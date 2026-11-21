import { useCallback, useEffect, useRef, useState } from "react";
import { P2PRoom, type PeerInfo } from "@/lib/multiplayer";
import { loadPeerId } from "./codes";
import { patternFor, vibrate } from "./haptics";
import { guestName, hostName } from "./prefs";
import type { CaptionWire, Member, Role, Utterance } from "./types";

export type PublishInput = {
  id: string;
  text: string;
  start: number;
  end: number;
  interim: boolean;
  onset: boolean;
};

type RelayBody = {
  now: number;
  members: Member[];
  captions: CaptionWire[];
  cursor: number;
};

function upsert(list: Utterance[], next: Utterance): Utterance[] {
  if (!next.text.trim()) return list;
  const index = list.findIndex((item) => item.id === next.id);
  const merged = index === -1 ? [...list, next] : list.map((item) => (item.id === next.id ? next : item));
  const finals = merged.filter((item) => !item.interim);
  const interims = merged.filter((item) => item.interim);
  return [...finals.slice(-180), ...interims];
}

export function useRoomChannel(code: string, role: Role) {
  const [identity] = useState(() => ({
    selfId: loadPeerId(),
    name: role === "host" ? hostName() : guestName(),
    role,
  }));
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [relayOk, setRelayOk] = useState(false);
  const [synced, setSynced] = useState(false);
  const offsetRef = useRef(0);
  const p2pRef = useRef<P2PRoom | null>(null);
  const vibrated = useRef(new Set<string>());
  const lastSent = useRef(0);
  const cursorRef = useRef(0);

  const now = useCallback(() => Date.now() + offsetRef.current, []);

  const ingest = useCallback(
    (caption: CaptionWire) => {
      if (!caption?.id || caption.peerId === identity.selfId) return;
      if (!caption.text?.trim()) return;
      const next: Utterance = {
        id: caption.id,
        peerId: caption.peerId,
        name: caption.name || "Friend",
        text: caption.text.trim(),
        start: caption.start,
        end: Math.max(caption.end, caption.start),
        interim: Boolean(caption.interim),
      };
      setUtterances((prev) => upsert(prev, next));
      if (identity.role === "host" && caption.onset && !vibrated.current.has(caption.id)) {
        vibrated.current.add(caption.id);
        vibrate(patternFor(next.name));
      }
    },
    [identity.role, identity.selfId],
  );

  const ingestRef = useRef(ingest);
  ingestRef.current = ingest;

  useEffect(() => {
    let cancel = false;
    const sync = async () => {
      const t0 = Date.now();
      try {
        const res = await fetch("/api/time", { cache: "no-store" });
        const t1 = Date.now();
        if (!res.ok) return;
        const body = (await res.json()) as { now?: number };
        if (cancel || typeof body.now !== "number") return;
        offsetRef.current = body.now - (t0 + t1) / 2;
        setSynced(true);
      } catch {
        /* keep the last offset */
      }
    };
    void sync();
    const id = setInterval(() => void sync(), 20_000);
    return () => {
      cancel = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let closed = false;
    const p2p = new P2PRoom({
      room: code,
      selfId: identity.selfId,
      name: identity.name,
      onPeersChanged: (next) => {
        if (!closed) setPeers(next);
      },
      onMessage: (from, data) => {
        const msg = data as { kind?: string; caption?: CaptionWire };
        if (msg?.kind !== "caption" || !msg.caption) return;
        ingestRef.current({ ...msg.caption, peerId: from });
      },
    });
    p2pRef.current = p2p;
    void p2p.join();
    return () => {
      closed = true;
      p2pRef.current = null;
      p2p.close();
    };
  }, [code, identity.name, identity.selfId]);

  useEffect(() => {
    let closed = false;
    const poll = async () => {
      if (closed) return;
      const params = new URLSearchParams({
        room: code,
        peer: identity.selfId,
        name: identity.name,
        role: identity.role,
        since: String(cursorRef.current),
      });
      try {
        const res = await fetch(`/api/relay?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as RelayBody;
        if (closed) return;
        setRelayOk(true);
        setMembers(Array.isArray(body.members) ? body.members : []);
        if (typeof body.cursor === "number") cursorRef.current = body.cursor;
        for (const caption of body.captions ?? []) ingestRef.current(caption);
      } catch {
        if (!closed) setRelayOk(false);
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 450);
    return () => {
      closed = true;
      clearInterval(id);
      void fetch("/api/relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "leave", room: code, peer: identity.selfId }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [code, identity.name, identity.role, identity.selfId]);

  const publish = useCallback(
    (input: PublishInput) => {
      const text = input.text.trim();
      if (!text) return;
      const utterance: Utterance = {
        id: input.id,
        peerId: identity.selfId,
        name: identity.name,
        text,
        start: input.start,
        end: Math.max(input.end, input.start),
        interim: input.interim,
      };
      setUtterances((prev) => upsert(prev, utterance));
      const stamp = performance.now();
      if (input.interim && !input.onset && stamp - lastSent.current < 280) return;
      lastSent.current = stamp;
      const caption: CaptionWire = { ...utterance, onset: input.onset };
      p2pRef.current?.send({ kind: "caption", caption });
      void fetch("/api/relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          op: "caption",
          room: code,
          peer: identity.selfId,
          caption,
        }),
      }).catch(() => {});
    },
    [code, identity.name, identity.selfId],
  );

  const injectLocal = useCallback(
    (caption: CaptionWire) => {
      setUtterances((prev) =>
        upsert(prev, {
          id: caption.id,
          peerId: caption.peerId,
          name: caption.name,
          text: caption.text,
          start: caption.start,
          end: caption.end,
          interim: caption.interim,
        }),
      );
      if (identity.role === "host" && caption.onset && !vibrated.current.has(caption.id)) {
        vibrated.current.add(caption.id);
        vibrate(patternFor(caption.name));
      }
    },
    [identity.role],
  );

  const ids = new Set<string>([identity.selfId]);
  for (const member of members) ids.add(member.id);
  for (const peer of peers) ids.add(peer.id);

  return {
    selfId: identity.selfId,
    name: identity.name,
    role: identity.role,
    utterances,
    members,
    peopleCount: ids.size,
    relayOk,
    direct: peers.some((peer) => peer.connectionState === "connected"),
    synced,
    now,
    publish,
    injectLocal,
  };
}
