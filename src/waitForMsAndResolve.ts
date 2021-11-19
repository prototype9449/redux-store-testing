type Props = {
  timeOut?: typeof setTimeout,
  ms: number;
  callback?: () => void
}

export const waitForMsAndResolve = ({timeOut = setTimeout, ms, callback}: Props): Promise<void> => {
  return new Promise<void>(res => {
    timeOut(() => res(), ms);
    callback && Promise.resolve().then(() => callback());
  });
};
