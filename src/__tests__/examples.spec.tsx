import {ConnectedRouter, connectRouter, LOCATION_CHANGE, push, routerMiddleware} from 'connected-react-router';
import {applyMiddleware, combineReducers, Store, StoreEnhancer} from 'redux';
import createSagaMiddleware, {SagaMiddlewareOptions} from 'redux-saga';
import {all, put, spawn, take} from 'redux-saga/effects';
import {createBrowserHistory} from 'history';
import {dispatchAction, StoreTester, createActionLogger, ActionListener, waitForAction, waitForMs, waitForPromise} from '../';
import {configureStore} from '@reduxjs/toolkit';
import produce from 'immer';
import {render} from "@testing-library/react";
import {Provider} from "react-redux";
import React from "react";
import {EnhancedStore} from "@reduxjs/toolkit/src/configureStore";

const initialState = {
  status: 'C'
}
const reducerA = produce((draft, action) => {
  switch (action.type) {
    case 'A':
      draft.status = 'A'
      return;
    case 'B':
      draft.status = 'B'
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
    yield take('B')
    yield put({type: 'A'})

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

type StateType = {reducerA: { status: string }}

let store : EnhancedStore<StateType> ;

function getStore(listener?: ActionListener, reset = false) {
  if (store && !reset) {
    return store;
  }
  const sagaMiddlewareOptions: SagaMiddlewareOptions = {
    onError: error => {
      // eslint-disable-next-line no-console
      console.error(error);
    },
  };

  const sagaMiddleware = createSagaMiddleware(sagaMiddlewareOptions);

  const history = getHistory(reset);

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
  it('something',  async() => {
    const initializeFunction = (store: Store) => {
      const history = getHistory(true);
      const {unmount} = render(
        <Provider store={store}>
        <ConnectedRouter history={history} />
      </Provider>)

      return () => {
        unmount();
      }
    }

    const s = new StoreTester<StateType>({initStore: getStore, initializeFunction});
    const { actions} = await s.run(function* () {
      const status = (yield dispatchAction({type: 'B'})).state.reducerA.status;
      expect(status).toBe('B');
      const {state} = yield waitForAction('A');
      expect(state.reducerA.status).toBe('A')
      yield waitForMs(10);
      yield waitForPromise(new Promise<void>((res) => {
        setTimeout(() => res(), 100);
      }))
      yield dispatchAction(push('ss'))
      yield waitForAction(LOCATION_CHANGE)
    });

    expect(actions.some(a => a.type === 'A')).toBeTruthy()
    expect(actions.some(a => a.type === 'B')).toBeTruthy()
  });
});
