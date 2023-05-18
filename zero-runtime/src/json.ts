import { TypedJSONString } from "./primitive";

export type JSON$stringifyT = <T>(
  data: T,
  replacer?: undefined,
  space?: number | string | undefined,
) => TypedJSONString<T>;

export type JSON$parseT = <T, OS extends TypedJSONString<T>>(
  text: TypedJSONString<T>,
) => OS["__type"];
