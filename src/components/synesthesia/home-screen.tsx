import { useNavigate } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { makeRoomCode, normalizeCode } from "@/lib/synesthesia/codes";
import { setGuestName } from "@/lib/synesthesia/prefs";
import { SettingsSheet } from "./settings-sheet";
import { fieldClass, primaryBtn, surfaceBtn } from "./ui";

const STEPS = [
  {
    title: "Welcome, Bob.",
    body: "Built for you by your son, Brian, so you never miss a word.",
    action: "Continue",
  },
  {
    title: "A room is a short code.",
    body: "Friends and family open Synesthesia on their phones, type the code, and speak into their mic or earbuds.",
    action: "Continue",
  },
  {
    title: "You watch, and you feel it.",
    body: "Each person has a row on a clock, so you can see who started and when two voices overlap. Your phone buzzes a different pattern for each of them.",
    action: "Start my room",
  },
] as const;

function Boot({ onSkip }: { onSkip: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col bg-ink px-6 pt-16 pb-safe text-bg">
      <p className="text-sm font-semibold tracking-widest text-lane">FOR BOB</p>
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <h1 className="text-center font-display text-5xl tracking-tight text-bg">Synesthesia</h1>
        <div className="flex h-16 items-end gap-1.5" aria-hidden="true">
          {["h-4", "h-8", "h-12", "h-7", "h-14", "h-6", "h-9"].map((height, index) => (
            <span key={index} className={`boot-bar w-1.5 rounded-full bg-accent ${height}`} />
          ))}
        </div>
        <p className="text-lg text-lane">Sound, made visible.</p>
      </div>
      <button
        type="button"
        className="inline-flex min-h-14 w-full items-center justify-center rounded-xl border border-lane bg-transparent px-5 text-lg font-semibold text-bg"
        onClick={onSkip}
      >
        Skip
      </button>
    </div>
  );
}

export function HomeScreen() {
  const navigate = useNavigate();
  const [booting, setBooting] = useState(true);
  const [step, setStep] = useState(0);
  const [joining, setJoining] = useState(false);
  const [guest, setGuest] = useState("");
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setBooting(false), reduce ? 0 : 2200);
    return () => window.clearTimeout(timer);
  }, []);

  const startRoom = () => {
    const next = makeRoomCode();
    sessionStorage.setItem(`syn.host.${next}`, "1");
    sessionStorage.setItem(`syn.soncake.${next}`, "1");
    void navigate({
      to: "/room/$code",
      params: { code: next },
      search: { host: true, soncake: true },
    });
  };

  const joinRoom = () => {
    const next = normalizeCode(code);
    const name = guest.trim();
    if (!name) {
      setJoinError("Add your name so Bob knows who is speaking.");
      return;
    }
    if (!next) {
      setJoinError("Enter the 4-character code from Bob's phone.");
      return;
    }
    setGuestName(name);
    void navigate({
      to: "/room/$code",
      params: { code: next },
      search: { host: false, soncake: false },
    });
  };

  if (booting) return <Boot onSkip={() => setBooting(false)} />;

  const current = STEPS[step];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-5 pt-6 pb-safe">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold tracking-widest text-muted">SYNESTHESIA</p>
        <button
          type="button"
          className="inline-flex size-12 items-center justify-center rounded-xl border border-line bg-surface text-ink"
          aria-label="Settings"
          onClick={() => setSettings(true)}
        >
          <Settings className="size-6" aria-hidden="true" />
        </button>
      </div>

      {joining ? (
        <form
          className="flex flex-1 flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            joinRoom();
          }}
        >
          <div className="rise">
            <h1 className="font-display text-4xl text-ink">Join Bob's room</h1>
            <p className="mt-3 text-lg text-ink">
              Use the code on his screen. Your phone listens, and his phone shows the words.
            </p>
          </div>
          <label className="flex flex-col gap-2 text-lg text-ink">
            What should Bob call you?
            <input
              className={fieldClass + " w-full"}
              value={guest}
              maxLength={32}
              autoComplete="given-name"
              onChange={(event) => setGuest(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-lg text-ink">
            Room code
            <input
              className={fieldClass + " w-full text-center text-2xl font-semibold tracking-widest uppercase"}
              value={code}
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              aria-label="Four character room code"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </label>
          {joinError ? <p className="text-lg text-accent">{joinError}</p> : null}
          <div className="mt-auto flex flex-col gap-3">
            <button type="submit" className={primaryBtn + " w-full"}>
              Enter the room
            </button>
            <button
              type="button"
              className={surfaceBtn + " w-full"}
              onClick={() => {
                setJoining(false);
                setJoinError("");
              }}
            >
              Back
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-1 flex-col gap-6" key={step}>
          <p className="text-base font-medium text-muted">Step {step + 1} of 3</p>
          <div className="rise">
            <h1 className="font-display text-4xl text-ink">{current.title}</h1>
          </div>
          <p className="rise d1 text-xl leading-relaxed text-ink">{current.body}</p>
          <ol className="rise d2 flex flex-col gap-3 text-lg text-ink">
            <li className={step === 0 ? "font-semibold" : "text-muted"}>1. Start a room on this phone.</li>
            <li className={step === 1 ? "font-semibold" : "text-muted"}>2. Read the code to everyone else.</li>
            <li className={step === 2 ? "font-semibold" : "text-muted"}>3. Watch the clock. Feel who is talking.</li>
          </ol>
          <div className="mt-auto flex flex-col gap-3 rise d3">
            <button
              type="button"
              className={primaryBtn + " w-full"}
              onClick={() => {
                if (step < 2) setStep((value) => value + 1);
                else startRoom();
              }}
            >
              {current.action}
            </button>
            {step > 0 ? (
              <button type="button" className={surfaceBtn + " w-full"} onClick={() => setStep((value) => value - 1)}>
                Back
              </button>
            ) : null}
            <button type="button" className={surfaceBtn + " w-full"} onClick={() => setJoining(true)}>
              Join a room
            </button>
          </div>
        </div>
      )}

      <SettingsSheet open={settings} onClose={() => setSettings(false)} role="home" />
    </main>
  );
}
