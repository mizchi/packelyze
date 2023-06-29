import type { TypedSearchString } from "./primitive";

export interface TypedURLSeachParams<T extends { [key: string]: any }> extends URLSearchParams {
  get(name: keyof T): T[typeof name];
  has(name: keyof T): boolean;
  append(name: keyof T, value: T[typeof name]): void;
  set(name: keyof T, value: T[typeof name]): void;
  delete(name: keyof T): void;
  toString(): TypedSearchString<T>;
}

// Subset of https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API

export type ParsedURLPattern<
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

export type ParseURLPattern<T extends string> = T extends
  | `${infer Protocol}://${infer Host}/${infer RestPath}`
  | `/${infer RestPath}`
  ? ParsedURLPattern<
      string extends Protocol ? "" : Protocol,
      string extends Host ? "" : Host,
      RestPath extends `${infer Path}?${string}` ? ParsePath<Path> : ParsePath<RestPath>,
      // TODO: handle search component
      RestPath extends `${string}?${string}` ? true : false
    >
  : never;

export type ParsePath<T extends string> = T extends `/${infer Rest}`
  ? ParsePath<Rest>
  : T extends `${infer A}/${infer Rest}`
  ? // :foo/...
    A extends `:${string}`
    ? `${string}/${ParsePath<Rest>}`
    : // foo/...
      `${A}/${ParsePath<Rest>}`
  : // :id
  T extends `:${string}`
  ? string
  : // foo
    T;

export type ParsedURLInput<
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

export type ParseURLInput<T extends string> = T extends
  | `${infer Protocol}://${infer Host}/${infer RestPath}`
  // | `${infer Protocol}://${infer Host}`
  | `/${infer RestPath}`
  ? ParsedURLInput<
      string extends Protocol ? "" : Protocol,
      string extends Host ? "" : Host,
      // Protocol,
      // Host,
      RestPath extends `${infer Path}?${string}` ? Path : RestPath,
      RestPath extends `${string}?${infer Search}` ? Search : never
    >
  : never;

export type GetMatchedRest<Pattern extends string, Input extends string> = Input extends
  | Pattern
  | `${Pattern}/${infer Rest}`
  ? string extends Rest
    ? never
    : Rest
  : never;

export type GetExactPattern<Pattern extends string, Input extends string> = Input extends Pattern
  ? Input extends `${Pattern}/${infer Over}`
    ? string extends Over
      ? Pattern
      : never
    : Pattern
  : never;

export type IsAcceptableUrlPattern<
  Pattern extends ParsedURLPattern<any, any, any, any>,
  Input extends ParsedURLInput<any, any, any, any>,
> = Input["protocol"] extends Pattern["protocol"]
  ? Input["host"] extends Pattern["host"]
    ? Input["path"] extends Pattern["path"]
      ? GetMatchedRest<Pattern["path"], Input["path"]> extends never
        ? true
        : false
      : never
    : never
  : never;

export type ExtractAcceptableURLPattern<
  Pattern extends ParsedURLPattern<any, any, any, any>,
  Input extends ParsedURLInput<any, any, any, any>,
> = Pattern extends ParsedURLPattern<infer ProtocolPattern, infer HostPattern, infer PathPattern, infer SearchPattern>
  ? Input extends ParsedURLInput<infer ProtocolInput, infer HostInput, infer PathInput, infer SearchInput>
    ? ProtocolInput extends ProtocolPattern
      ? HostInput extends HostPattern
        ? GetExactPattern<PathPattern, PathInput> extends infer MatchedPathPattern
          ? Extract<
              Pattern,
              {
                path: MatchedPathPattern;
                host: HostPattern;
                protocol: ProtocolPattern;
              }
            >
          : never
        : never
      : never
    : never
  : never;
