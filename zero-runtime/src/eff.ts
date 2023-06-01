import type { AnyGenerator } from "./utils";

export declare const __EFF__: unique symbol;

export type Operation<Op, Detail> = { $$op: Op; $$detail: Detail };
// export type GetOperation<Op extends Operation<any, any>> = Op[0];

export type Eff<Op> = {
  readonly [__EFF__]?: Op;
};

export type ExtractOps<F extends (...args: any[]) => AnyGenerator<any>> =
  ReturnType<F> extends AnyGenerator<infer T>
    ? T extends Eff<infer Op> | Promise<Eff<infer Op>> ? Op : never
    : never;

// Ops
export declare const __DOM_OPERATION__: unique symbol;
export declare const __THROW_OPERATION__: unique symbol;
export declare const __FETCH_OPERATION__: unique symbol;

export type DomOp = Operation<typeof __DOM_OPERATION__, never>;
export type ThrowOp<Err extends Error> = Operation<
  typeof __THROW_OPERATION__,
  Err
>;

export type AnyFetchOp = Operation<typeof __DOM_OPERATION__, never>;
