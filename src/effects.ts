import {Action} from 'redux';
import {Caller} from './createCaller';
import {ExternalCondition} from "./waitForExternalCondition";
import {DEFAULT_CONDITION_CHECK_INTERVAL} from "./constants";

type StoreActionPredicate = (action: Action, loggedActions: Action[]) => boolean;

export type StoreDispatchAction = {
  type: StoreActionType.dispatchAction;
  action: Action;
};

export type StoreWaitForAction = {
  type: StoreActionType.waitForActionType;
  actionOrPredicate: string | StoreActionPredicate;
};

export type StoreWaitForMicrotasksToFinish = {
  type: StoreActionType.waitForMicrotasksToFinish;
};

export type StoreWaitForMs = {
  type: StoreActionType.waitForMs;
  ms: number;
  callback?: () => void;
};

export type StoreWaitForPromise = {
  type: StoreActionType.waitForPromise;
  promise: Promise<void>;
};

export type StoreWaitForCaller = {
  type: StoreActionType.waitForCall;
  caller: Caller;
  times?: number;
};

export type StoreWaitForStoreState<T> = {
  type: StoreActionType.waitForStoreState;
  condition: StateCondition<T>;
};

export type StoreWaitFor = {
  type: StoreActionType.waitFor;
  condition: ExternalCondition;
  options: {intervalMs: number};
};

export type StoreAction<T> =
  | StoreDispatchAction
  | StoreWaitForAction
  | StoreWaitForMs
  | StoreWaitForPromise
  | StoreWaitForCaller
  | StoreWaitFor
  | StoreWaitForMicrotasksToFinish
  | StoreWaitForStoreState<T>;

export enum StoreActionType {
  waitForActionType = 'waitForActionType',
  dispatchAction = 'dispatchAction',
  waitForMs = 'waitForMs',
  waitForPromise = 'waitForPromise',
  waitForCall = 'waitForCall',
  waitForStoreState = 'waitForStoreState',
  waitFor = 'waitFor',
  waitForMicrotasksToFinish = 'waitForMicrotasksToFinish',
}

type StateCondition<T> = (state: T, actions: Action[]) => boolean;

export const waitForMs = (ms: number, callback?: () => void): StoreWaitForMs => ({
  type: StoreActionType.waitForMs,
  ms,
  callback,
});

export const waitForMicrotasksToFinish = (): StoreWaitForMicrotasksToFinish => ({
  type: StoreActionType.waitForMicrotasksToFinish,
});

export const waitForPromise = (promise: Promise<void>): StoreWaitForPromise => ({
  type: StoreActionType.waitForPromise,
  promise,
});

interface WaitForActionFunction {
  (actionType: string): StoreWaitForAction;
  (predicate: StoreActionPredicate): StoreWaitForAction;
}

export const waitForAction: WaitForActionFunction = (actionOrPredicate) => ({
  type: StoreActionType.waitForActionType,
  actionOrPredicate,
});

export const dispatchAction = (action: Action): StoreDispatchAction => ({
  type: StoreActionType.dispatchAction,
  action,
});

export const waitForCall = (caller: Caller, {times}: {times?: number} = {}): StoreWaitForCaller => ({
  type: StoreActionType.waitForCall,
  caller,
  times
});

export const waitForState = <T>(condition: StateCondition<T>): StoreWaitForStoreState<T> => ({
  type: StoreActionType.waitForStoreState,
  condition,
});

export const waitFor = (
  condition: ExternalCondition,
  options: {intervalMs: number} = {intervalMs: DEFAULT_CONDITION_CHECK_INTERVAL}
): StoreWaitFor => ({
  type: StoreActionType.waitFor,
  condition,
  options,
});
