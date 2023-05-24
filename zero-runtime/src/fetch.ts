import { type TypedJSONString } from "./primitive";
import type {
  ExactPathPattern,
  GetHostFromInput,
  PathPattern,
  TrimSearch,
} from "./pathPattern";
import type { FormDataT } from "./form";

export interface RequestConstructorT {
  new <T extends { [key: string]: any }, Method extends string, HT extends {}>(
    input: string,
    init: RequestInitT<Method, T, HT>,
  ): RequestT<T>;
}

interface RequestT<T extends { [key: string]: any }> extends Request {
  formData(): Promise<FormDataT<T>>;
  json(): Promise<T>;
  text(): Promise<TypedJSONString<T>>;
}

export interface RequestInitT<
  Method extends string,
  T extends { [key: string]: any },
  HT extends Record<string, string> = {},
> extends RequestInit {
  method: Method;
  body?: TypedJSONString<T> | FormDataT<T>;
  headers?: HT;
}

export interface ResponseT<T> extends Response {
  text(): Promise<TypedJSONString<T>>;
  json(): Promise<T>;
}
// const t = new Response();

export interface ResponseConstructorT {
  // new <T>(): ResponseT<T>;
  new <T>(body?: BodyInit | null, init?: ResponseInit): Response;
}

export type FetchEffectType<
  MethodType extends string = string,
  BodyType extends {} = any,
  HeadersType extends {} = any,
  ResponseType extends {} = any,
  SearchType extends {} = any,
> = {
  methodType: MethodType;
  bodyType: BodyType;
  headersType: HeadersType;
  responseType: ResponseType;
  searchType?: SearchType;
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
  InputPath extends string = ExtractInputPath<
    Input,
    StrKey<InputHost>
  >,
  ContextMap extends EffectMap[keyof EffectMap] = EffectMap[InputHost],
  Routed extends FetchEffectType = {
    [Pattern in keyof ContextMap]:
      ExactPathPattern<InputPath, PathPattern<StrKey<Pattern>>> extends true
        ? ContextMap[Pattern]
        : never;
  }[keyof ContextMap],
  Matched extends FetchEffectType = Routed extends FetchEffectType<
    infer MethodType,
    infer BodyType,
    infer HeadersType,
    infer ResponseType,
    infer SearchType
  >
    ? Method extends MethodType
      ? FetchEffectType<Method, BodyType, HeadersType, ResponseType, SearchType>
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

type ExtractInputPath<Input extends string, Host extends string> = Input extends
  `${Host}${infer Pattern}` ? TrimSearch<Pattern> : never;

type StrKey<Key extends string | number | symbol> = Key extends string ? Key
  : never;
