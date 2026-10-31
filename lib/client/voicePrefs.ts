"use client";

import { useSyncExternalStore } from "react";

// Preferências de áudio deste navegador: volume e silêncio por pessoa, volume do soundboard
// e posição da janela da chamada. Valem só aqui, ninguém mais vê.

export type PersonPrefs = { volume: number; muted: boolean; screenVolume: number };
export type WindowPos = { x: number; y: number };
export type VoicePrefs = {
  people: Record<string, Partial<PersonPrefs>>;
  soundboardVolume: number;
  windowPos: WindowPos | null;
};

const KEY = "concord:voice-prefs";
const DEFAULTS: VoicePrefs = { people: {}, soundboardVolume: 0.8, windowPos: null };

let current: VoicePrefs | null = null;
const listeners = new Set<() => void>();

function read(): VoicePrefs {
  if (current) return current;
  try {
    current = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    current = DEFAULTS;
  }
  return current as VoicePrefs;
}

function write(next: VoicePrefs) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useVoicePrefs() {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}

export function personPrefs(prefs: VoicePrefs, identity: string): PersonPrefs {
  return { volume: 1, muted: false, screenVolume: 1, ...prefs.people[identity] };
}

export function setPersonPrefs(identity: string, patch: Partial<PersonPrefs>) {
  const prefs = read();
  write({ ...prefs, people: { ...prefs.people, [identity]: { ...prefs.people[identity], ...patch } } });
}

export function setSoundboardVolume(soundboardVolume: number) {
  write({ ...read(), soundboardVolume });
}

export function setWindowPos(windowPos: WindowPos) {
  write({ ...read(), windowPos });
}
