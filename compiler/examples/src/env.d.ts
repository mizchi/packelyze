declare module "foo" {
  export declare type Foo = {};
  declare const t: number;
  export default t;
}

declare module "bar" {
  import type { Foo } from "foo";
  export type Bar = Foo;
}
