import type {
  TypedFormData,
  TypedJSON$stringify,
  TypedJSONString,
  TypedResponse,
} from "zero-runtime";

// interface RequestT<T extends { [key: string]: any }> extends Request {
//   formData(): Promise<FormDataT<T>>;
//   json(): Promise<T>;
//   text(): Promise<TypedJSONString<T>>;
// }

// type BodyInitT = ReadableStream | XMLHttpRequestBodyInit;

export interface ResponseConstructorT {
  new <T>(body?: TypedJSONString<T> | null, init?: ResponseInit): ResponseT<T>;
  prototype: ResponseT<T>;
  error(): ResponseT<T>;
  redirect(url: string | URL, status?: number | undefined): ResponseT<T>;
  // https://github.com/whatwg/fetch/pull/1392
  json<T>(body: T): ResponseT<T>;
  text<T>(body: T): ResponseT<TypedJSONString<T>>;
}

type T = { x: number };

const stringify = JSON.stringify as JSON$stringifyT;
const Response = globalThis.Response as ResponseConstructorT;

const x = {
  async fetch(): Promise<ResponseT<T>> {
    // return Response.json
    return new Response<T>(stringify({ x: 1 }), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  },
};

export default x;
