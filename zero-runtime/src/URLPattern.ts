import { Assert, Eq } from "./utils";

// Subset of https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API

type ParsedURLPattern<
  Protocol extends string,
  Host extends string,
  Path extends string,
  Search extends boolean,
> = {
  protocol: Protocol;
  host: Host;
  path: Path;
  search: Search;
};

type ParseURLPattern<T extends string> = T extends
  | `${infer Protocol}://${infer Host}/${infer RestPath}`
  | `/${infer RestPath}` ? ParsedURLPattern<
    string extends Protocol ? "" : Protocol,
    string extends Host ? "" : Host,
    RestPath extends `${infer Path}?${string}` ? ParsePath<Path>
      : ParsePath<RestPath>,
    // TODO: handle search component
    RestPath extends `${string}?${string}` ? true : false
  >
  : never;

type ParsePath<T extends string> = T extends `/${infer Rest}` ? ParsePath<Rest>
  : T extends `${infer A}/${infer Rest}`
  // :foo/...
    ? A extends `:${string}` ? `${string}/${ParsePath<Rest>}`
      // foo/...
    : `${A}/${ParsePath<Rest>}`
  // :id
  : T extends `:${string}` ? string
  // foo
  : T;

type ParsedURLInput<
  Protocol extends string | undefined,
  Host extends string | undefined,
  Path extends string,
  Search extends string | undefined,
> = {
  protocol: Protocol;
  host: Host;
  path: Path;
  search: Search;
};

type ParseURLInput<T extends string> = T extends
  | `${infer Protocol}://${infer Host}/${infer RestPath}`
  // | `${infer Protocol}://${infer Host}`
  | `/${infer RestPath}` ? ParsedURLInput<
    string extends Protocol ? "" : Protocol,
    string extends Host ? "" : Host,
    // Protocol,
    // Host,
    RestPath extends `${infer Path}?${string}` ? Path : RestPath,
    RestPath extends `${string}?${infer Search}` ? Search : never
  >
  : never;

export type GetMatchedRest<Pattern extends string, Input extends string> =
  Input extends Pattern | `${Pattern}/${infer Rest}`
    ? string extends Rest ? never : Rest
    : never;

type IsAcceptableUrlPattern<
  Pattern extends ParsedURLPattern<any, any, any, any>,
  Input extends ParsedURLInput<any, any, any, any>,
> = Input["protocol"] extends Pattern["protocol"]
  ? Input["host"] extends Pattern["host"]
    ? Input["path"] extends Pattern["path"]
      ? GetMatchedRest<Pattern["path"], Input["path"]> extends never ? true
      : false
    : never
  : never
  : never;

