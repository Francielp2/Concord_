"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import { Loader2 } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { api } from "@/lib/client/api";
import { registerServiceWorker } from "@/lib/client/install";
import { StoreProvider, useStore } from "@/lib/client/store";
import { unlockAudio } from "@/lib/client/sounds";
import { accentVars, useTheme } from "@/lib/client/theme";
import type { ApiChannel, ApiGuild } from "@/lib/client/types";
import { voiceSessionId } from "@/lib/client/voice";
import { Chat } from "./Chat";
import { CommandPalette, type PaletteTarget } from "./CommandPalette";
import { Friends, type FriendsTab } from "./Friends";
import { Members } from "./Members";
import {
  AddGuildModal,
  ConfirmModal,
  CreateChannelModal,
  GuildSettingsModal,
  InstallHelpModal,
  InviteModal,
  NewDmModal,
  ProfileModal,
} from "./Modals";
import { Rail } from "./Rail";
import { GuildSidebar, HomeSidebar } from "./Sidebars";
import { HelpModal, TopBar } from "./TopBar";
import { UserBar } from "./UserBar";
import { ActivityModal } from "./UserMenu";
import { VoicePanel } from "./voice/VoicePanel";

const NAV_KEY = "concord:nav";
const VOICE_HEARTBEAT_MS = 10_000;

type Nav = { place: string; channelByGuild: Record<string, string>; dm: string | null };

function loadNav(): Nav {
  try {
    const saved = JSON.parse(localStorage.getItem(NAV_KEY) ?? "null");
    if (saved && typeof saved.place === "string") return { channelByGuild: {}, dm: null, ...saved };
  } catch {}
  return { place: "home", channelByGuild: {}, dm: null };
}

