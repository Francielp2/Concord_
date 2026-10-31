"use client";

import { useSyncExternalStore } from "react";

export type NotificationData = { kind: "message" | "call" | "missed"; channelId?: string; guildId?: string; callId?: string };
export type NotificationClick = { action: string; data: NotificationData };

const listeners = new Set<() => void>();

function subscribePermission(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

export function useNotificationPermission(): NotificationPermission | "unsupported" {
  return useSyncExternalStore(subscribePermission, () => (notificationsSupported() ? Notification.permission : "unsupported"), () => "unsupported");
}

// Só de um clique: o navegador pune quem pede sozinho ao carregar a página.
export async function requestNotifications() {
  if (!notificationsSupported()) return;
  await Notification.requestPermission();
  listeners.forEach((fn) => fn());
}

function subscribeVisibility(fn: () => void) {
  document.addEventListener("visibilitychange", fn);
  return () => document.removeEventListener("visibilitychange", fn);
}

export function useDocumentVisible() {
  return useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => true);
}

let fallbackClick: ((click: NotificationClick) => void) | null = null;

// sem service worker (ambiente de desenvolvimento), o clique chega por aqui
export function setNotificationFallback(fn: (click: NotificationClick) => void) {
  fallbackClick = fn;
}

type ShowOptions = {
  title: string;
  body: string;
  icon?: string | null;
  tag: string;
  data: NotificationData;
  actions?: { action: string; title: string }[];
  requireInteraction?: boolean;
  vibrate?: number[];
};

const registration = async () => ("serviceWorker" in navigator ? navigator.serviceWorker.getRegistration() : undefined);

export async function showNotification({ title, ...options }: ShowOptions) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const full = { ...options, icon: options.icon || "/icons/icon-192.png", badge: "/icons/icon-192.png" } as NotificationOptions;
  try {
    const reg = await registration();
    if (reg) return await reg.showNotification(title, full);
    // botões só existem pelo service worker
    const { actions: _actions, ...plain } = full as NotificationOptions & { actions?: unknown };
    void _actions;
    const n = new Notification(title, plain);
    n.onclick = () => {
      window.focus();
      n.close();
      fallbackClick?.({ action: "open", data: options.data });
    };
  } catch (err) {
    console.error("[concord] notificação", err);
  }
}

export async function closeNotification(tag: string) {
  if (!notificationsSupported()) return;
  const reg = await registration().catch(() => undefined);
  const open = (await reg?.getNotifications({ tag }).catch(() => [])) ?? [];
  open.forEach((n) => n.close());
}
