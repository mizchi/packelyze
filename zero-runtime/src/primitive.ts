declare const __JSON_STRING_TYPE__: unique symbol;

export type TypedJSONString<T> = string & { [__JSON_STRING_TYPE__]: T };
export type TypedSearchString<T> = string & { [__JSON_STRING_TYPE__]: T };
