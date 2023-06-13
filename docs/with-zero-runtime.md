# With zero-runtime

WIP

### with typed fetch to keep external effects

`zero-runtime` library can declare fetch types.

(But anything is fine as long as you export the type from entrypoint)

```ts
// src/fetch.ts
import type { TypedFetch } from "zero-runtime";
export const fetch = window.fetch as TypedFetch<
  | FetchRule<{
    $method: "POST";
    $url: "/api/:id";
    $headers: {
      "Content-Type": "application/json";
    };
    $body: { text: string };
    $response: { ok: boolean };
  }>
  // NOTE: You can declare search types but zero-runtime does not check it.
  | FetchRule<{
    $method: "GET";
    $url: "/search";
    $search: {q: string},
    $headers: {
      "Content-Type": "application/json";
    };
    $response: { result: string[] };
  }>
>;

```

Your entrypoint should include fetch types.

```ts
// add this
export type { fetch } from "./fetch"
```

`packelyze analyze-dts` will capture `fetch()` properties.

