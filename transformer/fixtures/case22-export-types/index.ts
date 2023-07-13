export type {
  Foo,
  Bar,
} from "./types";

import type { FooCreator, AdditionalType } from "./types";

export const fooCreator: FooCreator = () => {
  return {
    foo: 1,
  };
};

export const additional: AdditionalType = {
  addition: true,
};
