type MyType = {
  pubVal: {
    pub: number;
  };
  privVal: {
    pv: number;
  };
};
export class C {
  private v: MyType;
  static sv: number = 1;
  #hardPriv: number = 2;
  private static svp: number = 2;
  static sfoo() {
    return this.spfoo();
  }
  private static spfoo() {
    return this.svp;
  }
  constructor(v: number) {
    this.#hardPriv;
    this.v = { pubVal: { pub: v }, privVal: { pv: v + this.#hardPriv } };
  }
  foo() {
    return this.v.pubVal;
  }
  private priv() {
    return this.v.privVal;
  }
}
