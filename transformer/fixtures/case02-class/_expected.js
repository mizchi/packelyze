class C {
  q;
  static sv = 1;
  /*#hardPriv*/ #z = 2;
  static /*svp*/ p = 2;
  static sfoo() {
    return this./*spfoo*/ f();
  }
  static /*spfoo*/ f() {
    return this./*svp*/ p;
  }
  constructor(v) {
    this./*#hardPriv*/ #z;
    this./*v*/ q = {
      /*pubVal*/ k: { pub: v },
      /*privVal*/ x: { /*pv*/ j: v + this./*#hardPriv*/ #z },
    };
  }
  foo() {
    return this./*v*/ q./*pubVal*/ k;
  }
  y() {
    return this./*v*/ q./*privVal*/ x;
  }
}
class C2 {
  c2() {
    return this./*c2_internal*/ w();
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
const calculator = new Calculator();
calculator.add(5).subtract(3);
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
const circle = new Circle(5);
circle.radius = 10;
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
