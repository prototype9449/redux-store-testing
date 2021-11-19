const defaultSetTimeout = setTimeout;

import {Action, Store} from 'redux';
import {StoreAction, StoreActionType, StoreWaitForAction, StoreWaitForCaller, StoreWaitForStoreState} from './effects';
import {waitForMsAndResolve} from './waitForMsAndResolve';
import {waitForExternalCondition} from './waitForExternalCondition';
import {printError} from './printError';
import {DEFAULT_TIMEOUT_ERROR} from './constants';
import {ActionListener} from './actionLogger';

export enum InitFunctionCallState {
  notCalled = 'notCalled',
  inProcess = 'inProcess',
  called = 'called',
}

export type StoreTesterParams<T> = {
  originalSetTimeout?: typeof setTimeout;
  initializeFunction?: (store: Store<T>) => () => void;
  initStore: (listener: ActionListener<T>) => Store<T>;
  errorTimoutMs?: number;
  throwOnTimeout?: boolean;
  skipSyncActionDispatchesInInitializeFunction?: boolean;
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
  private loggedEffects: StoreAction<T>[] = [];
  private initFunctionState: InitFunctionCallState = InitFunctionCallState.notCalled;

  private finished = false;
  private generator: Generator<StoreAction<T>, void, StoreResult<T>> | undefined;
  private nextAction: StoreAction<T> | undefined = undefined;
  private justDispatchedAction: Action | undefined;
  private readonly originalSetTimeout;
  private readonly errorTimoutMs: number;
  private promiseToWaitForCall: Promise<void> | undefined;
  private isWaitingForPromise = false;
  private readonly throwOnTimeout: boolean;
  private readonly skipSyncActionDispatchesInInitializeFunction: boolean;

  constructor({
    initStore,
    initializeFunction = () => () => void 0,
    originalSetTimeout,
    throwOnTimeout = true,
    errorTimoutMs = DEFAULT_TIMEOUT_ERROR,
    skipSyncActionDispatchesInInitializeFunction = false,
  }: StoreTesterParams<T>) {
    this.throwOnTimeout = throwOnTimeout;
    this.initStore = initStore;
    this.initializeFunction = initializeFunction;
    this.errorTimoutMs = errorTimoutMs;
    this.originalSetTimeout = originalSetTimeout ?? defaultSetTimeout;
    this.skipSyncActionDispatchesInInitializeFunction = skipSyncActionDispatchesInInitializeFunction;
  }

  private shouldWaitForInitialize = () =>
    this.skipSyncActionDispatchesInInitializeFunction && this.initFunctionState === InitFunctionCallState.inProcess;

  private listener = (action: Action, state: T): void => {
    if (this.finished) {
      return;
    }

    this.currentState = state;
    if (this.shouldWaitForInitialize()) {
      return;
    }
    this.loggedActions.push(action);

    if (this.promiseToWaitForCall || this.isWaitingForPromise) {
      return;
    }
    this.processCurrentStateAndAction(action);
  };

  private processCurrentStateAndAction(action?: Action): void {
    if (!this.generator || this.shouldWaitForInitialize() || this.promiseToWaitForCall || this.isWaitingForPromise) {
      return;
    }
    const isJustDispatchedAction = action ? this.justDispatchedAction === action : false;
    this.justDispatchedAction = undefined;

    this.nextAction = this.nextAction ?? this.processNextAction(this.generator);
    if (!this.nextAction) {
      return;
    }
    if (action && !isJustDispatchedAction && doesWaitForActionMatch<T>(action, this.nextAction, this.loggedActions)) {
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
        case StoreActionType.waitForMicrotasksToFinish: {
          this.isWaitingForPromise = true;
          await waitForMsAndResolve({ms: 0});
          this.isWaitingForPromise = false;
        }
      }
    }
  };

  public async run(createGenerator?: () => Generator<StoreAction<T>, void, StoreResult<T>>): Promise<StoreResult<T>> {
    this.generator = createGenerator ? createGenerator() : undefined;
    this.processCurrentStateAndAction();
    this.store = this.initStore(this.listener);
    this.currentState = this.currentState ?? this.store.getState();
    this.initFunctionState = InitFunctionCallState.inProcess;
    const destruct = this.initializeFunction(this.store);
    this.initFunctionState = InitFunctionCallState.called;
    this.processCurrentStateAndAction();
    const result: string | void = await Promise.race([this.main(), this.timeOut()]);
    destruct();
    if (result && this.throwOnTimeout) {
      throw new Error(result);
    }
    return Promise.resolve({state: this.currentState!, actions: this.loggedActions, error: result ?? undefined});
  }
}

function doesWaitForActionMatch<T>(action: Action, waitForAction: StoreAction<T>, loggedActions: Action[]): boolean {
  return (
    waitForAction.type === StoreActionType.waitForActionType &&
    ((typeof waitForAction.actionOrPredicate === 'string' && action.type === waitForAction.actionOrPredicate) ||
      (typeof waitForAction.actionOrPredicate === 'function' &&
        waitForAction.actionOrPredicate(action, [...loggedActions])))
  );
}
