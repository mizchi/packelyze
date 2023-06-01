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

export type FetchOpPayload<
  Pattern extends string = string,
  MethodType extends string = string,
  BodyType extends {} = any,
  HeadersType extends {} = any,
  ResponseType extends {} = any,
  SearchType extends {} = any,
> = {
  $url: Pattern;
  $method: MethodType;
  $body: BodyType;
  $headers: HeadersType;
  $response: ResponseType;
  $search?: SearchType;
};

export type FetchEffectMap = {
  [host: string]: {
    [pattern: string]: FetchOpPayload;
  };
};

export type PredefinedTypedFetch<EffectMap extends FetchEffectMap> = <
  Input extends string,
  Method extends string,
  InputHost extends keyof EffectMap = GetHostFromInput<Input>,
  InputPath extends string = ExtractInputPath<
    Input,
    StrKey<InputHost>
  >,
  ContextMap extends EffectMap[keyof EffectMap] = EffectMap[InputHost],
  Routed extends FetchOpPayload = {
    [Pattern in keyof ContextMap]:
      ExactPathPattern<InputPath, PathPattern<StrKey<Pattern>>> extends true
        ? ContextMap[Pattern]
        : never;
  }[keyof ContextMap],
  Matched extends FetchOpPayload = Routed extends FetchOpPayload<
    infer MethodType,
    infer BodyType,
    infer HeadersType,
    infer ResponseType,
    infer SearchType
  >
    ? Method extends MethodType
      ? FetchOpPayload<Method, BodyType, HeadersType, ResponseType, SearchType>
    : never
    : never,
>(
  input: Input,
  init: RequestInitT<
    Method,
    Matched["$body"],
    Matched["$headers"]
  >,
) => Promise<ResponseT<Matched["$response"]>>;

type ExtractInputPath<Input extends string, Host extends string> = Input extends
  `${Host}${infer Pattern}` ? TrimSearch<Pattern> : never;

type StrKey<Key extends string | number | symbol> = Key extends string ? Key
  : never;
