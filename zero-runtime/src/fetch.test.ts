import { test } from "vitest";
import { TypedFetch } from "./fetch";
import { JSON$stringifyT } from "./json";

test.skip("check types only", async () => {
  const stringifyT = JSON.stringify as JSON$stringifyT;
  const fetch = window.fetch as TypedFetch<{
    "/api/:xxx": {
      method: "GET";
      bodyType: { text: string; number: number; boolean: boolean };
      headersType: { "Content-Type": "application/json" };
      responseType: { text: string; number: number; boolean: boolean };
    } | {
      method: "POST";
      bodyType: { postData: number };
      headersType: { "Content-Type": "application/json" };
      responseType: { ok: boolean };
    };
    "/api/nested/:pid": {
      method: "GET";
      bodyType: { nested: 1 };
      headersType: { "Content-Type": "application/json" };
      responseType: { text: string; number: number; boolean: boolean };
    };
  }>;
  const res = await fetch("/api/xxxeuoau", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: stringifyT({ text: "text", number: 1, boolean: true }),
  });
  const _data: { text: string; number: number; boolean: boolean } = await res
    .json();

  fetch("/api/nested/aaa", {
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
