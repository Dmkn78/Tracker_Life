export type RequestRead = { generation: number; signal: AbortSignal };

export type RequestGate = {
  beginRead: () => RequestRead | null;
  invalidateReads: () => void;
  isCurrentRead: (generation: number) => boolean;
  isDisposed: () => boolean;
  dispose: () => void;
};

export function createRequestGate(): RequestGate {
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
    isCurrentRead: (readGeneration) => !disposed && readGeneration === generation,
    isDisposed: () => disposed,
    dispose() {
      disposed = true;
      activeController?.abort();
      generation += 1;
    }
  };
}
