import { createFileRoute } from "@tanstack/react-router";
import { atomicNow } from "@/lib/synesthesia/time.server";

export const Route = createFileRoute("/api/time")({
  server: {
    handlers: {
      GET: async () => {
        const clock = await atomicNow();
        return Response.json(clock, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
