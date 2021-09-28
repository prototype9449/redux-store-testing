export type Caller = {
  () : void;
  subscribeOnCall: (listener: () => void) => void;
  wasCalled: () => boolean;
}

export const createFunctionCaller = (): Caller => {
  let wasCalled = false;
  const listeners: (() => void)[] = [];

  const result = () => {
    wasCalled = true;
    listeners.forEach((l) => l());
  };
  result.subscribeOnCall = (listener: () => void): void => {
    listeners.push(listener);
  }
  result.wasCalled = (): boolean => wasCalled;

  return result;
}
