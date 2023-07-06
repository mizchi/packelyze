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
export { C };