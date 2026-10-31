import { ApiError, Errors, json, route } from "@/lib/server/http";
import {
  listRoomParticipants,
  livekitConfig,
  participantSession,
  verifyLivekitWebhook,
  voiceRoomName,
} from "@/lib/server/livekit";
import { parseSnowflake } from "@/lib/server/snowflake";
import { removeVoiceState } from "@/lib/server/voice";

type WebhookEvent = {
  event?: string;
  room?: { name?: string };
  participant?: { identity?: string; metadata?: string };
};

// POST /api/v1/voice/webhook
// Chamado pelo LiveKit. Quando alguém sai da sala (mesmo se a aba morreu sem avisar),
// tira a pessoa do canal na hora em vez de esperar a varredura.
export const POST = route(async (req) => {
  const cfg = livekitConfig();
  if (!cfg) throw new ApiError(503, 0, "Voice server is not configured");

  // a assinatura cobre os bytes exatos do corpo
  const body = await req.text();
  if (!verifyLivekitWebhook(cfg, body, req.headers.get("authorization"))) throw Errors.unauthorized();

  let event: WebhookEvent;
  try {
    event = JSON.parse(body);
  } catch {
    throw new ApiError(400, 50109, "The request body contains invalid JSON.");
  }
  if (event.event !== "participant_left") return json({ ok: true });

  const channelId = parseSnowflake(event.room?.name?.replace(/^voice-/, "") ?? "");
  const userId = parseSnowflake(event.participant?.identity ?? "");
  const sessionId = participantSession(event.participant?.metadata);
  // sem sessão (token antigo) não dá pra saber qual dispositivo saiu: fica pra varredura
  if (channelId == null || userId == null || !sessionId) return json({ ok: true });

  // reconexão completa do mesmo dispositivo também gera participant_left, com a pessoa já de volta na sala
  const inRoom = await listRoomParticipants(cfg, voiceRoomName(channelId));
  const back = inRoom?.some((p) => p.identity === userId.toString() && participantSession(p.metadata) === sessionId);
  if (back) return json({ ok: true });

  await removeVoiceState({ userId, channelId, sessionId });
  return json({ ok: true });
});
