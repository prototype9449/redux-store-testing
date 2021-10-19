import {StoreResult, StoreTester, StoreTesterParams} from './store-tester';
import {StoreAction} from './effects';

export const testStore = <T>(
  options: StoreTesterParams<T>,
  createGenerator?: () => Generator<StoreAction<T>, void, StoreResult<T>>
): Promise<StoreResult<T>> => {
  return new StoreTester<T>(options).run(createGenerator);
};
