export type AnyFunction<T extends Array<any> = Array<any>, R = any> = (
  ...args: T
) => R;
