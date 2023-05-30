import type { __JSON_STRING_TYPE__, TypedJSONString } from "./primitive";

export type JSON$stringifyT = <T>(
  data: T,
  replacer?: undefined,
  space?: number | string | undefined,
) => TypedJSONString<T>;

export type JSON$parseT = <T, OS extends TypedJSONString<T>>(
  text: TypedJSONString<T>,
) => OS[typeof __JSON_STRING_TYPE__];
