"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Play, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/client/api";
import { MAX_SOUND_SECONDS, measureAudio, playSound, unlockAudio } from "@/lib/client/sounds";
import { useStore } from "@/lib/client/store";
import { accentVars, colorToHex, hexToColor, useBlackBackground } from "@/lib/client/theme";
import { Perm, hasPerm, type ApiGuild } from "@/lib/client/types";
import { EmojiGlyph } from "./Emoji";
import { Field, GhostButton, PrimaryButton, initialsOf } from "./ui";

type Tab = "general" | "emojis" | "sounds" | "webhooks";

export function canOpenGuildSettings(g: ApiGuild) {
  return [Perm.MANAGE_GUILD, Perm.MANAGE_GUILD_EXPRESSIONS, Perm.MANAGE_SOUNDBOARD, Perm.MANAGE_WEBHOOKS].some((f) => hasPerm(g.permissions, f));
}

export function GuildSettingsTabs({ guild, onClose }: { guild: ApiGuild; onClose: () => void }) {
  const tabs = (
    [
      ["general", "Geral", Perm.MANAGE_GUILD],
      ["emojis", "Emojis", Perm.MANAGE_GUILD_EXPRESSIONS],
      ["sounds", "Sons", Perm.MANAGE_SOUNDBOARD],
      ["webhooks", "Integrações", Perm.MANAGE_WEBHOOKS],
    ] as const
  ).filter(([, , flag]) => hasPerm(guild.permissions, flag));
  const [tab, setTab] = useState<Tab>(tabs[0]?.[0] ?? "general");

  return (
    <>
      <div className="scroll-ink mb-4 flex gap-1 overflow-x-auto rounded-full border border-ink p-1 text-sm font-semibold">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 whitespace-nowrap rounded-full px-2.5 py-1.5 ${tab === id ? "bg-ink text-sheet" : "text-ink-3 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "general" && <General guild={guild} onClose={onClose} />}
      {tab === "emojis" && <Emojis guild={guild} />}
      {tab === "sounds" && <Sounds guild={guild} />}
      {tab === "webhooks" && <Webhooks guild={guild} />}
    </>
  );
}

const ACCENT_DEFAULT = "#ff4f1f";
const IMAGE_TYPES = "image/png,image/gif,image/jpeg,image/webp";

// Imagem escolhida ainda sem enviar: só sobe ao salvar, então a pré-visualização não publica nada.
function useImageDraft(initial: string | null | undefined, maxBytes: number, onError: (message: string) => void) {
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a URL precisa ser revogada junto com o arquivo
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return {
    file,
    removed,
    url: removed ? null : file ? preview : (initial ?? null),
    pick(next: File | null) {
      if (next && next.size > maxBytes) return onError(`Essa imagem passa de ${maxBytes / 1024 / 1024} MB.`);
      onError("");
      setFile(next);
      setRemoved(false);
    },
    remove() {
      setFile(null);
      setRemoved(true);
    },
  };
}

function ImagePicker({ label, url, onPick, onRemove }: { label: string; url: string | null; onPick: (f: File | null) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink bg-paper px-3 py-2 text-sm font-semibold hover:bg-paper-2">
        <Upload size={15} />
        {label}
        <input
          type="file"
          accept={IMAGE_TYPES}
          aria-label={label}
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      </label>
      {url && (
        <button type="button" onClick={onRemove} className="text-sm text-muted underline-offset-2 hover:text-dnd hover:underline">
          Remover
        </button>
      )}
    </div>
  );
}

function General({ guild, onClose }: { guild: ApiGuild; onClose: () => void }) {
  const [name, setName] = useState(guild.name);
  const [description, setDescription] = useState(guild.description ?? "");
  const [accent, setAccent] = useState<number | null>(guild.accent_color ?? null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const icon = useImageDraft(guild.icon, 1024 * 1024, setError);
  const banner = useImageDraft(guild.banner, 4 * 1024 * 1024, setError);
  const black = useBlackBackground();

  async function upload(kind: "icon" | "banner", file: File) {
    const form = new FormData();
    form.append("kind", kind);
    form.append("image", file);
    return (await api<{ url: string }>(`/guilds/${guild.id}/assets`, { body: form })).url;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = { name: name.trim(), description: description.trim() || null, accent_color: accent };
      if (icon.file) body.icon = await upload("icon", icon.file);
      else if (icon.removed) body.icon = null;
      if (banner.file) body.banner = await upload("banner", banner.file);
      else if (banner.removed) body.banner = null;
      await api(`/guilds/${guild.id}`, { method: "PATCH", body });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <GuildPreview name={name} description={description} icon={icon.url} banner={banner.url} style={accentVars(accent, black)} />
      <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      <Field label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
      <div className="space-y-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">Imagens</span>
        <ImagePicker label="Ícone (até 1 MB)" url={icon.url} onPick={icon.pick} onRemove={icon.remove} />
        <ImagePicker label="Banner (até 4 MB)" url={banner.url} onPick={banner.pick} onRemove={banner.remove} />
      </div>
      <div>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">Cor de destaque</span>
        <div className="mt-1.5 flex items-center gap-3">
          <input
            type="color"
            aria-label="Cor de destaque"
            value={accent == null ? ACCENT_DEFAULT : colorToHex(accent)}
            onChange={(e) => setAccent(hexToColor(e.target.value))}
            className="h-10 w-14 cursor-pointer rounded-lg border border-ink bg-paper p-1"
          />
          <span className="font-mono text-sm">{accent == null ? "Padrão" : colorToHex(accent)}</span>
          {accent != null && (
            <button type="button" onClick={() => setAccent(null)} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
              Usar a padrão
            </button>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-dnd">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <GhostButton type="button" onClick={onClose}>
          Fechar
        </GhostButton>
        <PrimaryButton busy={busy} disabled={name.trim().length < 2}>
          Salvar
        </PrimaryButton>
      </div>
    </form>
  );
}

// Miniatura da barra do servidor, com as mesmas variáveis que valem depois de salvar.
function GuildPreview({
  name,
  description,
  icon,
  banner,
  style,
}: {
  name: string;
  description: string;
  icon: string | null;
  banner: string | null;
  style: React.CSSProperties | undefined;
}) {
  return (
    <div style={style} className="overflow-hidden rounded-xl border border-ink/30 bg-paper-2" data-guild-preview aria-label="Pré-visualização">
      {banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner} alt="" className="h-20 w-full object-cover" />
      )}
      <div className="flex items-center gap-2 border-b border-ink/15 px-3 py-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-signal font-display text-xs font-bold text-on-signal">
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsOf(name)
          )}
        </span>
        <span className="min-w-0 leading-tight">
          <b className="block truncate font-display text-sm">{name || "Servidor"}</b>
          {description && <span className="block truncate text-xs text-muted">{description}</span>}
        </span>
      </div>
      <div className="space-y-1.5 p-2 text-sm">
        <div className="rounded-md bg-channel-active px-2 py-1 font-semibold"># canal-ativo</div>
        <p className="px-2 text-ink-2">
          Oi <span className="rounded bg-signal/15 px-1 font-semibold text-signal-ink">@alguém</span>, olha o{" "}
          <span className="text-signal-ink underline underline-offset-2">link</span>
        </p>
        <span className="ml-2 inline-block rounded-full bg-signal px-3 py-1 text-xs font-semibold text-on-signal">Botão</span>
      </div>
    </div>
  );
}

