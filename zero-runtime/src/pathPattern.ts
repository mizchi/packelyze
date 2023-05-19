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
  Input extends string,
  // inner type calculation
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
