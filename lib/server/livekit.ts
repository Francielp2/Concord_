import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Permissions, has } from "./permissions";

// Token de acesso do LiveKit (SFU de áudio/vídeo). É um JWT HS256 comum:
// https://docs.livekit.io/home/get-started/authentication/
// Configuração: LIVEKIT_URL (wss://...), LIVEKIT_API_KEY, LIVEKIT_API_SECRET.

export function livekitConfig() {
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  return url && key && secret ? { url, key, secret } : null;
}

type LivekitConfig = NonNullable<ReturnType<typeof livekitConfig>>;

const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");

function signJwt(claims: object, secret: string) {
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64(claims);
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export const voiceRoomName = (channelId: bigint) => `voice-${channelId}`;

// O id da sessão do dispositivo vai no metadata do participante: a identity é o usuário,
// igual em todos os dispositivos, e só com ela não dá pra saber qual deles saiu.
export function participantSession(metadata: string | undefined): string | null {
  if (!metadata) return null;
  try {
    const session = JSON.parse(metadata)?.session_id;
    return typeof session === "string" ? session : null;
  } catch {
    return null;
  }
}

// O que cada um pode publicar na sala, a partir das permissões do canal.
// Lista vazia em canPublishSources significa "tudo" no LiveKit: sem fonte, canPublish fica false.
export function voiceGrants(perms: bigint, serverMute: boolean) {
  const speak = has(perms, Permissions.SPEAK);
  const sources = [
    ...(speak && !serverMute ? ["MICROPHONE"] : []),
    ...(speak && has(perms, Permissions.STREAM) ? ["CAMERA", "SCREEN_SHARE", "SCREEN_SHARE_AUDIO"] : []),
  ];
  return {
    canSubscribe: true,
    canPublish: sources.length > 0,
    // soundboard é mensagem de dados: sem a permissão, o próprio LiveKit recusa o envio
    canPublishData: has(perms, Permissions.USE_SOUNDBOARD),
    canPublishSources: sources,
  };
}

export type VoiceGrants = ReturnType<typeof voiceGrants>;

export function livekitToken(input: {
  key: string;
  secret: string;
  identity: string;
  name: string;
  room: string;
  grants: VoiceGrants;
  sessionId: string;
  ttlSeconds?: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    {
      iss: input.key,
      sub: input.identity,
      name: input.name,
      metadata: JSON.stringify({ session_id: input.sessionId }),
      nbf: now - 10,
      exp: now + (input.ttlSeconds ?? 6 * 60 * 60),
      video: {
        room: input.room,
        roomJoin: true,
        ...input.grants,
        // no JWT as fontes vão em minúsculas; na API do servidor, em maiúsculas
        canPublishSources: input.grants.canPublishSources.map((s) => s.toLowerCase()),
      },
    },
    input.secret,
  );
}

// API do servidor do LiveKit (Twirp com JSON). Devolve null se não deu pra perguntar.
async function roomService<T>(cfg: LivekitConfig, method: string, room: string, body: object): Promise<T | null> {
  const now = Math.floor(Date.now() / 1000);
  const token = signJwt({ iss: cfg.key, sub: "concord-server", nbf: now - 10, exp: now + 60, video: { room, roomAdmin: true } }, cfg.secret);
  try {
    const res = await fetch(`${cfg.url.replace(/^ws/, "http").replace(/\/$/, "")}/twirp/livekit.RoomService/${method}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ room, ...body }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.error(`[concord] LiveKit ${method} respondeu ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[concord] LiveKit ${method} falhou`, err);
    return null;
  }
}

type LivekitParticipant = { identity: string; metadata?: string };

export async function listRoomParticipants(cfg: LivekitConfig, room: string) {
  const res = await roomService<{ participants?: LivekitParticipant[] }>(cfg, "ListParticipants", room, {});
  return res ? (res.participants ?? []) : null;
}

export async function updateParticipantGrants(cfg: LivekitConfig, room: string, identity: string, permission: VoiceGrants) {
  // quem ainda não conectou na sala recebe a regra nova no token; aqui só importa se já está lá
  await roomService(cfg, "UpdateParticipant", room, { identity, permission });
}

// Assinatura do webhook: o header Authorization é um JWT HS256 com o SHA-256 do corpo.
// https://docs.livekit.io/home/server/webhooks/
export function verifyLivekitWebhook(cfg: LivekitConfig, body: string, header: string | null) {
  const [head, payload, signature, ...rest] = (header ?? "").replace(/^Bearer\s+/i, "").split(".");
  if (!head || !payload || !signature || rest.length) return false;

  const expected = createHmac("sha256", cfg.secret).update(`${head}.${payload}`).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;

  try {
    const { alg } = JSON.parse(Buffer.from(head, "base64url").toString());
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    const now = Math.floor(Date.now() / 1000);
    if (alg !== "HS256" || claims.iss !== cfg.key) return false;
    if (typeof claims.exp === "number" && claims.exp < now) return false;
    if (typeof claims.nbf === "number" && claims.nbf > now + 60) return false;
    return claims.sha256 === createHash("sha256").update(body).digest("base64");
  } catch {
    return false;
  }
}
