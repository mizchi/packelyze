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
  // Self
  "": {
    "/api/:xxx": {
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
    "/search": {
      methodType: "GET";
      headersType: { "Content-Type": "application/json" };
      responseType: { text: string };
      // NOTE: Not handle as type yet.
      searchType: { q: string }
    },
  },
  // with host
  "https://z.test": {
    "/send": {
      methodType: "POST";
      bodyType: { text: string; };
      headersType: { "Content-Type": "application/json" };
      responseType: { ok: boolean };
    };
  };
}>;
const res = await fetchT("/api/xxxeuoau", {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
  body: stringifyT({ text: "text", number: 1, boolean: true }),
});

// ignore query
const res2 = await fetchT("/search?xxx", {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
  },
});


// Type here
const _data: { text: string, number: number, boolean: boolean } = await res.json();

// Full path
await fetchT("https://z.test/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: stringifyT({ text: "text" }),
});
```

## TODO

- [ ] Respect query type
- [x] Form Body

## LICENSE

MIT