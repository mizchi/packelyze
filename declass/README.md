# @mizchi/declass

## How to use

```bash
$ npm insntall @mizchi/declass -D
$ npx declass input.ts

# Write
$ npx declass input.ts -o input.ts
```

## What is this?

`@mizchi/declass` converts `classDeclaration` to `typeAlias` and `functiondeclaration`

Input

```ts
export class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    console.log("Point created", x, y);
  }
  distance(other: Point) {
    return Math.sqrt(Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2));
  }
}
export class Point3d {
  constructor(public x: number, public y: number, public z: number) {}
}

export class Complex {
  static staticV: number = 1;
  static staticFuncA(){
    this.staticFuncB();
  };
  static staticFuncB(){
    console.log('called');
  };

  _v: number = 1;
  get v(): number {
    this._v;
  };
  set v(value: number) {
    this._v = value;
  };
  // no constructor
}
```

Output

```ts
export type Point = {
    x: number;
    y: number;
};
export function Point$new(x: number, y: number): Point {
    const self: Point = { x: x, y: y };
    console.log("Point created", x, y);
    return self;
}
export function Point$distance(self: Point, other: Point) {
    return Math.sqrt(Math.pow(self.x - other.x, 2) + Math.pow(self.y - other.y, 2));
}
export type Point3d = {
    x: number;
    y: number;
    z: number;
};
export function Point3d$new(x: number, y: number, z: number): Point3d { const self: Point3d = { x: x, y: y, z: z }; return self; }

export const Complex$static$staticV: number = 1;
export function Complex$static$staticFuncA() {
  Complex$static$staticFuncB();
}
export function Complex$static$staticFuncB() {
  console.log("called");
}
export type Complex = {
  get v(): number;
  set v(value: number);
  _v: number;
};
export function Complex$new(): Complex {
  const self: Complex = {
    get v(): number {
      return this._v;
    },
    set v(value: number) {
      this._v = value;
    },
    _v: 1,
  };
  return self;
}
```

## Use declass as typescript transformer

```ts
import ts from "typescript";
import {declassTransformerFactory} from "@mizchi/declass";

const code = `class X {}`;

const source = ts.createSourceFile(
  "input.ts",
  code,
  ts.ScriptTarget.ES2019,
  true,
);

const thisTransformed = ts.transform(source, [
  declassTransformerFactory,
]);

const printer = ts.createPrinter({
  newLine: ts.NewLineKind.LineFeed,
});
const result = printer.printFile(
  thisTransformed.transformed[0],
);
```

## Why?

JavaScript classes are difficult to optimize for minifiers like terser. The use of classes makes it difficult to keep track of which methods are unnecessary code.

This converter illustrates ESM-friendly code by converting objects and methods in a rust-like fashion. It is not intended to be a complete 1:1 conversion, but rather a refactoring aid.

## LICENSE

MIT