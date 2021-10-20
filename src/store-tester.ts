import {Action, Store} from 'redux';
import {StoreAction, StoreActionType, StoreWaitForAction, StoreWaitForCaller, StoreWaitForStoreState} from './effects';
import {waitForMsAndResolve} from './waitForMsAndResolve';
import {waitForExternalCondition} from './waitForExternalCondition';
import {printError} from './printError';
import {DEFAULT_TIMEOUT_ERROR} from './constants';
import { ActionListener } from '.';

const defaultSetTimeout = setTimeout;

export type StoreTesterParams<T> = {
  originalSetTimeout?: typeof setTimeout;
  initializeFunction?: (store: Store<T>) => () => void;
  initStore: (listener: ActionListener<T>) => Store<T>;
  errorTimoutMs?: number;
  throwOnTimeout?: boolean;
};

export type StoreResult<T> = {actions: Action[]; state: T; error?: string};

export class StoreTester<T> {
  private store: Store<T>;
  private loggedActions: Action[] = [];
  private currentState: T | undefined = undefined;
  private readonly initStore;
  private readonly initializeFunction: (store: Store) => () => void;
  private resolveWhenActionCaught: (() => void) | undefined;
  private resolveWhenStateConditionMet: (() => void) | undefined;
  private resolveWhenInitFunctionCalled: (() => void) | undefined;
  private loggedEffects: StoreAction<T>[] = [];
  private initFunctionIsCalled = false;

  private finished = false;
  private generator: Generator<StoreAction<T>, void, StoreResult<T>> | undefined;
  private nextAction: StoreAction<T> | undefined = undefined;
  private justDispatchedAction: Action | undefined;
  private readonly originalSetTimeout;
  private readonly errorTimoutMs: number;
  private promiseToWaitForCall: Promise<void> | undefined;
  private promiseToWaitForInitFunctionToBeCalled: Promise<void> | undefined;
  private isWaitingForPromise = false;
  private throwOnTimeout: boolean;

  constructor({
    initStore,
    initializeFunction = () => () => void 0,
    originalSetTimeout,
    throwOnTimeout = true,
    errorTimoutMs = DEFAULT_TIMEOUT_ERROR,
  }: StoreTesterParams<T>) {
    this.throwOnTimeout = throwOnTimeout;
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

    if (this.promiseToWaitForCall || this.isWaitingForPromise || this.promiseToWaitForInitFunctionToBeCalled) {
      return;
    }
    this.processCurrentStateAndAction(action);
  };

  private processCurrentStateAndAction(action?: Action): void {
    if (!this.generator) {
      return;
    }
    const isJustDispatchedAction = action ? this.justDispatchedAction === action : false;
    this.justDispatchedAction = undefined;

    this.nextAction = this.nextAction ?? this.processNextAction(this.generator);
    if (!this.nextAction) {
      return;
    }
    if (
      action &&
      !isJustDispatchedAction &&
      this.nextAction.type === StoreActionType.waitForActionType &&
      ((typeof this.nextAction.actionOrPredicate === 'string' && action.type === this.nextAction.actionOrPredicate) ||
        (typeof this.nextAction.actionOrPredicate === 'function' &&
          this.nextAction.actionOrPredicate(action, [...this.loggedActions])))
    ) {
      this.nextAction = undefined;
      this.processCurrentStateAndAction();
      if (this.resolveWhenActionCaught) {
        this.resolveWhenActionCaught();
        this.resolveWhenActionCaught = undefined;
      }
      return;
    }

    if (
      this.currentState &&
      this.nextAction.type === StoreActionType.waitForStoreState &&
      this.nextAction.condition(this.currentState, this.loggedActions)
    ) {
      this.nextAction = undefined;
      this.processCurrentStateAndAction(action);
      if (this.resolveWhenStateConditionMet) {
        this.resolveWhenStateConditionMet();
        this.resolveWhenStateConditionMet = undefined;
      }
      return;
    }

    if (this.nextAction?.type === StoreActionType.waitForCall) {
      const action = this.nextAction;
      this.nextAction = undefined;
      this.waitForCall(action);
      return;
    }

    if (this.nextAction?.type === StoreActionType.waitForInitializeFunction && this.initFunctionIsCalled) {
      this.nextAction = undefined;
      this.processCurrentStateAndAction();
    }
  }

