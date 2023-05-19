// TODO: Support starndard https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API

// Extract URL pattern
export type PathPattern<T extends string> = T extends
  `/${infer Head}/${infer Body}/${infer Tail}`
  ? Tail extends "" ? `${PathPattern<`/${Head}`>}${PathPattern<`${Body}`>}`
    // folding to 2 term
  : `${PathPattern<`/${Head}`>}${PathPattern<`/${Body}/${Tail}`>}`
  // 2 term
  : T extends `/${infer Head}/${infer Tail}`
    ? Tail extends "" ? PathPattern<`/${Head}`>
    : `/${Head}${PathPattern<`/${Tail}`>}`
  // 1 term dynamic
  : T extends `/:${string}` ? `/${string}`
  : T;

// Check if the pattern is exact
export type ExactPathPattern<Input extends string, Pattern extends string> =
  Input extends Pattern ? Input extends `${Pattern}/${string}` ? false
    : IsSameSlashDepth<Input, Pattern> extends true ? true
    : false
    : false;

export type IsSameSlashDepth<A extends string, B extends string> =
  SlashDepthCounter<A> extends SlashDepthCounter<B> ? true : false;
export type SlashDepthCounter<T extends string> = T extends
  `${string}/${infer Tail}` ? `/${SlashDepthCounter<Tail>}`
  : "";

export type FillPathPattern<
  Host extends string,
  PatternExpr extends string,
  InputRaw extends string,
  // inner type calculation
  Input extends string = TrimSearch<InputRaw>,
  CompiledPattern extends string = PathPattern<PatternExpr>,
  InputPath extends string = GetPath<Input, Host>,
  InputHost extends string = GetHost<Input, InputPath>,
> = InputHost extends Host
  // Check if the pattern is exact
  ? InputPath extends CompiledPattern
    // Check exact match
    ? ExactPathPattern<InputPath, CompiledPattern> extends true ? true : false
  : false
  : false;

export type GetPath<Input extends string, Host extends string> = Input extends
  `${Host}${infer Pattern}` ? Pattern : never;

export type GetHost<Input extends string, Pattern extends string> =
  Input extends `${infer Host}${Pattern}` ? Host : never;

export type GetHostFromPatternString<
  Input extends string,
  PatternString extends string,
  CompiledPattern extends string = PathPattern<PatternString>,
> = Input extends `${infer Host}${CompiledPattern}` ? Host : never;

export type GetHostFromInput<T extends string> = T extends
  `${infer Protocol}://${infer Host}/${string}` ? `${Protocol}://${Host}` : "";

export type GetSearch<T> = T extends `${string}?${infer Search}` ? Search
  : never;
export type TrimSearch<T> = T extends `${infer Head}?${string}` ? Head : T;

// type Opaque<T> = string & { __opaque: T };

// type TypedSearchString<T> = string & { __query: T };

// export type WithQuery<T> = T extends `${infer Head}?${infer Query}`
//   ? { head: Head; query: Query }
//   : { head: T; query: "" };

// type Y<T, S extends Opaque<T>> = S extends `${infer U}?${infer Query}`
// type TT = SearchParser<"a=1">;
// type TT2 = SearchSetParser<"a=1&b=2">;
// type TT3 = SearchSetParser<"a=">;

// type URLPattern<T extends string> = T extends
//   `${infer Protocol}://${infer Rest}` ? `${Protocol}://${URLPattern<Rest>}`
//   : T extends `${infer Host}/${infer Rest}` ? `${Host}/${URLPattern<Rest>}`
//   : T extends `${infer Path}?${infer Rest}` ? `${Path}?${URLPattern<Rest>}`
//   : T extends `${infer Key}=${infer Value}&${infer Rest}`
//     ? `${Key}=${Value}&${URLPattern<Rest>}`
//   : T extends `${infer Key}=${infer Value}` ? `${Key}=${Value}`
//   : T;

// type P = URLPattern<"https://z.test/api/endpoint?query=1&query2=2">;

// type SearchSetParser<T extends string> = T extends `${infer A}&${infer B}`
//   ? SearchParser<A> & SearchSetParser<B>
//   : SearchParser<T>;
// type SearchParser<T extends string> = T extends `${infer Key}=${infer Value}`
//   ? {
//     [K in Key]: Value;
//   }
//   : {
//     [K in T]: void;
//   };
