import {StoreAction, StoreActionType} from './effects';

export const printEffect = (effect: StoreAction<unknown>): string => {
  switch (effect.type) {
    case StoreActionType.waitFor: {
      return `${effect.type}: Condition name - ${effect.condition.name ?? 'empty'}`;
    }
    case StoreActionType.waitForStoreState: {
      return `${effect.type}: Condition name - ${effect.condition.name ?? 'empty'}`;
    }
    case StoreActionType.dispatchAction: {
      return `${effect.type}: Action type - ${effect.action.type}`;
    }
    case StoreActionType.waitForActionType: {
      const message =
        typeof effect.actionOrPredicate === 'string'
          ? `Type - ${effect.actionOrPredicate}`
          : `Function with name ${effect.actionOrPredicate.name ?? 'empty'}`;
      return `${effect.type}: ${message}`;
    }
    case StoreActionType.waitForCall: {
      return `${effect.type}: Name - ${effect.caller.getName() ?? 'empty'}`;
    }
    case StoreActionType.waitForPromise: {
      return `${effect.type}: Promise`;
    }
    case StoreActionType.waitForMs: {
      return `${effect.type}: Ms - ${effect.ms}, Callback - ${effect.callback?.name ?? 'empty'}`;
    }
    case StoreActionType.waitForInitializeFunction: {
      return `${effect.type}`;
    }
    case StoreActionType.waitForSyncWorkToFinish: {
      return `${effect.type}`;
    }
    default: {
      throw new Error(`Unknown effect`);
    }
  }
};

export const getPrintedEffects = (effects: StoreAction<unknown>[]): string => {
  const printedEffects = effects.map(effect => printEffect(effect));

  return `Effects: \n${printedEffects.join('\n')}`;
};
