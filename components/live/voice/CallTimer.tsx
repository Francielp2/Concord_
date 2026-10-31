"use client";

import { useSyncExternalStore } from "react";
import { formatCallDuration } from "@/lib/client/voice";

// Todos os cronômetros da tela dividem um relógio só, que para com a aba oculta.
// Nada é acumulado: cada leitura recalcula a partir de Date.now().
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

const tick = () => listeners.forEach((fn) => fn());

function sync() {
  const run = listeners.size > 0 && document.visibilityState === "visible";
  if (run && !timer) timer = setInterval(tick, 1000);
  if (!run && timer) {
    clearInterval(timer);
    timer = null;
  }
}

function onVisibility() {
  sync();
  if (document.visibilityState === "visible") tick();
}

function subscribe(fn: () => void) {
  if (!listeners.size) document.addEventListener("visibilitychange", onVisibility);
  listeners.add(fn);
  sync();
  return () => {
    listeners.delete(fn);
    sync();
    if (!listeners.size) document.removeEventListener("visibilitychange", onVisibility);
  };
}

const nowInSeconds = () => Math.floor(Date.now() / 1000);

export function CallTimer({ startedAt, className = "" }: { startedAt: number | null; className?: string }) {
  const now = useSyncExternalStore(subscribe, nowInSeconds, () => 0);
  if (startedAt == null) return null;
  return (
    <span className={`shrink-0 tabular-nums ${className}`} data-call-timer>
      {formatCallDuration(now * 1000 - startedAt)}
    </span>
  );
}
