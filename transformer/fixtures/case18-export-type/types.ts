export type Input = {
  v1?: string;
  v2?: string;
};

export type Result = {
  v1: string;
  v2: string;
};

export interface Obj {
  xxx(): void;
  yyy(input: Partial<Input>): Result;
  zzz(): Array<Result>;
}

export type Indirect = {
  indirect: number;
};

export type IndirectArrayItem = {
  item: number;
};

export type LocalObj = {
  local: number;
};
