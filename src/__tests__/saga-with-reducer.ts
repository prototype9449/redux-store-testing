import {createFunctionCaller} from '../createFunctionCaller';

const originalSetTimeout = setTimeout;

import {applyMiddleware, StoreEnhancer} from 'redux';
import {
  StoreTester,
  createActionLogger,
  dispatchAction,
  waitForAction,
  waitForMs,
  waitForPromise,
  ActionListener,
  waitForCall, waitForStateChange, waitFor, testStore,
} from '../';
import {configureStore, createSlice} from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import {Saga} from '@redux-saga/types';
import {call, delay, put, take} from 'redux-saga/effects';

describe('store with saga and reducer', function () {
  const initialState = {
    status: 'C',
    number: 0,
  };
  type InitialState = typeof initialState;
  const {actions: sliceActions, reducer} = createSlice({
    name: 'default',
    initialState,
    reducers: {
      setA: state => {
        state.status = 'A';
      },
      setB: state => {
        state.status = 'B';
      },
      inc: state => {
        state.number++;
      },
    },
  });

  const getInitStoreFunction = (rootSaga: Saga) =>
    function initStore(listener: ActionListener) {
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
      yield put(sliceActions.setA());
      yield put(sliceActions.setB());
    });
    const s = new StoreTester<InitialState>({initStore});
    const {actions, state, error} = await s.run();

    expect(actions).toEqual([sliceActions.setA(), sliceActions.setB()]);
    expect(state.status).toBe('B');
    expect(error).toBeUndefined();
  });

  it('should catch actions until waited one in passed function', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setA());
      yield put(sliceActions.setB());
      yield put(sliceActions.inc());
    });

    const s = new StoreTester<InitialState>({initStore});
    const {actions, state, error} = await s.run(function* () {
      yield waitForAction(sliceActions.setB.type);
    });

    expect(actions).toEqual([sliceActions.setA(), sliceActions.setB()]);
    expect(state.status).toBe('B');
    expect(error).toBeUndefined();
  });

  it('should not catch action after last take which accepts dispatched in passed function action', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield take(sliceActions.setA.type);
      yield take(sliceActions.setA.type);
      yield put(sliceActions.setB());
    });

    const s = new StoreTester<InitialState>({initStore});
    const {actions, state, error} = await s.run(function* () {
      yield dispatchAction(sliceActions.setA());
      yield dispatchAction(sliceActions.setA());
    });

    expect(actions).toEqual([sliceActions.setA(), sliceActions.setA()]);
    expect(state.status).toBe('A');
    expect(error).toBeUndefined();
  });

  it('should dispatch action right after put in saga', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield take(sliceActions.inc.type);
      yield put(sliceActions.setB());
    });

    const s = new StoreTester<InitialState>({initStore});
    const {actions, state, error} = await s.run(function* () {
      yield dispatchAction(sliceActions.inc());
      yield dispatchAction(sliceActions.setA());
    });

    expect(actions).toEqual([sliceActions.inc(), sliceActions.setB(), sliceActions.setA()]);
    expect(state.status).toBe('A');
    expect(error).toBeUndefined();
  });

  it('should catch actions until delay when saga dispatches them synchronously when initializing', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setA());
      yield put(sliceActions.setB());
      yield delay(1);
      yield put(sliceActions.inc());
    });
    const s = new StoreTester<InitialState>({initStore});
    const {actions, state, error} = await s.run();

    expect(actions).toEqual([sliceActions.setA(), sliceActions.setB()]);
    expect(state.status).toBe('B');
    expect(state.number).toBe(0);
    expect(error).toBeUndefined();
  });

  it('should not catch action, which is dispatched in test generator after delay', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield delay(100);
    });
    const s = new StoreTester<InitialState>({initStore});
    const {actions, state, error} = await s.run(function* () {
      yield dispatchAction(sliceActions.setA());
      yield waitForAction(sliceActions.setA.type);
      yield dispatchAction(sliceActions.setB());
    });

    expect(error).toBeDefined();
    expect(actions).toEqual([sliceActions.setA()]);
    expect(state.status).toBe('A');
  });

  it('should dispatch action before delay when waitForMs is less than delay time', async () => {
    jest.useFakeTimers();

    const initStore = getInitStoreFunction(function* () {
      yield delay(100);
      yield put(sliceActions.setB());
    });
    const s = new StoreTester<InitialState>({initStore});
    const {actions, state, error} = await s.run(function* () {
      yield waitForMs(9, () => {
        jest.advanceTimersByTime(100);
      });
      yield dispatchAction(sliceActions.setA());
      yield waitForAction(sliceActions.setB.type);
    });
    jest.useRealTimers();

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setA(), sliceActions.setB()]);
    expect(state.status).toBe('B');
  });

  it('should wait for call', async () => {
    const caller = createFunctionCaller();
    const mocked = jest.fn().mockImplementation(() => {
      caller();
      return 'fsdf';
    });
    const initStore = getInitStoreFunction(function* () {
      yield delay(1);
      yield call(mocked, 'fsdf');
      yield put(sliceActions.setA());
    });
    const s = new StoreTester<InitialState>({initStore, originalSetTimeout});
    const {actions, state, error} = await s.run(function* () {
      yield waitForCall(caller);
      yield waitForAction(sliceActions.setA.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setA()]);
    expect(state.status).toBe('A');
  });

  it('should wait for call if it is called on initialization', async () => {
    const caller = createFunctionCaller();
    const mocked = jest.fn().mockImplementation(() => {
      caller();
      return 'fsdf';
    });
    const initStore = getInitStoreFunction(function* () {
      yield call(mocked, 'fsdf');
      yield put(sliceActions.setA());
    });
    const s = new StoreTester<InitialState>({initStore, originalSetTimeout});
    const {actions, state, error} = await s.run(function* () {
      yield waitForCall(caller);
      yield waitForAction(sliceActions.setA.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setA()]);
    expect(state.status).toBe('A');
  });

  it('should wait for 2 callers in sequence if they are called on initialization', async () => {
    const caller1 = createFunctionCaller();
    const caller2 = createFunctionCaller();
    const mocked = jest.fn().mockImplementation(() => {
      caller1();
      caller2();
      return 'fsdf';
    });
    const initStore = getInitStoreFunction(function* () {
      yield call(mocked, 'fsdf');
      yield put(sliceActions.setA());
    });
    const s = new StoreTester<InitialState>({initStore, originalSetTimeout});
    const {actions, state, error} = await s.run(function* () {
      yield waitForCall(caller1);
      yield waitForCall(caller2);
      yield waitForAction(sliceActions.setA.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setA()]);
    expect(state.status).toBe('A');
  });

  it('should wait for 2 callers in sequence if they are called after delay', async () => {
    const caller1 = createFunctionCaller();
    const caller2 = createFunctionCaller();
    const mocked = jest.fn().mockImplementation(() => {
      caller1();
      caller2();
      return 'fsdf';
    });
    const initStore = getInitStoreFunction(function* () {
      yield delay(1);
      yield call(mocked, 'fsdf');
      yield put(sliceActions.setA());
    });
    const s = new StoreTester<InitialState>({initStore, originalSetTimeout});
    const {actions, state, error} = await s.run(function* () {
      yield waitForCall(caller1);
      yield waitForCall(caller2);
      yield waitForAction(sliceActions.setA.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setA()]);
    expect(state.status).toBe('A');
  });


  it('should wait for call and dispatched by store tester async action should come after all dispatched actions in saga', async () => {
    const caller = createFunctionCaller();
    const mocked = jest.fn().mockImplementation(() => {
      caller();
      return 'fsdf';
    });
    const initStore = getInitStoreFunction(function* () {
      yield delay(1);
      yield call(mocked, 'fsdf');
      yield put(sliceActions.setA());
    });
    const s = new StoreTester<InitialState>({initStore, originalSetTimeout});
    const {actions, state, error} = await s.run(function* () {
      yield waitForCall(caller);
      yield dispatchAction(sliceActions.setB());
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setA(), sliceActions.setB()]);
    expect(state.status).toBe('B');
  });

  it('should wait for action and dispatched by store tester async action should come after all dispatched actions in saga', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setA());
      yield put(sliceActions.setB());
    });
    const s = new StoreTester<InitialState>({initStore, originalSetTimeout});
    const {actions, state, error} = await s.run(function* () {
      yield waitForAction(sliceActions.setA.type);
      yield dispatchAction(sliceActions.inc());
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setA(), sliceActions.setB(), sliceActions.inc()]);
    expect(state.status).toBe('B');
  });

  it('should wait for condition in state', async () => {
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setA());
      yield put(sliceActions.setB());
    });
    const s = new StoreTester<InitialState>({initStore, originalSetTimeout});
    const {actions, state, error} = await s.run(function* () {
      const {state, actions} = yield waitForStateChange((state) => state.status === 'B');
      expect(state.status).toBe('B');
      expect(actions).toEqual([sliceActions.setA(),sliceActions.setB()]);
      yield dispatchAction(sliceActions.inc());
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setA(), sliceActions.setB(), sliceActions.inc()]);
    expect(state.status).toBe('B');
  });

  it('should wait for condition on external variable', async () => {
    let variable = 'example'
    const initStore = getInitStoreFunction(function* () {
      yield put(sliceActions.setA());
      variable = 'hello'
      yield put(sliceActions.setB());
    });
    const {actions, state, error} = await testStore<InitialState>({initStore}, function* () {
      const {state, actions} = yield waitFor(() => variable === 'hello');

      expect(variable).toBe('hello');
      expect(state.status).toBe('B');
      expect(actions).toEqual([sliceActions.setA(),sliceActions.setB()]);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setA(), sliceActions.setB()]);
    expect(state.status).toBe('B');
  });
});
