import type TS from "typescript";
export type { TS };

export interface TSSymbol extends TS.Node {
  id: number;
}
