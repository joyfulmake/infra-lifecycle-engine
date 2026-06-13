// Pure risk aggregation engine — reads all state slices and produces a
// unified, severity-sorted risk list. No React, no side effects.

const SEV_SCORE = { CRITICAL: 4, HIGH: 2, MEDIUM: 1, LOW: 0 };

export function computeAllRisks(s) {
  const risks = [];

  // ── 1. Coherence alerts (warn severity) ─────────────────────────────────
  (s.coherenceAlerts || [])
    .filter(a => a.severity === 'warn')
    .forEach(a => risks.push({
      id:          `coherence-${a.id}`,
      source:      'coherence',
      severity:    'HIGH',
      title:       a.message,
      description: a.action || 'Review the relevant tab to resolve.',
      tab:         a.tabs?.[0] || 'exec',
      actionHint:  a.action || 'Open the flagged tab.',
    }));

  // ── 2. Custom RAID RISK entries ──────────────────────────────────────────
  (s.customRaidEntries || [])
    .filter(e => e.type === 'RISK' && e.status !== 'CLOSED')
    .forEach(e => {
      const sev = e.severity === 'CRITICAL' ? 'CRITICAL'
        : e.severity === 'HIGH' ? 'HIGH'
        : e.severity === 'MED' ? 'MEDIUM' : 'LOW';
      risks.push({
        id:          `raid-${e.id}`,
        source:      'raid',
        severity:    sev,
        title:       e.description || 'Undocumented risk',
        description: e.mitigation || 'No mitigation documented.',
        tab:         'raid',
        actionHint:  'Open RAID tab and add a mitigation plan.',
      });
    });

  // ── 3. Active vulnerabilities ────────────────────────────────────────────
  (s.vulnRegistry || [])
    .filter(v => v.status === 'ACTIVE')
    .forEach(v => risks.push({
      id:          `vuln-${v.id}`,
      source:      'vulnerability',
      severity:    v.severity || 'HIGH',
      title:       `EOL/CVE: ${v.title}`,
      description: v.description || v.title,
      tab:         'vuln',
      actionHint:  'Open Vulnerabilities tab → set status, add workaround or business decision.',
    }));

  // ── 4. Pending stakeholder discussions ──────────────────────────────────
  (s.stakeholderDiscussions || [])
    .filter(d => d.status === 'PENDING')
    .forEach(d => risks.push({
      id:          `disc-${d.id}`,
      source:      'stakeholder',
      severity:    'HIGH',
      title:       `Pending agreement: ${d.topic}`,
      description: d.question || 'Team/client agreement has not been recorded.',
      tab:         'vuln',
      actionHint:  `Get ${d.owner} to confirm and mark AGREED in the Vulnerabilities tab.`,
    }));

  // ── 5. System-state risks ────────────────────────────────────────────────
  if (s.rtmStale) risks.push({
    id:          'rtm-stale',
    source:      'system',
    severity:    'HIGH',
    title:       'RTM drifted after sign-off',
    description: 'Scope changed after RTM was signed. Cutover authorisation is at risk.',
    tab:         'rtm',
    actionHint:  'Review all RTM rows, address scope change, re-sign the RTM.',
  });

  if (s.tasksStaleReason) risks.push({
    id:          'tasks-stale',
    source:      'system',
    severity:    'MEDIUM',
    title:       'Gantt schedule is stale',
    description: s.tasksStaleReason,
    tab:         'gantt',
    actionHint:  'Open Gantt tab → Regenerate Tasks to sync the schedule.',
  });

  if (s.cabDeclined) risks.push({
    id:          'cab-declined',
    source:      'system',
    severity:    'CRITICAL',
    title:       'CAB rejected the change request',
    description: 'Change Advisory Board did not approve. Revision and resubmission required before any production change.',
    tab:         'exec',
    actionHint:  'Click "Unlock Tabs for Revision" in the sidebar to revise scope and resubmit to CAB.',
  });

  if (s.rtmSigned && s.promoted && s.rtmStale) risks.push({
    id:          'live-rtm-stale',
    source:      'system',
    severity:    'CRITICAL',
    title:       'Live system with stale RTM — rollback risk',
    description: 'System is promoted to live but the RTM has drifted. Unverified requirements increase rollback risk.',
    tab:         'rtm',
    actionHint:  'Assess rollback triggers in the Closure tab. Re-review RTM immediately.',
  });

  // ── 6. RTM FAIL rows ────────────────────────────────────────────────────
  const failCount = Object.values(s.rtmRows || {}).filter(v => v === 'FAIL' || v === 'BLOCKED').length;
  if (failCount > 0) risks.push({
    id:          'rtm-fails',
    source:      'rtm',
    severity:    failCount > 3 ? 'CRITICAL' : 'HIGH',
    title:       `${failCount} RTM row${failCount !== 1 ? 's' : ''} failing or blocked`,
    description: 'Failing RTM requirements block CAB approval and RTM sign-off.',
    tab:         'rtm',
    actionHint:  'Open RTM tab. For each FAIL row: resolve the issue, retest, then set to PASS.',
  });

  // ── 7. High incident density ─────────────────────────────────────────────
  const unfixedIncs = (s.selInc || []).filter(code => !(s.selFix || []).includes(code));
  if (unfixedIncs.length > 6) risks.push({
    id:          'incident-density',
    source:      'incident',
    severity:    unfixedIncs.length > 12 ? 'HIGH' : 'MEDIUM',
    title:       `${unfixedIncs.length} unresolved incidents in scope`,
    description: 'High incident count raises migration complexity, regression probability, and change window duration.',
    tab:         'exec',
    actionHint:  'Review incidents in Exec Summary. Descope out-of-scope items and fix critical incidents before CAB.',
  });

  // ── 8. No go-live date with CAB pending ──────────────────────────────────
  if (s.phase2Active && !s.requirements?.goLiveDate) risks.push({
    id:          'no-golive-date',
    source:      'schedule',
    severity:    'MEDIUM',
    title:       'No go-live date set',
    description: 'Change window and CAB submission require a target go-live date.',
    tab:         'exec',
    actionHint:  'Set the go-live date in the Phase 1 panel or via OpsMentor: "go-live date is YYYY-MM-DD".',
  });

  // ── 9. EOL components from live API ─────────────────────────────────────
  Object.entries(s.liveEolData || {}).forEach(([comp, data]) => {
    if (data?.error) return;
    const cycle = data?.matchedCycle;
    if (!cycle) return;
    const eol = cycle.eol;
    const eos = cycle.support || cycle.eol;
    const now = new Date();
    const eolDate = eol && eol !== true ? new Date(eol) : null;
    const eosDate = eos && eos !== true ? new Date(eos) : null;
    if (eol === true || (eolDate && eolDate < now)) {
      risks.push({
        id:          `live-eol-${comp}`,
        source:      'live-eol',
        severity:    'CRITICAL',
        title:       `${comp} is End-of-Life (API confirmed)`,
        description: `Live endoflife.date API confirms ${comp} is past EOL. Continuing exposes the system to unpatched CVEs.`,
        tab:         'cmdb',
        actionHint:  'Open CMDB tab to review lifecycle details. Plan migration to a supported version.',
      });
    } else if (eosDate && eosDate < now) {
      risks.push({
        id:          `live-eos-${comp}`,
        source:      'live-eol',
        severity:    'HIGH',
        title:       `${comp} past End of Standard Support`,
        description: `${comp} is in security-only support phase. Feature patches and bug fixes are no longer released.`,
        tab:         'cmdb',
        actionHint:  'Open CMDB tab. Evaluate upgrade timeline to avoid security-only window.',
      });
    }
  });

  // Sort: CRITICAL first, then HIGH, MEDIUM, LOW; within same severity by source
  return risks.sort((a, b) => (SEV_SCORE[b.severity] || 0) - (SEV_SCORE[a.severity] || 0));
}

export function riskScore(risks) {
  return risks.reduce((n, r) => n + (SEV_SCORE[r.severity] || 0), 0);
}

export function riskLabel(score) {
  if (score === 0)   return { label: 'Clear',    color: 'green'  };
  if (score <= 4)    return { label: 'Low',      color: 'teal'   };
  if (score <= 10)   return { label: 'Moderate', color: 'amber'  };
  if (score <= 18)   return { label: 'High',     color: 'orange' };
  return               { label: 'Critical', color: 'red'    };
}
