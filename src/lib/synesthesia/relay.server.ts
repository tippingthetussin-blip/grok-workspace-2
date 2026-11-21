import { z } from "zod";
import { clockNow } from "./time.server";
import type { CaptionWire, Member, Role } from "./types";

const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const ROOM = z.string().regex(/^[A-Z0-9]{4}$/);

type Stored = CaptionWire & { seq: number; receivedAt: number };
type RoomRec = {
  members: Map<string, Member & { seen: number }>;
  captions: Stored[];
  seq: number;
  touched: number;
};

const globalRef = globalThis as typeof globalThis & {
  __synRooms?: Map<string, RoomRec>;
};

function rooms(): Map<string, RoomRec> {
  globalRef.__synRooms ??= new Map();
  return globalRef.__synRooms;
}

function prune(now: number) {
  const all = rooms();
  for (const [code, room] of all) {
    for (const [id, member] of room.members) {
      if (now - member.seen > 8_000) room.members.delete(id);
    }
    if (now - room.touched > 10 * 60_000) all.delete(code);
  }
  if (all.size > 80) {
    const oldest = [...all.entries()].sort((a, b) => a[1].touched - b[1].touched)[0];
    if (oldest) all.delete(oldest[0]);
  }
}

function roomFor(code: string): RoomRec {
  const all = rooms();
  let room = all.get(code);
  if (!room) {
    room = { members: new Map(), captions: [], seq: 0, touched: Date.now() };
    all.set(code, room);
  }
  room.touched = Date.now();
  return room;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function roster(room: RoomRec): Member[] {
  return [...room.members.values()].map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
  }));
}

async function handleGet(url: URL): Promise<Response> {
  const parsed = z
    .object({
      room: ROOM,
      peer: ID,
      name: z.string().max(32).default(""),
      role: z.enum(["host", "guest"]).default("guest"),
      since: z.coerce.number().int().min(0).default(0),
    })
    .safeParse({
      room: (url.searchParams.get("room") ?? "").toUpperCase(),
      peer: url.searchParams.get("peer"),
      name: url.searchParams.get("name") ?? "",
      role: url.searchParams.get("role") ?? "guest",
      since: url.searchParams.get("since") ?? 0,
    });
  if (!parsed.success) return json({ error: "invalid query" }, 400);

  const nowMs = Date.now();
  prune(nowMs);
  const { room, peer, role, since } = parsed.data;
  const name = parsed.data.name.trim() || (role === "host" ? "Bob" : "Friend");
  const rec = roomFor(room);
  rec.members.set(peer, { id: peer, name, role: role as Role, seen: nowMs });

  const captions = rec.captions.filter((caption) => caption.seq > since);
  const cursor = rec.captions.reduce((max, caption) => Math.max(max, caption.seq), since);
  const clock = clockNow();
  return json({
    now: clock.now,
    source: clock.source,
    members: roster(rec),
    captions,
    cursor,
  });
}

const captionSchema = z.object({
  id: ID,
  peerId: ID,
  name: z.string().max(32),
  text: z.string().max(400),
  start: z.number().finite(),
  end: z.number().finite(),
  interim: z.boolean(),
  onset: z.boolean(),
});

const postSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("caption"),
    room: ROOM,
    peer: ID,
    caption: captionSchema,
  }),
  z.object({
    op: z.literal("leave"),
    room: ROOM,
    peer: ID,
  }),
]);

async function handlePost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (body && typeof body === "object" && "room" in body && typeof body.room === "string") {
    body = { ...body, room: body.room.toUpperCase() };
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid request" }, 400);
  const msg = parsed.data;
  const nowMs = Date.now();
  prune(nowMs);
  const rec = roomFor(msg.room);

  if (msg.op === "leave") {
    rec.members.delete(msg.peer);
    return json({ ok: true });
  }

  const text = msg.caption.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (!text) return json({ ok: true });

  const member = rec.members.get(msg.peer);
  const clock = clockNow();
  let start = msg.caption.start;
  let end = Math.max(msg.caption.end, start);
  if (Math.abs(start - clock.now) > 120_000) {
    start = clock.now;
    end = clock.now + 800;
  }

  rec.seq += 1;
  const stored: Stored = {
    id: msg.caption.id,
    peerId: msg.peer,
    name: (member?.name || msg.caption.name || "Friend").slice(0, 32),
    text: text.slice(0, 400),
    start,
    end,
    interim: msg.caption.interim,
    onset: msg.caption.onset,
    seq: rec.seq,
    receivedAt: nowMs,
  };
  const index = rec.captions.findIndex((caption) => caption.id === stored.id);
  if (index === -1) rec.captions.push(stored);
  else rec.captions[index] = stored;
  if (rec.captions.length > 200) rec.captions.splice(0, rec.captions.length - 200);

  if (!member) {
    rec.members.set(msg.peer, {
      id: msg.peer,
      name: stored.name,
      role: "guest",
      seen: nowMs,
    });
  } else {
    member.seen = nowMs;
  }

  return json({ ok: true, seq: stored.seq });
}

export async function handleRelay(request: Request): Promise<Response> {
  try {
    if (request.method === "GET") return await handleGet(new URL(request.url));
    if (request.method === "POST") return await handlePost(request);
    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    console.error("[relay]", error);
    return json({ error: "relay failed" }, 500);
  }
}
