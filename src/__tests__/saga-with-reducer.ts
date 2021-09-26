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
} from '../';
import {configureStore, createSlice} from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import {Saga} from '@redux-saga/types';
import {delay, put, take} from 'redux-saga/effects';

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

  it('should dispatch action before delay when waitForMs is less than delay time', async () => {
    jest.useFakeTimers();

    const initStore = getInitStoreFunction(function* () {
      yield delay(100);
      yield put(sliceActions.setB());
    });
    const s = new StoreTester<InitialState>({initStore, originalSetTimeout});
    const {actions, state, error} = await s.run(function* () {
      yield waitForMs(9, () => {
        jest.advanceTimersByTime(100);
      });
      yield dispatchAction(sliceActions.setA());
      yield waitForAction(sliceActions.setB.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setA(), sliceActions.setB()]);
    expect(state.status).toBe('B');
  });
});
