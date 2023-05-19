import { test } from "vitest";
import { TypedFetch } from "./fetch";
import { JSON$stringifyT } from "./json";

test.skip("check types only", async () => {
  const stringifyT = JSON.stringify as JSON$stringifyT;
  type Api = {
    "/api/:id": {
      methodType: "GET";
      bodyType: { text: string; number: number; boolean: boolean };
      headersType: { "Content-Type": "application/json" };
      responseType: { text: string; number: number; boolean: boolean };
    } | {
      methodType: "POST";
      bodyType: { postData: number };
      headersType: { "Content-Type": "application/json" };
      responseType: { ok: boolean };
    };
    "/api/nested/:pid": {
      methodType: "GET";
      bodyType: { nested: 1 };
      headersType: { "Content-Type": "application/json" };
      responseType: { text: string; number: number; boolean: boolean };
    };
  };
  const fetch = window.fetch as TypedFetch<{
    "": Api;
    "http://localhost:8080": Api;
    "https://z.test": {
      "/send": {
        methodType: "POST";
        bodyType: { text: string; number: number; boolean: boolean };
        headersType: { "Content-Type": "application/json" };
        responseType: { text: string; number: number; boolean: boolean };
      };
    };
  }>;

  type ResponseBody = { text: string; number: number; boolean: boolean };
  const requestInit = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: stringifyT({ text: "text", number: 1, boolean: true }),
  } as const;
  await fetch("https://z.test/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: stringifyT({ text: "text", number: 1, boolean: true }),
  });

  const response1 = await fetch("/api/xxxeuoau", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: stringifyT({ text: "text", number: 1, boolean: true }),
  });
  const _data1: ResponseBody = await response1.json();

  const response2 = await fetch(
    "http://localhost:8080/api/11111111",
    requestInit,
  );
  const _data2: ResponseBody = await response2.json();

  // with host
  await fetch("http://localhost:8080/api/xxxeuoau", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: stringifyT({ text: "text", number: 1, boolean: true }),
  });

  await fetch("/api/nested/aaa", {
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
// }
