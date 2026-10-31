"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Bell, CircleHelp, Search } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { statusOf, useStore } from "@/lib/client/store";
import { Rel } from "@/lib/client/types";
import { UserMenu } from "./UserMenu";
import { Modal, UserAvatar } from "./ui";

const icon = "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-on-rail hover:bg-rail-2";

export function TopBar({
  className,
  onSearch,
  onPending,
  onHelp,
  onActivity,
  onInstallHelp,
}: {
  className: string;
  onSearch: () => void;
  onPending: () => void;
  onHelp: () => void;
  onActivity: () => void;
  onInstallHelp: () => void;
}) {
  const { state } = useStore();
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const anchor = useRef<HTMLDivElement>(null);
  const me = state.me;
  const pending = Object.values(state.relationships).filter((r) => r.type === Rel.INCOMING).length;

  return (
    <div className={`h-12 shrink-0 items-center gap-1 border-b border-line bg-shell-top px-2 text-on-rail board:absolute board:inset-x-0 board:left-[85px] board:top-0 board:z-20 board:h-[69px] board:px-4 ${className}`} data-top-bar>
      <span className="hidden shrink-0 items-center gap-2.5 board:flex board:w-[262px]">
        <LogoMark size={30} stroke="var(--color-on-rail)" />
        <span className="font-display text-xl font-extrabold tracking-tight">Concord</span>
      </span>
      <button
        type="button"
        onClick={onSearch}
        aria-label="Buscar no Concord (Ctrl+K)"
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg bg-shell-field px-3 text-sm text-on-rail hover:brightness-110 sm:mx-auto sm:max-w-md board:mx-0 board:ml-[29px] board:h-10 board:max-w-[721px]"
      >
        <Search size={15} className="shrink-0" aria-hidden />
        <span className="truncate">Buscar no Concord</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-on-rail/30 px-1.5 font-mono text-[11px] sm:inline">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={onPending}
        aria-label={pending ? `Notificações: ${pending} ${pending === 1 ? "pedido de amizade" : "pedidos de amizade"}` : "Notificações: nenhum pedido de amizade"}
        title="Pedidos de amizade"
        className={`${icon} board:ml-auto`}
      >
        <Bell size={18} />
        {!!pending && <span data-bell-dot className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-rail bg-danger" />}
      </button>
      <button type="button" onClick={onHelp} aria-label="Ajuda" title="Ajuda" className={icon}>
        <CircleHelp size={18} />
      </button>
      <div ref={anchor} className="relative shrink-0">
        <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Menu do usuário" aria-expanded={menu} className={icon}>
          <UserAvatar user={me ?? undefined} size={28} status={me ? statusOf(state, me.id) : undefined} ring="border-rail" />
        </button>
        <AnimatePresence>
          {menu && <UserMenu anchor={anchor} className="right-0 top-11" onClose={closeMenu} onActivity={onActivity} onInstallHelp={onInstallHelp} />}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Ajuda">
      <dl className="space-y-3 text-sm">
        {[
          ["Buscar", "Ctrl+K (ou Cmd+K no Mac) abre a busca de servidores, canais, conversas e amigos."],
          ["Atividade", "Clique no seu nome e escolha Definir atividade. O site não vê quais programas estão abertos, então é você quem diz o que está fazendo."],
          ["Adicionar amigo", "Na tela Amigos, procure a pessoa, escolha na lista e toque em Enviar pedido."],
          ["Tela com som", "O áudio do sistema só funciona no Chrome ou Edge no computador. Marque o compartilhamento de áudio na janela que abrir."],
        ].map(([term, text]) => (
          <div key={term}>
            <dt className="font-semibold">{term}</dt>
            <dd className="mt-0.5 text-ink-3">{text}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
