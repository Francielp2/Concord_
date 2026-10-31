"use client";

import { useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

// O evento pode disparar antes de qualquer componente montar: a escuta fica no módulo.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function isIos() {
  // iPadOS se apresenta como Mac, mas Mac não tem tela de toque
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type InstallMode = "prompt" | "ios" | null;

function mode(): InstallMode {
  if (isInstalled()) return null;
  if (deferred) return "prompt";
  return isIos() ? "ios" : null;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useInstallMode() {
  return useSyncExternalStore(subscribe, mode, () => null);
}

export async function promptInstall() {
  const event = deferred;
  if (!event) return;
  deferred = null; // o evento só vale uma vez
  notify();
  await event.prompt();
}

export function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err) => console.error("[concord] service worker", err));
}
