import { useState, useEffect, useCallback } from 'react';

const TOUR_KEY = 'opsmanifest_tour_v2';

const SLIDES = [
  {
    icon: '⚙',
    title: 'OpsManifest — Enterprise Infra Lifecycle',
    body: 'Structured pre-work for server provisioning, CAB approval, RTM sign-off, and project closure. Works alongside ServiceNow / Jira — not a replacement.',
    step: 'Welcome',
    color: 'from-slate-800 to-slate-900',
    accent: 'bg-teal-500',
  },
  {
    icon: '🖥',
    title: 'Phase 1: Build Your Stack',
    body: 'Select hardware, OS, database, and application tier. Hit Build — the AI Smart Scan instantly checks your stack against live CVE and EOL data and pre-selects relevant incidents.',
    step: 'Phase 1',
    color: 'from-blue-900 to-slate-900',
    accent: 'bg-blue-500',
    hint: 'Sidebar → Hardware / OS / DB / App selectors',
  },
  {
    icon: '🔍',
    title: 'System Design — 8 Sections',
    body: 'Fill in Network, Storage, Security, Backup, Compliance, Monitoring, DR, and HA details. Hit "Generate Task Plan" — tasks auto-schedule into the Gantt chart.',
    step: 'Design',
    color: 'from-indigo-900 to-slate-900',
    accent: 'bg-indigo-500',
    hint: 'Tab: System Design → Generate Task Plan',
  },
  {
    icon: '⚠',
    title: 'Phase 2: Inject Incidents + UUM',
    body: 'Select incidents (outages, CVEs, compliance gaps) and UUM items (Unix/User/Middleware upgrades, DB migrations, security patches). Add custom entries for any project-specific operations. Inject to build.',
    step: 'Phase 2',
    color: 'from-red-900 to-slate-900',
    accent: 'bg-red-500',
    hint: 'Sidebar → Phase 2 — Incidents + UUM → Inject',
  },
  {
    icon: '📊',
    title: 'Gantt + Cross-Stack Matrix',
    body: 'Automated task scheduling with Critical Path Method (CPM), 7-point FSM state tracking, float calculation, and a cross-stack dependency matrix across 8 swimlane layers. Groq AI can deepen any task.',
    step: 'Gantt',
    color: 'from-emerald-900 to-slate-900',
    accent: 'bg-emerald-500',
    hint: 'Tabs: Gantt | Matrix',
  },
  {
    icon: '✅',
    title: 'CAB Gate → RTM → Closure',
    body: 'Submit to CAB, sign the RTM row-by-row, then complete the closure checklist. Export a 13-sheet styled Excel workbook for governance and audit trail.',
    step: 'Closure',
    color: 'from-violet-900 to-slate-900',
    accent: 'bg-violet-500',
    hint: 'Sidebar → CAB Gate | Tab: RTM | Tab: Closure',
  },
];

const DOT_COLORS = ['bg-teal-400', 'bg-blue-400', 'bg-indigo-400', 'bg-red-400', 'bg-emerald-400', 'bg-violet-400'];

export default function DemoTour() {
  const [visible, setVisible] = useState(false);
  const [idx, setIdx] = useState(0);
  const [animDir, setAnimDir] = useState('right'); // 'right' | 'left'
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(TOUR_KEY);
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(TOUR_KEY, '1');
    setVisible(false);
  }, []);

  const go = useCallback((dir) => {
    if (transitioning) return;
    const next = idx + dir;
    if (next < 0 || next >= SLIDES.length) return;
    setAnimDir(dir > 0 ? 'right' : 'left');
    setTransitioning(true);
    setTimeout(() => {
      setIdx(next);
      setTransitioning(false);
    }, 200);
  }, [idx, transitioning]);

  const goTo = useCallback((i) => {
    if (transitioning || i === idx) return;
    setAnimDir(i > idx ? 'right' : 'left');
    setTransitioning(true);
    setTimeout(() => {
      setIdx(i);
      setTransitioning(false);
    }, 200);
  }, [idx, transitioning]);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => {
      setIdx(prev => {
        if (prev >= SLIDES.length - 1) return prev;
        setAnimDir('right');
        setTransitioning(true);
        setTimeout(() => setTransitioning(false), 200);
        return prev + 1;
      });
    }, 4500);
    return () => clearInterval(t);
  }, [visible]);

  if (!visible) return null;

  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      onClick={dismiss}
    >
      <div
        className={['relative w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br', slide.color].join(' ')}
        style={{ transition: 'background 0.4s ease' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-1 bg-white/10">
          <div
            className={['h-full transition-all duration-500 ease-out', slide.accent].join(' ')}
            style={{ width: `${((idx + 1) / SLIDES.length) * 100}%` }}
          />
        </div>

        {/* Step pills */}
        <div className="flex items-center gap-1.5 px-6 pt-4 pb-0">
          {SLIDES.map((s, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={['h-1.5 rounded-full transition-all duration-300', i === idx ? `w-6 ${DOT_COLORS[i]}` : 'w-1.5 bg-white/25 hover:bg-white/50'].join(' ')}
            />
          ))}
          <span className="ml-auto text-xs text-white/50 font-mono">{idx + 1}/{SLIDES.length}</span>
        </div>

        {/* Slide content */}
        <div
          className="px-6 py-6"
          style={{
            opacity: transitioning ? 0 : 1,
            transform: transitioning ? `translateX(${animDir === 'right' ? '20px' : '-20px'})` : 'translateX(0)',
            transition: 'opacity 0.2s, transform 0.2s',
          }}
        >
          <div className="text-5xl mb-4 select-none">{slide.icon}</div>
          <div className={['inline-block text-xs font-bold uppercase tracking-widest rounded-full px-2.5 py-0.5 mb-3 text-white', slide.accent].join(' ')}>
            {slide.step}
          </div>
          <h2 className="text-xl font-bold text-white mb-3 leading-tight">{slide.title}</h2>
          <p className="text-sm text-white/75 leading-relaxed mb-4">{slide.body}</p>
          {slide.hint && (
            <div className="text-xs text-white/50 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
              {slide.hint}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 px-6 pb-5">
          {idx > 0 && (
            <button
              onClick={() => go(-1)}
              className="text-xs text-white/60 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/20 hover:border-white/40"
            >
              ← Back
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={dismiss}
            className="text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            Skip tour
          </button>
          {isLast ? (
            <button
              onClick={dismiss}
              className="text-sm font-semibold bg-teal-500 hover:bg-teal-400 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              Start using it →
            </button>
          ) : (
            <button
              onClick={() => go(1)}
              className="text-sm font-semibold bg-white/15 hover:bg-white/25 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
