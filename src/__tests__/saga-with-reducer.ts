import {createCaller} from '../createCaller';

const originalSetTimeout = setTimeout;

import {applyMiddleware, Store, StoreEnhancer} from 'redux';
import {
  StoreTester,
  createActionLogger,
  dispatchAction,
  waitForAction,
  waitForMs,
  ActionListener,
  waitForCall,
  waitForState,
  waitFor,
  testStore,
} from '../';
import {configureStore, createSlice} from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import {Saga} from '@redux-saga/types';
import {call, delay, put, take} from 'redux-saga/effects';
import {runAsyncEffect} from '../runAsyncEffect';
import { StoreResult } from '../store-tester';

describe('store with saga and reducer', function () {
  afterEach(() => {
    jest.useRealTimers();
  });

  const initialState = {
    status: 'C',
    number: 0,
  };
  type InitialState = typeof initialState;
  const {actions: sliceActions, reducer} = createSlice({
    name: 'default',
    initialState,
    reducers: {
      setOkStatus: state => {
        state.status = 'Ok';
      },
      setErrorStatus: state => {
        state.status = 'Error';
      },
      incrementValue: state => {
        state.number++;
      },
    },
  });

  const testStoreParams = {
    throwOnTimeout: false,
    errorTimoutMs: 10,
  };

  const getInitStoreFunction = (rootSaga: Saga) =>
    function initStore(listener: ActionListener<InitialState>): Store<InitialState> {
      const sagaMiddleware = createSagaMiddleware();
      const enhancers: StoreEnhancer[] = [applyMiddleware(sagaMiddleware), createActionLogger(listener)];
      const store = configureStore({
        reducer,
        enhancers,
        preloadedState: undefined,
      });

      sagaMiddleware.run(rootSaga);

      return store;
    };

  it('should catch actions when saga dispatches them synchronously when initializing', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
      yield put(sliceActions.setErrorStatus());
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run();

    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
    expect(state.status).toBe('Error');
    expect(error).toBeUndefined();
  });

  it('should catch action dispatched in saga when action type is passed to waitForAction', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
    });
    const {actions, state, error} = await testStore({...testStoreParams, initStore}, function* () {
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
    expect(error).toBeUndefined();
  });

  it('should catch action dispatched in saga when predicate is passed to waitForAction', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield waitForAction(action => action.type === sliceActions.setOkStatus.type);
    });

    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
    expect(error).toBeUndefined();
  });

  it('should catch the third incrementValue action and stop the test', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.incrementValue());
      yield put(sliceActions.incrementValue());
      yield put(sliceActions.incrementValue());
      yield put(sliceActions.incrementValue());
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield waitForAction((action, actions) => actions.length === 3);
    });

    expect(actions).toEqual([
      sliceActions.incrementValue(),
      sliceActions.incrementValue(),
      sliceActions.incrementValue(),
    ]);
    expect(state.number).toBe(3);
    expect(error).toBeUndefined();
  });

  it('should catch actions until waited one in passed function', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
      yield put(sliceActions.setErrorStatus());
      yield put(sliceActions.incrementValue());
    });

    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield waitForAction(sliceActions.setErrorStatus.type);
    });

    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
    expect(state.status).toBe('Error');
    expect(error).toBeUndefined();
  });

  it('should wait for state change and then action if one action leads to this', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
      yield put(sliceActions.setErrorStatus());
    });

    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield waitForState(state => state.status === 'Error');
      yield waitForAction(sliceActions.setErrorStatus.type);
    });

    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
    expect(state.status).toBe('Error');
    expect(error).toBeUndefined();
  });

  it('should wait for action and then state change if one action leads to this', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
      yield put(sliceActions.setErrorStatus());
    });

    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield waitForAction(sliceActions.setErrorStatus.type);
      yield waitForState(state => state.status === 'Error');
    });

    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
    expect(state.status).toBe('Error');
    expect(error).toBeUndefined();
  });

  it('should not catch action after last take which accepts dispatched in passed function action', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield take(sliceActions.setOkStatus.type);
      yield take(sliceActions.setOkStatus.type);
      yield put(sliceActions.setErrorStatus());
    });

    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield dispatchAction(sliceActions.setOkStatus());
      yield dispatchAction(sliceActions.setOkStatus());
    });

    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
    expect(error).toBeUndefined();
  });

  it('should dispatch action right after put in saga', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield take(sliceActions.incrementValue.type);
      yield put(sliceActions.setErrorStatus());
    });

    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield dispatchAction(sliceActions.incrementValue());
      yield dispatchAction(sliceActions.setOkStatus());
    });

    expect(actions).toEqual([sliceActions.incrementValue(), sliceActions.setErrorStatus(), sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
    expect(error).toBeUndefined();
  });

  it('should catch actions until delay when saga dispatches them synchronously when initializing', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
      yield put(sliceActions.setErrorStatus());
      yield delay(1);
      yield put(sliceActions.incrementValue());
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run();

    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
    expect(state.status).toBe('Error');
    expect(state.number).toBe(0);
    expect(error).toBeUndefined();
  });

  it('should not catch action, which is dispatched in test generator after delay', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield delay(100);
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield dispatchAction(sliceActions.setOkStatus());
      yield waitForAction(sliceActions.setOkStatus.type);
      yield dispatchAction(sliceActions.setErrorStatus());
    });

    expect(error).toBeDefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
  });

  it('should dispatch action before delay when waitForMs is less than delay time', async () => {
    jest.useFakeTimers();

    const initStore = getInitStoreFunction(function* () {
      yield delay(100);
      yield put(sliceActions.setErrorStatus());
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield waitForMs(9, () => {
        jest.advanceTimersByTime(100);
      });
      yield dispatchAction(sliceActions.setOkStatus());
      yield waitForAction(sliceActions.setErrorStatus.type);
    });
    jest.useRealTimers();

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
    expect(state.status).toBe('Error');
  });

  it('should dispatch action before delay when waitForMs is less than delay time when run timer is inside runAsyncEffect', async () => {
    jest.useFakeTimers();

    const initStore = getInitStoreFunction(function* () {
      yield delay(100);
      yield put(sliceActions.setErrorStatus());
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      runAsyncEffect(() => {
        jest.advanceTimersByTime(100);
      });
      yield waitForMs(9);
      yield dispatchAction(sliceActions.setOkStatus());
      yield waitForAction(sliceActions.setErrorStatus.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
    expect(state.status).toBe('Error');
  });

  it('should wait for call', async () => {
    const caller = createCaller();
    const mocked = jest.fn().mockImplementation(() => {
      caller();
      return 'fsdf';
    });
    const initStore = getInitStoreFunction(function* () {
      yield delay(1);
      yield call(mocked, 'fsdf');
      yield put(sliceActions.setOkStatus());
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield waitForCall(caller);
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
  });

  it('should wait for caller to be called n times', async () => {
    const caller = createCaller('testCaller');
    const initStore = getInitStoreFunction(function* () {
      caller();
      caller();
      caller();
      yield dispatchAction(sliceActions.setOkStatus());
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {error, actions} = await s.run(function* () {
      yield waitForCall(caller, {times: 3});
    });

    expect(error).toBeUndefined();
    expect(caller.wasCalled(3)).toBeTruthy();
    expect(actions).toEqual([]);
  });

  it('should wait for caller to be called n times if caller is called before test', async () => {
    const caller = createCaller('testCaller');
    caller();
    caller();
    caller();
    const initStore = getInitStoreFunction(function* () {
      yield dispatchAction(sliceActions.setOkStatus());
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {error, actions} = await s.run(function* () {
      yield waitForCall(caller, {times: 3});
    });

    expect(error).toBeUndefined();
    expect(caller.wasCalled(3)).toBeTruthy();
    expect(actions).toEqual([]);
  });

  it('should wait for call if it is called on initialization', async () => {
    const caller = createCaller();
    const mocked = jest.fn().mockImplementation(() => {
      caller();
      return 'fsdf';
    });
    const initStore = getInitStoreFunction(function* () {
      yield call(mocked, 'fsdf');
      yield put(sliceActions.setOkStatus());
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield waitForCall(caller);
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
  });

  it('should wait for 2 callers in sequence if they are called on initialization', async () => {
    const caller1 = createCaller();
    const caller2 = createCaller();
    const mocked = jest.fn().mockImplementation(() => {
      caller1();
      caller2();
      return 'fsdf';
    });
    const initStore = getInitStoreFunction(function* () {
      yield call(mocked, 'fsdf');
      yield put(sliceActions.setOkStatus());
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield waitForCall(caller1);
      yield waitForCall(caller2);
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
  });

  it('should wait for caller right after waitForAction', async () => {
    const caller1 = createCaller();
    const caller2 = createCaller();
    const mocked1 = jest.fn().mockImplementation(() => {
      caller1();
      return;
    });
    const mocked2 = jest.fn().mockImplementation(() => {
      caller2();
      return;
    });
    const initStore = getInitStoreFunction(function* () {
      yield call(mocked1);
      yield put(sliceActions.setOkStatus());
      yield call(mocked2);
      yield put(sliceActions.setErrorStatus());
    });
    const s = new StoreTester({...testStoreParams, initStore});
    const {actions, state, error} = await s.run(function* () {
      yield waitForCall(caller1);
      yield waitForAction(sliceActions.setOkStatus.type);
      yield waitForCall(caller2);
      yield waitForAction(sliceActions.setErrorStatus.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
    expect(state.status).toBe('Error');
  });

  it('should not wait for already called caller', async () => {
    const caller = createCaller();
    caller();
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
    });
    const {actions, state, error} = await testStore({...testStoreParams, initStore}, function* () {
      yield waitForCall(caller);
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
  });

  it('should not wait for already called caller when there are 2 of them', async () => {
    const caller = createCaller();
    caller();
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
    });
    const {actions, state, error} = await testStore({...testStoreParams, initStore}, function* () {
      yield waitForCall(caller);
      yield waitForCall(caller);
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
  });

  it('should not wait for already called caller if there is a delay before', async () => {
    const caller = createCaller();
    caller();
    const initStore = getInitStoreFunction(function* () {
      yield delay(1);
      yield put(sliceActions.setOkStatus());
    });
    const {actions, state, error} = await testStore({...testStoreParams, initStore}, function* () {
      yield waitForCall(caller);
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
  });

  it('should not wait for already called caller after waiting for action', async () => {
    const caller = createCaller();
    caller();
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
    });
    const {actions, state, error} = await testStore({...testStoreParams, initStore}, function* () {
      yield waitForAction(sliceActions.setOkStatus.type);
      yield waitForCall(caller);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
  });

  it('should wait for 2 callers in sequence if they are called after delay', async () => {
    const caller1 = createCaller();
    const caller2 = createCaller();
    const mocked = jest.fn().mockImplementation(() => {
      caller1();
      caller2();
      return 'fsdf';
    });
    const initStore = getInitStoreFunction(function* () {
      yield delay(1);
      yield call(mocked, 'fsdf');
      yield put(sliceActions.setOkStatus());
    });
    const s = new StoreTester({...testStoreParams, initStore, originalSetTimeout});
    const {actions, state, error} = await s.run(function* () {
      yield waitForCall(caller1);
      yield waitForCall(caller2);
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
  });

  it('should wait for call and dispatched by store tester async action should come after all dispatched actions in saga', async () => {
    const caller = createCaller();
    const mocked = jest.fn().mockImplementation(() => {
      caller();
      return 'fsdf';
    });
    const initStore = getInitStoreFunction(function* () {
      yield delay(1);
      yield call(mocked, 'fsdf');
      yield put(sliceActions.setOkStatus());
    });
    const s = new StoreTester({...testStoreParams, initStore, originalSetTimeout});
    const {actions, state, error} = await s.run(function* () {
      yield waitForCall(caller);
      yield dispatchAction(sliceActions.setErrorStatus());
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
    expect(state.status).toBe('Error');
  });

  it('should wait for action and dispatched by store tester async action should come after all dispatched actions in saga', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
      yield put(sliceActions.setErrorStatus());
    });
    const s = new StoreTester({initStore, originalSetTimeout});
    const {actions, state, error} = await s.run(function* () {
      yield waitForAction(sliceActions.setOkStatus.type);
      yield dispatchAction(sliceActions.incrementValue());
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus(), sliceActions.incrementValue()]);
    expect(state.status).toBe('Error');
  });

  it('should wait for condition in state', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
      yield put(sliceActions.setErrorStatus());
    });
    const s = new StoreTester({initStore, originalSetTimeout});
    const {actions, state, error} = await s.run(function* () {
      const {state, actions} = (yield waitForState(state => state.status === 'Error')) as StoreResult<InitialState>;;
      expect(state.status).toBe('Error');
      expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
      yield dispatchAction(sliceActions.incrementValue());
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus(), sliceActions.incrementValue()]);
    expect(state.status).toBe('Error');
  });

  it('should wait for condition on external variable', async () => {
    let variable = 'example';
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setOkStatus());
      variable = 'hello';
      yield put(sliceActions.setErrorStatus());
    });
    const {actions, state, error} = await testStore({...testStoreParams, initStore}, function* () {
      const {state, actions} = (yield waitFor(() => variable === 'hello')) as StoreResult<InitialState>;

      expect(variable).toBe('hello');
      expect(state.status).toBe('Error');
      expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
    expect(state.status).toBe('Error');
  });
});
