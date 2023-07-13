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
class C2 {
  c2() {
    return this.w();
  }
  w() {
    return 2;
  }
}
class C3 extends C2 {
  c3() {
    return this.c2();
  }
}
class C4 {
  foo() {
    return 1;
  }
}
class C5 {
  bar() {
    return this.foo();
  }
}
class C6 extends C5 {
  foo() {
    return 1;
  }
}
// Generics
class GenericClass {
  value;
  constructor(value) {
    this.value = value;
  }
  getValue() {
    return this.value;
  }
  setValue(value) {
    this.value = value;
  }
}
const stringInstance = new GenericClass("Hello");
// Method chaining
class Calculator {
  value;
  constructor(value = 0) {
    this.value = value;
  }
  add(value) {
    this.value += value;
    return this;
  }
  subtract(value) {
    this.value -= value;
    return this;
  }
  result() {
    return this.value;
  }
}
const g = new Calculator();
g.add(5).subtract(3);
// Accessors
class Circle {
  _radius;
  // TODO: fix private initializer
  constructor(_radius) {
    this._radius = _radius;
  }
  get radius() {
    return this._radius;
  }
  set radius(radius) {
    this._radius = radius;
  }
  get area() {
    return Math.PI * Math.pow(this._radius, 2);
  }
}
const b = new Circle(5);
b.radius = 10;
class OptionalClass {
  requiredMethod() {
    console.log("Required method");
  }
  requiredProp = 1;
}

export {
  C,
  C3,
  C4,
  C6,
  Calculator,
  Circle,
  GenericClass,
  OptionalClass,
  stringInstance,
};
