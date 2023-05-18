# @mizchi/zero-runtime

Zero runtime on TypeScript

```
$ npm install @mizchi/zero-runtime --save-dev
```

## Example

### Fetch

```ts
import type { TypedFetch, JSON$stringifyT, JSON$parseT } from "@mizchi/zero-runtime";

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
const res = await fetchT("/api/xxxeuoau", {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
  body: stringifyT({ text: "text", number: 1, boolean: true }),
});

// Type here
const _data: { text: string, number: number, boolean: boolean } = await res.json();
```

## LICENSE

MIT