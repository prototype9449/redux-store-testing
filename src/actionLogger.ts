import {Action, AnyAction, Middleware, StoreEnhancer, applyMiddleware} from 'redux';

export type ActionListener<S = any, A extends Action = AnyAction> = (action: A, state: S) => void;

export const createActionLogger = <S = any, A extends Action = AnyAction>(listener: ActionListener<S, A>): StoreEnhancer => {
  const middleware: Middleware =
    ({getState}) =>
      next =>
        action => {
          const result = next(action);
          listener(action, getState());

          return result;
        };

  return applyMiddleware(middleware);
};
