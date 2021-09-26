import {StoreEnhancer} from 'redux';
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

describe('store with simple reducer', function () {
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

  function initStore(listener: ActionListener) {
    const enhancers: StoreEnhancer[] = [createActionLogger(listener)];

    return configureStore({
      reducer,
      enhancers,
      preloadedState: undefined,
    });
  }

  it('should catch 1 action and produce correct state', async () => {
    const s = new StoreTester<InitialState>({initStore});
    const {actions, state, error} = await s.run(function* () {
      const {
        state: {status},
        actions,
      } = yield dispatchAction(sliceActions.setA());
      expect(status).toBe('A');
      expect(actions.length).toBe(1);
    });

    expect(actions.length).toBe(1);
    expect(actions[0]).toEqual(sliceActions.setA());
    expect(state.status).toBe('A');
    expect(error).toBeUndefined();
  });

  it('should catch 2 actions and increment number up to 2', async () => {
    const s = new StoreTester<InitialState>({initStore});
    const {actions, state, error} = await s.run(function* () {
      const result1 = yield dispatchAction(sliceActions.inc());

      expect(result1.state.number).toBe(1);
      expect(result1.actions.length).toBe(1);

      const result2 = yield dispatchAction(sliceActions.inc());

      expect(result2.state.number).toBe(2);
      expect(result2.actions.length).toBe(2);
    });

    expect(actions.length).toBe(2);
    expect(actions).toEqual([sliceActions.inc(), sliceActions.inc()]);
    expect(state.status).toBe('C');
    expect(error).toBeUndefined();
  });

  it('should fail with timeout when waiting for dispatched action', async () => {
    const s = new StoreTester<InitialState>({initStore});
    let wasRestCodeRun = false;
    const {actions, state, error} = await s.run(function* () {
      yield dispatchAction(sliceActions.setA());
      yield waitForAction(sliceActions.setA.type);
      wasRestCodeRun = true;
    });

    expect(wasRestCodeRun).toBeFalsy();
    expect(actions.length).toBe(1);
    expect(state.status).toBe('A');
    expect(error).not.toBeUndefined();
    expect(error).toMatchSnapshot();
  });

  it('should fail with timeout when waiting for dispatched action after waiting several ms', async () => {
    const s = new StoreTester<InitialState>({initStore});
    let wasRestCodeRun = false;
    const {actions, state, error} = await s.run(function* () {
      yield waitForMs(10);
      yield dispatchAction(sliceActions.setA());
      yield waitForAction(sliceActions.setA.type);
      wasRestCodeRun = true;
    });

    expect(wasRestCodeRun).toBeFalsy();
    expect(actions.length).toBe(1);
    expect(state.status).toBe('A');
    expect(error).not.toBeUndefined();
    expect(error).toMatchSnapshot();
  });

  it('should fail with timeout when waiting for dispatched action after waiting promise', async () => {
    const s = new StoreTester<InitialState>({initStore});
    let wasRestCodeRun = false;

    const {actions, state, error} = await s.run(function* () {
      yield waitForPromise(
        new Promise<void>(res => {
          setTimeout(() => res(), 10);
        })
      );
      yield dispatchAction(sliceActions.setA());
      yield waitForAction(sliceActions.setA.type);
      wasRestCodeRun = true;
    });

    expect(wasRestCodeRun).toBeFalsy();
    expect(actions.length).toBe(1);
    expect(state.status).toBe('A');
    expect(error).not.toBeUndefined();
    expect(error).toMatchSnapshot();
  });
});
