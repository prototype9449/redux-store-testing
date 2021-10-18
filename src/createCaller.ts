export type Caller = {
  () : void;
  subscribeOnCall: (listener: () => void) => void;
  wasCalled: (times?: number) => boolean;
  getName: () => string | undefined;
}

export const createCaller = (callerName?: string): Caller => {
  let timesCalled = 0;
  let listeners: (() => void)[] = [];
  let canSubscribe = true;

  const result = () => {
    timesCalled++;
    listeners.forEach((l) => l());
    listeners = [];
    canSubscribe = false;
  };
  result.subscribeOnCall = (listener: () => void): void => {
    if(canSubscribe) {
      listeners.push(listener);
    }
  }
  result.wasCalled = (times?: number): boolean => times ? timesCalled === times : timesCalled > 0;
  result.getName = () => callerName;

  return result;
}
