import { type TypedJSONString } from "./primitive";
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

export interface ResponseConstructorT {
  // new <T>(): ResponseT<T>;
  new <T>(body?: BodyInit | null, init?: ResponseInit): Response;
}

export type FetchOpPayload<
  UrlPattern extends string = string,
  MethodType extends string = string,
  BodyType extends {} = any,
  HeadersType extends {} = any,
  ResponseType extends {} = any,
  SearchType extends {} = any,
> = {
  $urlPattern: UrlPattern;
  $method: MethodType;
  $body: BodyType;
  $headers: HeadersType;
  $response: ResponseType;
  $search?: SearchType;
};
