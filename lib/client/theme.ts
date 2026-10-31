"use client";

import { useSyncExternalStore, type CSSProperties } from "react";

// ---- cor de destaque do servidor ----

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const rgbOf = (color: number) => [(color >> 16) & 255, (color >> 8) & 255, color & 255];
const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hexOf = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

export const colorToHex = (color: number) => hexOf(rgbOf(color));
export const hexToColor = (hex: string) => parseInt(hex.replace("#", ""), 16);

const SHEET = [250, 247, 240];
const INK = [25, 23, 20];
const PAPER = [244, 239, 228];
const BLACK = [0, 0, 0];

// Qualquer cor pode ser escolhida, então o texto se adapta a ela: amarelo-claro em botão pede
// texto escuro, e como texto sobre o fundo a cor escurece (ou clareia) até ficar legível.
export function accentVars(color: number | null | undefined, black: boolean): CSSProperties | undefined {
  if (color == null) return undefined;
  const rgb = rgbOf(color);
  const surface = black ? BLACK : PAPER;
  const target = black ? [255, 255, 255] : BLACK;
  let readable = rgb;
  for (let t = 0.1; t <= 1 && contrast(readable, surface) < 4.5; t += 0.1) {
    readable = rgb.map((v, i) => v + (target[i] - v) * t);
  }
  const hex = hexOf(rgb);
  return {
    "--color-signal": hex,
    "--color-signal-ink": hexOf(readable),
    "--color-on-signal": contrast(SHEET, rgb) >= contrast(INK, rgb) ? hexOf(SHEET) : hexOf(INK),
    "--color-channel-active": `color-mix(in srgb, ${hex} 24%, var(--color-paper-3))`,
    "--color-mention": hex,
  } as CSSProperties;
}

// ---- fundo preto (preferência deste navegador) ----

const BLACK_KEY = "concord:black-background";
const listeners = new Set<() => void>();

function readBlack() {
  try {
    return localStorage.getItem(BLACK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setBlackBackground(on: boolean) {
  try {
    if (on) localStorage.setItem(BLACK_KEY, "1");
    else localStorage.removeItem(BLACK_KEY);
  } catch {}
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useBlackBackground() {
  return useSyncExternalStore(subscribe, readBlack, () => false);
}
