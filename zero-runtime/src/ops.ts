import type { Operation } from "./eff";
import type { FetchRuleInternal } from "./fetch";

// Ops
export declare const __DOM_OPERATION__: unique symbol;
export declare const __THROW_OPERATION__: unique symbol;
export declare const __FETCH_OPERATION__: unique symbol;

export type DomOp = Operation<typeof __DOM_OPERATION__, never>;

export type FetchOp<T extends FetchRuleInternal<any, any, any, any, any, any>> = Operation<
  typeof __FETCH_OPERATION__,
  T
>;
export type ThrowOp<Err extends Error> = Operation<typeof __THROW_OPERATION__, Err>;
