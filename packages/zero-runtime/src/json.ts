import type { TypedJSONString, __JSON_STRING_TYPE__ } from "./primitive";

export type TypedJSON$stringify = <T>(
  data: T,
  replacer?: undefined,
  space?: number | string | undefined,
) => TypedJSONString<T>;

export type TypedJSON$parse = <T, OS extends TypedJSONString<T>>(
  text: TypedJSONString<T>,
) => OS[typeof __JSON_STRING_TYPE__];
