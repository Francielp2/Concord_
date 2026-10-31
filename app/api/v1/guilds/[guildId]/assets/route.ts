import { requireAuth } from "@/lib/server/auth";
import { requireMember, requirePermission } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { ASSET_LIMITS, assetUrl, type AssetKind } from "@/lib/server/guildAssets";
import { ApiError, Errors, json, route } from "@/lib/server/http";
import { Permissions } from "@/lib/server/permissions";
import { limit } from "@/lib/server/ratelimit";
import { snowflake } from "@/lib/server/snowflake";
import { sniffImageType, storeFile } from "@/lib/server/storage";
import { idParam } from "@/lib/server/validate";

type Params = { guildId: string };

// POST /api/v1/guilds/{id}/assets  (multipart: kind = icon|banner, image)  MANAGE_GUILD
// Só guarda o arquivo e devolve a url. Passa a valer no PATCH /guilds/{id}, ao salvar.
export const POST = route<Params>(async (req, { params }) => {
  const { user } = await requireAuth(req);
  const guildId = idParam((await params).guildId, Errors.unknownGuild);
  const ctx = await requireMember(guildId, user.id);
  requirePermission(ctx, Permissions.MANAGE_GUILD);
  await limit("upload", user.id);

  const form = await req.formData().catch(() => null);
  const kind = String(form?.get("kind") ?? "");
  const file = form?.get("image");
  if (kind !== "icon" && kind !== "banner") throw Errors.badRequest("kind must be icon or banner");
  if (!file || typeof file === "string") throw Errors.badRequest("Missing image");
  const max = ASSET_LIMITS[kind as AssetKind];
  if (file.size > max) throw new ApiError(400, 50138, `Image too big (max ${max / 1024 / 1024} MB)`);

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(buf);
  if (!type) throw Errors.badRequest("Image must be PNG, JPEG, GIF or WebP");

  const id = snowflake();
  const stored = await storeFile(`guilds/${guildId}/${kind}-${id}.${type.split("/")[1]}`, buf, type);
  const asset = await db.guildAsset.create({
    data: { id, guildId, contentType: type, url: stored.url, data: stored.data ? new Uint8Array(stored.data) : null },
    select: { id: true, url: true },
  });
  return json({ url: assetUrl(asset) }, 201);
});
