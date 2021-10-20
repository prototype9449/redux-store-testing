import {StoreTester, StoreTesterParams} from './StoreTester';

export const createTest = <T>(options: StoreTesterParams<T>): StoreTester<T> => new StoreTester<T>(options)