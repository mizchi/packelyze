import { expect, test } from "vitest";
import type { AnyFetchOp, DomOp, Eff, ExtractOps, ThrowOp } from "./eff";

test("Eff", async () => {
  class MyError extends Error {}

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
    & Eff<AnyFetchOp>
  > {
    try {
      // skip: type check only
      if (true as any) {
        return undefined as void & Eff<AnyFetchOp>;
      }
      const res = await fetch("/post", {});
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

  type MainOps = ExtractOps<typeof main>;
  const _: DomOp | AnyFetchOp | ThrowOp<MyError> = undefined as any as MainOps;
});