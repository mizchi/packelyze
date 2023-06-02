import { test } from "vitest";
import type { FetchRule, TypedFetch } from "./fetch";
import type { TypedJSON$stringify } from "./json";

test("run", async () => {
  const fetch = window.fetch as TypedFetch<
    | FetchRule<{
      $method: "POST";
      $url: "/api/:id";
      $headers: {
        "Content-Type": "application/json";
      };
      $body: { text: string };
      $response: { ok: boolean };
    }>
    | FetchRule<{
      $method: "POST";
      $url: "/xxx";
      $headers: {
        "Content-Type": "application/json";
      };
      $body: { text: string };
      $response: { error: boolean };
    }>
    | FetchRule<{
      $method: "PUT";
      $url: "/foo/:id";
      $headers: {
        "Content-Type": "application/json";
      };
      $body: {};
      $response: { result: string };
    }>
    | FetchRule<{
      $method: "POST";
      $url: "https://example.test/zzz";
      $headers: {
        "Content-Type": "application/json";
      };
      $body: {};
      $response: { result: string };
    }>
    | FetchRule<{
      $method: "GET";
      $url: `/search`;
      $headers: {
        "Content-Type": "application/json";
      };
      $search: { q: string };
      $response: { items: string[] };
    }>
  >;
  const stringify = JSON.stringify as TypedJSON$stringify;
  const res = await fetch("/api/xxx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: stringify({ text: "text" }),
  });

  const ret = await res.json();
  const _data1: { ok: boolean } = ret;
  // Do not conterminate
  // @ts-expect-error
  const _data2: { error: boolean } = ret;
  const _data3: { result: string } = await fetch("/foo/xxx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: stringify({ text: "text" }),
  }).then((r) => r.json());

  const _ = await fetch("/api/xxx", {
    method: "POST",
    // @ts-expect-error
    headers: {},
    // @ts-expect-error
    body: stringify({ text: 1 }),
  });

  const _1: { result: string } = await fetch("https://example.test/zzz", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: stringify({ text: 1 }),
  }).then((r) => r.json());

  // TODO: search body is not supported
  const _2: { items: string[] } = await fetch("/search?q=hello", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  }).then((r) => r.json());
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