  private processNextAction = (
    generator: Generator<StoreAction<T>, void, StoreResult<T>>
  ): StoreAction<T> | undefined => {
    const nextAction = generator.next({actions: [...this.loggedActions], state: this.currentState!});
    if (nextAction.done) {
      this.finished = true;
      return;
    }
    this.loggedEffects.push(nextAction.value);
    return nextAction.value;
  };

  private waitForAction = (action: StoreWaitForAction): Promise<void> => {
    this.nextAction = action;
    return new Promise<void>(res => {
      this.resolveWhenActionCaught = res;
    });
  };

  private waitForState = (action: StoreWaitForStoreState<T>): Promise<void> => {
    this.nextAction = action;
    const promise = new Promise<void>(res => {
      this.resolveWhenStateConditionMet = res;
    });
    this.processCurrentStateAndAction();
    return promise;
  };

  private waitForInitFunctionToBeCalled = (): Promise<void> => {
    this.promiseToWaitForInitFunctionToBeCalled = new Promise(res => {
      this.resolveWhenInitFunctionCalled = res;
    });
    return this.promiseToWaitForInitFunctionToBeCalled;
  };

  private async waitForCall(action: StoreWaitForCaller) {
    if (action.caller.wasCalled()) {
      this.promiseToWaitForCall = undefined;
      this.processCurrentStateAndAction();
      return;
    }
    this.promiseToWaitForCall = new Promise<void>(res => {
      action.caller.subscribeOnCall(async () => {
        this.promiseToWaitForCall = undefined;
        this.processCurrentStateAndAction();
        res();
      });
    });
    await this.promiseToWaitForCall;
  }

  private timeOut = (): Promise<string | void> => {
    return new Promise<string | void>(res => {
      this.originalSetTimeout(() => {
        this.finished = true;
        res(printError(this.loggedEffects, this.loggedActions));
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
        const nextStoreAction = this.processNextAction(this.generator);
        if (this.finished || !nextStoreAction) {
          break;
        }
        storeAction = nextStoreAction;
      }

      switch (storeAction.type) {
        case StoreActionType.dispatchAction: {
          const action = storeAction.action;
          this.justDispatchedAction = action;
          this.store.dispatch(action);
          break;
        }
        case StoreActionType.waitForActionType: {
          await this.waitForAction(storeAction);
          break;
        }
        case StoreActionType.waitForStoreState: {
          await this.waitForState(storeAction);
          break;
        }
        case StoreActionType.waitForCall: {
          await this.waitForCall(storeAction);
          break;
        }
        case StoreActionType.waitForMs: {
          const {ms, callback} = storeAction;
          this.isWaitingForPromise = true;
          await waitForMsAndResolve({ms, callback});
          this.isWaitingForPromise = false;
          break;
        }
        case StoreActionType.waitForPromise: {
          this.isWaitingForPromise = true;
          await storeAction.promise;
          this.isWaitingForPromise = false;
          break;
        }
        case StoreActionType.waitFor: {
          const {condition, options} = storeAction;
          this.isWaitingForPromise = true;
          await waitForExternalCondition({condition, options});
          this.isWaitingForPromise = false;
          break;
        }
        case StoreActionType.waitForInitializeFunction: {
          if (this.initFunctionIsCalled) {
            break;
          }
          await this.waitForInitFunctionToBeCalled();
          break;
        }
        case StoreActionType.waitForSyncWorkToFinish: {
          this.isWaitingForPromise = true;
          await waitForMsAndResolve({ms: 0});
          this.isWaitingForPromise = false;
        }
      }
    }
  };

  public async run(createGenerator?: () => Generator<StoreAction<T>>): Promise<StoreResult<T>> {
    this.generator = createGenerator ? createGenerator() : undefined;
    this.processCurrentStateAndAction();
    this.store = this.initStore(this.listener);
    this.currentState = this.currentState ?? this.store.getState();
    const destruct = this.initializeFunction(this.store);
    this.initFunctionIsCalled = true;
    if (this.resolveWhenInitFunctionCalled) {
      this.resolveWhenInitFunctionCalled();
      this.promiseToWaitForInitFunctionToBeCalled = undefined;
    }
    const result: string | void = await Promise.race([this.main(), this.timeOut()]);
    destruct();
    if (result && this.throwOnTimeout) {
      throw new Error(result);
    }
    return Promise.resolve({state: this.currentState!, actions: this.loggedActions, error: result ?? undefined});
  }
}
