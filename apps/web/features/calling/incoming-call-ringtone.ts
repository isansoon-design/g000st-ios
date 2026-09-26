"use client";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ??= new AudioContextConstructor();
  return audioContext;
}

export function listenForRingtoneUnlock(): () => void {
  const unlock = () => {
    const context = getAudioContext();
    if (context?.state === "suspended") void context.resume().catch(() => undefined);
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

export function startIncomingCallRingtone(): () => void {
  const context = getAudioContext();
  if (!context) return () => undefined;

  let stopped = false;
  let interval: number | undefined;
  const activeTones = new Set<OscillatorNode>();

  const ring = () => {
    if (stopped || context.state !== "running") return;

    const start = context.currentTime + 0.02;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.055, start + 0.03);
    gain.gain.setValueAtTime(0.055, start + 0.28);
    gain.gain.linearRampToValueAtTime(0.0001, start + 0.36);
    gain.gain.setValueAtTime(0.0001, start + 0.43);
    gain.gain.linearRampToValueAtTime(0.055, start + 0.46);
    gain.gain.setValueAtTime(0.055, start + 0.71);
    gain.gain.linearRampToValueAtTime(0.0001, start + 0.81);
    gain.connect(context.destination);

    const tone = context.createOscillator();
    tone.type = "sine";
    tone.frequency.setValueAtTime(660, start);
    tone.frequency.setValueAtTime(880, start + 0.43);
    tone.connect(gain);
    tone.onended = () => {
      activeTones.delete(tone);
      tone.disconnect();
      gain.disconnect();
    };
    activeTones.add(tone);
    tone.start(start);
    tone.stop(start + 0.83);
  };

  const begin = () => {
    if (stopped || interval !== undefined || context.state !== "running") return;
    ring();
    interval = window.setInterval(ring, 2_600);
  };

  const resume = () => {
    if (context.state === "running") begin();
    else void context.resume().then(begin).catch(() => undefined);
  };

  resume();
  window.addEventListener("pointerdown", resume, { passive: true });
  window.addEventListener("keydown", resume);

  return () => {
    stopped = true;
    if (interval !== undefined) window.clearInterval(interval);
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
    activeTones.forEach((tone) => {
      try {
        tone.stop();
      } catch {
        // The short tone may have already ended.
      }
    });
  };
}
