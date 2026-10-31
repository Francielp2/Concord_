"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ApiUser, Status } from "@/lib/client/types";

// por extenso: o Tailwind só gera as variáveis cujo nome encontra no código
const PALETTE = [
  "var(--color-avatar-1)",
  "var(--color-avatar-2)",
  "var(--color-avatar-3)",
  "var(--color-avatar-4)",
  "var(--color-avatar-5)",
  "var(--color-avatar-6)",
  "var(--color-avatar-7)",
];

export function colorFor(id: string | undefined) {
  if (!id) return PALETTE[6];
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ?? "").join("").toUpperCase() || "?";
}

const STATUS_BG: Record<Status, string> = {
  online: "bg-online",
  idle: "bg-idle",
  dnd: "bg-dnd",
  offline: "bg-faint",
  invisible: "bg-faint",
};

export const STATUS_PT: Record<Status, string> = {
  online: "Online",
  idle: "Ausente",
  dnd: "Não perturbe",
  offline: "Offline",
  invisible: "Invisível",
};

// foto que não carrega mais (link fora do ar, servidor apagado) volta para as iniciais
function AvatarPhoto({ src, initials }: { src: string; initials: React.ReactNode }) {
  const [broken, setBroken] = useState(false);
  if (broken) return initials;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" onError={() => setBroken(true)} className="h-full w-full rounded-full object-cover" />;
}

export function UserAvatar({
  user,
  size = 40,
  status,
  ring = "border-paper-2",
}: {
  user: ApiUser | undefined;
  size?: number;
  status?: Status;
  ring?: string;
}) {
  const name = user?.global_name || user?.username || "?";
  const dot = Math.max(10, Math.round(size * 0.32));
  const initials = (
    <span
      className="flex h-full w-full items-center justify-center rounded-full font-display font-bold text-on-avatar"
      style={{ background: colorFor(user?.id), fontSize: size * 0.36 }}
    >
      {initialsOf(name)}
    </span>
  );
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {user?.avatar ? (
        <AvatarPhoto key={user.avatar} src={user.avatar} initials={initials} />
      ) : (
        initials
      )}
      {status && (
        <span
          title={STATUS_PT[status]}
          className={`absolute -right-0.5 -bottom-0.5 rounded-full border-[3px] ${ring} ${STATUS_BG[status]}`}
          style={{ width: dot, height: dot }}
        />
      )}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ y: 16, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 16, scale: 0.98 }}
            className={`scroll-thin max-h-[calc(100dvh-2rem)] w-full ${wide ? "max-w-2xl" : "max-w-md"} overflow-y-auto rounded-2xl border border-line bg-sheet p-4 text-ink shadow-pop sm:p-6`}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-xl font-bold">{title}</h2>
              <button aria-label="Fechar" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-paper-2 hover:text-ink">
                <X size={20} />
              </button>
            </div>
            <div className="mt-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <label className="block">
      <span className={`text-[11px] font-bold uppercase tracking-[0.08em] ${error ? "text-dnd" : "text-muted"}`}>
        {label}
        {error && <span className="normal-case tracking-normal"> · {error}</span>}
      </span>
      <input
        {...props}
        className={`mt-1.5 w-full rounded-xl border bg-paper px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-signal/40 md:text-[15px] ${
          error ? "border-dnd" : "border-line focus:border-signal"
        }`}
      />
    </label>
  );
}

export function PrimaryButton({ busy, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={`glow rounded-xl bg-signal px-5 py-2.5 font-semibold text-on-signal hover:brightness-110 disabled:opacity-50 ${
        props.className ?? ""
      }`}
    >
      {busy ? "Só um segundo…" : children}
    </button>
  );
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-xl border border-line px-5 py-2.5 font-semibold text-ink-3 hover:border-line-strong hover:text-ink ${props.className ?? ""}`}
    />
  );
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
