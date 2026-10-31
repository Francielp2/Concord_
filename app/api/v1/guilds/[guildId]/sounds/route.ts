import { requireAuth } from "@/lib/server/auth";
import { requireMember, requirePermission } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { soundSelect, serializeSound } from "@/lib/server/guilds";
import { ApiError, Errors, json, route } from "@/lib/server/http";
import { Permissions } from "@/lib/server/permissions";
import { limit } from "@/lib/server/ratelimit";
import { snowflake } from "@/lib/server/snowflake";
import { MAX_SOUND_BYTES, MAX_SOUND_MS, MAX_SOUNDS, SOUND_NAME, broadcastSounds, soundExtension } from "@/lib/server/sounds";
import { sniffAudioType, storeFile } from "@/lib/server/storage";
import { idParam } from "@/lib/server/validate";

type Params = { guildId: string };

// GET /api/v1/guilds/{id}/sounds
export const GET = route<Params>(async (req, { params }) => {
  const { user } = await requireAuth(req);
  const guildId = idParam((await params).guildId, Errors.unknownGuild);
  await requireMember(guildId, user.id);
  const sounds = await db.sound.findMany({ where: { guildId }, select: soundSelect, orderBy: { name: "asc" } });
  return json(sounds.map(serializeSound));
});

// POST /api/v1/guilds/{id}/sounds  (multipart: name, duration_ms, sound)  MANAGE_SOUNDBOARD
export const POST = route<Params>(async (req, { params }) => {
  const { user } = await requireAuth(req);
  const guildId = idParam((await params).guildId, Errors.unknownGuild);
  const ctx = await requireMember(guildId, user.id);
  requirePermission(ctx, Permissions.MANAGE_SOUNDBOARD);
  await limit("soundCreate", user.id);

  const form = await req.formData().catch(() => null);
  const name = String(form?.get("name") ?? "").trim();
  const durationMs = Number(form?.get("duration_ms"));
  const file = form?.get("sound");
  if (!SOUND_NAME.test(name)) {
    throw new ApiError(400, 50035, "Invalid Form Body", { name: { _errors: [{ code: "STRING_TYPE_REGEX", message: "Invalid name" }] } });
  }
  if (!file || typeof file === "string") throw Errors.badRequest("Missing sound");
  if (file.size > MAX_SOUND_BYTES) throw new ApiError(400, 50138, "Sound too big (max 300 KB)");
  // Medido no navegador: aqui não há decodificador. Quem toca corta em 5s, então mentir não adianta.
  if (!Number.isInteger(durationMs) || durationMs <= 0 || durationMs > MAX_SOUND_MS) {
    throw new ApiError(400, 50138, "Sound too long (max 5 seconds)");
  }
  if ((await db.sound.count({ where: { guildId } })) >= MAX_SOUNDS) throw new ApiError(400, 30008, `Maximum number of sounds reached (${MAX_SOUNDS})`);

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffAudioType(buf);
  if (!type) throw Errors.badRequest("Sound must be MP3, OGG, WAV, WebM or M4A");

  const id = snowflake();
  const stored = await storeFile(`sounds/${guildId}/${id}.${soundExtension(type)}`, buf, type);
  const sound = await db.sound.create({
    data: { id, guildId, name, creatorId: user.id, contentType: type, durationMs, url: stored.url, data: stored.data ? new Uint8Array(stored.data) : null },
    select: soundSelect,
  });
  await broadcastSounds(guildId);
  return json(serializeSound(sound), 201);
});
