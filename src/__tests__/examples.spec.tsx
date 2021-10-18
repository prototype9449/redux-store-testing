import {ConnectedRouter, connectRouter, LOCATION_CHANGE, push, routerMiddleware} from 'connected-react-router';
import {applyMiddleware, combineReducers, Store, StoreEnhancer} from 'redux';
import createSagaMiddleware, {SagaMiddlewareOptions} from 'redux-saga';
import {all, put, spawn, take} from 'redux-saga/effects';
import {createBrowserHistory} from 'history';
import {
  dispatchAction,
  StoreTester,
  createActionLogger,
  ActionListener,
  waitForAction,
  waitForMs,
  waitForPromise,
  waitForSyncWorkToFinish,
} from '../';
import {configureStore} from '@reduxjs/toolkit';
import produce from 'immer';
import {Provider, useDispatch} from 'react-redux';
import React from 'react';
import {render, fireEvent, screen} from '@testing-library/react';
import {EnhancedStore} from '@reduxjs/toolkit/src/configureStore';

import {runAsyncEffect} from '../runAsyncEffect';

const initialState = {
  status: 'C',
};
const reducerA = produce((draft, action) => {
  switch (action.type) {
    case 'Ok':
      draft.status = 'Ok';
      return;
    case 'Error':
      draft.status = 'Error';
      return;
  }
}, initialState);

const rootReducer = history =>
  combineReducers({
    reducerA,
    router: connectRouter(history),
  });

function* rootSaga() {
  function* mySaga() {
    yield take('Error');
    // const w = yield call(AAA);
    yield put({type: 'Ok'});
    yield take('C');
    yield put({type: 'Q'});
  }
  const sagas = [mySaga];

  yield all(sagas.map(saga => spawn(saga)));
}

let history;
function getHistory(reset = false) {
  if (history && !reset) {
    return history;
  }
  history = createBrowserHistory();
  return history;
}

type StateType = {reducerA: {status: string}};

let store: EnhancedStore<StateType>;

function getStore(listener?: ActionListener) {
  const sagaMiddlewareOptions: SagaMiddlewareOptions = {
    onError: error => {
      // eslint-disable-next-line no-console
      console.error(error);
    },
  };

  const sagaMiddleware = createSagaMiddleware(sagaMiddlewareOptions);

  const history = getHistory();

  const enhancers: StoreEnhancer[] = [applyMiddleware(routerMiddleware(history), sagaMiddleware)];
  if (listener) {
    enhancers.push(createActionLogger(listener));
  }

  store = configureStore({
    reducer: rootReducer(history),
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware({thunk: true, serializableCheck: false, immutableCheck: false}),
    enhancers,
    preloadedState: undefined,
  });

  sagaMiddleware.run(rootSaga);
  return store;
}

describe('tests', function () {
  it('something', async () => {
    const initializeFunction = (store: Store) => {
      const history = getHistory();
      const {unmount} = render(
        <Provider store={store}>
          <ConnectedRouter history={history} />
        </Provider>
      );

      return () => {
        unmount();
      };
    };

    const s = new StoreTester<StateType>({initStore: getStore, initializeFunction});
    const {actions} = await s.run(function* () {
      const status = (yield dispatchAction({type: 'Error'})).state.reducerA.status;
      expect(status).toBe('Error');
      const {state} = yield waitForAction('Ok');
      expect(state.reducerA.status).toBe('Ok');
      yield waitForMs(10);
      yield waitForPromise(
        new Promise<void>(res => {
          setTimeout(() => res(), 100);
        })
      );
      yield dispatchAction(push('ss'));
      yield waitForAction(LOCATION_CHANGE);
    });

    expect(actions.some(a => a.type === 'Ok')).toBeTruthy();
    expect(actions.some(a => a.type === 'Error')).toBeTruthy();
  });

  it('something 2', async () => {
    const ButtonA = () => {
      const dispatch = useDispatch();
      const clickHandler = () => {
        dispatch({type: 'CCC'});
      };
      return <button onClick={clickHandler}>button A</button>;
    };

    const initializeFunction = (store: Store) => {
      const {unmount} = render(
        <Provider store={store}>
          <ButtonA />
        </Provider>
      );

      return () => {
        unmount();
      };
    };

    const s = new StoreTester<StateType>({initStore: getStore, initializeFunction});
    const {actions} = await s.run(function* () {
      runAsyncEffect(() => fireEvent.click(screen.getByText('button A')));
      yield waitForAction('CCC');
      yield waitForSyncWorkToFinish();
    });

    expect(actions.some(a => a.type === 'CCC')).toBeTruthy();
  });
});