if (false as any) {
  type _cases = [
    Assert<Eq<ParsePath<"foo">, `foo`>>,
    Assert<Eq<ParsePath<":foo">, string>>,
    Assert<Eq<ParsePath<"foo/:id">, `foo/${string}`>>,
    Assert<Eq<ParsePath<"foo/:id/xxx">, `foo/${string}/xxx`>>,
    Assert<Eq<ParsePath<"foo/:id/xxx/:xid">, `foo/${string}/xxx/${string}`>>,
    Assert<Eq<ParsePath<":foo/:bar">, `${string}/${string}`>>,
    Assert<
      Eq<
        ParseURLPattern<`/foo`>,
        {
          protocol: "";
          host: "";
          path: "foo";
          search: false;
        }
      >
    >,

    Assert<
      Eq<
        ParseURLPattern<`https://example.test/foo?${string}`>,
        {
          protocol: "https";
          host: "example.test";
          path: "foo";
          search: true;
        }
      >
    >,
    Assert<
      Eq<
        ParseURLPattern<`https://example.test/foo?`>,
        {
          protocol: "https";
          host: "example.test";
          path: "foo";
          search: true;
        }
      >
    >,

    Assert<
      Eq<
        ParseURLPattern<"https://example.test/foo/:id">,
        {
          protocol: "https";
          host: "example.test";
          path: `foo/${string}`;
          search: false;
        }
      >
    >,

    Assert<
      Eq<
        ParseURLPattern<`${"https" | "http"}://example.test/send`>,
        {
          protocol: "https";
          host: "example.test";
          path: `send`;
          search: false;
        } | {
          protocol: "http";
          host: "example.test";
          path: `send`;
          search: false;
        }
      >
    >,

    Assert<
      Eq<
        ParseURLPattern<`https://${"prod.test" | "staging.test"}/send`>,
        {
          protocol: "https";
          host: "prod.test";
          path: `send`;
          search: false;
        } | {
          protocol: "https";
          host: "staging.test";
          path: `send`;
          search: false;
        }
      >
    >,

    Assert<
      Eq<
        ParseURLPattern<
          `https://${"prod.example.test" | "staging.example.test"}/send`
        >,
        {
          protocol: "https";
          host: "prod.example.test";
          path: `send`;
          search: false;
        } | {
          protocol: "https";
          host: "staging.example.test";
          path: `send`;
          search: false;
        }
      >
    >,
    // Has host or skip
    Assert<
      Eq<
        ParseURLPattern<`${"https://example.test" | ""}/foo/:id`>,
        {
          protocol: "https";
          host: "example.test";
          path: `foo/${string}`;
          search: false;
        } | {
          protocol: "";
          host: "";
          path: `foo/${string}`;
          search: false;
        }
      >
    >,
  ];

  {
    type _cases = [
      // @ts-expect-error
      Assert<ExactPattern<`/xxx/${string}/yyy/${string}`, "/xxx/xid">>,
      // @ts-expect-error
      Assert<ExactPattern<`/xxx/${string}/yyy/${string}`, "/xxx/xid/yyy">>,
      Assert<
        Eq<
          GetMatchedRest<`xxx/${string}/yyy/${string}`, "xxx/xid/yyy/yid/xxx">,
          "xxx"
        >
      >,

      Assert<
        // @ts-expect-error
        IsAcceptableUrlPattern<
          ParseURLPattern<`/foo/:id`>,
          ParseURLInput<`/foo/x/x`>
        >
      >,
      Assert<
        // @ts-expect-error
        IsAcceptableUrlPattern<
          ParseURLPattern<`https://example.test/foo/:id/p/:pid`>,
          ParseURLInput<`https://example.test/foo/xxxx/p/p/x`>
        >
      >,
      // Overrun
      Assert<
        // @ts-expect-error
        IsAcceptableUrlPattern<
          ParseURLPattern<`/foo/:id`>,
          ParseURLInput<`/foo/pid/over`>
        >
      >,

      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`https://example.test/foo`>,
          ParseURLInput<`https://example.test/foo`>
        >
      >,
      Assert<
        Eq<ParseURLInput<"/foo">, {
          protocol: "";
          host: "";
          path: "foo";
          search: never;
        }>
      >,

      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`https://example.test/foo`>,
          ParseURLInput<`https://example.test/foo`>
        >
      >,
      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`${"https://example.test" | ""}/foo`>,
          ParseURLInput<`/foo`>
        >
      >,

      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`${"https://example.test" | ""}/foo`>,
          ParseURLInput<`https://example.test/foo`>
        >
      >,

      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<
            `${"https://example.test" | "https://example2.test"}/foo`
          >,
          ParseURLInput<`https://example2.test/foo`>
        >
      >,

      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`${"https://example.test" | ""}/foo`>,
          ParseURLInput<`/foo`>
        >
      >,

      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`/foo`>,
          ParseURLInput<`/foo`>
        >
      >,
      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`/foo/:id`>,
          ParseURLInput<`/foo/x`>
        >
      >,
      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`/foo/:id?${string}`>,
          ParseURLInput<`/foo/x?xxx`>
        >
      >,

      // TODO: Unacceptable search pattern
      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`/foo/:id`>,
          ParseURLInput<`/foo/x?xxx`>
        >
      >,

      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`https://example.test/foo?${string}`>,
          ParseURLInput<`https://example.test/foo?xxxx`>
        >
      >,
      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`https://example.test/foo/bar`>,
          ParseURLInput<`https://example.test/foo/bar`>
        >
      >,

      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`https://example.test/foo/bar/baz`>,
          ParseURLInput<`https://example.test/foo/bar/baz`>
        >
      >,

      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`https://example.test/foo/:id`>,
          ParseURLInput<`https://example.test/foo/x`>
        >
      >,

      Assert<
        IsAcceptableUrlPattern<
          ParseURLPattern<`https://example.test/foo/:id/p/:pid`>,
          ParseURLInput<`https://example.test/foo/xxxx/p/p`>
        >
      >,
    ];
  }
}
