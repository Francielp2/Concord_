import { requireAuth } from "@/lib/server/auth";
import { DM_SESSION_ID, assertNoBlock, requireDmParticipant } from "@/lib/server/dmCalls";
import { ApiError, Errors, json, readJson, route } from "@/lib/server/http";
import { dmGrants, dmRoomName, livekitConfig, livekitToken } from "@/lib/server/livekit";
import { sid } from "@/lib/server/serialize";
import { Form } from "@/lib/server/validate";

// POST /api/v1/voice/dm-token { channel_id, session_id }
// Token da sala de chamada de uma DM. Sem VoiceState: quem participa da conversa e não tem bloqueio
// entra na sala. A identity é o usuário, então o último dispositivo a entrar derruba o anterior.
export const POST = route(async (req) => {
  const { user } = await requireAuth(req);
  const cfg = livekitConfig();
  if (!cfg) throw new ApiError(503, 0, "Voice server is not configured");

  const form = new Form(await readJson(req));
  const channelId = form.snowflake("channel_id");
  const session = form.string("session_id", { pattern: DM_SESSION_ID });
  form.done();
  if (channelId == null) throw Errors.badRequest("channel_id is required");

  const channel = await requireDmParticipant(channelId, user.id);
  await assertNoBlock(channel, user.id);

  const token = livekitToken({
    key: cfg.key,
    secret: cfg.secret,
    identity: user.id.toString(),
    name: user.globalName || user.username,
    room: dmRoomName(channel.id),
    sessionId: session!,
    grants: dmGrants(),
  });
  return json({ url: cfg.url, token, channel_id: sid(channel.id), session_id: session });
});
