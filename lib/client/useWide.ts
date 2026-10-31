"use client";

import { useSyncExternalStore } from "react";

// A tela de desktop é um quadro de 1672x941 que escala com a janela. Fica igual à variante
// `board:` do globals.css; abaixo disso vale o layout responsivo.
const BOARD = { width: 1672, height: 941, minWindow: 1000, maxScale: 1.2 };
const QUERY = `(min-width: ${BOARD.minWindow}px)`;

function subscribe(fn: () => void) {
  window.addEventListener("resize", fn);
  return () => window.removeEventListener("resize", fn);
}

// Avatar recebe o tamanho em px, e não em classe: é por aqui que ele cresce no quadro.
export function useWide() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}

function readScale() {
  const { innerWidth: w, innerHeight: h } = window;
  if (w < BOARD.minWindow) return 0;
  // cabe inteiro na janela; numa janela muito baixa a largura segura o mínimo e o conteúdo rola
  const fit = Math.min(w / BOARD.width, h / BOARD.height);
  return Math.min(BOARD.maxScale, Math.max(BOARD.minWindow / BOARD.width, fit));
}

// 0 = fora do quadro. Com zoom, width/height em % continuam ocupando a janela toda.
export function useBoardScale() {
  return useSyncExternalStore(subscribe, readScale, () => 0);
}
