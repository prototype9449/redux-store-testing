export type ExternalCondition = () => boolean;

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
