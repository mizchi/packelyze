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

class C2 {
  c2() {
    return this.c2_internal();
  }
  private c2_internal() {
    return 2;
  }
}

export class C3 extends C2 {
  c3() {
    return this.c2();
  }
}

interface I {
  foo(): number;
}
export class C4 implements I {
  foo() {
    return 1;
  }
}

abstract class C5 {
  abstract foo(): number;
  bar() {
    return this.foo();
  }
}

export class C6 extends C5 {
  foo() {
    return 1;
  }
}
