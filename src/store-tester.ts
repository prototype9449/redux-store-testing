import {Action, Store} from 'redux';

type StoreDispatchAction = {
  type: StoreActionType.dispatchAction;
  action: Action;
};

export type StoreWaitForAction = {
  type: StoreActionType.waitForActionType;
  actionType: string;
};

export type StoreWaitForMs = {
  type: StoreActionType.waitForMs;
  ms: number;
};

export type StoreWaitForPromise = {
  type: StoreActionType.waitForPromise;
  promise: Promise<unknown>;
};

export type StoreAction = StoreDispatchAction | StoreWaitForAction | StoreWaitForMs | StoreWaitForPromise;

type StoreResult<T> = {actions: Action[]; state: T; error?: string};

enum StoreActionType {
  waitForActionType = 'waitForActionType',
  dispatchAction = 'dispatchAction',
  waitForMs = 'waitForMs',
  waitForPromise = 'waitForPromise'
}

export const waitForMs = (ms: number): StoreWaitForMs => ({
  type: StoreActionType.waitForMs,
  ms,
});

export const waitForPromise = <T>(promise: Promise<T>): StoreWaitForPromise => ({
  type: StoreActionType.waitForPromise,
  promise,
});

export const waitForAction = (actionType: string): StoreWaitForAction => ({
  type: StoreActionType.waitForActionType,
  actionType,
});

export const dispatchAction = (action: Action): StoreDispatchAction => ({
  type: StoreActionType.dispatchAction,
  action,
});

type InitParams<T> = {
  initializeFunction?: (store: Store<T>) => () => void;
  initStore: (listener: (action: Action, state: T) => void) => Store<T>;
};

const waitForMsAndResolve = (ms: number): Promise<void> => {
  return new Promise<void>(res => {
    setTimeout(() => res(), ms);
  });
};

export class StoreTester<T> {
  private store: Store<T>;
  private loggedActions: Action[] = [];
  private state: T | undefined = undefined;
  private readonly initStore;
  private readonly initializeFunction: (store: Store) => () => void;
  private waitedAction: string | undefined;
  private promiseToWait: Promise<unknown>;
  private resolveWhenActionCaught: ((value?: any) => void) | undefined;
  private isError: boolean = false;
  private finished: boolean = false;
  private gen: Generator<StoreAction, void, StoreResult<T>>;
  private nextAction: StoreAction | undefined = undefined;
  private justDispatchedActionType: string | undefined;

  constructor({initStore, initializeFunction = () => () => void 0}: InitParams<T>) {
    this.initStore = initStore;
    this.initializeFunction = initializeFunction;
  }

  listener = (action: Action, state: T) => {
    const isDispatchedAction = this.justDispatchedActionType === action.type;
    if (isDispatchedAction) {
      this.justDispatchedActionType = undefined;
    }
    this.loggedActions.push(action);
    this.state = state;

    const processNextWaitForAction = () => {
      if (!this.waitedAction && this.gen) {
        const nextAction = this.gen.next({actions: [...this.loggedActions], state});
        if (nextAction.done) {
          this.finished = true;
          return;
        }
        if (nextAction.value.type === StoreActionType.waitForActionType) {
          this.waitedAction = nextAction.value.actionType;
        } else {
          this.nextAction = nextAction.value;
        }
      }
    };
    processNextWaitForAction();

    if (!isDispatchedAction && this.waitedAction && action.type === this.waitedAction) {
      this.waitedAction = undefined;
      processNextWaitForAction();
      if (this.resolveWhenActionCaught) {
        this.resolveWhenActionCaught();
      }
    }
  };

  waitForAction = (actionType: string) => {
    this.waitedAction = actionType;
    this.promiseToWait = new Promise<any>(res => {
      this.resolveWhenActionCaught = res;
    });
    return this.promiseToWait;
  };

  timeOut = (): Promise<string | void> => {
    let savedMs = 0;
    let initialTime = performance.now();
    let resolve: (value: string | void) => void;
    const promise = new Promise<string | void>(res => {
      resolve = res;
    });
    const func = () => {
      if (this.finished) {
        resolve();
        return;
      }
      if (savedMs > 3000) {
        this.isError = true;
        this.finished = true;
        resolve('Timeout has expired. Caught actions: ' + this.loggedActions.map(x => x.type).join('\n'));
      } else {
        const currentPerf = performance.now();
        savedMs += currentPerf - initialTime;
        initialTime = currentPerf;
        requestAnimationFrame(() => func());
      }
    };
    func();
    return promise;
  };

  main = async (): Promise<void> => {
    while (!this.finished) {
      let value: StoreAction;
      if (this.nextAction) {
        value = this.nextAction;
        this.nextAction = undefined;
      } else if (this.waitedAction) {
        value = {
          type: StoreActionType.waitForActionType,
          actionType: this.waitedAction,
        };
      } else {
        const res = this.gen.next({actions: [...this.loggedActions], state: this.state!});
        this.finished = res.done ? res.done : false;
        if (this.finished || !res.value) {
          break;
        }
        value = res.value;
      }

      switch (value.type) {
        case StoreActionType.waitForActionType: {
          await this.waitForAction(value.type);
          this.resolveWhenActionCaught = undefined;
          break;
        }

        case StoreActionType.dispatchAction: {
          const action = value.action;
          this.justDispatchedActionType = action.type;
          this.store.dispatch(action);
          break;
        }

        case StoreActionType.waitForMs: {
          const milliseconds = value.ms;
          await waitForMsAndResolve(milliseconds);
          break;
        }

        case StoreActionType.waitForPromise: {
          const promise = value.promise;
          await promise;
          break;
        }
      }
    }
  };

  async run(generator: () => Generator<StoreAction, void, StoreResult<T>>): Promise<StoreResult<T>> {
    this.store = this.initStore(this.listener);
    const destruct = this.initializeFunction(this.store);
    this.gen = generator();
    const result: string | void = await Promise.race([this.main(), this.timeOut()]);
    destruct();
    return Promise.resolve({state: this.state!, actions: this.loggedActions, error: result ?? undefined});
  }
}
