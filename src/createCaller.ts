export type Caller = {
  () : void;
  subscribeOnCall: (listener: () => void) => void;
  wasCalled: () => boolean;
  getName: () => string | undefined;
}

export const createCaller = (callerName?: string): Caller => {
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
  result.getName = () => callerName;

  return result;
}
