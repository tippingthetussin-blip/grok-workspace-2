const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeRoomCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function normalizeCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 4) return null;
  return code;
}

export function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${rand}${time}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

export function loadPeerId(): string {
  const key = "synesthesia.peer";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing && /^[a-zA-Z0-9_-]{1,64}$/.test(existing)) return existing;
  } catch {
    /* private mode */
  }
  const id = makeId("p");
  try {
    sessionStorage.setItem(key, id);
  } catch {
    /* ignore */
  }
  return id;
}
