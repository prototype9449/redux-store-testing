import {Action} from 'redux';

export const getPrintedActions = (actions: Action[]): string => {
  if (actions.length === 0) {
    return `No actions caught`;
  }
  return `Caught actions: 
${actions.map((x, i) => `${i + 1}) ${x.type}`).join('\n')}`;
};
