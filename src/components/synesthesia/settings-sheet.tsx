import { useEffect, useRef, useState } from "react";
import {
  PRESETS,
  assignPreset,
  listSpeakers,
  presetIdFor,
  stopVibrate,
  vibrate,
} from "@/lib/synesthesia/haptics";
import {
  guestName,
  hostName,
  readDeepgramKey,
  setDeepgramKey,
  setGuestName,
  setHostName,
} from "@/lib/synesthesia/prefs";
import { fieldClass, primaryBtn, surfaceBtn } from "./ui";

export function SettingsSheet({
  open,
  onClose,
  role,
  onSample,
}: {
  open: boolean;
  onClose: () => void;
  role: "host" | "guest" | "home";
  onSample?: () => void;
}) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [feeling, setFeeling] = useState("");
  const runRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setName(role === "guest" ? guestName() : hostName());
    setKey(readDeepgramKey());
    setSpeakers(listSpeakers());
    setFeeling("");
  }, [open, role]);

  useEffect(() => {
    if (!open) {
      runRef.current += 1;
      stopVibrate();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const saveName = (value: string) => {
    setName(value);
    if (role === "guest") setGuestName(value);
    else setHostName(value);
  };

  const testAll = async () => {
    const token = ++runRef.current;
    for (const preset of PRESETS) {
      if (runRef.current !== token) return;
      setFeeling(preset.label);
      const ok = vibrate(preset.pattern);
      if (!ok) {
        setFeeling("This browser didn't vibrate. Use Android Chrome with the screen on.");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (runRef.current === token) setFeeling("That's each pattern.");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg px-5 pt-6 pb-safe" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="settings-title" className="font-display text-4xl text-ink">
            Settings
          </h2>
          <button type="button" className={surfaceBtn + " px-5"} onClick={onClose}>
            Done
          </button>
        </div>

        <label className="flex flex-col gap-2 text-lg text-ink">
          Your name
          <input
            className={fieldClass + " w-full"}
            value={name}
            maxLength={32}
            autoComplete="given-name"
            onChange={(event) => saveName(event.target.value)}
          />
          <span className="text-base text-muted">Used the next time you enter a room.</span>
        </label>

        <label className="flex flex-col gap-2 text-lg text-ink">
          Deepgram key
          <input
            className={fieldClass + " w-full"}
            type="password"
            autoComplete="off"
            value={key}
            placeholder="Optional"
            onChange={(event) => {
              setKey(event.target.value);
              setDeepgramKey(event.target.value);
            }}
          />
          <span className="text-base text-muted">
            Leave this blank and the phone's own speech recognition is used. With a key, captions use
            Deepgram Nova-2 — punctuation and background-noise filtering. The key stays in this browser
            and is sent only to Deepgram while the mic is on.
          </span>
        </label>

        <section className="flex flex-col gap-3">
          <h3 className="text-xl font-semibold text-ink">Haptics</h3>
          <p className="text-lg text-ink">
            Each person gets their own buzz on Bob's phone. Android Chrome vibrates only while
            Synesthesia is open and the screen is on.
          </p>
          <button
            type="button"
            className={primaryBtn + " w-full"}
            onClick={() => {
              void testAll();
            }}
          >
            Test haptics
          </button>
          {feeling ? <p className="text-lg text-accent">{feeling}</p> : null}
          {speakers.length === 0 ? (
            <p className="text-base text-muted">Patterns appear here after someone speaks.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {speakers.map((speaker) => (
                <li key={speaker} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
                  <span className="text-lg font-semibold text-ink">{speaker}</span>
                  <div className="flex gap-2">
                    <select
                      className={fieldClass + " min-w-0 flex-1"}
                      aria-label={`Vibration for ${speaker}`}
                      value={presetIdFor(speaker)}
                      onChange={(event) => {
                        assignPreset(speaker, event.target.value);
                        setSpeakers(listSpeakers());
                      }}
                    >
                      {PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label} — {preset.hint}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={surfaceBtn + " shrink-0 px-4"}
                      onClick={() => {
                        const preset = PRESETS.find((item) => item.id === presetIdFor(speaker)) ?? PRESETS[0];
                        setFeeling(preset.label);
                        if (!vibrate(preset.pattern)) {
                          setFeeling("This browser didn't vibrate. Use Android Chrome with the screen on.");
                        }
                      }}
                    >
                      Test
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {onSample ? (
            <button type="button" className={surfaceBtn + " w-full"} onClick={onSample}>
              Play a sample overlap
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
