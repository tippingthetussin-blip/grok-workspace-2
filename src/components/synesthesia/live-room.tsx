import { useNavigate } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeId } from "@/lib/synesthesia/codes";
import { readDeepgramKey } from "@/lib/synesthesia/prefs";
import { startListening } from "@/lib/synesthesia/speech";
import type { SpeechStatus } from "@/lib/synesthesia/types";
import { useRoomChannel } from "@/lib/synesthesia/use-room";
import { SettingsSheet } from "./settings-sheet";
import { Soncake } from "./soncake";
import { Timeline } from "./timeline";
import { fieldClass, primaryBtn, surfaceBtn } from "./ui";

function CodeMark({ code }: { code: string }) {
  return (
    <p className="flex gap-1.5" aria-label={`Room code ${code.split("").join(" ")}`}>
      {code.split("").map((char, index) => (
        <span
          key={index}
          className="flex h-12 w-10 items-center justify-center rounded-lg border border-line bg-surface text-2xl font-semibold text-ink tabular-nums"
        >
          {char}
        </span>
      ))}
    </p>
  );
}

export function LiveRoom({
  code,
  hostRequested,
  soncakeRequested,
}: {
  code: string;
  hostRequested: boolean;
  soncakeRequested: boolean;
}) {
  const navigate = useNavigate();
  const [role] = useState<"host" | "guest">(() => {
    if (hostRequested) return "host";
    try {
      if (sessionStorage.getItem(`syn.host.${code}`) === "1") return "host";
    } catch {
      /* ignore */
    }
    return "guest";
  });
  const channel = useRoomChannel(code, role);
  const [listening, setListening] = useState(false);
  const [speech, setSpeech] = useState<SpeechStatus>({ engine: "idle", detail: "" });
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [frame, setFrame] = useState(() => Date.now());
  const [showSoncake, setShowSoncake] = useState(() => {
    if (role !== "host") return false;
    try {
      if (sessionStorage.getItem(`syn.soncake.seen.${code}`) === "1") return false;
      return soncakeRequested || sessionStorage.getItem(`syn.soncake.${code}`) === "1";
    } catch {
      return false;
    }
  });
  const readerRef = useRef<HTMLDivElement>(null);
  const phrase = useRef<{ id: string; start: number } | null>(null);
  const publishRef = useRef(channel.publish);
  const nowRef = useRef(channel.now);
  publishRef.current = channel.publish;
  nowRef.current = channel.now;

  useEffect(() => {
    if (!showSoncake) return;
    try {
      sessionStorage.setItem(`syn.soncake.seen.${code}`, "1");
    } catch {
      /* ignore */
    }
  }, [showSoncake, code]);

  const dismissSoncake = useCallback(() => setShowSoncake(false), []);

  useEffect(() => {
    if (!listening) {
      phrase.current = null;
      return;
    }
    return startListening({
      deepgramKey: readDeepgramKey(),
      onStatus: setSpeech,
      onEvent: (event) => {
        const t = nowRef.current();
        if (event.onset || !phrase.current) phrase.current = { id: makeId("c"), start: t };
        const current = phrase.current;
        if (!current) return;
        publishRef.current({
          id: current.id,
          text: event.text,
          start: current.start,
          end: Math.max(t, current.start + 700),
          interim: !event.final,
          onset: event.onset,
        });
        if (event.final) phrase.current = null;
      },
    });
  }, [listening]);

  useEffect(() => {
    if (role !== "host") return;
    let raf = 0;
    let last = 0;
    const loop = (time: number) => {
      if (time - last > 100) {
        setFrame(nowRef.current());
        last = time;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [role]);

  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of channel.members) map.set(member.id, member.name);
    map.set(channel.selfId, channel.name);
    for (const item of channel.utterances) {
      if (!map.has(item.peerId)) map.set(item.peerId, item.name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => {
        if (a.id === channel.selfId) return -1;
        if (b.id === channel.selfId) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [channel.members, channel.name, channel.selfId, channel.utterances]);

  const lines = useMemo(
    () => [...channel.utterances].sort((a, b) => a.start - b.start).slice(-16),
    [channel.utterances],
  );

  useEffect(() => {
    const el = readerRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (near) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const playSample = useCallback(() => {
    const t = nowRef.current();
    channel.injectLocal({
      id: makeId("c"),
      peerId: "sample-brian",
      name: "Brian",
      text: "Dad, can you see both of us?",
      start: t,
      end: t + 2800,
      interim: false,
      onset: true,
    });
    window.setTimeout(() => {
      channel.injectLocal({
        id: makeId("c"),
        peerId: "sample-mom",
        name: "Mom",
        text: "We're talking at the same time.",
        start: t + 900,
        end: t + 3600,
        interim: false,
        onset: true,
      });
    }, 900);
    setSettings(false);
  }, [channel]);

  const share = async () => {
    const text = `Join Bob on Synesthesia. Room code ${code}.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Synesthesia", text });
        return;
      }
    } catch {
      /* fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const sendDraft = () => {
    const text = draft.trim();
    if (!text) return;
    const t = channel.now();
    channel.publish({
      id: makeId("c"),
      text,
      start: t,
      end: t + 1800,
      interim: false,
      onset: true,
    });
    setDraft("");
  };

  const connected = channel.relayOk || channel.direct;
  const selfLine = lines.filter((item) => item.peerId === channel.selfId).at(-1);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-3 overflow-x-hidden px-4 pt-4 pb-safe">
      <header className="flex items-center justify-between gap-2">
        <CodeMark code={code} />
        <div className="flex items-center gap-2">
          <button type="button" className={surfaceBtn + " px-3"} onClick={() => void share()}>
            {copied ? "Copied" : "Share"}
          </button>
          <button
            type="button"
            className="inline-flex size-12 items-center justify-center rounded-xl border border-line bg-surface text-ink"
            aria-label="Settings"
            onClick={() => setSettings(true)}
          >
            <Settings className="size-6" aria-hidden="true" />
          </button>
        </div>
      </header>

      <p className="text-base text-ink">
        <span className={"mr-2 inline-block size-2.5 rounded-full " + (connected ? "bg-accent" : "bg-line")} />
        {connected ? "Live" : "Reconnecting"}
        {" · "}
        {channel.peopleCount <= 1 ? "Waiting for others" : `${channel.peopleCount} people here`}
        {channel.synced ? " · Clocks aligned" : ""}
      </p>

      {role === "host" ? (
        <>
          <Timeline people={people} utterances={channel.utterances} now={frame} selfId={channel.selfId} />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className={(listening ? primaryBtn : surfaceBtn) + " px-4"}
              aria-pressed={listening}
              onClick={() => setListening((value) => !value)}
            >
              {listening ? "Mute my mic" : "My mic"}
            </button>
            <p className="min-w-0 flex-1 text-base text-muted">
              {listening ? speech.detail || "Listening" : "Optional. Your words join the timeline too."}
            </p>
          </div>
          <div ref={readerRef} className="reader flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-2">
            {lines.length === 0 ? (
              <div className="flex flex-col gap-4">
                <p className="text-xl leading-relaxed text-ink">
                  When someone speaks, their words sit on the clock in their own row. Overlap means two
                  voices at once. Your phone buzzes a different pattern for each person.
                </p>
                <button type="button" className={surfaceBtn + " w-full"} onClick={playSample}>
                  Play a sample overlap
                </button>
              </div>
            ) : (
              lines.map((item) => (
                <article key={item.id}>
                  <p className="text-lg font-semibold text-accent">{item.name}</p>
                  <p className="text-2xl leading-snug text-ink">{item.text}</p>
                </article>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
          <div className="relative">
            {listening ? <span className="pulse-ring absolute inset-0 rounded-full bg-accent" aria-hidden="true" /> : null}
            <button
              type="button"
              className={
                "relative inline-flex h-40 w-40 items-center justify-center rounded-full px-4 text-center text-xl font-semibold transition-transform duration-150 ease-out active:scale-[0.96] " +
                (listening ? "bg-accent text-accent-ink" : "border border-line bg-surface text-ink")
              }
              aria-pressed={listening}
              onClick={() => setListening((value) => !value)}
            >
              {listening ? "Mute" : "Tap to speak"}
            </button>
          </div>
          <p className="max-w-sm text-center text-xl text-ink" aria-live="polite">
            {selfLine?.text || "Your words will show here, and on Bob's screen."}
          </p>
          <p className="max-w-sm text-center text-base text-muted">
            {listening
              ? speech.detail || "Listening"
              : "Bluetooth earbuds or the phone mic both work. Bob feels a buzz when you start."}
          </p>
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          sendDraft();
        }}
      >
        <input
          className={fieldClass + " min-w-0 flex-1"}
          value={draft}
          placeholder="Or type a line"
          aria-label="Type a line"
          maxLength={400}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className={primaryBtn + " px-4"}>
          Send
        </button>
      </form>
      <button type="button" className="min-h-12 text-lg font-semibold text-muted" onClick={() => void navigate({ to: "/" })}>
        Leave room
      </button>

      {showSoncake ? <Soncake onDone={dismissSoncake} /> : null}
      <SettingsSheet
        open={settings}
        onClose={() => setSettings(false)}
        role={role}
        onSample={role === "host" ? playSample : undefined}
      />
    </main>
  );
}
