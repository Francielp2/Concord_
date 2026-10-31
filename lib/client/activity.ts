import type { State } from "./store";
import type { ApiChannel, ApiGuild } from "./types";

// A atividade escolhida viaja no custom_status, em texto ("act:game|Valorant"): não precisa de
// coluna nova. Tudo que mostra o custom_status passa por aqui, para o prefixo nunca aparecer.
export type ActivityKind = "game" | "watch" | "listen" | "compete";
export type Activity = { kind: ActivityKind; name: string };

export const ACTIVITY_NAME_MAX = 32;

export const ACTIVITY_KINDS: { id: ActivityKind; label: string }[] = [
  { id: "game", label: "Jogando" },
  { id: "watch", label: "Assistindo" },
  { id: "listen", label: "Ouvindo" },
  { id: "compete", label: "Competindo" },
];

const PREFIX = /^act:(game|watch|listen|compete)\|([\s\S]+)$/;

export const cleanActivityName = (name: string) => name.trim().replace(/\s+/g, " ").slice(0, ACTIVITY_NAME_MAX);

export const encodeActivity = ({ kind, name }: Activity) => `act:${kind}|${cleanActivityName(name)}`;

export function parseCustomStatus(raw: string | null | undefined): { activity: Activity | null; text: string | null } {
  const value = raw?.trim();
  if (!value) return { activity: null, text: null };
  const m = value.match(PREFIX);
  const name = m && cleanActivityName(m[2]);
  if (name) return { activity: { kind: m[1] as ActivityKind, name }, text: null };
  // prefixo sem nome não tem o que mostrar; qualquer outra coisa é status de texto comum
  return { activity: null, text: value.startsWith("act:") && value.endsWith("|") ? null : value };
}

export const activityLine = ({ kind, name }: Activity) => `${ACTIVITY_KINDS.find((k) => k.id === kind)!.label} ${name}`;

// texto pronto de um custom_status, para quem só exibe uma linha
export function customStatusText(raw: string | null | undefined) {
  const { activity, text } = parseCustomStatus(raw);
  return activity ? activityLine(activity) : text;
}

export type Brand = "youtube" | "spotify" | "twitch" | "netflix" | "game";

const BRANDS: [Brand, string[]][] = [
  ["youtube", ["youtube"]],
  ["spotify", ["spotify"]],
  ["twitch", ["twitch"]],
  ["netflix", ["netflix"]],
  ["game", ["valorant", "minecraft", "lol", "league of legends", "cs2", "fortnite"]],
];

// palavra inteira: "lol" não pode reconhecer "Lollapalooza"
export function brandOf(name: string): Brand | null {
  const text = ` ${name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ")} `;
  return BRANDS.find(([, words]) => words.some((w) => text.includes(` ${w} `)))?.[0] ?? null;
}

export type FriendCall = { guild: ApiGuild; channelId: string; channel: ApiChannel | undefined };

// O canal pode não estar na lista se a pessoa não puder vê-lo: aí a chamada aparece sem nome.
export function callOf(s: State, userId: string): FriendCall | null {
  for (const guild of Object.values(s.guilds)) {
    const voice = guild.voice_states.find((v) => v.user_id === userId && v.channel_id);
    if (voice) return { guild, channelId: voice.channel_id!, channel: guild.channels.find((c) => c.id === voice.channel_id) };
  }
  return null;
}

export type LiveActivity = {
  activity: Activity | null;
  call: FriendCall | null;
  line: string | null; // null: só o status (Online, Ausente...)
  rank: number;
};

// Prioridade ao exibir: atividade escolhida > chamada > status de texto > status
export function liveActivity(s: State, userId: string): LiveActivity {
  const { activity, text } = parseCustomStatus(s.presences[userId]?.custom_status);
  const call = callOf(s, userId);
  if (activity) return { activity, call, line: activityLine(activity), rank: 0 };
  if (call) return { activity, call, line: call.channel?.name ? `Em chamada · ${call.channel.name}` : "Em chamada", rank: 1 };
  if (text) return { activity, call, line: text, rank: 2 };
  return { activity, call, line: null, rank: 3 };
}
