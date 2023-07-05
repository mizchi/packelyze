import type TS from "typescript";
export type { TS };

// export interface TSNode extends TS.Node {
//   id: number;
// }

export interface TSSymbol extends TS.Node {
  id: number;
}
