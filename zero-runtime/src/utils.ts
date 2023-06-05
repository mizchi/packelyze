export type AnyFunction<T extends Array<any> = Array<any>, R = any> = (
  ...args: T
) => R;

export type AnyGenerator<T> = AsyncGenerator<T> | Generator<T>;

export type Eq<X, Y> = (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

export type Assert<A extends true> = A;
