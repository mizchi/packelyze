declare module "ext-a" {
  export const a: string;
  type FooInputType = {
    foo: string;
  };
  type ModuleOutputType = {
    xxx: number;
  };

  export function foo(input: FooInputType): ModuleOutputType;
  export function restFn(...inputs: { rrr: number }[]): void;
}
