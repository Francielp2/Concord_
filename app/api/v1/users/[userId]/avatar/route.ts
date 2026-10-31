import { requireAuth, requireMe } from "@/lib/server/auth";
import { AVATAR_MAX_BYTES } from "@/lib/server/avatars";
import { db } from "@/lib/server/db";
import { assetUrl } from "@/lib/server/guildAssets";
import { ApiError, Errors, json, route } from "@/lib/server/http";
import { limit } from "@/lib/server/ratelimit";
import { snowflake } from "@/lib/server/snowflake";
import { sniffImageType, storeFile, usingBlob } from "@/lib/server/storage";

type Params = { userId: string };

// POST /api/v1/users/@me/avatar  (multipart: image)
// Só guarda o arquivo e devolve a url. Passa a valer no PATCH /users/@me, ao salvar.
export const POST = route<Params>(async (req, { params }) => {
  const { user } = await requireAuth(req);
  requireMe((await params).userId);
  await limit("upload", user.id);

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!file || typeof file === "string") throw Errors.badRequest("Missing image");
  if (file.size > AVATAR_MAX_BYTES) throw new ApiError(400, 50138, `Image too big (max ${AVATAR_MAX_BYTES / 1024 / 1024} MB)`);

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(buf);
  if (!type) throw Errors.badRequest("Image must be PNG, JPEG, GIF or WebP");

  const id = snowflake();
  if (usingBlob()) {
    const stored = await storeFile(`avatars/${user.id}/${id}.${type.split("/")[1]}`, buf, type);
    return json({ url: stored.url }, 201);
  }

  // Sem Blob, o único lugar para os bytes é a tabela de imagens de servidor, que exige um servidor.
  const member = await db.member.findFirst({ where: { userId: user.id }, orderBy: { joinedAt: "asc" }, select: { guildId: true } });
  if (!member) throw new ApiError(400, 50142, "Join a server before uploading a photo");
  const asset = await db.guildAsset.create({
    data: { id, guildId: member.guildId, contentType: type, data: new Uint8Array(buf) },
    select: { id: true, url: true },
  });
  return json({ url: assetUrl(asset) }, 201);
});
