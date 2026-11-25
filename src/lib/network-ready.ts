let ready: Promise<unknown> = Promise.resolve();
let hydrating = false;
let mounted!: () => void;
const publicPageReady = new Promise<void>((resolve) => {
  mounted = resolve;
});

export function markPublicPageReady() {
  mounted();
}

export function waitForPublicPage() {
  return publicPageReady;
}

export function prepareNetwork(
  initialization: Promise<unknown>,
  hydration = false,
) {
  ready = initialization;
  hydrating = hydration;
}

export function waitForNetwork() {
  return ready;
}

export async function waitForReconciliation() {
  await ready;
  if (hydrating) await publicPageReady;
}
