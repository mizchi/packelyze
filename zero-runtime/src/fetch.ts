import { type TypedJSONString } from "./primitive";
import type {
  ExactPathPattern,
  GetHostFromInput,
  PathPattern,
} from "./pathPattern";

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

export type FetchEffectType<
  MethodType extends string = string,
  BodyType extends {} = any,
  HeadersType extends {} = any,
  ResponseType extends {} = any,
> = {
  methodType: MethodType;
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
  InputHost extends keyof EffectMap = GetHostFromInput<Input>,
  InputPath extends string = ExtractPath<
    Input,
    _StrKey<InputHost>
  >,
  Context extends EffectMap[keyof EffectMap] = EffectMap[InputHost],
  Routed extends FetchEffectType = {
    [Pattern in keyof Context]:
      ExactPathPattern<InputPath, PathPattern<_StrKey<Pattern>>> extends true
        ? Context[Pattern]
        : never;
  }[keyof Context],
  Matched extends FetchEffectType = Routed extends FetchEffectType<
    infer MethodType,
    infer BodyType,
    infer HeadersType,
    infer ResponseType
  >
    ? Method extends MethodType
      ? FetchEffectType<Method, BodyType, HeadersType, ResponseType>
    : never
    : never,
>(
  input: Input,
  init: RequestInitT<
    Method,
    Matched["bodyType"],
    Matched["headersType"]
  >,
) => Promise<ResponseT<Matched["responseType"]>>;

type ExtractPath<Input extends string, Host extends string> = Input extends
  `${Host}${infer Pattern}` ? Pattern : never;

type _StrKey<Key extends string | number | symbol> = Key extends string ? Key
  : never;
