import { requireAuth } from "@/lib/server/auth";
import { requireMember, requirePermission } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { soundSelect, serializeSound } from "@/lib/server/guilds";
import { ApiError, Errors, json, noContent, readJson, route } from "@/lib/server/http";
import { Permissions } from "@/lib/server/permissions";
import { SOUND_NAME, broadcastSounds } from "@/lib/server/sounds";
import { removeFiles } from "@/lib/server/storage";
import { idParam } from "@/lib/server/validate";

type Params = { guildId: string; soundId: string };

const unknownSound = () => new ApiError(404, 10097, "Unknown Sound");

async function load(req: Parameters<typeof requireAuth>[0], params: Promise<Params>) {
  const { user } = await requireAuth(req);
  const p = await params;
  const guildId = idParam(p.guildId, Errors.unknownGuild);
  const soundId = idParam(p.soundId, unknownSound);
  const ctx = await requireMember(guildId, user.id);
  requirePermission(ctx, Permissions.MANAGE_SOUNDBOARD);
  const sound = await db.sound.findFirst({ where: { id: soundId, guildId }, select: soundSelect });
  if (!sound) throw unknownSound();
  return { guildId, sound };
}

// PATCH /api/v1/guilds/{id}/sounds/{sound.id} { name }
export const PATCH = route<Params>(async (req, { params }) => {
  const { guildId, sound } = await load(req, params);
  const body = await readJson(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!SOUND_NAME.test(name)) {
    throw new ApiError(400, 50035, "Invalid Form Body", { name: { _errors: [{ code: "STRING_TYPE_REGEX", message: "Invalid name" }] } });
  }
  const updated = await db.sound.update({ where: { id: sound.id }, data: { name }, select: soundSelect });
  await broadcastSounds(guildId);
  return json(serializeSound(updated));
});

// DELETE /api/v1/guilds/{id}/sounds/{sound.id}
export const DELETE = route<Params>(async (req, { params }) => {
  const { guildId, sound } = await load(req, params);
  await removeFiles([sound.url]);
  await db.sound.delete({ where: { id: sound.id } });
  await broadcastSounds(guildId);
  return noContent();
});
