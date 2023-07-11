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

// Generics
export class GenericClass<T> {
  constructor(private value: T) {}

  getValue(): T {
    return this.value;
  }

  setValue(value: T): void {
    this.value = value;
  }
}

export const stringInstance = new GenericClass<string>("Hello");

// Method chaining
export class Calculator {
  constructor(private value: number = 0) {}

  add(value: number): this {
    this.value += value;
    return this;
  }

  subtract(value: number): this {
    this.value -= value;
    return this;
  }

  result(): number {
    return this.value;
  }
}

const calculator = new Calculator();
calculator.add(5).subtract(3);

// Accessors
export class Circle {
  // TODO: fix private initializer
  constructor(private _radius: number) {}

  get radius() {
    return this._radius;
  }

  set radius(radius: number) {
    this._radius = radius;
  }

  get area() {
    return Math.PI * Math.pow(this._radius, 2);
  }
}

const circle = new Circle(5);
circle.radius = 10;

// Optional methods and properties
interface OptionalInterface {
  requiredMethod(): void;
  optionalMethod?(): void;
  requiredProp: number;
  optionalProp?: number;
}

export class OptionalClass implements OptionalInterface {
  requiredMethod() {
    console.log("Required method");
  }

  requiredProp = 1;
}
