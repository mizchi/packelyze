import type { ShouldKeep, Pub } from "./types";

export const pub: Pub = {
  pub: 1,
  hidden: 1,
};

const keep: ShouldKeep = {
  dontmangle: "str",
};

console.log(keep.dontmangle);
