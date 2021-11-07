import {Store, StoreEnhancer} from 'redux';
import {
  createActionLogger,
  dispatchAction,
  waitForAction,
  waitForMs,
  waitForPromise,
  ActionListener,
  waitForState,
  waitForCall,
  waitFor,
  waitForMicrotasksToFinish,
  createTest,
  StoreTesterParams,
} from '../';
import {configureStore, createSlice} from '@reduxjs/toolkit';
import {createCaller} from '../createCaller';
import {runAsyncEffect} from '../runAsyncEffect';

describe('store tester with reducer should', function () {
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

  function initStore(listener: ActionListener<InitialState>) {
    const enhancers: StoreEnhancer[] = [createActionLogger(listener)];

    return configureStore({
      reducer,
      enhancers,
      preloadedState: undefined,
    });
  }

  const params = {initStore, errorTimoutMs: 10, throwOnTimeout: false};

  it('catch 1 action and produce correct state', async () => {
    const {actions, state, error} = await createTest(params).run(function* () {
      const {
        state: {status},
        actions,
      } = yield dispatchAction(sliceActions.setOkStatus());
      expect(status).toBe('Ok');
      expect(actions.length).toBe(1);
    });

    expect(actions.length).toBe(1);
    expect(actions[0]).toEqual(sliceActions.setOkStatus());
    expect(state.status).toBe('Ok');
    expect(error).toBeUndefined();
  });

  it('catch 2 actions and increment number up to 2', async () => {
    const {actions, state, error} = await createTest(params).run(function* () {
      const result1 = yield dispatchAction(sliceActions.incrementValue());

      expect(result1.state.number).toBe(1);
      expect(result1.actions.length).toBe(1);

      const result2 = yield dispatchAction(sliceActions.incrementValue());

      expect(result2.state.number).toBe(2);
      expect(result2.actions.length).toBe(2);
    });

    expect(actions.length).toBe(2);
    expect(actions).toEqual([sliceActions.incrementValue(), sliceActions.incrementValue()]);
    expect(state.status).toBe('C');
    expect(error).toBeUndefined();
  });

  it('fail with timeout when waiting for dispatched action', async () => {
    let wasRestCodeRun = false;
    const {actions, state, error} = await createTest(params).run(function* () {
      yield dispatchAction(sliceActions.setOkStatus());
      yield waitForAction(sliceActions.setOkStatus.type);
      wasRestCodeRun = true;
    });

    expect(wasRestCodeRun).toBeFalsy();
    expect(actions.length).toBe(1);
    expect(state.status).toBe('Ok');
    expect(error).not.toBeUndefined();
    expect(error).toMatchSnapshot();
  });

  it('fail with timeout when waiting for dispatched action after waiting several ms', async () => {
    let wasRestCodeRun = false;
    const {actions, state, error} = await createTest(params).run(function* () {
      yield waitForMs(10);
      yield dispatchAction(sliceActions.setOkStatus());
      yield waitForAction(sliceActions.setOkStatus.type);
      wasRestCodeRun = true;
    });

    expect(wasRestCodeRun).toBeFalsy();
    expect(actions.length).toBe(1);
    expect(state.status).toBe('Ok');
    expect(error).not.toBeUndefined();
    expect(error).toMatchSnapshot();
  });

  it('fail with timeout when waiting for dispatched action after waiting promise', async () => {
    let wasRestCodeRun = false;

    const {actions, state, error} = await createTest(params).run(function* () {
      yield waitForPromise(
        new Promise<void>(res => {
          setTimeout(() => res(), 10);
        })
      );
      yield dispatchAction(sliceActions.setOkStatus());
      yield waitForAction(sliceActions.setOkStatus.type);
      wasRestCodeRun = true;
    });

    expect(wasRestCodeRun).toBeFalsy();
    expect(actions.length).toBe(1);
    expect(state.status).toBe('Ok');
    expect(error).not.toBeUndefined();
    expect(error).toMatchSnapshot();
  });

  it('not catch action dispatched by store tester', async () => {
    const {error} = await createTest(params).run(function* () {
      yield dispatchAction(sliceActions.setOkStatus());
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('wait for state change right after dispatch which leads to this state', async () => {
    const {error, state} = await createTest(params).run(function* () {
      yield dispatchAction(sliceActions.setOkStatus());
      yield waitForState(state => state.status === 'Ok');
    });

    expect(error).toBeUndefined();
    expect(state.status).toBe('Ok');
  });

  it('wait for state change right even if no actions are dispatched', async () => {
    const {error, state} = await createTest(params).run(function* () {
      yield waitForState(() => true);
    });

    expect(error).toBeUndefined();
    expect(state).toBe(state);
  });

  it('wait for state change and called caller even if no actions are dispatched', async () => {
    const caller = createCaller();
    caller();
    const {error, state} = await createTest(params).run(function* () {
      yield waitForState(() => true);
      yield waitForCall(caller);
    });

    expect(error).toBeUndefined();
    expect(state).toBe(state);
  });

  it('wait for called caller and state change even if no actions are dispatched', async () => {
    const caller = createCaller();
    caller();
    const {error, state} = await createTest(params).run(function* () {
      yield waitForCall(caller);
      yield waitForState(() => true);
    });

    expect(error).toBeUndefined();
    expect(state).toBe(state);
  });

  it('wait for state change right after waiting for already called caller', async () => {
    const caller = createCaller();
    caller();

    const {error, state} = await createTest(params).run(function* () {
      yield dispatchAction(sliceActions.setOkStatus());
      yield waitForCall(caller);
      yield waitForState(state => state.status === 'Ok');
    });

    expect(error).toBeUndefined();
    expect(state.status).toBe('Ok');
  });

  it('wait twice for the same state change right after dispatch which leads to this state', async () => {
    const {error, state} = await createTest(params).run(function* () {
      yield dispatchAction(sliceActions.setOkStatus());
      yield waitForState(state => state.status === 'Ok');
      yield waitForState(state => state.status === 'Ok');
    });

    expect(error).toBeUndefined();
    expect(state.status).toBe('Ok');
  });

  it('fail with error when waiting for unknown action', async () => {
    const {error} = await createTest(params).run(function* () {
      yield waitForAction('unknown');
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('fail with error when waiting for caller which will not be called', async () => {
    const {error} = await createTest(params).run(function* () {
      yield waitForCall(createCaller());
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('fail with error when waiting unreachable state', async () => {
    const {error} = await createTest(params).run(function* () {
      yield waitForState(() => false);
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('fail with error when waiting unresolvable promise', async () => {
    const {error} = await createTest(params).run(function* () {
      yield waitForPromise(
        new Promise<void>(() => {
          return;
        })
      );
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('fail with error when waiting longer than error timeout', async () => {
    const {error} = await createTest(params).run(function* () {
      yield waitForMs(10000);
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('fail with error when waiting for unreachable condition', async () => {
    const {error} = await createTest(params).run(function* () {
      yield waitFor(() => false);
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('call initializeFunction before the result of it', async () => {
    let placeToCall = 'unknown';
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      initializeFunction: () => {
        placeToCall = 'init';
        return () => void 0;
      },
    };
    await createTest(realParams).run(function* () {
      expect(placeToCall).toBe('unknown');
      yield waitForMs(1);
      expect(placeToCall).toBe('init');
      yield waitFor(() => true);
    });
  });

  it('call the result of initializeFunction after store tester body', async () => {
    let wasCalled = false;
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      initializeFunction: () => {
        return () => {
          wasCalled = true;
        };
      },
    };
    await createTest(realParams).run(function* () {
      expect(wasCalled).toBeFalsy();
      yield waitFor(() => true);
    });
    expect(wasCalled).toBeTruthy();
  });

  it('catch action dispatched in initializeFunction', async () => {
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      initializeFunction: store => {
        store.dispatch(sliceActions.setOkStatus());
        return () => void 0;
      },
    };
    const {error, actions, state} = await createTest(realParams).run(function* () {
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(state.status).toBe('Ok');
  });

  it('not catch action and update state when action is dispatched in the result of initializeFunction', async () => {
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      initializeFunction: store => {
        return () => {
          store.dispatch(sliceActions.setOkStatus());
        };
      },
    };
    const {error, actions, state} = await createTest(realParams).run(function* () {
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeDefined();
    expect(actions).toEqual([]);
    expect(state.status).toBe('C');
    expect(error).toMatchSnapshot();
  });

  it('wait for caller when it is called in initializeFunction', async () => {
    const caller = createCaller();
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      initializeFunction: () => {
        caller();
        return () => void 0;
      },
    };
    const {error} = await createTest(realParams).run(function* () {
      yield waitForCall(caller);
    });

    expect(error).toBeUndefined();
    expect(caller.wasCalled()).toBeTruthy();
  });

  it('not wait for caller when it is called in the result of initializeFunction', async () => {
    const caller = createCaller();
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      initializeFunction: () => {
        return () => {
          caller();
        };
      },
    };
    const {error} = await createTest(realParams).run(function* () {
      yield waitForCall(caller);
    });

    expect(error).toBeDefined();
    expect(caller.wasCalled()).toBeTruthy();
    expect(error).toMatchSnapshot();
  });

  it('wait for caller when it is called in initializeFunction and when skipSyncActionDispatchesInInitializeFunction is true', async () => {
    const caller = createCaller();
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      skipSyncActionDispatchesInInitializeFunction: true,
      initializeFunction: () => {
        caller();
        return () => void 0;
      },
    };
    const {error} = await createTest(realParams).run(function* () {
      yield waitForCall(caller);
    });

    expect(error).toBeUndefined();
    expect(caller.wasCalled()).toBeTruthy();
  });

  it('catch action in subscribe if skipSyncActionDispatchesInInitializeFunction is true', async () => {
    let wasSubscribeCalled = false;
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      skipSyncActionDispatchesInInitializeFunction: true,
      initializeFunction: store => {
        store.subscribe(() => {
          wasSubscribeCalled = true;
        });
        return () => void 0;
      },
    };
    const {error, actions} = await createTest(realParams).run(function* () {
      yield dispatchAction(sliceActions.setOkStatus());
    });

    expect(wasSubscribeCalled).toBeTruthy();
    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
  });

  it('call subscribe listener if action dispatched without waitForInitializeFunction', async () => {
    let wasSubscribeCalled = false;
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      initializeFunction: store => {
        store.subscribe(() => {
          wasSubscribeCalled = true;
        });
        return () => void 0;
      },
    };
    const {error, actions} = await createTest(realParams).run(function* () {
      yield dispatchAction(sliceActions.setOkStatus());
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
    expect(wasSubscribeCalled).toBeTruthy();
  });

  it('not log dispatched in unmount function action when waitForMicrotasksToFinish is used at the end', async () => {
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      initializeFunction: store => {
        return () => {
          store.dispatch(sliceActions.setOkStatus());
        };
      },
    };
    const {actions, error} = await createTest(realParams).run(function* () {
      yield dispatchAction(sliceActions.setErrorStatus());
      yield waitForMicrotasksToFinish();
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setErrorStatus()]);
  });

  it('not log and wait for action dispatched in initializeFunction if skipSyncActionDispatchesInInitializeFunction is true', async () => {
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      skipSyncActionDispatchesInInitializeFunction: true,
      initializeFunction: store => {
        store.dispatch(sliceActions.setOkStatus());
        return () => void 0;
      },
    };
    const {actions, error} = await createTest(realParams).run(function* () {
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
    expect(actions).toEqual([]);
  });

  it('log action when it is dispatched in resolved promise in initializeFunction when waitForMicrotasksToFinish is present at the end', async () => {
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      initializeFunction: store => {
        Promise.resolve().then(() => store.dispatch(sliceActions.setOkStatus()));
        return () => void 0;
      },
    };
    const {actions, error} = await createTest(realParams).run(function* () {
      yield waitForMicrotasksToFinish();
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
  });

  it('run timer yielded in test body', async () => {
    jest.useFakeTimers();

    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
    };
    const {actions, error} = await createTest(realParams).run(function* () {
      runAsyncEffect(() => {
        jest.advanceTimersByTime(30000);
      });
      yield waitForMs(30000);
      yield dispatchAction(sliceActions.setOkStatus());
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);

    jest.useRealTimers();
  });

  it('run only first timer yielded in test body', async () => {
    jest.useFakeTimers();

    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
    };
    const {error} = await createTest(realParams).run(function* () {
      runAsyncEffect(() => {
        jest.runAllTimers();
      });
      yield waitForMs(30000);
      yield waitForMs(30000);
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();

    jest.useRealTimers();
  });

  it('wait for action dispatched in runAsyncEffect', async () => {
    let storeInstance: Store<InitialState>;
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      initializeFunction: store => {
        storeInstance = store;
        return () => void 0;
      },
    };
    const {actions, error} = await createTest(realParams).run(function* () {
      runAsyncEffect(() => {
        storeInstance.dispatch(sliceActions.setOkStatus());
      });
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus()]);
  });

  it('wait for several actions dispatched in runAsyncEffect', async () => {
    let storeInstance: Store<InitialState>;
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      initializeFunction: store => {
        storeInstance = store;
        return () => void 0;
      },
    };
    const {actions, error} = await createTest(realParams).run(function* () {
      runAsyncEffect(() => {
        storeInstance.dispatch(sliceActions.setOkStatus());
        storeInstance.dispatch(sliceActions.setErrorStatus());
      });
      yield waitForAction(sliceActions.setOkStatus.type);
      yield waitForAction(sliceActions.setErrorStatus.type);
    });

    expect(error).toBeUndefined();
    expect(actions).toEqual([sliceActions.setOkStatus(), sliceActions.setErrorStatus()]);
  });

  it('not catch the action dispatched in runAsyncEffect if action is waited after waitForMicrotasksToFinish', async () => {
    let storeInstance: Store<InitialState>;
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      initializeFunction: store => {
        storeInstance = store;
        return () => void 0;
      },
    };
    const {error} = await createTest(realParams).run(function* () {
      runAsyncEffect(() => {
        storeInstance.dispatch(sliceActions.setOkStatus());
      });
      yield waitForMicrotasksToFinish();
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });

  it('not catch the action dispatched after Promise.resolve in runAsyncEffect if action is waited after waitForMicrotasksToFinish', async () => {
    let storeInstance: Store<InitialState>;
    const realParams: StoreTesterParams<InitialState> = {
      ...params,
      errorTimoutMs: 10,
      initializeFunction: store => {
        storeInstance = store;
        return () => void 0;
      },
    };
    const {error} = await createTest(realParams).run(function* () {
      runAsyncEffect(() => {
        Promise.resolve().then(() => storeInstance.dispatch(sliceActions.setOkStatus()));
      });
      yield waitForMicrotasksToFinish();
      yield waitForAction(sliceActions.setOkStatus.type);
    });

    expect(error).toBeDefined();
    expect(error).toMatchSnapshot();
  });
});
