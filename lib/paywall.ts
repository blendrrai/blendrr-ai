// Lightweight event bus for the paywall modal. callEdge (lib/blendrr.ts)
// fires `showPaywall()` whenever the server returns "Out of credits" for a
// non-Pro user. The PaywallModal mounted in the root layout subscribes here
// and renders accordingly. Decoupled from the modal itself so any future
// surface — onboarding gate, deep-link entry point, etc. — can trigger it
// without importing the component.

type Listener = () => void;

const listeners = new Set<Listener>();

export function showPaywall(): void {
  listeners.forEach((cb) => {
    try { cb(); } catch { /* ignore listener errors */ }
  });
}

export function subscribePaywall(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
