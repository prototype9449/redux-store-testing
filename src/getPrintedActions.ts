import {Action} from "redux";

export const getPrintedActions = (actions: Action[]): string => {
  return `Caught actions: \n${actions.map(x => x.type).join('\n')}`
}
