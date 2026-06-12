// Cartesia Sonic-2 TTS client.
// All API calls proxy through the Cloudflare Worker to keep the API key out of the browser.
// Works in text-only mode (word-count timing) when CARTESIA_CONFIGURED is false.

export const VOICE_IDS = {
  guide:   'b7d50908-b17c-442d-ad8d-810c63997ed9', // warm female
  learner: '694f9389-aac1-45b6-b726-9d9369183238', // clear male
};

export const CARTESIA_WORKER_URL = 'https://opsmanifest-ai.sriram-c76-254.workers.dev';
export const CARTESIA_CONFIGURED = true;

// Fetch audio for a single line. Returns an HTMLAudioElement or null.
async function fetchAudio(line) {
  if (!CARTESIA_CONFIGURED) return null;
  try {
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
    if (!res.ok) return null; // fall through to Web Speech
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    return new Audio(url);
  } catch {
    return null; // network error — fall through to Web Speech
  }
}

// Web Speech API fallback — works in all modern browsers, no API key needed.
function speakWebSpeech(text, signal) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return Promise.resolve();
  // Cancel any lingering utterance from a previous call
  speechSynthesis.cancel();
  return new Promise(resolve => {
    const utt    = new SpeechSynthesisUtterance(text);
    utt.rate     = 0.9;
    utt.pitch    = 1.05;
    utt.volume   = 1;
    utt.lang     = 'en-US';
    utt.onend    = resolve;
    utt.onerror  = resolve;
    signal?.addEventListener('abort', () => { speechSynthesis.cancel(); resolve(); }, { once: true });
    // Chrome bug: speechSynthesis stops if page is not in focus; resume if needed
    const keepAlive = setInterval(() => {
      if (speechSynthesis.paused) speechSynthesis.resume();
    }, 5000);
    utt.onend   = () => { clearInterval(keepAlive); resolve(); };
    utt.onerror = () => { clearInterval(keepAlive); resolve(); };
    speechSynthesis.speak(utt);
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

    const audio = await fetchAudio(line);

    if (audio) {
      await new Promise((resolve, reject) => {
        audio.addEventListener('ended', resolve, { once: true });
        audio.addEventListener('error', resolve, { once: true }); // non-fatal
        signal?.addEventListener('abort', () => { audio.pause(); resolve(); }, { once: true });
        audio.play().catch(resolve); // autoplay block → fall through silently
      });
    } else {
      // Web Speech API fallback (built into every modern browser)
      await speakWebSpeech(line.text, signal);
    }

    onLineEnd?.(i, line);

    // Explicit inter-segment breath — guaranteed by a timer, not TTS punctuation
    if (line.pauseAfter > 0) {
      await pause(line.pauseAfter, signal);
    }
  }
}
