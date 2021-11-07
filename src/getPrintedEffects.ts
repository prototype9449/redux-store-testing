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
      const timesCalledMessage = effect.times ? `Times - ${effect.times}` : '';
      return `${effect.type}: Name - ${effect.caller.getName() ?? 'empty'} ${timesCalledMessage}`;
    }
    case StoreActionType.waitForPromise: {
      return `${effect.type}: Promise`;
    }
    case StoreActionType.waitForMs: {
      return `${effect.type}: Ms - ${effect.ms}, Callback - ${effect.callback?.name ?? 'empty'}`;
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
  if(effects.length === 0){
    return 'No effects handled'
  }

  const printedEffects = effects.map((effect, i) => `${i+1}) ${printEffect(effect)}`);

  return `Effects: 
${printedEffects.join('\n')}`;
};
