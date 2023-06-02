import { expect, test } from "vitest";
// import type { TypedFetch } from "./fetch";
import type { JSON$stringifyT } from "./json";
import type { FormDataT } from "./form";
import type {
  AcceptableUrlPattern,
  IsAcceptableUrlPattern,
  ParsedURLPattern,
  ParseURLInput,
  ParseURLPattern,
  SerializeURLPattern,
} from "./URLPattern";
import { RequestInitT, ResponseT } from "./fetch";
import { TypedJSONString } from "./primitive";
// type TypedFetch<T> = any;

type FetchDef<
  Method,
  // UrlPattern extends ParsedURLPattern<any, any, any, any>,
  UrlPattern extends ParsedURLPattern<any, any, any, any>,
  Headers,
  Search,
  Body,
  Response,
> = {
  $method: Method;
  $url: UrlPattern;
  $headers?: Headers;
  $search?: Search;
  $body: Body;
  $response: Response;
};

type ExtractDef<
  Def extends FetchDef<any, any, any, any, any, any>,
  Method extends string,
  Url extends string,
> = Def extends FetchDef<
  any,
  any,
  any,
  any,
  any,
  any
>
  ? Method extends Def["$method"]
    ? IsAcceptableUrlPattern<Def["$url"], ParseURLInput<Url>> extends true ? Def
    : never
  : never
  : never;

type TypedFetch<
  Def extends FetchDef<any, any, any, any, any, any>,
> = <
  InputUrl extends SerializeURLPattern<Def["$url"]>,
  InputMethod extends ExtractDef<Def, any, InputUrl>["$method"],
  Matched extends ExtractDef<Def, InputMethod, InputUrl>,
> // Matched extends FetchDef<any, any, any, any, any, any> = Def extends FetchDef<
// infer Method,
// infer Pattern,
// infer Headers,
// infer Search,
// infer Body,
// infer Response
// >
// ? AcceptableUrlPattern<Pattern, ParseURLInput<InputUrl>> extends ParsedURLPattern<infer A, infer B, infer C, infer D>
//     // ?  FetchDef<Method, Pattern, Headers, Search, Body, Response>
//     ? Extract<Def, { $url: ParsedURLPattern<A, B, C, D>; $method: InputMethod }>
//   : never
//   : never,

// Matched extends FetchDef<any, any, any, any, any, any> = Def extends FetchDef<
//   infer Method,
//   infer Pattern,
//   infer Headers,
//   infer Search,
//   infer Body,
//   infer Response
// > ? AcceptableUrlPattern<Pattern, ParseURLInput<InputUrl>> extends ParsedURLPattern<infer A, infer B, infer C, infer D>
//     // ?  FetchDef<Method, Pattern, Headers, Search, Body, Response>
//     ? Extract<Def, { $url: ParsedURLPattern<A, B, C, D>; $method: InputMethod }>
//   : never
//   : never,
(
  input: InputUrl,
  init: RequestInitT<
    InputMethod,
    Matched["$body"],
    Matched["$headers"]
  >,
  // Matched["$body"],
  // Matched["$headers"]
  // ) => Promise<ResponseT<Matched["$response"]>>;
) => Promise<ResponseT<Matched["$response"]>>;

type FetchOps =
  | {
    $method: "POST";
    $url: ParseURLPattern<"/api/:id">;
    $headers: {
      "Content-Type": "application/json";
    };
    $body: { text: string };
    $response: { ok: boolean };
  }
  | {
    $method: "PUT";
    $url: ParseURLPattern<"/foo/:id">;
    $headers: {
      "Content-Type": "application/json";
    };
    $body: {};
    $response: { result: string };
  };

// type PickedFetchOps = Extract<FetchOps, {$method: "POST"}>;
// type PickedFetchOps = Extract<FetchOps, { $method: "POST" }>;

test("run", async () => {
  const fetch = window.fetch as TypedFetch<
    | {
      $method: "POST";
      $url: ParseURLPattern<"/api/:id">;
      $headers: {
        "Content-Type": "application/json";
      };
      $body: { text: string };
      $response: { ok: boolean };
    }
    | {
      $method: "POST";
      $url: ParseURLPattern<"/xxx">;
      $headers: {
        "Content-Type": "application/json";
      };
      $body: { text: string };
      $response: { error: boolean };
    }
    | {
      $method: "PUT";
      $url: ParseURLPattern<"/foo/:id">;
      $headers: {
        "Content-Type": "application/json";
      };
      $body: {};
      $response: { result: string };
    }
  >;
  const stringify = JSON.stringify as JSON$stringifyT;
  const res = await fetch("/api/xxx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: stringify({ text: "text" }),
  });

  // shoud be valid
  const data1: { ok: true } = await res.json();

  // @ts-expect-error
  const data2: { error: false } = await res.json();

  const res2 = await fetch("/api/xxx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: stringify({ text: "text" }),
  });
  // const data2 = await res2.json();

  // const fetch = window.fetch as TypedFetch<{
  //   $method: "GET";
  //   $url: {
  //     $protocol: "http";
  //     $host: "localhost:8080";
  //     $path: "/api/:id";
  //     $search: "";
  //   };
  //   $headers: {
  //     "Content-Type": "application/json";
  //   };
  //   $body: {
  //     text: string;
  //   };
  //   $response: {
  //     ok: boolean;
  //   };
  // }>;
});

