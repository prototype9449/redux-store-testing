import {StoreAction, StoreActionType} from "./effects";

export const getPrintedEffects = (effects: StoreAction<unknown>[]): string => {
  const printedEffects = effects.map(effect => {
    switch (effect.type) {
      case StoreActionType.waitFor: {
        return `${effect.type}: Condition name - ${effect.condition.name ?? 'empty'}`
      }
      case StoreActionType.waitForStoreState: {
        return `${effect.type}: Condition name - ${effect.condition.name ?? 'empty'}`
      }
      case StoreActionType.dispatchAction: {
        return `${effect.type}: Action type - ${effect.action.type}`
      }
      case StoreActionType.waitForActionType: {
        return `${effect.type}: Type - ${effect.actionType}`
      }
      case StoreActionType.waitForCall: {
        return `${effect.type}: Name - ${effect.caller.getName() ?? 'empty'}`
      }
      case StoreActionType.waitForPromise: {
        return `${effect.type}: Promise`
      }
      case StoreActionType.waitForMs: {
        return `${effect.type}: Ms - ${effect.ms}, Callback - ${effect.callback?.name ?? 'empty'}`
      }
    }
  })

  return `Effects: \n${printedEffects.join('\n')}`
}
