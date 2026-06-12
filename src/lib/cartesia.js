// Cartesia Sonic-2 TTS client.
// All API calls proxy through the Cloudflare Worker to keep the API key out of the browser.
// Works in text-only mode (word-count timing) when CARTESIA_CONFIGURED is false.

export const VOICE_IDS = {
  guide:   'b7d50908-b17c-442d-ad8d-810c63997ed9', // warm female
  learner: '694f9389-aac1-45b6-b726-9d9369183238', // clear male
};

export const CARTESIA_WORKER_URL = 'https://opsmanifest-ai.sriram-c76-254.workers.dev';
export const CARTESIA_CONFIGURED = true;

// Fetch audio for a single line. Returns an HTMLAudioElement or null (text mode).
async function fetchAudio(line) {
  if (!CARTESIA_CONFIGURED) return null;

  const res = await fetch(`${CARTESIA_WORKER_URL}/cartesia-tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text:    line.text,
      voiceId: VOICE_IDS[line.voice] || VOICE_IDS.guide,
      speed:   line.speed   || 'normal',
      emotion: line.emotion || [],
    }),
  });

  if (!res.ok) throw new Error(`Cartesia TTS ${res.status}`);

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  return new Audio(url);
}

// Text-mode wait: ~130 wpm average reading pace, minimum 1.8 s.
function textWait(text, signal) {
  const ms = Math.max(1800, (text.split(/\s+/).length / 130) * 60_000);
  return new Promise(resolve => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

function pause(ms, signal) {
  if (!ms) return Promise.resolve();
  return new Promise(resolve => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

// Play a full script sequentially.
//
//   onLineStart(index, line) — called before speaking each line
//   onLineEnd(index, line)   — called after audio completes
//   signal                   — AbortSignal; stops cleanly mid-script
//
// Pauses between lines are guaranteed by a timer (line.pauseAfter ms),
// not left to TTS punctuation or silence detection.
export async function speakScript(lines, { onLineStart, onLineEnd, signal } = {}) {
  for (let i = 0; i < lines.length; i++) {
    if (signal?.aborted) break;

    const line = lines[i];
    onLineStart?.(i, line);

    try {
      const audio = await fetchAudio(line);

      if (audio) {
        await new Promise((resolve, reject) => {
          audio.addEventListener('ended', resolve, { once: true });
          audio.addEventListener('error', e => reject(e), { once: true });
          signal?.addEventListener('abort', () => { audio.pause(); resolve(); }, { once: true });
          audio.play().catch(reject);
        });
      } else {
        // Text-only fallback
        await textWait(line.text, signal);
      }
    } catch {
      // Non-fatal: skip line on fetch/play error and continue
    }

    onLineEnd?.(i, line);

    // Explicit inter-segment breath — guaranteed by a timer, not TTS punctuation
    if (line.pauseAfter > 0) {
      await pause(line.pauseAfter, signal);
    }
  }
}
