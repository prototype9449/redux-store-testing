import {Action} from "redux";

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

export type StoreAction = StoreDispatchAction | StoreWaitForAction | StoreWaitForMs | StoreWaitForPromise;

export enum StoreActionType {
  waitForActionType = 'waitForActionType',
  dispatchAction = 'dispatchAction',
  waitForMs = 'waitForMs',
  waitForPromise = 'waitForPromise'
}

export const waitForMs = (ms: number, callback?: () => void): StoreWaitForMs => ({
  type: StoreActionType.waitForMs,
  ms,
  callback
});
export const waitForPromise = <T>(promise: Promise<T>): StoreWaitForPromise => ({
  type: StoreActionType.waitForPromise,
  promise,});

export const waitForAction = (actionType: string): StoreWaitForAction => ({
  type: StoreActionType.waitForActionType,
  actionType,
});
export const dispatchAction = (action: Action): StoreDispatchAction => ({
  type: StoreActionType.dispatchAction,
  action,
});
