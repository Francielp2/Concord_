import { requireAuth } from "@/lib/server/auth";
import { permissionsInChannel } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { dispatch } from "@/lib/server/events";
import { ApiError, Errors, json, readJson, route } from "@/lib/server/http";
import { livekitConfig, updateParticipantGrants, voiceGrants, voiceRoomName } from "@/lib/server/livekit";
import { Permissions, has } from "@/lib/server/permissions";
import { serializeVoiceState } from "@/lib/server/serialize";
import { Form, idParam } from "@/lib/server/validate";

type Params = { guildId: string; userId: string };

// PATCH /api/v1/guilds/{id}/voice-states/{user.id} { mute }  MUTE_MEMBERS
// Silencia para todos. A permissão é retirada no próprio LiveKit, então não dá pra
// religar o microfone pelo cliente. Vale até a pessoa sair do canal.
export const PATCH = route<Params>(async (req, { params }) => {
  const { user } = await requireAuth(req);
  const p = await params;
  const guildId = idParam(p.guildId, Errors.unknownGuild);
  const userId = idParam(p.userId, Errors.unknownUser);

  const form = new Form(await readJson(req));
  const mute = form.bool("mute");
  form.done();
  if (mute === undefined) throw Errors.badRequest("mute is required");

  const state = await db.voiceState.findFirst({ where: { userId, guildId } });
  if (!state) throw new ApiError(400, 40032, "Target user is not connected to voice");
  if (!has(await permissionsInChannel(state.channelId, user.id), Permissions.MUTE_MEMBERS)) throw Errors.missingPermissions();

  const cfg = livekitConfig();
  if (cfg) {
    const perms = await permissionsInChannel(state.channelId, userId);
    await updateParticipantGrants(cfg, voiceRoomName(state.channelId), userId.toString(), voiceGrants(perms, mute));
  }
  const updated = await db.voiceState.update({ where: { userId }, data: { serverMute: mute } });
  const payload = serializeVoiceState(updated);
  await dispatch("VOICE_STATE_UPDATE", payload, { guildId });
  return json(payload);
});
