import { useState, useEffect, useCallback, useRef } from 'react';

const TOUR_KEY = 'opsmanifest_tour_v4';

const SLIDES = [
  {
    icon: '⚙',
    title: 'OpsManifest — Enterprise Infra Lifecycle',
    body: 'Structured pre-work for server provisioning, CAB approval, RTM sign-off, and project closure. Works alongside ServiceNow / Jira — not a replacement.',
    step: 'Welcome',
    color: ['#0F1F35', '#1A2E4A'],
    accent: '#14B8A6',
  },
  {
    icon: '🖥',
    title: 'Phase 1: Build Your Stack',
    body: 'Select hardware, OS, database, and application tier. Hit Build — the AI Smart Scan instantly checks your stack against live CVE and EOL data and pre-selects relevant incidents.',
    step: 'Phase 1',
    color: ['#0F1F35', '#1E3A5F'],
    accent: '#3B82F6',
    hint: 'Sidebar → Hardware / OS / DB / App selectors',
  },
  {
    icon: '🔍',
    title: 'System Design — 8 Sections',
    body: 'Fill Network, Storage, Security, Backup, Compliance, Monitoring, DR, and HA details. Hit "Generate Task Plan" — tasks auto-schedule into the Gantt chart across your team.',
    step: 'Design',
    color: ['#0F1F35', '#1F1740'],
    accent: '#8B5CF6',
    hint: 'Tab: System Design → Generate Task Plan',
  },
  {
    icon: '⚠',
    title: 'Phase 2: Incidents + UUM Changes',
    body: 'Select incidents (outages, CVEs, compliance gaps) and UUM items (upgrades, migrations, patches). Type freely — the engine auto-detects layers, type, severity, and maps them to Gantt, RTM, and Matrix.',
    step: 'Phase 2',
    color: ['#0F1F35', '#2A1010'],
    accent: '#EF4444',
    hint: 'Sidebar → Phase 2 → Inject',
  },
  {
    icon: '🗺',
    title: 'Infra Maps & Mission Intelligence',
    body: 'Three views on the Diagram tab: Visual topology, ASCII Map (copy-paste into any doc or ticket), and Mission Intel — a 4-section delivery analysis with triple-layer architecture (Business / Functional / Technical), live compatibility matrix, and Groq AI-powered deep analysis.',
    step: 'Diagram',
    color: ['#0F1F35', '#0D2A2A'],
    accent: '#0D9488',
    hint: 'Tab: Infra Diagram → ASCII Map | Mission Intel',
  },
  {
    icon: '📊',
    title: 'Gantt + Cross-Stack Matrix',
    body: 'Automated task scheduling with Critical Path Method, 7-point FSM state tracking, float calculation, and a cross-stack dependency matrix across 8 swimlane layers. Groq AI deepens any task on demand.',
    step: 'Gantt',
    color: ['#0F1F35', '#0D2217'],
    accent: '#22C55E',
    hint: 'Tabs: Gantt | Matrix',
  },
  {
    icon: '✅',
    title: 'CAB Gate → RTM → Closure',
    body: 'Submit to CAB, sign the RTM row-by-row, then complete the closure checklist. Export a 13-sheet styled Excel workbook for governance and audit trail. Cloud sync keeps your team in step.',
    step: 'Closure',
    color: ['#0F1F35', '#1A0F2E'],
    accent: '#8B5CF6',
    hint: 'Sidebar → CAB Gate | Tab: RTM | Tab: Closure',
  },
];

