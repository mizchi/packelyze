// Generic function and Class
export class GenericClass<T> {
  constructor(public value: T) {}
}

export function genericFunction<T>(arg: T): T {
  return arg;
}

const stringInstance = new GenericClass('Hello');
const numberInstance = new GenericClass(123);
genericFunction(stringInstance);
genericFunction(numberInstance);

// Interfaces and function types
interface Printable {
  print(): string;
}

type FunctionType = (a: number, b: number) => number;

const add: FunctionType = (a, b) => a + b;
const subtract: FunctionType = (a, b) => a - b;

let printable: Printable = {
  print: () => 'I can print'
};

// Enums and namespaces
export enum Color {
  Red,
  Green,
  Blue
}

export namespace MyNamespace {
  export function foo(): void {}
}

const red: Color = Color.Red;
MyNamespace.foo();

// Mapped and conditional types
type Properties = 'propA' | 'propB';
type MyMappedType = {
  [P in Properties]: P;
};

export const mapped: MyMappedType = {
  propA: 'propA',
  propB: 'propB'
};

type MyConditionalType<T> = T extends string ? string : number;
let conditional: MyConditionalType<'test'> = 'test';

// Decorators
function log(target: any, propertyName: string | symbol): void {
  console.log(`log: ${propertyName.toString()}`);
}

export class DecoratorTest {
  @log
  private property: string = 'property';
}

const decoratorTest = new DecoratorTest();

