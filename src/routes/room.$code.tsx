import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LiveRoom } from "@/components/synesthesia/live-room";
import { normalizeCode } from "@/lib/synesthesia/codes";
import { primaryBtn } from "@/components/synesthesia/ui";

export const Route = createFileRoute("/room/$code")({
  validateSearch: (search: Record<string, unknown>) => ({
    host: search.host === true || search.host === "true" || search.host === "1",
    soncake: search.soncake === true || search.soncake === "true" || search.soncake === "1",
  }),
  component: RoomRoute,
});

function RoomRoute() {
  const { code: raw } = Route.useParams();
  const search = Route.useSearch();
  const code = normalizeCode(raw);
  const [live, setLive] = useState(false);
  useEffect(() => setLive(true), []);

  if (!code) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-4 px-5">
        <h1 className="font-display text-4xl text-ink">That code doesn't look right.</h1>
        <p className="text-xl text-ink">Room codes are 4 letters or numbers.</p>
        <Link to="/" className={primaryBtn + " w-full"}>
          Back home
        </Link>
      </main>
    );
  }

  if (!live) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-3 px-5">
        <p className="text-lg text-muted">Opening the room</p>
        <p className="font-display text-5xl tracking-widest text-ink">{code}</p>
      </main>
    );
  }

  return <LiveRoom code={code} hostRequested={search.host} soncakeRequested={search.soncake} />;
}
