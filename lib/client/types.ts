// Formatos que a API devolve (mesmo padrão do Discord: snake_case, ids em string)

export type ApiUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  bio: string | null;
  email?: string;
  verified?: boolean;
  bot?: boolean;
};

export type ApiRole = {
  id: string;
  name: string;
  color: number;
  permissions: string;
  position: number;
  hoist: boolean;
};

export type ApiOverwrite = { id: string; type: number; allow: string; deny: string };

export type ApiChannel = {
  id: string;
  type: number; // 0 texto, 1 DM, 2 voz, 3 grupo, 4 categoria
  guild_id?: string;
  name: string | null;
  topic?: string | null;
  position?: number;
  parent_id?: string | null;
  last_message_id: string | null;
  rate_limit_per_user?: number;
  recipients?: ApiUser[];
  owner_id?: string | null;
  user_limit?: number | null;
  permission_overwrites?: ApiOverwrite[];
  message_count?: number;
  thread_metadata?: { archived: boolean };
};

export type ApiMember = { user?: ApiUser; nick: string | null; roles: string[]; joined_at: string };

export type ApiVoiceState = {
  user_id: string;
  guild_id: string;
  channel_id: string | null;
  session_id: string;
  self_mute: boolean;
  self_deaf: boolean;
  mute?: boolean; // silenciado por um moderador
  call_started_at?: string | null;
};

export type ApiEmoji = { id: string; name: string; animated: boolean; url: string };

export type ApiSound = { id: string; name: string; duration_ms: number; url: string };

export type ApiGuild = {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  banner?: string | null;
  accent_color?: number | null;
  owner_id: string;
  system_channel_id: string | null;
  permissions: string;
  member_count: number;
  roles: ApiRole[];
  channels: ApiChannel[];
  members: ApiMember[];
  voice_states: ApiVoiceState[];
  emojis?: ApiEmoji[];
  sounds?: ApiSound[];
};

export type ApiReaction = { emoji: { id: null; name: string }; count: number; me: boolean };

export type ApiMessage = {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: ApiUser;
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  type: number;
  pinned: boolean;
  mentions: ApiUser[];
  mention_everyone: boolean;
  mention_roles: string[];
  reactions: ApiReaction[];
  attachments: ApiAttachment[];
  message_reference?: { message_id: string };
  thread?: { id: string; name: string; message_count: number; archived: boolean };
  webhook_id?: string;
  referenced_message?: ApiMessage | null;
  nonce?: string;
  // só no cliente
  pending?: boolean;
  failed?: boolean;
};

export type ApiAttachment = {
  id: string;
  filename: string;
  url: string;
  size: number;
  content_type: string | null;
  width?: number | null;
  height?: number | null;
};

export type ApiRelationship = { id: string; type: number; user: ApiUser; since: string };

export type ApiPresence = { user: { id: string }; status: Status; custom_status: string | null };

export type ApiReadState = { id: string; last_message_id: string | null; mention_count: number };

export type Status = "online" | "idle" | "dnd" | "offline" | "invisible";

export type Ready = {
  session_id: string;
  user: ApiUser;
  guilds: ApiGuild[];
  private_channels: ApiChannel[];
  relationships: ApiRelationship[];
  read_state: ApiReadState[];
  presences: ApiPresence[];
  self_presence?: { status: Status; custom_status: string | null };
};

export type ApiInvite = {
  code: string;
  guild?: { id: string; name: string; icon: string | null; description: string | null };
  channel?: { id: string; name: string; type: number };
  inviter?: ApiUser;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  expires_at: string | null;
};

export const Rel = { FRIEND: 1, BLOCKED: 2, INCOMING: 3, OUTGOING: 4 } as const;

export const Perm = {
  CREATE_INSTANT_INVITE: BigInt(1) << BigInt(0),
  KICK_MEMBERS: BigInt(1) << BigInt(1),
  ADMINISTRATOR: BigInt(1) << BigInt(3),
  MANAGE_CHANNELS: BigInt(1) << BigInt(4),
  MANAGE_GUILD: BigInt(1) << BigInt(5),
  VIEW_CHANNEL: BigInt(1) << BigInt(10),
  MANAGE_MESSAGES: BigInt(1) << BigInt(13),
  MANAGE_WEBHOOKS: BigInt(1) << BigInt(29),
  MANAGE_GUILD_EXPRESSIONS: BigInt(1) << BigInt(30),
  ATTACH_FILES: BigInt(1) << BigInt(15),
  CONNECT: BigInt(1) << BigInt(20),
  MUTE_MEMBERS: BigInt(1) << BigInt(22),
  MOVE_MEMBERS: BigInt(1) << BigInt(24),
  USE_SOUNDBOARD: BigInt(1) << BigInt(42),
  MANAGE_SOUNDBOARD: BigInt(1) << BigInt(43),
} as const;

export function hasPerm(perms: string | undefined, flag: bigint) {
  if (!perms) return false;
  const p = BigInt(perms);
  return (p & Perm.ADMINISTRATOR) === Perm.ADMINISTRATOR || (p & flag) === flag;
}

// guild.permissions não conta as exceções do canal. Mesma conta do servidor (lib/server/permissions.ts);
// o servidor continua decidindo, aqui é só para não oferecer o que vai ser recusado.
export function channelHasPerm(guild: ApiGuild, channel: ApiChannel, userId: string | undefined, flag: bigint) {
  if (!guild.permissions) return false;
  let perms = BigInt(guild.permissions);
  if ((perms & Perm.ADMINISTRATOR) === Perm.ADMINISTRATOR) return true;
  const roles = guild.members.find((m) => m.user?.id === userId)?.roles ?? [];
  const list = channel.permission_overwrites ?? [];
  const everyone = list.find((o) => o.id === guild.id);
  if (everyone) perms = (perms & ~BigInt(everyone.deny)) | BigInt(everyone.allow);
  let allow = BigInt(0);
  let deny = BigInt(0);
  for (const o of list) {
    if (o.type === 0 && o.id !== guild.id && roles.includes(o.id)) {
      allow |= BigInt(o.allow);
      deny |= BigInt(o.deny);
    }
  }
  perms = (perms & ~deny) | allow;
  const mine = list.find((o) => o.type === 1 && o.id === userId);
  if (mine) perms = (perms & ~BigInt(mine.deny)) | BigInt(mine.allow);
  return (perms & Perm.VIEW_CHANNEL) === Perm.VIEW_CHANNEL && (perms & flag) === flag;
}

// dá para entrar nesse canal de voz agora? (permissão e lugar na sala)
export function canJoinVoice(guild: ApiGuild, channel: ApiChannel, userId: string | undefined) {
  if (!channelHasPerm(guild, channel, userId, Perm.CONNECT)) return false;
  const limit = channel.user_limit ?? 0;
  if (limit <= 0 || guild.voice_states.filter((v) => v.channel_id === channel.id).length < limit) return true;
  return channelHasPerm(guild, channel, userId, Perm.MOVE_MEMBERS);
}
