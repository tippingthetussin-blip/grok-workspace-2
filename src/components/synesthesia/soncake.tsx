import { useEffect, useState } from "react";
import { primaryBtn } from "./ui";

export function Soncake({ onDone }: { onDone: () => void }) {
  const [named, setNamed] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setNamed(true);
      return;
    }
    const timer = window.setTimeout(() => setNamed(true), 2200);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(onDone, 7200);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ink px-6 pt-16 pb-safe text-bg">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6">
        <p className="text-sm font-semibold tracking-widest text-lane">SYNESTHESIA</p>
        <p className="text-xl leading-relaxed text-bg">
          A crossing of the senses — sometimes met in psychedelic experience — where a sound can look
          like a color, or a word can taste like something familiar.
        </p>
        {named ? (
          <div className="pop-in">
            <p className="font-display text-5xl tracking-tight text-bg">Soncake</p>
            <div className="mt-3 h-1 w-24 bg-accent" />
            <p className="mt-4 text-xl text-lane">Brian's nickname for it. And for this room.</p>
          </div>
        ) : (
          <div className="h-28" />
        )}
      </div>
      <button type="button" className={primaryBtn + " w-full"} onClick={onDone}>
        Enter the room
      </button>
    </div>
  );
}
