export class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    console.log("Point created", x, y);
  }
  distance(other: Point) {
    return Math.sqrt(
      Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2),
    );
  }
}
export class Point3d {
  constructor(public x: number, public y: number, public z: number) {}
}

export class Complex {
  static staticV: number = 1;
  static staticFuncA() {
    this.staticFuncB();
  }
  static staticFuncB() {
    console.log("called");
  }

  _v: number = 1;
  get v(): number {
    return this._v;
  }
  set v(value: number) {
    this._v = value;
  }
  // no constructor
}
