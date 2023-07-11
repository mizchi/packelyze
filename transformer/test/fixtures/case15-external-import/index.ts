import { foo, restFn } from "ext-a";

export const fooRet = foo({ foo: "foo" });
restFn({ rrr: 123 }, { rrr: 456 });