export default function DemoTour() {
  const [visible, setVisible]           = useState(false);
  const [idx, setIdx]                   = useState(0);
  const [opacity, setOpacity]           = useState(1);
  const [translateY, setTranslateY]     = useState(0);
  const autoTimerRef = useRef(null);
  const transRef     = useRef(false);

  useEffect(() => {
    const seen = localStorage.getItem(TOUR_KEY);
    if (!seen) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = useCallback(() => {
    setOpacity(0);
    setTranslateY(12);
    setTimeout(() => {
      localStorage.setItem(TOUR_KEY, '1');
      setVisible(false);
      // Signal orchestrator to auto-open and greet the user
      window.dispatchEvent(new CustomEvent('opsmanifest-tour-dismissed'));
    }, 300);
  }, []);

  const go = useCallback((dir) => {
    if (transRef.current) return;
    const next = idx + dir;
    if (next < 0 || next >= SLIDES.length) return;
    transRef.current = true;
    setOpacity(0);
    setTranslateY(dir > 0 ? -8 : 8);
    setTimeout(() => {
      setIdx(next);
      setTranslateY(dir > 0 ? 8 : -8);
      setTimeout(() => {
        setOpacity(1);
        setTranslateY(0);
        transRef.current = false;
      }, 60);
    }, 200);
  }, [idx]);

  const goTo = useCallback((i) => {
    if (transRef.current || i === idx) return;
    go(i > idx ? 1 : -1);
  }, [idx, go]);

  // Auto-advance every 5.5s, pauses on last slide
  useEffect(() => {
    if (!visible) return;
    clearTimeout(autoTimerRef.current);
    if (idx < SLIDES.length - 1) {
      autoTimerRef.current = setTimeout(() => go(1), 5500);
    }
    return () => clearTimeout(autoTimerRef.current);
  }, [visible, idx, go]);

  if (!visible) return null;

  const slide   = SLIDES[idx];
  const isLast  = idx === SLIDES.length - 1;
  const bg      = `linear-gradient(160deg, ${slide.color[0]} 0%, ${slide.color[1]} 100%)`;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(5, 12, 24, 0.65)', backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        transition: 'background 0.4s',
      }}
      onClick={dismiss}
    >
      <div
        style={{
          position: 'relative', width: '100%', maxWidth: 460,
          margin: '0 16px', borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07)',
          background: bg,
          opacity,
          transform: `translateY(${translateY}px)`,
          transition: 'opacity 0.2s ease, transform 0.2s ease, background 0.5s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Thin progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{
            height: '100%', background: slide.accent,
            width: `${((idx + 1) / SLIDES.length) * 100}%`,
            transition: 'width 0.5s ease, background 0.4s ease',
          }} />
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 20px 0' }}>
          {SLIDES.map((s, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                height: 4, borderRadius: 2, border: 'none', cursor: 'pointer',
                width: i === idx ? 20 : 6,
                background: i === idx ? slide.accent : 'rgba(255,255,255,0.18)',
                transition: 'width 0.3s ease, background 0.3s ease',
                flexShrink: 0,
              }}
            />
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>
            {idx + 1} / {SLIDES.length}
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px 8px' }}>
          <div style={{ fontSize: 42, marginBottom: 12, lineHeight: 1, userSelect: 'none' }}>{slide.icon}</div>
          <div style={{
            display: 'inline-block', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: slide.accent, marginBottom: 10,
          }}>
            {slide.step}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.35, marginBottom: 12 }}>
            {slide.title}
          </div>
          <p style={{ fontSize: 13, color: 'rgba(241,245,249,0.72)', lineHeight: 1.7, marginBottom: 12 }}>
            {slide.body}
          </p>
          {slide.hint && (
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.45)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 8, padding: '7px 12px',
              marginBottom: 4,
            }}>
              {slide.hint}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 24px 20px' }}>
          {idx > 0 && (
            <button
              onClick={() => go(-1)}
              style={{
                fontSize: 12, color: 'rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={dismiss}
            style={{
              fontSize: 12, color: 'rgba(255,255,255,0.38)',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 8px',
            }}
          >
            Skip
          </button>
          {isLast ? (
            <button
              onClick={dismiss}
              style={{
                fontSize: 13, fontWeight: 600,
                background: slide.accent, color: '#fff',
                border: 'none', borderRadius: 8,
                padding: '7px 20px', cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
            >
              Start using it →
            </button>
          ) : (
            <button
              onClick={() => go(1)}
              style={{
                fontSize: 13, fontWeight: 600,
                background: 'rgba(255,255,255,0.1)',
                color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8, padding: '7px 18px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
