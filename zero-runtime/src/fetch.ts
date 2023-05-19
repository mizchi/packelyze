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
export type PathPattern<T extends string> = T extends
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
export type ExactPattern<Input extends string, Pattern extends string> =
  Input extends `${Pattern}/${string}` ? false : true;

export type FetchEffectType<
  Method extends string = string,
  BodyType extends {} = any,
  HeadersType extends {} = any,
  ResponseType extends {} = any,
> = {
  method: Method;
  bodyType: BodyType;
  headersType: HeadersType;
  responseType: ResponseType;
};

export type FetchEffectMap = {
  [host: string]: {
    [pattern: string]: FetchEffectType;
  };
};

export type TypedFetch<EffectMap extends FetchEffectMap> = <
  Input extends string,
  Method extends string,
  // filter route
  A1 extends {
    [Host in keyof EffectMap]: {
      [Pattern in keyof EffectMap[Host]]:
        ExtractPattern<Input, _StrKey<Host>> extends
          PathPattern<_StrKey<Pattern>> ? EffectMap[Host][Pattern] & {
            __pattern: _StrKey<Pattern>;
            __host: ExtractHost<Input, _StrKey<Pattern>>;
          }
          : never;
    };
  }[keyof EffectMap][keyof EffectMap[keyof EffectMap]],
  // filter method
  A2 extends {
    [P in keyof A1]: Method extends A1["method"] ? A1 : never;
  }[keyof A1],
  // filter exact
  A3 extends {
    [P in keyof A2]: ExactPattern<
      // Filter pattern fills all input
      ExtractPattern<Input, A2["__host"]>,
      PathPattern<A2["__pattern"]>
    > extends true ? A2 : never;
  }[keyof A2],
>(
  input: Input,
  init: RequestInitT<
    Method,
    A3["bodyType"],
    A3["headersType"]
  >,
) => Promise<ResponseT<A3["responseType"]>>;

type ExtractPattern<Input extends string, Host extends string> = Input extends
  `${Host}${infer Pattern}` ? Pattern : never;
type ExtractHost<Input extends string, Pattern extends string> = Input extends
  `${infer Host}${Pattern}` ? Host : never;

type _StrKey<Key extends string | number | symbol> = Key extends string ? Key
  : never;
