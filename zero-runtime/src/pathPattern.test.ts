import { test } from "vitest";
import type {
  ExactPathPattern,
  FillPathPattern,
  GetHostFromInput,
  GetSearch,
  PathPattern,
  TrimSearch,
} from "./pathPattern";

test.skip("TrimSearch", async () => {
  const _t: TrimSearch<"https://example.com/search?a=1"> =
    "https://example.com/search" as const;
  const _t1: TrimSearch<"/search?a=1"> = "/search" as const;
  const _t2: GetSearch<"https://example.com/search?a=1"> = "a=1" as const;
});

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

  const _7: ExactPathPattern<
    "/search",
    PathPattern<"/search">
  > = true as const;
});

test.skip("FillPathPattern", async () => {
  const f1: FillPathPattern<
    "https://test.test",
    "/api/:x",
    "https://test.test/api"
  > = false as const;
  const f2: FillPathPattern<
    "https://test.test",
    "/api/:x",
    "https://test.test/api/aoueoa"
  > = true as const;
  const f3: FillPathPattern<
    "https://test.test",
    "/api/:x",
    "https://test.test/api/aoueoa/xxxx"
  > = false as const;
  const f4: FillPathPattern<
    "https://test.tes",
    "/api/:x",
    "https://test.test/api"
  > = false as const;

  const f6: FillPathPattern<
    "",
    "/search",
    "/search?xxx=1"
  > = true as const;
});
