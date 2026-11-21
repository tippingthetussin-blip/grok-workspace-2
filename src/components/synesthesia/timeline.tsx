import type { Utterance } from "@/lib/synesthesia/types";

const PAST_MS = 6000;
const FUTURE_MS = 2000;
const SPAN_MS = PAST_MS + FUTURE_MS;
const NOW_PCT = (PAST_MS / SPAN_MS) * 100;

const TICKS = [
  { at: 0, label: "6s ago" },
  { at: NOW_PCT / 2, label: "3s" },
  { at: NOW_PCT, label: "now" },
];

export function Timeline({
  people,
  utterances,
  now,
  selfId,
}: {
  people: { id: string; name: string }[];
  utterances: Utterance[];
  now: number;
  selfId: string;
}) {
  const windowStart = now - PAST_MS;

  return (
    <section className="flex shrink-0 flex-col gap-3" aria-label="Conversation timeline">
      <div className="relative h-6">
        {TICKS.map((tick) => (
          <span
            key={tick.label}
            className="absolute top-0 text-sm font-semibold text-ink tabular-nums"
            style={{
              left: `${tick.at}%`,
              transform: tick.at === 0 ? "none" : "translateX(-50%)",
            }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      {people.map((person) => {
        const mine = utterances.filter(
          (item) => item.peerId === person.id && item.end >= windowStart && item.start <= now + FUTURE_MS,
        );
        return (
          <div key={person.id} className="flex flex-col gap-1">
            <p className="truncate text-base font-semibold text-ink">{person.name}</p>
            <div className="relative h-12 overflow-hidden rounded-lg bg-lane">
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-accent"
                style={{ left: `${NOW_PCT}%` }}
                aria-hidden="true"
              />
              {mine.map((item) => {
                const rawLeft = ((item.start - windowStart) / SPAN_MS) * 100;
                const rawWidth = (Math.max(700, item.end - item.start) / SPAN_MS) * 100;
                let left = rawLeft;
                let width = Math.max(rawWidth, 28);
                if (left < 0) {
                  width += left;
                  left = 0;
                }
                if (left >= 100 || width < 6) return null;
                const tone = item.interim
                  ? "border border-accent bg-surface text-ink"
                  : item.peerId === selfId
                    ? "bg-accent text-accent-ink"
                    : "bg-ink text-bg";
                return (
                  <div
                    key={item.id}
                    className={`absolute top-1 bottom-1 z-10 flex items-center overflow-hidden rounded-md px-2 text-base font-medium ${tone}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    <span className="truncate">{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
