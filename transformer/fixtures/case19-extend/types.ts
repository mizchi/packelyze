export type Loc = {
  fileName: string;
};

export type LocExt = Loc & {
  original: string;
  to: string;
};
