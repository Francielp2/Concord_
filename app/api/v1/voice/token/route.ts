import { requireAuth } from "@/lib/server/auth";
import { permissionsInChannel } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { ApiError, json, readJson, route } from "@/lib/server/http";
import { livekitConfig, livekitToken, voiceGrants, voiceRoomName } from "@/lib/server/livekit";
import { Permissions, has } from "@/lib/server/permissions";
import { sid } from "@/lib/server/serialize";

// POST /api/v1/voice/token
// Depois de entrar num canal de voz pelo gateway (op 4), o cliente pede aqui o token
// da sala de mídia. A sala é o próprio canal; quem não está no canal não recebe token.
// Com session_id, recusa o dispositivo que já perdeu a vez para outro (409).
export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  const cfg = livekitConfig();
  if (!cfg) throw new ApiError(503, 0, "Voice server is not configured");

  const state = await db.voiceState.findUnique({ where: { userId: user.id } });
  if (!state) throw new ApiError(400, 50024, "You are not connected to a voice channel");
  const { session_id: session } = await readJson(req);
  if (session !== undefined && session !== state.sessionId) throw new ApiError(409, 40032, "Voice session moved to another device");

  const perms = await permissionsInChannel(state.channelId, user.id);
  if (!has(perms, Permissions.CONNECT)) throw new ApiError(403, 50013, "Missing Permissions");

  const token = livekitToken({
    key: cfg.key,
    secret: cfg.secret,
    identity: user.id.toString(),
    name: user.globalName || user.username,
    room: voiceRoomName(state.channelId),
    sessionId: state.sessionId,
    grants: voiceGrants(perms, state.serverMute),
  });
  return json({ url: cfg.url, token, channel_id: sid(state.channelId), session_id: state.sessionId });
});
