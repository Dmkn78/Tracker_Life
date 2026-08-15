export type SerializedWriteCoordinator<Key, State, Write> = {
  synchronizeConfirmedState: (key: Key, state: State) => State;
  enqueueWrite: (key: Key, write: Write) => Promise<State>;
  getConfirmedState: (key: Key) => State | undefined;
  whenIdle: (key: Key) => Promise<void>;
};

type PendingWrite<State, Write> = {
  write: Write;
  resolve: (state: State) => void;
  reject: (error: unknown) => void;
};

type Channel<State, Write> = {
  confirmedState: State;
  pendingWrites: PendingWrite<State, Write>[];
  idleWaiters: Array<() => void>;
  isExecuting: boolean;
};

export function createSerializedWriteCoordinator<Key, State, Write>({
  applyWrite,
  executeWrite,
  publishState
}: {
  applyWrite: (state: State, write: Write) => State;
  executeWrite: (key: Key, write: Write) => Promise<State>;
  publishState: (key: Key, state: State) => void;
}): SerializedWriteCoordinator<Key, State, Write> {
  const channels = new Map<Key, Channel<State, Write>>();

  function synchronizeConfirmedState(key: Key, state: State): State {
    const channel = channels.get(key);
    if (!channel) {
      channels.set(key, { confirmedState: state, pendingWrites: [], idleWaiters: [], isExecuting: false });
      return state;
    }
    if (channel.pendingWrites.length === 0) channel.confirmedState = state;
    return project(channel);
  }

  function enqueueWrite(key: Key, write: Write): Promise<State> {
    const channel = channels.get(key);
    if (!channel) return Promise.reject(new Error("Cannot write before synchronizing confirmed state"));
    const completion = new Promise<State>((resolve, reject) => channel.pendingWrites.push({ write, resolve, reject }));
    publishState(key, project(channel));
    void drain(key, channel);
    return completion;
  }

  function whenIdle(key: Key): Promise<void> {
    const channel = channels.get(key);
    if (!channel || (!channel.isExecuting && channel.pendingWrites.length === 0)) return Promise.resolve();
    return new Promise((resolve) => channel.idleWaiters.push(resolve));
  }

  async function drain(key: Key, channel: Channel<State, Write>): Promise<void> {
    if (channel.isExecuting) return;
    channel.isExecuting = true;
    try {
      while (channel.pendingWrites.length > 0) {
        const pending = channel.pendingWrites[0];
        try {
          channel.confirmedState = await executeWrite(key, pending.write);
          channel.pendingWrites.shift();
          publishState(key, project(channel));
          pending.resolve(channel.confirmedState);
        } catch (error: unknown) {
          channel.pendingWrites.shift();
          publishState(key, project(channel));
          pending.reject(error);
        }
      }
    } finally {
      channel.isExecuting = false;
      channel.idleWaiters.splice(0).forEach((resolve) => resolve());
    }
  }

  function project(channel: Channel<State, Write>): State {
    return channel.pendingWrites.reduce((state, pending) => applyWrite(state, pending.write), channel.confirmedState);
  }

  return {
    synchronizeConfirmedState,
    enqueueWrite,
    getConfirmedState: (key) => channels.get(key)?.confirmedState,
    whenIdle
  };
}
