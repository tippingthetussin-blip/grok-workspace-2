import { createFileRoute } from "@tanstack/react-router";
import { handleRelay } from "@/lib/synesthesia/relay.server";

const handle = ({ request }: { request: Request }) => handleRelay(request);

export const Route = createFileRoute("/api/relay")({
  server: { handlers: { GET: handle, POST: handle } },
});
