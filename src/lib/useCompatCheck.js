/**
 * useCompatCheck — React hook for inline compatibility checking.
 *
 * Debounces calls to checkCompatibilityForText() so every keystroke
 * does not rerun the rule engine. Returns { hits, clear }.
 *
 * Usage:
 *   const { hits, clear } = useCompatCheck(text, ctx, 400);
 *   // hits: array of matching COMPAT_RULES entries (full objects)
 *   // clear: function to reset hits (call after user overrides or form resets)
 */

import { useState, useEffect, useRef } from 'react';
import { checkCompatibility, checkCompatibilityForText } from './compatibilityRules.js';

export function useCompatCheck(text, ctx, delayMs = 400) {
  const [hits, setHits] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!text || text.trim().length < 4) { setHits([]); return; }
    timer.current = setTimeout(() => {
      // Merge text-scan hits with current ctx hits (avoid duplicates by id)
      const textHits = checkCompatibilityForText(text, ctx || {});
      const ctxHits  = checkCompatibility(ctx || {});
      const seen = new Set();
      const merged = [];
      for (const r of [...textHits, ...ctxHits]) {
        if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
      }
      setHits(merged);
    }, delayMs);
    return () => clearTimeout(timer.current);
  }, [text, ctx?.hw, ctx?.os, ctx?.db, ctx?.app, delayMs]);

  function clear() { setHits([]); }
  return { hits, clear };
}
