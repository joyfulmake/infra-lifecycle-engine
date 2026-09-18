import { useState, useEffect, useCallback, useRef } from 'react';

const SLIDES = [
  {
    icon: '⚙',
    title: 'OpsManifest',
    body: 'One guided delivery workflow across 16 PM domains — infra, SAP, cloud migration, Healthcare, Salesforce, and more: design, risk, approval, and sign-off in one place. Works alongside ServiceNow / Jira, not a replacement for them.',
    step: 'Welcome',
    color: ['#0F1F35', '#1A2E4A'],
    accent: '#14B8A6',
  },
  {
    icon: '🖥',
    title: '1. Pick Your Domain, Build Your Stack',
    body: 'Choose the domain that matches your project — every field, catalog, and screen adapts to speak its language. Fill in your stack/scope and hit Build. An instant AI scan checks it against live CVE and end-of-life data.',
    step: 'Navigate',
    color: ['#0F1F35', '#1E3A5F'],
    accent: '#3B82F6',
    hint: 'Opening screen → choose a domain → fill in your stack',
  },
  {
    icon: '📐',
    title: '2. Design & Schedule',
    body: 'Fill in your system design, then hit Generate Task Plan — tasks auto-schedule into a Gantt chart across your team, no spreadsheet needed.',
    step: 'Navigate',
    color: ['#0F1F35', '#1F1740'],
    accent: '#8B5CF6',
    hint: 'Tab: System Design → Generate Task Plan',
  },
  {
    icon: '🔗',
    title: '3. Track Risk',
    body: 'Add incidents and changes in Phase 2. The Dependency Graph tab links every task to its real risks automatically, so nothing falls through the cracks.',
    step: 'Navigate',
    color: ['#0F1F35', '#2A1010'],
    accent: '#EF4444',
    hint: 'Sidebar → Phase 2 · Tab: Dependency Graph',
  },
  {
    icon: '✅',
    title: '4. Approve & Close',
    body: 'Submit to CAB, sign off the RTM, then close out. Export a full Excel workbook for your audit trail — done in one flow, start to finish.',
    step: 'Navigate',
    color: ['#0F1F35', '#0D2217'],
    accent: '#22C55E',
    hint: 'Sidebar → CAB Gate · Tab: RTM · Tab: Closure',
  },
  {
    icon: '🏆',
    title: 'Built to Outclass Enterprise PPM',
    body: 'Six things ServiceNow, Clarity, Planview, Jira Align, and MS Project don’t do out of the box:',
    step: 'Why OpsManifest',
    color: ['#0F1F35', '#1A0F2E'],
    accent: '#F59E0B',
    bullets: [
      'Live CVE/EOL scan gates your design — before you build, not after',
      'Built-in AI advisor grounded in your actual build, not a generic chatbot',
      'Every task auto-links to its real risks, with live schedule & cost health',
      'CAB approval and RTM sign-off are native, not a workflow you configure',
      'Country + industry auto-surface the compliance obligations that apply',
      'Zero per-seat license — deployed free, no six-figure PPM contract',
    ],
  },
];

export default function DemoTour() {
  const [visible, setVisible]           = useState(false);
  const [idx, setIdx]                   = useState(0);
  const [opacity, setOpacity]           = useState(1);
  const [translateY, setTranslateY]     = useState(0);
  const autoTimerRef = useRef(null);
  const transRef     = useRef(false);

  // Show once per session (sessionStorage gate — resets when browser tab closes)
  useEffect(() => {
    if (sessionStorage.getItem('opsmanifest_tour_seen')) return;
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  const dismiss = useCallback(() => {
    sessionStorage.setItem('opsmanifest_tour_seen', '1');
    setOpacity(0);
    setTranslateY(12);
    setTimeout(() => {
      setVisible(false);
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
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.65)', fontVariantNumeric: 'tabular-nums' }}>
            {idx + 1} / {SLIDES.length}
          </span>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px 8px' }}>
          <div style={{ fontSize: 42, marginBottom: 12, lineHeight: 1, userSelect: 'none' }}>{slide.icon}</div>
          <div style={{
            display: 'inline-block', fontSize: 11.5, fontWeight: 700,
            letterSpacing: '0.10em', textTransform: 'uppercase',
            color: slide.accent, marginBottom: 10,
          }}>
            {slide.step}
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#F8FAFC', lineHeight: 1.3, marginBottom: 13 }}>
            {slide.title}
          </div>
          <p style={{ fontSize: 14, color: 'rgba(241,245,249,0.92)', lineHeight: 1.72, marginBottom: slide.bullets ? 10 : 13 }}>
            {slide.body}
          </p>
          {slide.bullets && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginBottom: 13 }}>
              {slide.bullets.map((b, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 8, fontSize: 13.5, lineHeight: 1.5, color: 'rgba(241,245,249,0.92)' }}>
                  <span style={{
                    flexShrink: 0, width: 18, height: 18, borderRadius: 5, marginTop: 1,
                    background: slide.accent, color: '#0F1F35', fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</span>
                  {b}
                </li>
              ))}
            </ul>
          )}
          {slide.hint && (
            <div style={{
              fontSize: 12.5, color: 'rgba(255,255,255,0.80)',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: 8, padding: '8px 14px',
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
                fontSize: 13, color: 'rgba(255,255,255,0.85)',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8, padding: '7px 16px', cursor: 'pointer',
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
              fontSize: 13, color: 'rgba(255,255,255,0.65)',
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
                fontSize: 14, fontWeight: 700,
                background: slide.accent, color: '#fff',
                border: 'none', borderRadius: 8,
                padding: '8px 22px', cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
            >
              Start using it →
            </button>
          ) : (
            <button
              onClick={() => go(1)}
              style={{
                fontSize: 14, fontWeight: 700,
                background: 'rgba(255,255,255,0.12)',
                color: '#fff', border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
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
