import { type JSON$stringifyT } from "./json";
import { type TypedJSONString } from "./primitive";

export interface RequestInitT<
  Method extends string,
  T,
  HT extends Record<string, string> = {},
> extends RequestInit {
  method: Method;
  body?: TypedJSONString<T>;
  headers?: HT;
}

export interface ResponseT<T> extends Response {
  text(): Promise<TypedJSONString<T>>;
  json(): Promise<T>;
}

// Extract URL pattern
export type PathPattern<T extends string | number | symbol> = T extends
  `/${infer Head}/${infer Body}/${infer Tail}`
  ? Tail extends "" ? `${PathPattern<`/${Head}`>}${PathPattern<`${Body}`>}`
    // folding to 2 term
  : `${PathPattern<`/${Head}`>}${PathPattern<`/${Body}/${Tail}`>}`
  // 2 term
  : T extends `/${infer Head}/${infer Tail}`
    ? Tail extends "" ? PathPattern<`/${Head}`>
    : `/${Head}${PathPattern<`/${Tail}`>}`
  // 1 term dynamic
  : T extends `/:${string}` ? `/${string}`
  : T;

// Check if the pattern is exact
export type ExactPathPattern<Static extends string, Statement extends string> =
  Static extends `${Statement}/${string}` ? false : true;

export type FetchEffectType<
  Method extends string = string,
  bodyType extends {} = any,
  headersType extends {} = any,
  responseType extends {} = any,
> = {
  method: string;
  bodyType: any;
  headersType: any;
  responseType: any;
};

export type FetchEffectMap = {
  [pattern: string]: FetchEffectType;
};

export type TypedFetch<FEMap extends FetchEffectMap> = <
  Input extends string,
  Method extends string,
  // filter route
  ActiveRouteMap extends {
    [P in keyof FEMap]: Input extends PathPattern<P>
      ? FEMap[P] & { _pattern: P }
      : never;
  }[keyof FEMap],
  // filter method
  ActiveMethodMap extends {
    [P in keyof ActiveRouteMap]: Method extends ActiveRouteMap["method"]
      ? ActiveRouteMap
      : never;
  }[keyof ActiveRouteMap],
  // filter exact
  ActiveExactMap extends {
    [P in keyof ActiveMethodMap]:
      ExactPathPattern<Input, PathPattern<ActiveMethodMap["_pattern"]>> extends
        true ? ActiveMethodMap : never;
  }[keyof ActiveMethodMap],
>(
  input: Input,
  init: RequestInitT<
    Method,
    ActiveExactMap["bodyType"],
    ActiveExactMap["headersType"]
  >,
) => Promise<ResponseT<ActiveExactMap["responseType"]>>;

if (import.meta.vitest) {
  const { test } = import.meta.vitest;
  test.skip("check types only", async () => {
    const stringifyT = JSON.stringify as JSON$stringifyT;
    const fetch = window.fetch as TypedFetch<{
      "/api/:xxx": {
        method: "GET";
        bodyType: { text: string; number: number; boolean: boolean };
        headersType: { "Content-Type": "application/json" };
        responseType: { text: string; number: number; boolean: boolean };
      } | {
        method: "POST";
        bodyType: { postData: number };
        headersType: { "Content-Type": "application/json" };
        responseType: { ok: boolean };
      };
      "/api/nested/:pid": {
        method: "GET";
        bodyType: { nested: 1 };
        headersType: { "Content-Type": "application/json" };
        responseType: { text: string; number: number; boolean: boolean };
      };
    }>;
    const res = await fetch("/api/xxxeuoau", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      body: stringifyT({ text: "text", number: 1, boolean: true }),
    });
    const _data: { text: string; number: number; boolean: boolean } = await res
      .json();

    fetch("/api/nested/aaa", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Check contermination
      // @ts-expect-error
      body: stringifyT({ text: "text", number: 1, boolean: true }),
    });

    await fetch("/api/xxxeuoau", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // Check contermination
      // @ts-expect-error
      body: stringifyT({ text: "text", number: 1, boolean: true }),
    });
  });
}
