/**
 * useLiveCompatSync — runs on every app open.
 *
 * Fetches live EOL dates from endoflife.date for every compatibility rule
 * that has an EOL_RULE_SLUGS entry. Results go into store.liveCompatData
 * and are used by CompatWarning to show "Live confirmed" or "Support extended"
 * badges instead of relying purely on hardcoded dates.
 *
 * Platform incompatibility rules (SQL Server on AIX, SAP HANA on AIX, etc.)
 * have no machine-readable vendor PAM API — they remain statically authoritative.
 *
 * API calls are grouped by product slug to minimise requests (one fetch per
 * product, not per rule). Failures are silent — static rules remain in force.
 */

import { useEffect } from 'react';
import { useStore } from '../store/useStore.js';
import { fetchProductCycles, cycleLiveStatus } from './eolApi.js';
import { EOL_RULE_SLUGS } from './compatibilityRules.js';

export function useLiveCompatSync() {
  const setLiveCompatData    = useStore(s => s.setLiveCompatData);
  const setLiveCompatVerifiedAt = useStore(s => s.setLiveCompatVerifiedAt);

  useEffect(() => {
    const verifiedAt = new Date().toISOString();
    setLiveCompatVerifiedAt(verifiedAt);

    // Group rule IDs by slug — one fetch per product, multiple rules per product
    const bySlug = {};
    for (const [ruleId, { slug, cycle }] of Object.entries(EOL_RULE_SLUGS)) {
      if (!bySlug[slug]) bySlug[slug] = [];
      bySlug[slug].push({ ruleId, cycle });
    }

    for (const [slug, rules] of Object.entries(bySlug)) {
      fetchProductCycles(slug)
        .then(cycles => {
          for (const { ruleId, cycle } of rules) {
            // Match exact cycle string; fall back to prefix match (e.g. '12' matches '12.2')
            const match =
              cycles.find(c => String(c.cycle) === String(cycle)) ||
              cycles.find(c => String(c.cycle).startsWith(String(cycle)));
            if (!match) return;

            const liveStatus = cycleLiveStatus(match);

            setLiveCompatData(ruleId, {
              eolDate:     match.eol   === true ? 'EOL'   : match.eol   === false ? null : match.eol,
              supportDate: match.support === true ? null  : match.support === false ? 'EOS' : match.support,
              latest:      match.latest || null,
              status:      liveStatus.status,   // 'eol' | 'eos' | 'eos_soon' | 'active' | 'unknown'
              label:       liveStatus.label,
              color:       liveStatus.color,
              verifiedAt,
            });
          }
        })
        .catch(() => {
          // Network failure or slug not found — static rule detail remains shown as-is.
          // No update to store — CompatWarning will not show a live badge for this rule.
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once per mount = once per app open
}
