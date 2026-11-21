const DISPLAY = "synesthesia.displayName";
const GUEST = "synesthesia.guestName";
const DG = "synesthesia.dg";

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function hostName(): string {
  return read(DISPLAY).trim() || "Bob";
}

export function setHostName(name: string) {
  write(DISPLAY, name.trim().slice(0, 32));
}

export function guestName(): string {
  return read(GUEST).trim() || "Guest";
}

export function setGuestName(name: string) {
  write(GUEST, name.trim().slice(0, 32));
}

export function readDeepgramKey(): string {
  return read(DG).trim();
}

export function setDeepgramKey(key: string) {
  write(DG, key.trim());
}
