import {ExternalCondition} from './effects';

export const waitForExternalCondition = ({
  options,
  condition,
}: {
  condition: ExternalCondition;
  options: {intervalMs: number};
}) => {
  return new Promise<void>((res) => {
    setInterval(() => {
      if(condition()){
        res();
      }
    }, options.intervalMs)
  })
};
