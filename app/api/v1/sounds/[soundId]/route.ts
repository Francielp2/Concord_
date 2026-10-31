import type { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { parseSnowflake } from "@/lib/server/snowflake";

// GET /api/v1/sounds/{id}  → arquivo do som (público, como os emojis)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ soundId: string }> }) {
  const id = parseSnowflake((await params).soundId);
  const sound = id != null ? await db.sound.findUnique({ where: { id } }) : null;
  if (!sound) return new Response("Not found", { status: 404 });
  if (sound.url) return Response.redirect(sound.url, 302);
  if (!sound.data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(sound.data), {
    headers: {
      "content-type": sound.contentType,
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
