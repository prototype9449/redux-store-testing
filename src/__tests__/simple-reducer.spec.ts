import {StoreEnhancer} from 'redux';
import {
  StoreTester,
  createActionLogger,
  dispatchAction,
  waitForAction,
  waitForMs,
  waitForPromise,
  ActionListener, waitForStateChange, waitForCall, waitFor,
} from '../';
import {configureStore, createSlice} from '@reduxjs/toolkit';
import {createCaller} from "../createCaller";

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

  const params = {initStore, errorTimoutMs: 10}

  it('should catch 1 action and produce correct state', async () => {
    const s = new StoreTester<InitialState>(params);
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
    const s = new StoreTester<InitialState>(params);
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
    const s = new StoreTester<InitialState>(params);
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
    const s = new StoreTester<InitialState>(params);
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
    const s = new StoreTester<InitialState>(params);
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

  it('should not catch action dispatched by store tester', async () => {
    const s = new StoreTester<InitialState>(params);
    const {error} = await s.run(function* () {
      yield dispatchAction(sliceActions.setA())
      yield waitForAction(sliceActions.setA.type);
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('should wait for state change right after dispatch which leads to this state', async () => {
    const s = new StoreTester<InitialState>(params);
    const {error, state} = await s.run(function* () {
      yield dispatchAction(sliceActions.setA())
      yield waitForStateChange((state) => state.status === 'A');
    });

    expect(error).toBeUndefined();
    expect(state.status).toBe('A');
  });

  it('should wait for state change right even if no actions are dispatched', async () => {
    const s = new StoreTester<InitialState>(params);
    const {error, state} = await s.run(function* () {
      yield waitForStateChange(() => true);
    });

    expect(error).toBeUndefined();
    expect(state).toBe(state);
  });

  it('should wait for state change and called caller even if no actions are dispatched', async () => {
    const s = new StoreTester<InitialState>(params);
    const caller = createCaller();
    caller();
    const {error, state} = await s.run(function* () {
      yield waitForStateChange(() => true);
      yield waitForCall(caller);
    });

    expect(error).toBeUndefined();
    expect(state).toBe(state);
  });

  it('should wait for called caller and state change even if no actions are dispatched', async () => {
    const s = new StoreTester<InitialState>(params);
    const caller = createCaller();
    caller();
    const {error, state} = await s.run(function* () {
      yield waitForCall(caller);
      yield waitForStateChange(() => true);
    });

    expect(error).toBeUndefined();
    expect(state).toBe(state);
  });

  it('should wait for state change right after waiting for already called caller', async () => {
    const caller = createCaller();
    caller();
    const s = new StoreTester<InitialState>(params);
    const {error, state} = await s.run(function* () {
      yield dispatchAction(sliceActions.setA())
      yield waitForCall(caller);
      yield waitForStateChange((state) => state.status === 'A');
    });

    expect(error).toBeUndefined();
    expect(state.status).toBe('A');
  });

  it('should wait twice for the same state change right after dispatch which leads to this state', async () => {
    const s = new StoreTester<InitialState>(params);
    const {error, state} = await s.run(function* () {
      yield dispatchAction(sliceActions.setA())
      yield waitForStateChange((state) => state.status === 'A');
      yield waitForStateChange((state) => state.status === 'A');
    });

    expect(error).toBeUndefined();
    expect(state.status).toBe('A');
  });

  it('should fail with error when waiting for unknown action', async () => {
    const s = new StoreTester<InitialState>(params);
    const {error} = await s.run(function* () {
      yield waitForAction('unknown');
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('should fail with error when waiting for caller which will not be called', async () => {
    const s = new StoreTester<InitialState>(params);
    const {error} = await s.run(function* () {
      yield waitForCall(createCaller());
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('should fail with error when waiting unreachable state', async () => {
    const s = new StoreTester<InitialState>(params);
    const {error} = await s.run(function* () {
      yield waitForStateChange(() => false);
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('should fail with error when waiting unresolvable promise', async () => {
    const s = new StoreTester<InitialState>(params);
    const {error} = await s.run(function* () {
      yield waitForPromise(new Promise<void>(() => { return;}));
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('should fail with error when waiting longer than error timeout', async () => {
    const s = new StoreTester<InitialState>(params);
    const {error} = await s.run(function* () {
      yield waitForMs(10000);
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('should fail with error when waiting for unreachable condition', async () => {
    const s = new StoreTester<InitialState>(params);
    const {error} = await s.run(function* () {
      yield waitFor(() => false);
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });
})
