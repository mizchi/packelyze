import { test } from "vitest";
import type {
  ExactPathPattern,
  FillPathPattern,
  GetHostFromInput,
  PathPattern,
} from "./pathPattern";

test.skip("GetHostFromInput", async () => {
  const _t1: GetHostFromInput<"https://example.com/xxx"> =
    "https://example.com" as const;
  const _t2: GetHostFromInput<"/id"> = "" as const;
});

test.skip("ExactPathPattern", async () => {
  const _s1: ExactPathPattern<"/foo", PathPattern<"/foo">> = true as const;
  const _s2: ExactPathPattern<"/fooxx", PathPattern<"/foo">> = false as const;
  // dynamic
  const _1: ExactPathPattern<"/xxx", PathPattern<"/:param">> = true as const;
  // nested
  const _2: ExactPathPattern<"/api/xxx", PathPattern<"/api/:id">> =
    true as const;
  const _3: ExactPathPattern<"/xxx", PathPattern<"/api/:id">> = false as const;
  const _4: ExactPathPattern<
    "/users/xxx/pages/xxx",
    PathPattern<"/users/:uid/pages/:pid">
  > = true as const;
  const _5: ExactPathPattern<
    "/users/xx/pages",
    PathPattern<"/users/:uid/pages/:pid">
  > = false as const;
  // check same depth
  const _6: ExactPathPattern<
    "/users/xxx/pages/xxx",
    PathPattern<"/users/:uid">
  > = false as const;
});

test.skip("FillPathPattern", async () => {
  type F1 = FillPathPattern<
    "https://test.test",
    "/api/:x",
    "https://test.test/api"
  >;

  type F2 = FillPathPattern<
    "https://test.test",
    "/api/:x",
    "https://test.test/api/aoueoa"
  >;

  type F3 = FillPathPattern<
    "https://test.test",
    "/api/:x",
    "https://test.test/api/aoueoa/xxxx"
  >;

  // host
  type F4 = FillPathPattern<
    "https://test.tes",
    "/api/:x",
    "https://test.test/api"
  >;
  type F5 = FillPathPattern<
    "https://test.test",
    "/api/:x",
    "https://test.test/api"
  >;

  const f1: F1 = false;
  const f2: F2 = true;
  const f3: F3 = false;
  const f4: F4 = false;
});
