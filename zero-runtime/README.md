# @mizchi/zero-runtime

Zero runtime on TypeScript

```
$ npm install @mizchi/zero-runtime --save-dev
```

## Examples

### Fetch

```ts
import type { FetchRule, TypedFetch, TypedJSON$stringify } from "@mizchi/zero-runtime";

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
    $method: "GET";
    $url: "/search";
    $search: {q: string},
    $headers: {
      "Content-Type": "application/json";
    };
    $response: { result: string[] };
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
```

### Declarative `Eff<Operation>`

You can declare side effects of your app.

TODO: No linter for `Eff<Op>` yet.

```ts
import type {
  Eff,
  ExtractOps,
  FetchRule,
  TypedFetch,
  TypedJSON$stringify,
  DomOp,
  FetchOp,
  ThrowOp
} from "@mizchi/zero-rutime";

class MyError extends Error {}
type MyFetchRule = FetchRule<{
  $method: "POST";
  $url: "/post";
  $headers: {
    "Content-Type": "application/json";
  };
  $body: {
    foo: string;
  };
}>;

function doSomething(): string & Eff<ThrowOp<MyError>> {
  if (Math.random() > 0.99999) {
    throw new MyError("oops");
  }
  return "foo";
}

function mount(): void & Eff<DomOp> {
  // skip: type check only
  if (true as any) {
    return undefined as void & Eff<DomOp>;
  }

  const div = document.createElement("div");
  div.textContent = "hello";
  document.body.append(div);
}

async function doSend(): Promise<
  & void
  & Eff<FetchOp<MyFetchRule>>
> {
  const fetch = globalThis.fetch as TypedFetch<MyFetchRule>;
  const stringify = JSON.stringify as TypedJSON$stringify;
  try {
    // skip: type check only
    if (true as any) {
      return undefined as void & Eff<FetchOp<MyFetchRule>>;
    }
    const res = await fetch("/post", {
      method: "POST",
      body: stringify({ foo: "bar" }),
    });
    const _data = await res.json();
    console.log(_data);
  } catch (err) {
    console.error(err);
  }
}

function* sub() {
  yield doSomething();
  const ret = doSomething();
  yield ret;
  const _val: string = ret;
}

async function* sub2() {
  yield doSomething();
  yield* sub3();
  yield doSend();
}

async function* sub3() {
  yield doSomething();
  yield doSomething();
}

async function* main() {
  yield mount();
  yield* sub();
  yield* sub2();
}

for await (const _op of main()) {
  console.log("step", _op);
}

type MainOps = ExtractOps<typeof main> // => DomOp | FetchOp<MyFetchRule> | ThrowOp<MyError>
```

## LICENSE

MIT