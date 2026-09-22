/**
 * A short synthesised blip for the vibe button.
 *
 * Synthesised rather than shipped as an audio file: it keeps the bundle free of
 * a media asset and there is nothing to fetch on first press. The context is
 * created lazily on the first real click, so nothing is constructed during page
 * load and autoplay policies are never in play.
 */
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

export function playVibeSound(vibed: boolean) {
  // Anyone who has asked for less motion generally wants less of this too.
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  try {
    const audio = getContext();
    if (!audio) return;
    // Safari suspends the context until a gesture resumes it.
    if (audio.state === "suspended") void audio.resume();

    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = "sine";
    // Rising blip on vibe, falling on un-vibe, so the two are distinguishable
    // without looking.
    osc.frequency.setValueAtTime(vibed ? 520 : 400, now);
    osc.frequency.exponentialRampToValueAtTime(vibed ? 880 : 260, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    // Audio is a flourish; never let it break the vote.
  }
}
