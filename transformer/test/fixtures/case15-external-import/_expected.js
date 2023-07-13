import { foo, restFn } from "ext-a";

const fooRet = foo({ foo: "foo" });
restFn({ rrr: 123 }, { rrr: 456 });

export { fooRet };
