import { requireAuth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { limit } from "@/lib/server/ratelimit";
import { Rel } from "@/lib/server/relationships";
import { sid } from "@/lib/server/serialize";

const MAX_RESULTS = 8;
const MAX_SUGGESTIONS = 24; // sobra para repor quem a pessoa dispensar no navegador

// "_" e "%" são curingas no LIKE, e "_" é comum em nome de usuário
const escapeLike = (v: string) => v.replace(/[\\%_]/g, "\\$&");

// GET /api/v1/users/search?q=dav: quem tem usuário ou nome de exibição começando com q (até 8).
// Devolve só o que já é público no perfil. Fica de fora quem bloqueou quem está buscando.
// ?suggest=1: sem q, as pessoas mais novas com quem ainda não há amizade, pedido nem bloqueio.
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  if (req.nextUrl.searchParams.get("suggest")) {
    await limit("userSearch", user.id);
    const people = await db.user.findMany({
      where: { id: { not: user.id }, relationships: { none: { targetId: user.id } }, relatedBy: { none: { userId: user.id } } },
      select: { id: true, username: true, globalName: true, avatar: true },
      orderBy: { id: "desc" },
      take: MAX_SUGGESTIONS,
    });
    return json(people.map((u) => ({ id: sid(u.id), username: u.username, global_name: u.globalName, avatar: u.avatar })));
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().replace(/^@/, "").slice(0, 32);
  if (q.length < 2) return json([]);
  await limit("userSearch", user.id);

  const prefix = escapeLike(q);
  const visible = { id: { not: user.id }, relationships: { none: { targetId: user.id, type: Rel.BLOCKED } } };
  const select = { id: true, username: true, globalName: true, avatar: true };

  // primeiro pelo usuário, que tem índice; o nome de exibição só completa a lista
  const byUsername = await db.user.findMany({
    where: { ...visible, username: { startsWith: prefix } },
    select,
    orderBy: { username: "asc" },
    take: MAX_RESULTS,
  });
  const byName =
    byUsername.length < MAX_RESULTS
      ? await db.user.findMany({
          where: { ...visible, globalName: { startsWith: prefix }, id: { not: user.id, notIn: byUsername.map((u) => u.id) } },
          select,
          orderBy: { username: "asc" },
          take: MAX_RESULTS - byUsername.length,
        })
      : [];

  return json(
    [...byUsername, ...byName].map((u) => ({ id: sid(u.id), username: u.username, global_name: u.globalName, avatar: u.avatar })),
  );
});
