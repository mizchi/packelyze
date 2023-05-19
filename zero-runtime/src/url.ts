import type { TypedSearchString } from "./primitive";

export interface URLSeachParamsT<T extends { [key: string]: any }>
  extends URLSearchParams {
  get(name: keyof T): T[typeof name];
  has(name: keyof T): boolean;
  append(name: keyof T, value: T[typeof name]): void;
  set(name: keyof T, value: T[typeof name]): void;
  delete(name: keyof T): void;
  toString(): TypedSearchString<T>;
}
