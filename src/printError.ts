import {StoreAction} from './effects';
import {Action} from 'redux';
import {getPrintedEffects, printEffect} from './getPrintedEffects';
import {getPrintedActions} from './getPrintedActions';

export const printError = (effects: StoreAction<unknown>[], actions: Action[]): string => {
  const effectCount = effects.length;
  const handledEffects = effectCount > 0 ? effects.slice(0, effectCount - 1) : [];
  const unhandledEffect = effectCount > 0 ? effects[effectCount - 1] : undefined;
  const header = unhandledEffect ? `Effect ${printEffect(unhandledEffect)} was not handled` : `No effects found`;

  return `${header}

${getPrintedActions(actions)}
        
${getPrintedEffects(handledEffects)}`;
};
