export type CalendarRead = { generation: number; signal: AbortSignal };

export type CalendarRequestGate = {
  beginRead: () => CalendarRead | null;
  invalidateReads: () => void;
  isCurrentRead: (generation: number) => boolean;
  isDisposed: () => boolean;
  dispose: () => void;
};

export function createCalendarRequestGate(): CalendarRequestGate {
  let generation = 0;
  let activeController: AbortController | null = null;
  let disposed = false;
  return {
    beginRead() {
      if (disposed) return null;
      activeController?.abort();
      activeController = new AbortController();
      generation += 1;
      return { generation, signal: activeController.signal };
    },
    invalidateReads() {
      if (disposed) return;
      activeController?.abort();
      generation += 1;
    },
    isCurrentRead(readGeneration) {
      return !disposed && readGeneration === generation;
    },
    isDisposed: () => disposed,
    dispose() {
      disposed = true;
      activeController?.abort();
      generation += 1;
    }
  };
}

export async function runCalendarMutation<Result>({
  requestGate,
  mutate,
  whenIdle,
  reload
}: {
  requestGate: CalendarRequestGate;
  mutate: () => Promise<Result>;
  whenIdle: () => Promise<void>;
  reload: () => Promise<void>;
}): Promise<Result> {
  requestGate.invalidateReads();
  try {
    return await mutate();
  } finally {
    await whenIdle();
    if (!requestGate.isDisposed()) await reload();
  }
}
