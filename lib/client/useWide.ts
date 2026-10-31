"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1280px)";

function subscribe(fn: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", fn);
  return () => media.removeEventListener("change", fn);
}

// Avatar recebe o tamanho em px, e não em classe: é por aqui que ele cresce na grade do desktop.
export function useWide() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
