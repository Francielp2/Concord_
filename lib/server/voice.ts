import { db } from "./db";
import { dispatch } from "./events";
import { listRoomParticipants, livekitConfig, participantSession, voiceRoomName } from "./livekit";
import { serializeVoiceState } from "./serialize";

// Sem heartbeat de voz por esse tempo (e sem mídia viva no LiveKit), a pessoa sai do canal.
// Separado da presença: o celular pode ter caído da chamada com o PC ainda online.
export const VOICE_TIMEOUT_MS = 25_000;

type VoiceWhere = { userId: bigint; sessionId?: string; channelId?: bigint; lastSeenAt?: { lt: Date } };

// Apaga o estado e avisa a guild. Com sessionId, só apaga se a sessão ainda for aquela:
// o dispositivo antigo não pode derrubar o que entrou depois dele.
export async function removeVoiceState(where: VoiceWhere) {
  const state = await db.voiceState.findFirst({ where });
  if (!state) return null;
  const { count } = await db.voiceState.deleteMany({ where });
  if (!count) return null; // outra requisição (webhook, beacon, varredura) chegou antes
  const payload = { ...serializeVoiceState(state), channel_id: null };
  await dispatch("VOICE_STATE_UPDATE", payload, { guildId: state.guildId });
  return payload;
}

// Limpa a voz fantasma. O heartbeat pode parar com a chamada viva (aba congelada no celular),
// então, com LiveKit configurado, a sala decide antes de tirar alguém.
export async function sweepVoice(now: Date) {
  const cutoff = new Date(now.getTime() - VOICE_TIMEOUT_MS);
  const stale = await db.voiceState.findMany({ where: { lastSeenAt: { lt: cutoff } }, take: 200 });
  if (!stale.length) return;

  const cfg = livekitConfig();
  const rooms = new Map<bigint, Awaited<ReturnType<typeof listRoomParticipants>>>();
  if (cfg) {
    await Promise.all(
      [...new Set(stale.map((v) => v.channelId))].map(async (channelId) => {
        rooms.set(channelId, await listRoomParticipants(cfg, voiceRoomName(channelId)));
      }),
    );
  }

  for (const v of stale) {
    const alive = rooms
      .get(v.channelId)
      ?.some((p) => p.identity === v.userId.toString() && participantSession(p.metadata) === v.sessionId);
    if (alive) {
      await db.voiceState.updateMany({ where: { userId: v.userId, sessionId: v.sessionId }, data: { lastSeenAt: now } });
    } else {
      await removeVoiceState({ userId: v.userId, sessionId: v.sessionId, lastSeenAt: { lt: cutoff } });
    }
  }
}
