class C {
  q;
  static sv = 1;
  #z = 2;
  static p = 2;
  static sfoo() {
    return this.f();
  }
  static f() {
    return this.p;
  }
  constructor(v) {
    this.#z;
    this.q = { k: { pub: v }, x: { j: v + this.#z } };
  }
  foo() {
    return this.q.k;
  }
  y() {
    return this.q.x;
  }
}
class w {
  c2() {
    return this.g();
  }
  g() {
    return 2;
  }
}
class C3 extends w {
  c3() {
    return this.c2();
  }
}
class C4 {
  foo() {
    return 1;
  }
}
class b {
  bar() {
    return this.v();
  }
}
class C6 extends b {
  v() {
    return 1;
  }
}
export { C, C3, C4, C6 };
