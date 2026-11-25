import { setupWorker } from "msw/browser";
import { apiHandler } from "./api";
import { socketHandler } from "./socket";
import { initialize, startOrderClock } from "./store";

export async function startMocks() {
  const data = initialize();
  const worker = setupWorker(apiHandler, socketHandler);
  await worker.start({
    quiet: true,
    onUnhandledRequest(request) {
      if (new URL(request.url).pathname.startsWith("/api/"))
        throw new Error(
          `Requisição sem handler: ${request.method} ${request.url}`,
        );
    },
  });
  await data;
  startOrderClock();
}
