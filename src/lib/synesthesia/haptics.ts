export type HapticPreset = {
  id: string;
  label: string;
  hint: string;
  pattern: number[];
};

export const PRESETS: HapticPreset[] = [
  { id: "double", label: "Double short", hint: "two quick buzzes", pattern: [100, 80, 100] },
  { id: "long", label: "One long", hint: "a single long buzz", pattern: [450] },
  { id: "triple", label: "Triple quick", hint: "three short buzzes", pattern: [80, 60, 80, 60, 80] },
  { id: "pair", label: "Two beats", hint: "two slower beats", pattern: [220, 90, 220] },
  { id: "flutter", label: "Flutter", hint: "a flutter, then a thump", pattern: [40, 40, 40, 40, 40, 40, 180] },
];

const SPEAKER_KEY = "synesthesia.speakers";
const MAP_KEY = "synesthesia.haptics";

function readSpeakers(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SPEAKER_KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is string => typeof item === "string").slice(0, 24);
  } catch {
    return [];
  }
}

function writeSpeakers(names: string[]) {
  try {
    localStorage.setItem(SPEAKER_KEY, JSON.stringify(names.slice(0, 24)));
  } catch {
    /* ignore */
  }
}

function readMap(): Record<string, number[]> {
  try {
    const raw = JSON.parse(localStorage.getItem(MAP_KEY) || "{}") as unknown;
    if (!raw || typeof raw !== "object") return {};
    const out: Record<string, number[]> = {};
    for (const [name, pattern] of Object.entries(raw)) {
      if (Array.isArray(pattern) && pattern.every((n) => typeof n === "number")) {
        out[name] = pattern.slice(0, 12);
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function listSpeakers(): string[] {
  return readSpeakers();
}

export function rememberSpeaker(name: string) {
  const clean = name.trim();
  if (!clean) return;
  const all = readSpeakers();
  if (!all.includes(clean)) {
    all.push(clean);
    writeSpeakers(all);
  }
}

export function patternFor(name: string): number[] {
  rememberSpeaker(name);
  const custom = readMap()[name];
  if (custom && custom.length > 0) return custom;
  const idx = readSpeakers().indexOf(name);
  return PRESETS[(idx < 0 ? 0 : idx) % PRESETS.length].pattern;
}

export function peekPattern(name: string): number[] {
  const custom = readMap()[name];
  if (custom && custom.length > 0) return custom;
  const idx = readSpeakers().indexOf(name);
  return PRESETS[(idx < 0 ? 0 : idx) % PRESETS.length].pattern;
}

export function presetIdFor(name: string): string {
  const pattern = peekPattern(name);
  const found = PRESETS.find((preset) => preset.pattern.join(",") === pattern.join(","));
  return found?.id ?? PRESETS[0].id;
}

export function assignPreset(name: string, presetId: string) {
  const preset = PRESETS.find((item) => item.id === presetId) ?? PRESETS[0];
  const map = readMap();
  map[name] = preset.pattern;
  try {
    localStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  rememberSpeaker(name);
}

export function vibrate(pattern: number[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export function stopVibrate() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(0);
  }
}
