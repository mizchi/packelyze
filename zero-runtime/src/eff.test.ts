import { test } from "vitest";
import type { Eff, ExtractOps } from "./eff";
import type { DomOp, FetchOp, ThrowOp } from "./ops";
import type { FetchRule, TypedFetch } from "./fetch";
import type { TypedJSON$stringify } from "./json";
import { Assert, Eq } from "./utils";

test.skip("Eff", async () => {
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

  async function doSend(): Promise<void & Eff<FetchOp<MyFetchRule>>> {
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

  type _cases = [Assert<Eq<ExtractOps<typeof main>, DomOp | FetchOp<MyFetchRule> | ThrowOp<MyError>>>];
});
