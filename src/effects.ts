import {Action} from 'redux';
import {Caller} from './createCaller';

export const DEFAULT_CONDITION_CHECK_INTERVAL = 10;

export type StoreDispatchAction = {
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
  callback?: () => void;
};

export type StoreWaitForPromise = {
  type: StoreActionType.waitForPromise;
  promise: Promise<void>;
};

export type StoreWaitForCaller = {
  type: StoreActionType.waitForCall;
  caller: Caller;
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
  | StoreWaitForStoreState<T>;

export enum StoreActionType {
  waitForActionType = 'waitForActionType',
  dispatchAction = 'dispatchAction',
  waitForMs = 'waitForMs',
  waitForPromise = 'waitForPromise',
  waitForCall = 'waitForCall',
  waitForStoreState = 'waitForStoreState',
  waitFor = 'waitFor',
}

type StateCondition<T> = (state: T, actions: Action[]) => boolean;
export type ExternalCondition = () => boolean;

export const waitForMs = (ms: number, callback?: () => void): StoreWaitForMs => ({
  type: StoreActionType.waitForMs,
  ms,
  callback,
});

export const waitForPromise = (promise: Promise<void>): StoreWaitForPromise => ({
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

export const waitForCall = (caller: Caller): StoreWaitForCaller => ({
  type: StoreActionType.waitForCall,
  caller,
});

export const waitForStateChange = <T>(condition: StateCondition<T>): StoreWaitForStoreState<T> => ({
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
