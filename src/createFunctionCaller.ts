export type Caller = {
  () : void;
  subscribeOnCall: (listener: () => void) => void;
  wasCalled: () => boolean;
}

export const createFunctionCaller = (): Caller => {
  let wasCalled = false;
  let listeners: (() => void)[] = [];
  let canSubscribe = true;

  const result = () => {
    wasCalled = true;
    listeners.forEach((l) => l());
    listeners = [];
    canSubscribe = false;
  };
  result.subscribeOnCall = (listener: () => void): void => {
    if(canSubscribe) {
      listeners.push(listener);
    }
  }
  result.wasCalled = (): boolean => wasCalled;

  return result;
}
