"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Bell, ChevronDown, CircleHelp, Search } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { statusOf, useStore } from "@/lib/client/store";
import { Rel } from "@/lib/client/types";
import { useWide } from "@/lib/client/useWide";
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
  const wide = useWide();
  const me = state.me;
  const pending = Object.values(state.relationships).filter((r) => r.type === Rel.INCOMING).length;

  return (
    <div className={`h-12 shrink-0 items-center gap-1 border-b border-line bg-shell-top px-2 text-on-rail board:absolute board:inset-x-0 board:left-[85px] board:top-0 board:z-20 board:h-[69px] board:gap-0 board:pl-5 board:pr-5 ${className}`} data-top-bar>
      <span className="hidden shrink-0 items-center gap-2.5 board:flex board:w-[258px]">
        <LogoMark size={30} stroke="var(--color-on-rail)" />
        <span className="pt-1 font-display text-2xl font-extrabold tracking-tight">Concord</span>
      </span>
      <button
        type="button"
        onClick={onSearch}
        aria-label="Buscar no Concord (Ctrl+K)"
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg bg-shell-field px-3 text-sm text-on-rail hover:brightness-110 sm:mx-auto sm:max-w-[453px] board:mx-0 board:ml-[17px] board:h-[43px] board:rounded-xl board:border board:border-line-strong board:pl-3.5 board:pr-2.5 board:text-[15px]"
      >
        <Search size={wide ? 20 : 15} className="shrink-0" aria-hidden />
        <span className="truncate opacity-70">Buscar no Concord...</span>
        <kbd className="ml-auto hidden shrink-0 rounded-md bg-rail-2 px-2 py-0.5 font-sans text-[13px] font-medium sm:inline board:bg-voice-btn">Ctrl + K</kbd>
      </button>
      <button
        type="button"
        onClick={onPending}
        aria-label={pending ? `Notificações: ${pending} ${pending === 1 ? "pedido de amizade" : "pedidos de amizade"}` : "Notificações: nenhum pedido de amizade"}
        title="Pedidos de amizade"
        className={`${icon} board:ml-auto board:mr-[31px]`}
      >
        <Bell size={wide ? 26 : 18} />
        {!!pending && <span data-bell-dot className="absolute right-1 top-0.5 h-3 w-3 rounded-full border-2 border-shell-top bg-signal" />}
      </button>
      <button type="button" onClick={onHelp} aria-label="Ajuda" title="Ajuda" className={`${icon} board:mr-[35px]`}>
        <CircleHelp size={wide ? 26 : 18} />
      </button>
      <div ref={anchor} className="relative shrink-0">
        <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Menu do usuário" aria-expanded={menu} className="relative flex h-9 shrink-0 items-center gap-1 rounded-lg text-on-rail hover:bg-rail-2">
          <UserAvatar user={me ?? undefined} size={wide ? 34 : 28} status={me ? statusOf(state, me.id) : undefined} ring="border-shell-top" />
          <ChevronDown size={14} className="hidden opacity-70 board:block" aria-hidden />
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