export function LiveApp() {
  const goLogin = useCallback(() => {
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, []);
  return (
    <StoreProvider onUnauthorized={goLogin}>
      <MotionConfig reducedMotion="user">
        <Shell />
      </MotionConfig>
    </StoreProvider>
  );
}

function Shell() {
  const { state, dispatch, gatewaySend } = useStore();
  // navegação lembrada entre visitas (e ?guild= vindo de um convite).
  // Lida já no estado inicial: o servidor só renderiza a tela de "Conectando", que não usa isso.
  const [nav, setNav] = useState<Nav>(() => {
    if (typeof window === "undefined") return { place: "home", channelByGuild: {}, dm: null };
    const saved = loadNav();
    const fromInvite = new URLSearchParams(window.location.search).get("guild");
    return fromInvite ? { ...saved, place: fromInvite } : saved;
  });
  const [drawer, setDrawer] = useState(false);
  const [membersOpen, setMembersOpen] = useState(true);
  const [membersDrawer, setMembersDrawer] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [addGuild, setAddGuild] = useState(false);
  const [newDm, setNewDm] = useState(false);
  const [profile, setProfile] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [palette, setPalette] = useState(false);
  const [friendsTab, setFriendsTab] = useState<FriendsTab>("add");
  const [invite, setInvite] = useState<ApiGuild | null>(null);
  const [settings, setSettings] = useState<ApiGuild | null>(null);
  const [leave, setLeave] = useState<ApiGuild | null>(null);
  const [createChannel, setCreateChannel] = useState<{ guild: ApiGuild; parentId: string | null; type: 0 | 2 | 4 } | null>(null);
  const [voiceSlot, setVoiceSlot] = useState<HTMLDivElement | null>(null);
  const [voiceBar, setVoiceBar] = useState<HTMLDivElement | null>(null);
  const [voiceFocus, setVoiceFocus] = useState(0);
  const [voiceKicked, setVoiceKicked] = useState(false);
  const [sessionId] = useState(voiceSessionId);
  const theme = useTheme();
  // no <html>, para a rolagem elástica e a janela destacada da chamada acompanharem o tema
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    const bar = getComputedStyle(root).getPropertyValue("--color-rail").trim();
    if (bar) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bar);
    return () => {
      delete root.dataset.theme;
    };
  }, [theme]);
  const [muted, setMuted] = useState(false);
  const [deaf, setDeaf] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("guild")) window.history.replaceState(null, "", "/app");
    registerServiceWorker();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_KEY, JSON.stringify(nav));
    } catch {}
  }, [nav]);

  const guild = nav.place !== "home" ? state.guilds[nav.place] : undefined;
  const textChannels = useMemo(
    () => (guild ? [...guild.channels].filter((c) => c.type === 0 || c.type === 5 || c.type === 11).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) : []),
    [guild],
  );
  const channel: ApiChannel | undefined = guild
    ? (textChannels.find((c) => c.id === nav.channelByGuild[guild.id]) ??
      textChannels.find((c) => c.id === guild.system_channel_id) ??
      textChannels.find((c) => c.type !== 11))
    : nav.dm
      ? state.dms[nav.dm]
      : undefined;

  // servidor sumiu (saiu, foi expulso, excluído): volta pra home
  useEffect(() => {
    if (state.conn === "ready" && nav.place !== "home" && !state.guilds[nav.place]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reação a um evento do gateway
      setNav((n) => ({ ...n, place: "home" }));
    }
  }, [state.conn, state.guilds, nav.place]);

  const myVoice = useMemo(() => {
    for (const g of Object.values(state.guilds)) {
      const v = g.voice_states.find((x) => x.user_id === state.me?.id);
      if (v) return v;
    }
    return null;
  }, [state.guilds, state.me?.id]);

  // a chamada só é "minha" neste dispositivo se a sessão gravada for a dele;
  // senão a conta está em chamada em outro lugar e aqui não conecta nada
  const ownVoice = myVoice?.session_id === sessionId && !voiceKicked ? myVoice : null;
  const elsewhere = myVoice && !ownVoice ? myVoice : null;

  const hadOwnVoice = useRef(false);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reação a um evento do gateway */
    if (!myVoice) setVoiceKicked(false);
    else if (hadOwnVoice.current && myVoice.session_id !== sessionId) setVoiceKicked(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    hadOwnVoice.current = !!ownVoice;
  }, [myVoice, ownVoice, sessionId]);

  // heartbeat de voz: é por ele que a varredura sabe que este dispositivo continua na chamada
  const inOwnVoice = !!ownVoice;
  useEffect(() => {
    if (!inOwnVoice) return;
    const beat = () => gatewaySend(1, { voice_session_id: sessionId }).catch(() => {});
    const timer = setInterval(beat, VOICE_HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, [inOwnVoice, sessionId, gatewaySend]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (patch: Partial<Nav>) => {
    setNav((n) => ({ ...n, ...patch }));
    setDrawer(false);
    setMembersDrawer(false);
  };

  // abaixo de lg a lista de membros não cabe do lado do chat: abre em gaveta
  function toggleMembers() {
    if (window.matchMedia("(min-width: 1024px)").matches) setMembersOpen((v) => !v);
    else setMembersDrawer((v) => !v);
  }

  async function openDmWith(userId: string) {
    const existing = Object.values(state.dms).find((c) => c.type === 1 && c.recipients?.[0]?.id === userId);
    if (existing) return go({ place: "home", dm: existing.id });
    const c = await api<ApiChannel>("/users/@me/channels", { body: { recipient_id: userId } });
    dispatch({ type: "UPSERT_DM", channel: c });
    go({ place: "home", dm: c.id });
  }

  function pickFromPalette(target: PaletteTarget) {
    if (target.kind === "guild") go({ place: target.id });
    else if (target.kind === "channel") go({ place: target.guildId, channelByGuild: { ...nav.channelByGuild, [target.guildId]: target.id } });
    else if (target.kind === "dm") go({ place: "home", dm: target.id });
    else openDmWith(target.id).catch(() => {});
  }

  async function setVoice(channelId: string, opts: { mute?: boolean; deaf?: boolean } = {}) {
    const g = Object.values(state.guilds).find((x) => x.channels.some((c) => c.id === channelId));
    setVoiceKicked(false);
    await gatewaySend(4, {
      guild_id: g?.id ?? null,
      channel_id: channelId,
      self_mute: opts.mute ?? muted,
      self_deaf: opts.deaf ?? deaf,
      session_id: sessionId,
    }).catch(() => {});
  }

  // Sempre funciona, com a mídia de pé ou não. A interface sai na hora; se o pedido falhar,
  // o heartbeat já parou e a varredura termina o serviço.
  function leaveVoice() {
    if (!myVoice) return;
    dispatch({ type: "EVENT", t: "VOICE_STATE_UPDATE", d: { ...myVoice, channel_id: null } });
    // sem session_id ao desligar uma chamada que está em outro dispositivo
    gatewaySend(4, { channel_id: null, ...(ownVoice ? { session_id: sessionId } : {}) }).catch(() => {});
  }

  // clicar no canal em que já estou só traz a chamada para a frente
  function openVoice(channelId: string) {
    setDrawer(false);
    unlockAudio();
    if (channelId === ownVoice?.channel_id) setVoiceFocus((n) => n + 1);
    else setVoice(channelId);
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    if (!next && deaf) setDeaf(false);
    if (ownVoice) setVoice(ownVoice.channel_id!, { mute: next, deaf: next ? deaf : false });
  }

  function toggleDeaf() {
    const next = !deaf;
    setDeaf(next);
    if (next) setMuted(true);
    if (ownVoice) setVoice(ownVoice.channel_id!, { deaf: next, mute: next ? true : muted });
  }

  if (!state.me) {
    return (
      <div className="app-backdrop flex h-dvh flex-col items-center justify-center gap-4 text-ink">
        <LogoMark size={56} />
        <span className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Conectando…
        </span>
      </div>
    );
  }

  const footer = (
    <>
      <div ref={setVoiceSlot} />
      <UserBar muted={muted} deaf={deaf} onMute={toggleMute} onDeaf={toggleDeaf} onSettings={() => setProfile(true)} onActivity={() => setActivityOpen(true)} onInstallHelp={() => setInstallHelp(true)} />
    </>
  );

  const sidebar = guild ? (
    <GuildSidebar
      guild={guild}
      channelId={channel?.id ?? null}
      voiceChannelId={ownVoice?.guild_id === guild.id ? ownVoice.channel_id : null}
      onSelect={(id) => go({ channelByGuild: { ...nav.channelByGuild, [guild.id]: id } })}
      onVoice={openVoice}
      onInvite={() => setInvite(guild)}
      onCreateChannel={(parentId, type) => setCreateChannel({ guild, parentId, type })}
      onLeave={() => setLeave(guild)}
      onSettings={() => setSettings(guild)}
      membersOpen={membersOpen}
      onToggleMembers={() => {
        toggleMembers();
        setDrawer(false);
      }}
      footer={footer}
    />
  ) : (
    <HomeSidebar
      view={nav.dm && state.dms[nav.dm] ? nav.dm : null}
      onFriends={() => go({ dm: null })}
      onDm={(id) => go({ dm: id })}
      onNewDm={() => setNewDm(true)}
      footer={footer}
    />
  );

  return (
    <div style={accentVars(guild?.accent_color, theme)} className="app-backdrop h-dvh text-ink md:p-3 lg:p-4 xl:p-0">
      <div className="relative flex h-full flex-col overflow-hidden bg-rail md:rounded-3xl md:border md:border-line md:shadow-pop xl:rounded-none xl:border-0 xl:shadow-none">
        {/* no celular só na tela Amigos: dentro do chat a altura é do campo de mensagem */}
        <TopBar
          className={channel || guild ? "hidden md:flex" : "flex"}
          onSearch={() => setPalette(true)}
          onPending={() => {
            setFriendsTab("pending");
            go({ place: "home", dm: null });
          }}
          onHelp={() => setHelp(true)}
          onActivity={() => setActivityOpen(true)}
          onInstallHelp={() => setInstallHelp(true)}
        />
        <div className="flex min-h-0 flex-1 xl:pt-[69px]">
        <div
          className={`fixed inset-y-0 left-0 z-40 flex transition-transform duration-300 md:static md:translate-x-0 ${
            drawer ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Rail active={guild ? guild.id : "home"} onSelect={(id) => go({ place: id })} onAdd={() => setAddGuild(true)} />
          <div className="flex md:overflow-hidden md:rounded-tl-2xl xl:rounded-none">{sidebar}</div>
        </div>
        {drawer && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-scrim/50 md:hidden" onClick={() => setDrawer(false)} />}

        <main className="flex min-w-0 flex-1 flex-col bg-sheet">
          {state.conn !== "ready" && (
            <div className="bg-mustard px-3 py-1 text-center text-xs font-semibold text-chrome">Conexão caiu. Reconectando…</div>
          )}
          {state.me.verified === false && <VerifyBanner email={state.me.email} />}
          <div ref={setVoiceBar} className="md:hidden" />
          <div className="flex min-h-0 flex-1">
            {channel ? (
              <Chat
                key={channel.id}
                channel={channel}
                guild={guild}
                membersOpen={membersOpen}
                onToggleMembers={toggleMembers}
                onMenu={() => setDrawer(true)}
                onInvite={guild ? () => setInvite(guild) : undefined}
                onOpenChannel={(id) => guild && go({ channelByGuild: { ...nav.channelByGuild, [guild.id]: id } })}
              />
            ) : guild ? (
              <EmptyGuild guild={guild} onCreate={() => setCreateChannel({ guild, parentId: null, type: 0 })} />
            ) : (
              <Friends tab={friendsTab} onTab={setFriendsTab} onDm={openDmWith} onJoin={openVoice} onMenu={() => setDrawer(true)} />
            )}
            {guild && membersOpen && <Members guild={guild} onDm={openDmWith} className="hidden lg:block" />}
          </div>
        </main>
        </div>
      </div>

      {guild && membersDrawer && (
        <div className="fixed inset-0 z-40 flex justify-end lg:hidden">
          <button aria-label="Fechar membros" className="flex-1 bg-scrim/50" onClick={() => setMembersDrawer(false)} />
          <Members guild={guild} onDm={openDmWith} className="max-w-[80vw] pt-[env(safe-area-inset-top)]" />
        </div>
      )}

      {/* fica fora das barras laterais pra chamada não cair ao trocar de tela */}
      <VoicePanel
        voice={ownVoice}
        elsewhere={elsewhere}
        kicked={voiceKicked}
        muted={muted}
        deaf={deaf}
        slot={voiceSlot}
        mobileBar={voiceBar}
        focusSignal={voiceFocus}
        sessionId={sessionId}
        onLeave={leaveVoice}
        onTakeOver={() => elsewhere?.channel_id && setVoice(elsewhere.channel_id)}
        onReplaced={() => setVoiceKicked(true)}
        onMute={toggleMute}
        onDeaf={toggleDeaf}
      />

      <AddGuildModal open={addGuild} onClose={() => setAddGuild(false)} onDone={(id) => go({ place: id })} />
      <NewDmModal open={newDm} onClose={() => setNewDm(false)} onOpen={(id) => go({ place: "home", dm: id })} />
      <ProfileModal open={profile} onClose={() => setProfile(false)} />
      <ActivityModal open={activityOpen} onClose={() => setActivityOpen(false)} />
      <HelpModal open={help} onClose={() => setHelp(false)} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} onPick={pickFromPalette} />
      <InstallHelpModal open={installHelp} onClose={() => setInstallHelp(false)} />
      <InviteModal guild={invite} channelId={guild && channel?.guild_id === guild.id ? channel.id : null} onClose={() => setInvite(null)} />
      <GuildSettingsModal guild={settings} onClose={() => setSettings(null)} />
      <CreateChannelModal
        target={createChannel}
        onClose={() => setCreateChannel(null)}
        onCreated={(c) => c.type === 0 && c.guild_id && go({ channelByGuild: { ...nav.channelByGuild, [c.guild_id]: c.id } })}
      />
      <ConfirmModal
        open={!!leave}
        title={leave?.owner_id === state.me.id ? "Excluir servidor" : "Sair do servidor"}
        text={
          leave?.owner_id === state.me.id
            ? `Isso apaga o ${leave?.name} pra todo mundo, com canais e mensagens. Não tem volta.`
            : `Tem certeza que quer sair do ${leave?.name}? Pra voltar vai precisar de um convite.`
        }
        action={leave?.owner_id === state.me.id ? "Excluir" : "Sair"}
        onClose={() => setLeave(null)}
        onConfirm={async () => {
          if (!leave) return;
          await api(leave.owner_id === state.me!.id ? `/guilds/${leave.id}` : `/users/@me/guilds/${leave.id}`, { method: "DELETE" });
          dispatch({ type: "EVENT", t: "GUILD_DELETE", d: { id: leave.id } });
          go({ place: "home" });
        }}
      />
    </div>
  );
}

function VerifyBanner({ email }: { email?: string }) {
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="flex items-center justify-center gap-3 border-b border-line bg-paper-2 px-3 py-1.5 text-xs text-ink-3">
      <span>
        Confirma teu e-mail{email ? <> (<b className="text-ink">{email}</b>)</> : null} pelo link que mandamos.
      </span>
      {status === "sent" ? (
        <span className="font-semibold text-online">Link reenviado.</span>
      ) : (
        <button
          className="font-semibold text-signal-ink underline-offset-2 hover:underline"
          onClick={() =>
            api("/auth/verify/send", { method: "POST" })
              .then(() => setStatus("sent"))
              .catch(() => setStatus("error"))
          }
        >
          {status === "error" ? "Tenta daqui a pouco" : "Reenviar"}
        </button>
      )}
      <button aria-label="Esconder aviso" className="text-faint hover:text-ink" onClick={() => setHidden(true)}>
        ×
      </button>
    </div>
  );
}

function EmptyGuild({ guild, onCreate }: { guild: ApiGuild; onCreate: () => void }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center bg-sheet px-6 text-center">
      <span className="font-display text-3xl font-bold text-muted">Silêncio por aqui.</span>
      <p className="mt-2 text-muted">O {guild.name} ainda não tem canal de texto que você consiga ver.</p>
      <button onClick={onCreate} className="glow mt-5 rounded-xl bg-signal px-5 py-2.5 font-semibold text-on-signal hover:brightness-110">
        Criar canal
      </button>
    </section>
  );
}
