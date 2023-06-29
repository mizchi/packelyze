import type { TypedJSONString } from "./primitive";
import type { TypedFormData } from "./form";
import type { ExtractAcceptableURLPattern, ParsedURLPattern, ParseURLInput, ParseURLPattern } from "./url";

export interface TypedRequestConstructor {
  new <T extends { [key: string]: any }, Method extends string, HT extends {}>(
    input: string,
    init: TypedRequestInit<Method, T, HT>,
  ): TypedRequest<T>;
}

interface TypedRequest<T extends { [key: string]: any }> extends Request {
  formData(): Promise<TypedFormData<T>>;
  json(): Promise<T>;
  text(): Promise<TypedJSONString<T>>;
}

export interface TypedRequestInit<
  Method extends string,
  T extends { [key: string]: any },
  HT extends Record<string, string> = {},
> extends RequestInit {
  method: Method;
  body?: TypedJSONString<T> | TypedFormData<T>;
  headers?: HT;
}

export interface TypedResponse<T> extends Response {
  text(): Promise<TypedJSONString<T>>;
  json(): Promise<T>;
}

export interface TypedResponseConstructor {
  // new <T>(): ResponseT<T>;
  new <T>(body?: BodyInit | null, init?: ResponseInit): TypedResponse<T>;
}

export type FetchRule<
  Raw extends {
    $method: string;
    $url: string;
    $headers?: {} | never;
    $search?: {} | never;
    $body?: {} | never;
    $response?: {} | never;
  },
> = {
  $method: Raw["$method"];
  $url: ParseURLPattern<Raw["$url"]>;
  $headers: Raw["$headers"];
  $search: Raw["$search"];
  $body: Raw["$body"];
  $response: Raw["$response"];
};

export type FetchRuleInternal<
  Method,
  UrlPattern extends ParsedURLPattern<any, any, any, any>,
  Headers,
  Search,
  Body,
  Response,
> = {
  $method: Method;
  $url: UrlPattern;
  $headers: Headers;
  $search: Search;
  $body: Body;
  $response: Response;
};

export type TypedFetch<Op extends FetchRuleInternal<any, any, any, any, any, any>,> = <
  InputUrl extends string,
  InputMethod extends string,
  Matched extends Extract<Op, { $url: ExtractAcceptableURLPattern<Op["$url"], ParseURLInput<InputUrl>> }>,
>(
  input: InputUrl,
  init: TypedRequestInit<InputMethod, Matched["$body"], Matched["$headers"]>,
) => Promise<TypedResponse<Matched["$response"]>>;