function Emojis({ guild }: { guild: ApiGuild }) {
  const { state } = useStore();
  const emojis = state.guilds[guild.id]?.emojis ?? [];
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("name", name.trim());
    form.append("image", file);
    try {
      await api(`/guilds/${guild.id}/emojis`, { body: form });
      setName("");
      setFile(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-ink-3">PNG, GIF, JPG ou WebP até 256 KB. Até 50 por servidor.</p>
      <form onSubmit={upload} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <Field
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
            placeholder="festa"
            maxLength={32}
          />
        </div>
        <label className="flex h-[46px] cursor-pointer items-center gap-1.5 rounded-lg border border-ink bg-paper px-3 text-sm font-semibold hover:bg-paper-2">
          <Upload size={15} />
          {file ? "Trocar" : "Imagem"}
          <input
            type="file"
            accept="image/png,image/gif,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !name) setName(f.name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_]/g, "_").slice(0, 32));
            }}
          />
        </label>
        <PrimaryButton busy={busy} disabled={!file || name.trim().length < 2}>
          Subir
        </PrimaryButton>
      </form>
      {file && <p className="mt-1 truncate text-xs text-muted">{file.name}</p>}
      {error && <p className="mt-2 text-sm text-dnd">{error}</p>}

      <ul className="scroll-thin mt-4 max-h-64 space-y-1 overflow-y-auto">
        {emojis.map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-paper">
            <EmojiGlyph value={`${e.name}:${e.id}`} size={28} />
            <span className="flex-1 font-mono text-sm">:{e.name}:</span>
            <button
              aria-label={`Apagar ${e.name}`}
              onClick={() => api(`/guilds/${guild.id}/emojis/${e.id}`, { method: "DELETE" }).catch((err) => setError(err.message))}
              className="rounded-md p-1.5 text-muted hover:bg-dnd/10 hover:text-dnd"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {!emojis.length && <li className="py-4 text-center text-sm text-faint">Nenhum emoji ainda.</li>}
      </ul>
    </div>
  );
}

