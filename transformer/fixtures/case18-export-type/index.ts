export {
  type Obj,
  type Result,
} from "./types";

export { createObj } from "./obj";

import type { Indirect, IndirectArrayItem } from "./types";

export type { Indirect };

export const indirect: Indirect = {
  indirect: 1,
};

export const items: Array<IndirectArrayItem> = [
  {
    item: 1,
  },
];

export { runLocal } from "./localObj";
