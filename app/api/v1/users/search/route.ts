import { requireAuth } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { json, route } from "@/lib/server/http";
import { limit } from "@/lib/server/ratelimit";
import { Rel } from "@/lib/server/relationships";
import { sid } from "@/lib/server/serialize";

const MAX_RESULTS = 8;
const MAX_SUGGESTIONS = 24; // sobra para repor quem a pessoa dispensar no navegador
const CANDIDATE_POOL = 100;

// "_" e "%" são curingas no LIKE, e "_" é comum em nome de usuário
const escapeLike = (v: string) => v.replace(/[\\%_]/g, "\\$&");

// GET /api/v1/users/search?q=dav: quem tem usuário ou nome de exibição começando com q (até 8).
// Devolve só o que já é público no perfil. Fica de fora quem bloqueou quem está buscando.
// ?suggest=1: sem q, quem ainda não tem amizade, pedido nem bloqueio com a pessoa: primeiro quem divide
// servidor, depois quem tem amigos em comum, e as contas mais novas completam. Dos amigos em comum só sai o número.
export const GET = route(async (req) => {
  const { user } = await requireAuth(req);
  if (req.nextUrl.searchParams.get("suggest")) {
    await limit("userSearch", user.id);
    const links = await db.relationship.findMany({ where: { OR: [{ userId: user.id }, { targetId: user.id }] } });
    const known = [user.id, ...links.map((r) => (r.userId === user.id ? r.targetId : r.userId))];
    const friends = links.filter((r) => r.userId === user.id && r.type === Rel.FRIEND).map((r) => r.targetId);

    const [memberships, mutual] = await Promise.all([
      db.member.findMany({ where: { userId: user.id }, select: { guildId: true } }),
      friends.length
        ? db.relationship.groupBy({
            by: ["targetId"],
            where: { userId: { in: friends }, type: Rel.FRIEND, targetId: { notIn: known } },
            _count: { targetId: true },
            orderBy: { _count: { targetId: "desc" } },
            take: CANDIDATE_POOL,
          })
        : [],
    ]);
    const counts = new Map(mutual.map((m) => [m.targetId, m._count.targetId]));
    const shared = memberships.length
      ? await db.member.findMany({
          where: { guildId: { in: memberships.map((m) => m.guildId) }, userId: { notIn: known } },
          select: { userId: true },
          distinct: ["userId"],
          take: CANDIDATE_POOL,
        })
      : [];
    const byMutual = (a: bigint, b: bigint) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    const sharedIds = shared.map((m) => m.userId).sort(byMutual);
    const ranked = [...new Set([...sharedIds, ...counts.keys()])].slice(0, MAX_SUGGESTIONS);

    const select = { id: true, username: true, globalName: true, avatar: true };
    const [picked, newest] = await Promise.all([
      db.user.findMany({ where: { id: { in: ranked } }, select }),
      db.user.findMany({
        where: { id: { notIn: [...known, ...ranked] } },
        select,
        orderBy: { id: "desc" },
        take: MAX_SUGGESTIONS - ranked.length,
      }),
    ]);
    const order = new Map(ranked.map((id, i) => [id, i]));
    picked.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    return json(
      [...picked, ...newest].map((u) => ({
        id: sid(u.id),
        username: u.username,
        global_name: u.globalName,
        avatar: u.avatar,
        mutual_friends: counts.get(u.id) ?? 0,
      })),
    );
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
