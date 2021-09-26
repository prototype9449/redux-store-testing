import {Action, Store} from 'redux';
import {StoreAction, StoreActionType} from './effects';
import { waitForMsAndResolve } from './waitForMsAndResolve';

type InitParams<T> = {
  originalSetTimeout?: typeof setTimeout;
  initializeFunction?: (store: Store<T>) => () => void;
  initStore: (listener: (action: Action, state: T) => void) => Store<T>;
  errorTimoutMs?: number;
};

export type StoreResult<T> = {actions: Action[]; state: T; error?: string};

const DEFAULT_TIMEOUT_ERROR = 3000;

export class StoreTester<T> {
  private store: Store<T>;
  private loggedActions: Action[] = [];
  private currentState: T | undefined = undefined;
  private readonly initStore;
  private readonly initializeFunction: (store: Store) => () => void;
  private waitedAction: string | undefined;
  private promiseToWait: Promise<void>;
  private resolveWhenActionCaught: ((value?: any) => void) | undefined;
  private finished = false;
  private generator: Generator<StoreAction, void, StoreResult<T>> | undefined;
  private nextAction: StoreAction | undefined = undefined;
  private justDispatchedActionType: string | undefined;
  private readonly originalSetTimeout;
  private readonly errorTimoutMs: number;

  constructor({
    initStore,
    initializeFunction = () => () => void 0,
    originalSetTimeout,
    errorTimoutMs = DEFAULT_TIMEOUT_ERROR,
  }: InitParams<T>) {
    this.initStore = initStore;
    this.initializeFunction = initializeFunction;
    this.errorTimoutMs = errorTimoutMs;
    this.originalSetTimeout = originalSetTimeout ?? setTimeout;
  }

  listener = (action: Action, state: T): void => {
    if (this.finished) {
      return;
    }
    const isDispatchedAction = this.justDispatchedActionType === action.type;
    if (isDispatchedAction) {
      this.justDispatchedActionType = undefined;
    }
    this.loggedActions.push(action);
    this.currentState = state;

    const processNextWaitForAction = () => {
      if (!this.waitedAction && this.generator) {
        const nextAction = this.generator.next({actions: [...this.loggedActions], state});
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

  waitForAction = (actionType: string): Promise<void> => {
    this.waitedAction = actionType;
    this.promiseToWait = new Promise<void>(res => {
      this.resolveWhenActionCaught = res;
    });
    return this.promiseToWait;
  };

  timeOut = (): Promise<string | void> => {
    return new Promise<string | void>(res => {
      this.originalSetTimeout(() => {
        res('Timeout has expired. Caught actions: ' + this.loggedActions.map(x => x.type).join('\n'));
      }, this.errorTimoutMs);
    });
  };

  main = async (): Promise<void> => {
    if (!this.generator) {
      return Promise.resolve();
    }
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
        const res = this.generator.next({actions: [...this.loggedActions], state: this.currentState!});
        this.finished = res.done ? res.done : false;
        if (this.finished || !res.value) {
          break;
        }
        value = res.value;
      }

      switch (value.type) {
        case StoreActionType.waitForActionType: {
          await this.waitForAction(value.actionType);
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
          const {ms, callback} = value;
          await waitForMsAndResolve({ms, callback});
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

  async run(createGenerator?: () => Generator<StoreAction, void, StoreResult<T>>): Promise<StoreResult<T>> {
    this.generator = createGenerator ? createGenerator() : undefined;
    this.store = this.initStore(this.listener);
    const result: string | void = await Promise.race([this.main(), this.timeOut()]);
    const destruct = this.initializeFunction(this.store);
    destruct();
    return Promise.resolve({state: this.currentState!, actions: this.loggedActions, error: result ?? undefined});
  }
}
