"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import { LEGACY_BLACK_KEY, THEME_KEY } from "./themeBoot";

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

export type ThemeId = "beige" | "default" | "black";

export const THEMES: { id: ThemeId; name: string; hint: string }[] = [
  { id: "beige", name: "Tema Beige", hint: "Moderno e elegante" },
  { id: "default", name: "Tema Padrão", hint: "Visual limpo e familiar" },
  { id: "black", name: "Tema Preto", hint: "Sofisticado e imersivo" },
];

// a superfície principal de cada tema (--color-sheet), e para onde o texto caminha até ficar legível
const SURFACE: Record<ThemeId, { sheet: number[]; target: number[] }> = {
  beige: { sheet: [251, 246, 236], target: [0, 0, 0] },
  default: { sheet: [255, 253, 248], target: [0, 0, 0] },
  black: { sheet: [14, 16, 25], target: [255, 255, 255] },
};

// Qualquer cor pode ser escolhida, então o texto se adapta a ela: amarelo-claro em botão pede
// texto escuro, e como texto sobre o fundo a cor escurece (ou clareia) até ficar legível.
export function accentVars(color: number | null | undefined, theme: ThemeId): CSSProperties | undefined {
  if (color == null) return undefined;
  const rgb = rgbOf(color);
  const { sheet, target } = SURFACE[theme];
  let readable = rgb;
  for (let t = 0.1; t <= 1 && contrast(readable, sheet) < 4.5; t += 0.1) {
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

// ---- tema (preferência deste navegador) ----

const listeners = new Set<() => void>();

function readTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "beige" || saved === "default" || saved === "black") return saved;
    // quem tinha ligado o antigo "fundo preto" continua no escuro
    return localStorage.getItem(LEGACY_BLACK_KEY) === "1" ? "black" : "default";
  } catch {
    return "default";
  }
}

export function setTheme(theme: ThemeId) {
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.removeItem(LEGACY_BLACK_KEY);
  } catch {}
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}

export function useTheme() {
  return useSyncExternalStore(subscribe, readTheme, () => "default" as ThemeId);
}
