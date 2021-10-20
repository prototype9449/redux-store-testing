import {StoreTester, StoreTesterParams} from './store-tester';

export const createTest = <T>(options: StoreTesterParams<T>): StoreTester<T> => new StoreTester<T>(options)