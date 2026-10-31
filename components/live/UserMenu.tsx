"use client";

import { useEffect, useState, type RefObject } from "react";
import { motion } from "framer-motion";
import { Download, Gamepad2, LogOut } from "lucide-react";
import { ACTIVITY_KINDS, ACTIVITY_NAME_MAX, cleanActivityName, encodeActivity, parseCustomStatus, type ActivityKind } from "@/lib/client/activity";
import { api } from "@/lib/client/api";
import { promptInstall, useInstallMode } from "@/lib/client/install";
import { useStore } from "@/lib/client/store";
import type { Status } from "@/lib/client/types";
import { ActivityTile } from "./RollingNow";
import { Modal, PrimaryButton, GhostButton, STATUS_PT } from "./ui";

const CHOICES: Status[] = ["online", "idle", "dnd", "invisible"];

// O menu do usuário, aberto pela barra lateral e pelo topo do app. O que estiver fora de `anchor` fecha.
export function UserMenu({
  anchor,
  className,
  onClose,
  onActivity,
  onInstallHelp,
}: {
  anchor: RefObject<HTMLElement | null>;
  className: string;
  onClose: () => void;
  onActivity: () => void;
  onInstallHelp: () => void;
}) {
  const { state, dispatch, gatewaySend } = useStore();
  const install = useInstallMode();

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  async function pick(status: Status) {
    onClose();
    dispatch({ type: "MY_STATUS", status });
    await gatewaySend(3, { status }).catch(() => {});
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className={`absolute z-50 w-56 rounded-xl border border-line-strong bg-sheet p-1.5 text-ink shadow-pop ${className}`}
    >
      {CHOICES.map((s) => (
        <button
          key={s}
          onClick={() => pick(s)}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper-2 ${
            state.myStatus === s ? "font-semibold" : ""
          }`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${s === "online" ? "bg-online" : s === "idle" ? "bg-idle" : s === "dnd" ? "bg-dnd" : "bg-faint"}`} />
          {STATUS_PT[s]}
        </button>
      ))}
      <span className="my-1 block h-px bg-line" />
      <button
        onClick={() => {
          onClose();
          onActivity();
        }}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper-2"
      >
        <Gamepad2 size={15} /> Definir atividade
      </button>
      {install && (
        <button
          onClick={() => {
            onClose();
            if (install === "prompt") promptInstall().catch(() => {});
            else onInstallHelp();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper-2"
        >
          <Download size={15} /> Instalar o app
        </button>
      )}
      <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-dnd hover:bg-dnd/10">
        <LogOut size={15} /> Sair da conta
      </button>
    </motion.div>
  );
}

export function ActivityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Definir atividade">
      <ActivityBody onClose={onClose} />
    </Modal>
  );
}

function ActivityBody({ onClose }: { onClose: () => void }) {
  const { state, dispatch, gatewaySend } = useStore();
  const current = parseCustomStatus(state.myCustomStatus).activity;
  const [kind, setKind] = useState<ActivityKind>(current?.kind ?? "game");
  const [name, setName] = useState(current?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clean = cleanActivityName(name);

  // sempre manda o status atual junto: o servidor exige, e não pode tirar ninguém do invisível
  async function save(custom: string) {
    setBusy(true);
    setError("");
    try {
      await gatewaySend(3, { status: state.myStatus, custom_status: custom });
      dispatch({ type: "MY_CUSTOM_STATUS", custom: custom || null });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (clean) save(encodeActivity({ kind, name: clean }));
      }}
    >
      <div role="radiogroup" aria-label="Tipo de atividade" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIVITY_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`rounded-lg border px-2 py-2 text-sm font-semibold ${kind === k.id ? "border-signal bg-signal text-on-signal" : "border-line text-ink-3 hover:border-line-strong"}`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="flex justify-between text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
          Nome
          <span className="tabular-nums">
            {name.length}/{ACTIVITY_NAME_MAX}
          </span>
        </span>
        <input
          autoFocus
          value={name}
          maxLength={ACTIVITY_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Valorant, YouTube, Spotify"
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-base outline-none placeholder:text-muted focus:border-signal focus:ring-2 focus:ring-signal/40 md:text-[15px]"
        />
      </label>
      {clean && (
        <p className="mt-3 flex items-center gap-2.5 rounded-xl border border-line bg-paper p-2.5 text-sm font-semibold">
          <span className="min-w-0 flex-1 truncate">
            {ACTIVITY_KINDS.find((k) => k.id === kind)!.label} {clean}
          </span>
          <ActivityTile activity={{ kind, name: clean }} />
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        Quem está nos seus servidores e seus amigos veem isso enquanto você estiver online. Fica até você limpar.
        {state.myStatus === "invisible" && " Agora você está invisível: ninguém vê até voltar a ficar online."}
      </p>
      {error && <p className="mt-2 text-sm text-dnd">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {state.myCustomStatus && (
          <GhostButton type="button" disabled={busy} onClick={() => save("")} className="mr-auto">
            Limpar
          </GhostButton>
        )}
        <PrimaryButton busy={busy} disabled={!clean}>
          Salvar
        </PrimaryButton>
      </div>
    </form>
  );
}
