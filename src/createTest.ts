import {StoreResult, StoreTester, StoreTesterParams} from './StoreTester';
import {StoreAction} from './effects';

type RunFunc<T> = (generator?: () => Generator<StoreAction<T>, void, StoreResult<T>>) => Promise<StoreResult<T>>;

export const createTest = <T>(options: StoreTesterParams<T>): {run: RunFunc<T>} => {
  return {
    run: generator => new StoreTester<T>(options).run(generator),
  };
};
