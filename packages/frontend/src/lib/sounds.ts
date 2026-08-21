/**
 * Synthesized notification sounds via Web Audio API.
 * Approximates the iPhone tri-tone and Outlook new-mail chime.
 */

function getAudioContext(): AudioContext | null {
  try {
    return new AudioContext();
  } catch {
    return null;
  }
}

/**
 * iPhone-style tri-tone notification:
 * Three short ascending sine tones (approx. 800 → 1000 → 1260 Hz).
 */
export function playIphoneNotification(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [
    { freq: 800, start: 0.0, duration: 0.12 },
    { freq: 1008, start: 0.13, duration: 0.12 },
    { freq: 1260, start: 0.26, duration: 0.18 },
  ];

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = note.freq;

    const t0 = ctx.currentTime + note.start;
    const t1 = t0 + note.duration;

    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.35, t0 + 0.015);
    gain.gain.setValueAtTime(0.35, t1 - 0.04);
    gain.gain.linearRampToValueAtTime(0, t1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t1);

    osc.onended = () => {
      gain.disconnect();
      osc.disconnect();
    };
  }

  // close context after last note finishes
  setTimeout(() => ctx.close(), 700);
}

/**
 * Outlook-style new-mail chime:
 * Two-note ascending ding (approx. 880 → 1100 Hz) with soft envelope.
 */
export function playOutlookMailSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [
    { freq: 880, start: 0.0, duration: 0.22 },
    { freq: 1100, start: 0.2, duration: 0.38 },
  ];

  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = note.freq;

    const t0 = ctx.currentTime + note.start;
    const t1 = t0 + note.duration;

    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.28, t0 + 0.02);
    gain.gain.setValueAtTime(0.28, t1 - 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, t1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t1);

    osc.onended = () => {
      gain.disconnect();
      osc.disconnect();
    };
  }

  setTimeout(() => ctx.close(), 900);
}
