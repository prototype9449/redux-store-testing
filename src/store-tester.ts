const defaultSetTimeout = setTimeout;

import {Action, Store} from 'redux';
import {StoreAction, StoreActionType, StoreWaitForAction, StoreWaitForCaller, StoreWaitForStateChange} from './effects';
import {waitForMsAndResolve} from './waitForMsAndResolve';
import {waitForExternalCondition} from './waitForExternalCondition';

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
  private resolveWhenActionCaught: (() => void) | undefined;
  private resolveWhenConditionMet: (() => void) | undefined;

  private finished = false;
  private generator: Generator<StoreAction<T>, void, StoreResult<T>> | undefined;
  private nextAction: StoreAction<T> | undefined = undefined;
  private justDispatchedAction: Action | undefined;
  private readonly originalSetTimeout;
  private readonly errorTimoutMs: number;
  private promiseToWaitForCall: Promise<void> | undefined;
  private waitingForExternalPromise = false;

  constructor({
    initStore,
    initializeFunction = () => () => void 0,
    originalSetTimeout,
    errorTimoutMs = DEFAULT_TIMEOUT_ERROR,
  }: InitParams<T>) {
    this.initStore = initStore;
    this.initializeFunction = initializeFunction;
    this.errorTimoutMs = errorTimoutMs;
    this.originalSetTimeout = originalSetTimeout ?? defaultSetTimeout;
  }

  private listener = (action: Action, state: T): void => {
    if (this.finished) {
      return;
    }

    this.loggedActions.push(action);
    this.currentState = state;

    if (this.promiseToWaitForCall || this.waitingForExternalPromise) {
      return;
    }

    const isJustDispatchedAction = this.justDispatchedAction === action;
    if (isJustDispatchedAction) {
      this.justDispatchedAction = undefined;
    }

    if (!this.nextAction && this.generator) {
      this.nextAction = this.processNextWaitForAction(this.generator);
    }

    if (
      !isJustDispatchedAction &&
      this.nextAction?.type === StoreActionType.waitForActionType &&
      action.type === this.nextAction.actionType
    ) {
      this.nextAction = this.processNextWaitForAction(this.generator!);
      if (this.resolveWhenActionCaught) {
        this.resolveWhenActionCaught();
      }
    }

    if (
      this.nextAction?.type === StoreActionType.waitForStateChange &&
      this.nextAction.condition(state, this.loggedActions)
    ) {
      this.nextAction = this.processNextWaitForAction(this.generator!);
      if (this.resolveWhenConditionMet) {
        this.resolveWhenConditionMet();
      }
    }
  };

  private processNextWaitForAction = (
    generator: Generator<StoreAction<T>, void, StoreResult<T>>
  ): StoreAction<T> | undefined => {
    const nextAction = generator.next({actions: [...this.loggedActions], state: this.currentState!});
    if (nextAction.done) {
      this.finished = true;
      return;
    }
    return nextAction.value;
  };

  private waitForAction = (action: StoreWaitForAction): Promise<void> => {
    this.nextAction = action;
    return new Promise<void>(res => {
      this.resolveWhenActionCaught = res;
    });
  };

  private waitForCondition = (action: StoreWaitForStateChange<T>): Promise<void> => {
    this.nextAction = action;
    return new Promise<void>(res => {
      this.resolveWhenConditionMet = res;
    });
  };

  private async waitForCall(action: StoreWaitForCaller, deep = 0) {
    this.promiseToWaitForCall = new Promise<void>(res => {
      action.caller.subscribeOnCall(async () => {
        const nextAction = this.processNextWaitForAction(this.generator!);
        if (nextAction?.type === StoreActionType.waitForCall) {
          //continue to wait for next caller
          await this.waitForCall(nextAction, deep + 1);
        } else {
          this.nextAction = nextAction;
        }
        this.promiseToWaitForCall = undefined; // should clear promise to make listener handle the next action
        res();
      });
    });

    return this.promiseToWaitForCall;
  }

  private timeOut = (): Promise<string | void> => {
    return new Promise<string | void>(res => {
      this.originalSetTimeout(() => {
        res('Timeout has expired. Caught actions: \n' + this.loggedActions.map(x => x.type).join('\n'));
      }, this.errorTimoutMs);
    });
  };

  private main = async (): Promise<void> => {
    if (!this.generator) {
      return Promise.resolve();
    }
    while (!this.finished) {
      let storeAction: StoreAction<T>;
      if (this.promiseToWaitForCall) {
        await this.promiseToWaitForCall;
      }
      if (this.nextAction) {
        storeAction = this.nextAction;
        this.nextAction = undefined;
      } else {
        const {done, value: nextStoreAction} = this.generator.next({
          actions: [...this.loggedActions],
          state: this.currentState!,
        });
        this.finished = !!done;
        if (this.finished || !nextStoreAction) {
          break;
        }
        storeAction = nextStoreAction;
      }

      switch (storeAction.type) {
        case StoreActionType.waitForActionType: {
          await this.waitForAction(storeAction);
          this.resolveWhenActionCaught = undefined;
          break;
        }

        case StoreActionType.waitForStateChange: {
          await this.waitForCondition(storeAction);
          this.resolveWhenConditionMet = undefined;
          break;
        }

        case StoreActionType.dispatchAction: {
          const action = storeAction.action;
          this.justDispatchedAction = action;
          this.store.dispatch(action);
          break;
        }

        case StoreActionType.waitForMs: {
          const {ms, callback} = storeAction;
          this.waitingForExternalPromise = true;
          await waitForMsAndResolve({ms, callback});
          this.waitingForExternalPromise = false;
          break;
        }

        case StoreActionType.waitForPromise: {
          this.waitingForExternalPromise = true;
          await storeAction.promise; // todo return result?
          this.waitingForExternalPromise = false;
          break;
        }

        case StoreActionType.waitFor: {
          const {condition, options} = storeAction;
          this.waitingForExternalPromise = true;
          await waitForExternalCondition({condition, options});
          this.waitingForExternalPromise = false;
          break;
        }

        case StoreActionType.waitForCall: {
          await this.waitForCall(storeAction);
          break;
        }
      }
    }
  };

  public async run(createGenerator?: () => Generator<StoreAction<T>, void, StoreResult<T>>): Promise<StoreResult<T>> {
    this.generator = createGenerator ? createGenerator() : undefined;
    if (this.generator) {
      const nextAction = this.processNextWaitForAction(this.generator);
      if (nextAction?.type === StoreActionType.waitForCall) {
        this.waitForCall(nextAction); // need to subscribe on caller before store initialization begin
      } else {
        this.nextAction = nextAction;
      }
    }
    this.store = this.initStore(this.listener);
    const result: string | void = await Promise.race([this.main(), this.timeOut()]);
    const destruct = this.initializeFunction(this.store);
    destruct();
    return Promise.resolve({state: this.currentState!, actions: this.loggedActions, error: result ?? undefined});
  }
}

type StoreTesterRunParameters = Parameters<typeof StoreTester.prototype.run>;
type ReturnTypeOfStoreTesterRun = ReturnType<typeof StoreTester.prototype.run>;

export const testStore = <T>(
  options: InitParams<T>,
  ...runParams: StoreTesterRunParameters
): ReturnTypeOfStoreTesterRun => {
  return new StoreTester(options).run(...runParams);
};
