import type { AnyFunction } from "./utils";

export declare const __EFF__: unique symbol;

export type Eff<E> = {
  readonly [__EFF__]?: E;
};

type InferEffType<T> = T extends Eff<infer T> ? T : never;

export type GetEffType<T extends AnyFunction> = InferEffType<
  Awaited<ReturnType<T>>
>;
