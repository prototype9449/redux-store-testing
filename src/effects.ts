import {Action} from 'redux';
import {Caller} from './createFunctionCaller';

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
  promise: Promise<unknown>;
};

export type StoreWaitForCaller = {
  type: StoreActionType.waitForCall;
  caller: Caller;
};

export type StoreWaitForCondition<T> = {
  type: StoreActionType.waitForCondition;
  condition: Condition<T>;
};

export type StoreAction<T> =
  | StoreDispatchAction
  | StoreWaitForAction
  | StoreWaitForMs
  | StoreWaitForPromise
  | StoreWaitForCaller
  | StoreWaitForCondition<T>;

export enum StoreActionType {
  waitForActionType = 'waitForActionType',
  dispatchAction = 'dispatchAction',
  waitForMs = 'waitForMs',
  waitForPromise = 'waitForPromise',
  waitForCall = 'waitForCall',
  waitForCondition = 'waitForCondition',
}

type Condition<T> = (state: T, actions: Action[]) => boolean;

export const waitForMs = (ms: number, callback?: () => void): StoreWaitForMs => ({
  type: StoreActionType.waitForMs,
  ms,
  callback,
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

export const waitForCall = (caller: Caller): StoreWaitForCaller => ({
  type: StoreActionType.waitForCall,
  caller,
});

export const waitForCondition = <T>(condition: Condition<T>): StoreWaitForCondition<T> => ({
  type: StoreActionType.waitForCondition,
  condition,
});
