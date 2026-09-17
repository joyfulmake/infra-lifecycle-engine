import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore.js';
import { TABS } from './PmTabs.jsx';
import { DOMAINS } from '../domains/registry.js';

// Cmd/Ctrl+K power-user launcher — tab navigation, domain switching, and a
// few universal actions. Deliberately scoped to things that are pure store
// state (safe to trigger from anywhere) rather than wiring every PhasePanel
// action (Run Scan, Generate Task Plan, etc.) which live behind modal/local
// UI state — those stay a follow-up once this proves useful.

function buildCommands(s) {
  const cmds = [];

  TABS.filter(tab => !tab.hidden || !tab.hidden(s)).forEach(tab => {
    const unlocked = s.unlockedForRevision || tab.unlocked(s);
    cmds.push({
      id: `tab-${tab.id}`,
      group: 'Navigate',
      label: `Go to ${tab.label}`,
      meta: unlocked ? '' : 'Locked',
      disabled: !unlocked,
      run: () => s.setActiveTab(tab.id),
    });
  });

  if (!s.isBuilt) {
    DOMAINS.forEach(d => {
      if (d.id === s.activeDomain) return;
      cmds.push({
        id: `domain-${d.id}`,
        group: 'Switch Domain',
        label: `${d.icon} ${d.label}`,
        meta: d.category,
        run: () => {
          if (s.isDirty && !window.confirm(`Switch to ${d.label}? This clears the current in-progress build.`)) return;
          s.setActiveDomain(d.id);
        },
      });
    });
  }

  cmds.push({
    id: 'action-theme',
    group: 'Actions',
    label: s.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
    run: () => s.toggleTheme(),
  });
  cmds.push({
    id: 'action-opsmentor',
    group: 'Actions',
    label: 'Open OpsMentor',
    run: () => window.dispatchEvent(new CustomEvent('opsmanifest-orchestrator-open')),
  });

  return cmds;
}

function fuzzyMatch(query, text) {
  if (!query) return true;
  const q = query.toLowerCase();
  return text.toLowerCase().includes(q);
}

export default function CommandPalette() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);

  const close = useCallback(() => { setOpen(false); setQuery(''); setActiveIdx(0); }, []);

  useEffect(() => {
    function onKeyDown(e) {
      const isK = e.key === 'k' || e.key === 'K';
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape' && open) {
        close();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    const onExternalOpen = () => setOpen(true);
    window.addEventListener('opsmanifest-palette-open', onExternalOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('opsmanifest-palette-open', onExternalOpen);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  const commands = useMemo(() => buildCommands(s), [s]);
  const filtered = useMemo(() => {
    const grouped = {};
    commands.filter(c => fuzzyMatch(query, c.label)).forEach(c => {
      (grouped[c.group] ||= []).push(c);
    });
    return grouped;
  }, [commands, query]);

  const flatList = useMemo(() => Object.values(filtered).flat(), [filtered]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  function runCommand(cmd) {
    if (cmd.disabled) return;
    cmd.run();
    close();
  }

  function onInputKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flatList.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const cmd = flatList[activeIdx]; if (cmd) runCommand(cmd); }
  }

  if (!open) return null;

  let runningIdx = -1;

  return (
    <div className="cmdk-overlay" onClick={close}>
      <div className="cmdk-panel" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmdk-input"
          placeholder="Jump to a tab, switch domain, or run an action…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
        />
        <div className="cmdk-list">
          {flatList.length === 0 && (
            <div className="text-xs text-slate-400 px-3 py-4 text-center">No matches</div>
          )}
          {Object.entries(filtered).map(([group, cmds]) => (
            <div key={group}>
              <div className="cmdk-group-label">{group}</div>
              {cmds.map(cmd => {
                runningIdx += 1;
                const isActive = runningIdx === activeIdx;
                return (
                  <div
                    key={cmd.id}
                    className={`cmdk-item ${isActive ? 'active' : ''} ${cmd.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    onMouseEnter={() => setActiveIdx(runningIdx)}
                    onClick={() => runCommand(cmd)}
                  >
                    <span>{cmd.label}</span>
                    {cmd.meta && <span className="cmdk-item-meta">{cmd.meta}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
