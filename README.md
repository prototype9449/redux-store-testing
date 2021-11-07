# redux-store-testing

Testing library for redux store. Allows testing the logic behind reducers, redux sagas, middlewares in easy way.

## Install

```bash
npm install redux-store-testing --save-dev
```

Or

```bash
yarn add redux-store-testing --dev
```

## Usage

### Example with saga
First, you need to create a function, which will return you an initialized store. This function should accept the "listener" parameter, which should be passed to createActionLogger. The result of the last function should be added last in the list of store enhancers.

```typescript
import {applyMiddleware} from 'redux';
import createSagaMiddleware from 'redux-saga';
import {configureStore} from '@reduxjs/toolkit';
import {createActionLogger} from 'redux-store-testing'
import {reducer, initialState} from './reducer'

function initStore(listener) {
    const sagaMiddleware = createSagaMiddleware();
    const enhancers = [applyMiddleware(sagaMiddleware), createActionLogger(listener)];
    const store = configureStore({
        reducer,
        enhancers,
        preloadedState: initialState,
    });

    sagaMiddleware.run(rootSaga);

    return store;
};
```

Test body

```typescript
import {createTest, dispatchAction, waitForAction} from 'redux-store-testing'
import {actions, selectors} from './reducer'

// the test body
const {state} = await createTest({initStore}).run(function*() {
    yield dispatchAction(actions.addWish('go to gym'));
    const {state} = yield waitForAction(actions.finishToExercize.type);
    const stepCount = selectors.getStepCount(state);
    yield dispatchAction(actions.writeToNotepad('steps', stepCount));
    yield waitForAction(actions.comeHome.type);
});
const muscleSize = selectors.getMusleSize(state, 'leftArm');

// assert the muscleSize. Example with jest test framework
expect(muscleSize).toBe(40);
```

### Example with rendering react components

```jsx
import {Provider, useDispatch} from 'react-redux';
import {render, fireEvent, screen} from '@testing-library/react';
import {createTest, waitForAction} from 'redux-store-testing'
import {actions} from './reducer'

const ButtonA = () => {
   const dispatch = useDispatch();
   const clickHandler = () => {dispatch(actions.addWish('Go to gym'))};
   return <button onClick={clickHandler}>Gym</button>
 }
 const initializeFunction = (store) => {
   const {unmount} = render(
       <Provider store={store}>
         <ButtonA/>
       </Provider>
   );
   return () => {
     unmount();
   };
 };

 await createTest({initStore, initializeFunction}).run(function* () {
   runAsyncEffect(() => fireEvent.click(screen.getByText('Gym')));
   yield waitForAction(actions.addWish.type);
 });
```

## Api

### waitForAction
You can wait for action to be dispatched

```typescript

const {state} = await testStore({initStore}, function*() {
   yield waitForAction(actions.addWish.type);
  
   // or you can wait for custom condition
   yield waitForAction(
     (state, actions) => actions.filter(a => a.type === 'addWish').length === 3
   );
});
```

### waitForState
You can wait for state to be in needed shape

```typescript
const {state} = await testStore({initStore}, function*() {
   yield waitForState(state => selectors.isPersonAtHome(state, 'Anna');
   
  // or any condition by state and actions 
  const predicate = 
        (state, actions) => 
                 selectors.isPersonAtHome(state, 'Anna') 
                 && actions.filter(a => a.type === 'goHome').length === 2
   yield waitForState(predicate);
});
```

### waitForPromise
You can wait for promise to be resolved

```typescript
const promise = new Promise((resolve) => {
    fetchWeatcher().then(result => resolve(result));
})

const {state} = await testStore({initStore}, function*() {
    yield waitForPromise(promise);
});
```

### waitForMs
You can wait for timeout in ms

```typescript
 await testStore({initStore}, function* () {
    yield waitForMs(10);
    yield dispatchAction(goToGym());
});
```

You can also test your code with timeouts synchronously with jest helpers

```typescript
import {dispatchAction, waitForMs, runAsyncEffect} from 'redux-store-testing'

jest.useFakeTimers();

await testStore({initStore}, function* () {
    // this will be run in async way, right after all microtasks
    runAsyncEffect(() => {
        jest.advanceTimersByTime(10)
    })
    //this will create macrotask with 10ms timeout and will be instantly(but async) resolved by jest
    yield waitForMs(10);
    yield dispatchAction(actions.goToGym());
});

jest.useRealTimers();
```

### waitForCall
You can wait for function to be called

```typescript
import {fetchWeather} from './services/weather'

const fetchWeatherCaller = createCaller('fetchWeather');

const mockedFetchOptions = fetchWeather.mockImplementation(() => {
    fetchWeatherCaller();
    return 'sunny';
})
//fetchWeather is called inside saga or react component

const {state} = await testStore({initStore}, function*() {
    yield waitForCall(fetchWeatherCaller);
    // or you can wait for function to be called several times 
    yield waitForCall(fetchWeatherCaller, {times: 2});
});
```

### waitForMicrotasksToFinish
You can wait for all microtasks to be finished

```typescript
const {state} = await testStore({initStore}, function*() {
    yield dispatchAction(actions.goToGym());
    yield waitForAction(actions.finishTraining)
    //let saga or any other sync code to finish
    yield waitForMicrotasksToFinish();
});

// assert that something is done after finished microtasks 
```

### waitFor
You can wait for any external condition  

```typescript
const {state} = await testStore({initStore}, function*() {
    yield waitFor(() => mock.calls.length > 0);

    yield waitFor(() => getCurrentWeather() === 'sunny');
});
```