function Sounds({ guild }: { guild: ApiGuild }) {
  const { state } = useStore();
  const sounds = state.guilds[guild.id]?.sounds ?? [];
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 300 * 1024) throw new Error("Esse arquivo passa de 300 KB.");
      let seconds: number;
      try {
        seconds = await measureAudio(file);
      } catch {
        throw new Error("Não consegui ler esse áudio. Tenta MP3, OGG ou WAV.");
      }
      if (seconds > MAX_SOUND_SECONDS) throw new Error(`Esse som tem ${seconds.toFixed(1)}s. O limite é ${MAX_SOUND_SECONDS}s.`);
      const form = new FormData();
      form.append("name", name.trim());
      form.append("duration_ms", String(Math.max(1, Math.round(seconds * 1000))));
      form.append("sound", file);
      await api(`/guilds/${guild.id}/sounds`, { body: form });
      setName("");
      setFile(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-ink-3">MP3, OGG, WAV, WebM ou M4A, até 5 segundos e 300 KB. Até 30 por servidor.</p>
      <form onSubmit={upload} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="buzina" maxLength={32} />
        </div>
        <label className="flex h-[46px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-ink bg-paper px-3 text-sm font-semibold hover:bg-paper-2">
          <Upload size={15} />
          {file ? "Trocar" : "Áudio"}
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !name) setName(f.name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N} _-]/gu, " ").trim().slice(0, 32));
            }}
          />
        </label>
        <PrimaryButton busy={busy} disabled={!file || name.trim().length < 2}>
          Subir
        </PrimaryButton>
      </form>
      {file && <p className="mt-1 truncate text-xs text-muted">{file.name}</p>}
      {error && <p className="mt-2 text-sm text-dnd">{error}</p>}

      <ul className="scroll-thin mt-4 max-h-64 space-y-1 overflow-y-auto">
        {sounds.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-paper">
            <button
              aria-label={`Ouvir ${s.name}`}
              onClick={() => {
                unlockAudio();
                playSound(s.url, 0.8).catch((err) => setError(err.message));
              }}
              className="rounded-md p-1.5 text-ink-3 hover:bg-paper-2 hover:text-ink"
            >
              <Play size={15} />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
            <span className="font-mono text-xs text-muted">{(s.duration_ms / 1000).toFixed(1)}s</span>
            <button
              aria-label={`Apagar ${s.name}`}
              onClick={() => api(`/guilds/${guild.id}/sounds/${s.id}`, { method: "DELETE" }).catch((err) => setError(err.message))}
              className="rounded-md p-1.5 text-muted hover:bg-dnd/10 hover:text-dnd"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {!sounds.length && <li className="py-4 text-center text-sm text-faint">Nenhum som ainda.</li>}
      </ul>
    </div>
  );
}

type Hook = { id: string; channel_id: string; name: string; url?: string };

function Webhooks({ guild }: { guild: ApiGuild }) {
  const textChannels = guild.channels.filter((c) => c.type === 0);
  const [hooks, setHooks] = useState<Hook[] | null>(null);
  const [name, setName] = useState("Avisos do sistema");
  const [channelId, setChannelId] = useState(textChannels[0]?.id ?? "");
  const [fresh, setFresh] = useState<Hook | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Hook[]>(`/guilds/${guild.id}/webhooks`)
      .then(setHooks)
      .catch((e) => setError(e.message));
  }, [guild.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const hook = await api<Hook>(`/channels/${channelId}/webhooks`, { body: { name: name.trim() } });
      setFresh(hook);
      setHooks((h) => [...(h ?? []), hook]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api(`/webhooks/${id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    setHooks((h) => (h ?? []).filter((x) => x.id !== id));
    if (fresh?.id === id) setFresh(null);
  }

  return (
    <div>
      <p className="text-sm text-ink-3">Um webhook é um link secreto que posta mensagens num canal. Serve pra ligar outros sistemas.</p>
      <form onSubmit={create} className="mt-3 space-y-2">
        <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        <label className="block">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">Canal</span>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-ink bg-paper px-3 py-2.5 text-[15px] outline-none"
          >
            {textChannels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end">
          <PrimaryButton busy={busy} disabled={!name.trim() || !channelId}>
            Criar webhook
          </PrimaryButton>
        </div>
      </form>

      {fresh?.url && (
        <div className="mt-3 rounded-lg border border-mustard bg-mustard/15 p-3">
          <p className="text-xs font-semibold">Copia agora: esse link não aparece de novo.</p>
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={fresh.url} className="min-w-0 flex-1 rounded border border-ink/20 bg-sheet px-2 py-1 font-mono text-xs" />
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(fresh.url!).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex items-center gap-1 rounded bg-ink px-2 py-1 text-xs font-semibold text-sheet"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-dnd">{error}</p>}

      <ul className="mt-4 space-y-1">
        {(hooks ?? []).map((h) => (
          <li key={h.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-paper">
            <span className="min-w-0 flex-1 leading-tight">
              <b className="block truncate text-sm">{h.name}</b>
              <span className="text-xs text-muted">#{guild.channels.find((c) => c.id === h.channel_id)?.name ?? "canal"}</span>
            </span>
            <button
              aria-label={`Apagar ${h.name}`}
              onClick={() => remove(h.id)}
              className="rounded-md p-1.5 text-muted hover:bg-dnd/10 hover:text-dnd"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {hooks && !hooks.length && <li className="py-4 text-center text-sm text-faint">Nenhum webhook ainda.</li>}
      </ul>
    </div>
  );
}
