import { onBeforeUnmount } from "vue";
import { captureSession, isCurrentSession, subscribeSession } from "@/utils/token";

interface Effects<T> {
  start?: () => void;
  success?: (value: T) => void | Promise<void>;
  error?: (error: unknown) => void;
  finish?: () => void;
}

/** One owner per view; replacement, session changes and unmount abort work. */
export function useSessionRequests(reset: () => void) {
  const pending = new Map<string, AbortController>();
  let disposed = false;
  function cancel(): void {
    for (const controller of pending.values()) controller.abort();
    pending.clear();
    reset();
  }
  const unsubscribe = subscribeSession(cancel);
  onBeforeUnmount(() => {
    disposed = true;
    unsubscribe();
    cancel();
  });
  return async function run<T>(
    key: string,
    work: (signal: AbortSignal) => Promise<T>,
    effects: Effects<T>,
  ): Promise<void> {
    const session = captureSession();
    if (disposed || !isCurrentSession(session)) return;
    pending.get(key)?.abort();
    const controller = new AbortController();
    pending.set(key, controller);
    const current = () => !disposed && pending.get(key) === controller &&
      !controller.signal.aborted && isCurrentSession(session);
    try {
      effects.start?.();
      const value = await work(AbortSignal.any([session.signal, controller.signal]));
      if (current()) await effects.success?.(value);
    } catch (error) {
      if (current()) effects.error?.(error);
    } finally {
      if (current()) effects.finish?.();
      if (pending.get(key) === controller) pending.delete(key);
      controller.abort();
    }
  };
}