// test("URLSearchParams", async () => {
//   type Param = { query: string };
//   const params = new URLSearchParams("query=hello") as URLSeachParamsT<Param>;
//   const v1: string = params.get("query");
//   // @ts-expect-error
//   const v2 = params.get("query2");

//   expect(v1).toBe("hello");

//   const str = params.toString();
//   expect(str).toBe("query=hello");
//   const stringifyT = JSON.stringify as JSON$stringifyT;
// });

// test.skip("check types only", async () => {
//   const stringifyT = JSON.stringify as JSON$stringifyT;
//   type LocalApi = {
//     // "/search?query=:id&xxx=:xxx": {
//     "/api/:id": {
//       methodType: "GET";
//       bodyType: { text: string; number: number; boolean: boolean };
//       headersType: { "Content-Type": "application/json" };
//       responseType: { text: string; number: number; boolean: boolean };
//     } | {
//       methodType: "POST";
//       bodyType: { postData: number };
//       headersType: { "Content-Type": "application/json" };
//       responseType: { ok: boolean };
//     };
//     "/api/nested/:pid": {
//       methodType: "GET";
//       bodyType: { nested: 1 };
//       headersType: { "Content-Type": "application/json" };
//       responseType: { text: string; number: number; boolean: boolean };
//     };
//     "/search": {
//       methodType: "GET";
//       headersType: { "Content-Type": "application/json" };
//       searchType: { query: string; xxx: string };
//       responseType: { ok: boolean };
//       bodyType: {};
//     };
//   };
//   const fetch = window.fetch as TypedFetch<{
//     "": LocalApi;
//     "http://localhost:8080": LocalApi;
//     "https://z.test": {
//       "/send": {
//         methodType: "POST";
//         bodyType: { text: string; number: number; boolean: boolean };
//         headersType: { "Content-Type": "application/json" };
//         responseType: { text: string; number: number; boolean: boolean };
//       };
//     };
//   }>;

//   type ResponseBody = { text: string; number: number; boolean: boolean };
//   const requestInit = {
//     method: "GET",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: stringifyT({ text: "text", number: 1, boolean: true }),
//   } as const;
//   await fetch("https://z.test/send", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: stringifyT({ text: "text", number: 1, boolean: true }),
//   });

//   const d: { ok: boolean } = await fetch("/search?xxx=1", {
//     method: "GET",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     // search: { query: "query", xxx: "xxx" },
//     // body: undefined
//     // body: stringifyT({ text: "text", number: 1, boolean: true }),
//   }).then((x) => x.json());

//   const response1 = await fetch("/api/xxxeuoau", {
//     method: "GET",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: stringifyT({ text: "text", number: 1, boolean: true }),
//   });
//   const _data1: ResponseBody = await response1.json();

//   const response2 = await fetch(
//     "http://localhost:8080/api/11111111",
//     requestInit,
//   );
//   const _data2: ResponseBody = await response2.json();

//   // with host
//   await fetch("http://localhost:8080/api/xxxeuoau", {
//     method: "GET",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     body: stringifyT({ text: "text", number: 1, boolean: true }),
//   });

//   await fetch("/api/nested/aaa", {
//     method: "GET",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     // Check contermination
//     // @ts-expect-error
//     body: stringifyT({ text: "text", number: 1, boolean: true }),
//   });

//   await fetch("/api/xxxeuoau", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//     },
//     // Check contermination
//     // @ts-expect-error
//     body: stringifyT({ text: "text", number: 1, boolean: true }),
//   });
// });

// test.skip("with formData", async () => {
//   const fetch = window.fetch as TypedFetch<{
//     "": {
//       "/send": {
//         methodType: "POST";
//         bodyType: { text: string };
//         headersType: { "Content-Type": "application/json" };
//         responseType: { ok: boolean };
//       };
//     };
//   }>;
//   const formData = new FormData() as FormDataT<{ text: string }>;
//   formData.append("text", "text");
//   // @ts-expect-error
//   formData.append("text2", "text");

//   const _data: { ok: boolean } = await fetch("/send", {
//     method: "POST",
//     body: formData,
//   }).then((x) => x.json());
// });
