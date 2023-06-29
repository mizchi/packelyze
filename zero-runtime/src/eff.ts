import type { AnyGenerator } from "./utils";

export declare const __EFF__: unique symbol;

export type Operation<Op, Detail> = { $$op: Op; $$detail: Detail };

export type Eff<Op> = {
  readonly [__EFF__]?: Op;
};

export type ExtractOps<F extends (...args: any[]) => AnyGenerator<any>> = ReturnType<F> extends AnyGenerator<infer T>
  ? T extends Eff<infer Op> | Promise<Eff<infer Op>>
    ? Op
    : never
  : never;
