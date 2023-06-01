export type AnyFunction<T extends Array<any> = Array<any>, R = any> = (
  ...args: T
) => R;

export type AnyGenerator<T> = AsyncGenerator<T> | Generator<T>;

export type Eq<X, Y> = (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;

export type Assert<A extends true> = A;

if (import.meta.vitest) {
  type _cases = [
    Assert<Eq<1, 1>>,
    // @ts-ignore
    Assert<Eq<string | number, string>>,
    // @ts-expect-error
    Assert<Eq<any, never>>,
  ];
}
