export const waitForMsAndResolve = ({ms, callback}: {ms: number; callback?: () => void}): Promise<void> => {
  return new Promise<void>(res => {
    setTimeout(() => res(), ms);
    callback && Promise.resolve().then(() => callback());
  });
};
