import {StoreTester, StoreTesterParams} from "./store-tester";

type StoreTesterRunParameters = Parameters<typeof StoreTester.prototype.run>;
type StoreTesterRunResult = ReturnType<typeof StoreTester.prototype.run>;

export const testStore = <T>(
  options: StoreTesterParams<T>,
  ...runParams: StoreTesterRunParameters
): StoreTesterRunResult => {
  return new StoreTester(options).run(...runParams);
};
