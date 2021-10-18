export const runAsyncEffect = (effect: () => unknown): void => {
    Promise.resolve().then(() => effect());
}