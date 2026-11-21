const globalRef = globalThis as typeof globalThis & {
  __synClock?: { offset: number; at: number };
  __synClockFetch?: Promise<void>;
};

async function refreshOffset(): Promise<void> {
  if (globalRef.__synClockFetch) return globalRef.__synClockFetch;
  globalRef.__synClockFetch = (async () => {
    try {
      const t0 = Date.now();
      const res = await fetch("https://worldtimeapi.org/api/timezone/Etc/UTC", {
        signal: AbortSignal.timeout(1200),
      });
      const t1 = Date.now();
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { unixtime?: number; datetime?: string };
      const remote =
        typeof data.unixtime === "number"
          ? data.unixtime * 1000
          : Date.parse(String(data.datetime ?? ""));
      if (!Number.isFinite(remote)) throw new Error("bad time");
      globalRef.__synClock = { offset: remote - (t0 + t1) / 2, at: Date.now() };
    } catch {
      globalRef.__synClock = { offset: globalRef.__synClock?.offset ?? 0, at: Date.now() };
    } finally {
      globalRef.__synClockFetch = undefined;
    }
  })();
  return globalRef.__synClockFetch;
}

/** Fast shared clock. Kicks off an NTP refresh when the cache is cold or old. */
export function clockNow(): { now: number; source: "ntp" | "server" } {
  const hit = globalRef.__synClock;
  if (!hit || Date.now() - hit.at > 60_000) void refreshOffset();
  const offset = hit?.offset ?? 0;
  return { now: Date.now() + offset, source: offset === 0 ? "server" : "ntp" };
}

/** One waited reading, for phones syncing their offset. */
export async function atomicNow(): Promise<{ now: number; source: "ntp" | "server" }> {
  const hit = globalRef.__synClock;
  if (!hit || Date.now() - hit.at > 60_000) await refreshOffset();
  return clockNow();
}
