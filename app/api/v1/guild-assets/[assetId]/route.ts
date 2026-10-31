import type { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { parseSnowflake } from "@/lib/server/snowflake";

// GET /api/v1/guild-assets/{id}  → ícone ou banner do servidor (público, como os emojis)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const id = parseSnowflake((await params).assetId);
  const asset = id != null ? await db.guildAsset.findUnique({ where: { id } }) : null;
  if (!asset) return new Response("Not found", { status: 404 });
  if (asset.url) return Response.redirect(asset.url, 302);
  if (!asset.data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.data), {
    headers: {
      "content-type": asset.contentType,
      // cada imagem nova ganha outro id, então pode ficar em cache
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
