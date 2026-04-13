import type { FactSetAlert } from '@/lib/factset';

type Listener = (payload: { updatedAt: string; alert?: FactSetAlert; alerts: FactSetAlert[] }) => void;

const globalForRealtime = globalThis as typeof globalThis & {
  __factsetListeners?: Set<Listener>;
};

function listeners() {
  if (!globalForRealtime.__factsetListeners) {
    globalForRealtime.__factsetListeners = new Set();
  }
  return globalForRealtime.__factsetListeners;
}

export function subscribe(listener: Listener) {
  listeners().add(listener);
  return () => listeners().delete(listener);
}

export function publish(payload: { updatedAt: string; alert?: FactSetAlert; alerts: FactSetAlert[] }) {
  for (const listener of listeners()) {
    try {
      listener(payload);
    } catch {
      // ignore listener errors
    }
  }
}
