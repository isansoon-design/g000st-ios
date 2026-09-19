"use client";

let audioContext: AudioContext | null = null;
let isUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor =
    window.AudioContext ??
    (
      window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ??= new AudioContextConstructor();
  return audioContext;
}

async function unlockMessageSound(): Promise<void> {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") await context.resume();
  isUnlocked = context.state === "running";
}

export function listenForMessageSoundUnlock(): () => void {
  const unlock = () => {
    void unlockMessageSound();
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);

  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

export async function playIncomingMessageSound(): Promise<void> {
  if (!isUnlocked) return;
  const context = getAudioContext();
  if (!context || context.state !== "running") return;

  const startedAt = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, startedAt);
  gain.gain.exponentialRampToValueAtTime(0.12, startedAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.32);
  gain.connect(context.destination);

  const firstTone = context.createOscillator();
  firstTone.frequency.setValueAtTime(720, startedAt);
  firstTone.type = "sine";
  firstTone.connect(gain);
  firstTone.start(startedAt);
  firstTone.stop(startedAt + 0.13);

  const secondTone = context.createOscillator();
  secondTone.frequency.setValueAtTime(920, startedAt + 0.13);
  secondTone.type = "sine";
  secondTone.connect(gain);
  secondTone.start(startedAt + 0.13);
  secondTone.stop(startedAt + 0.32);
}
