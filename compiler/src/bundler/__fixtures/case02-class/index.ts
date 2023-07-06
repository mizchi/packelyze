export class MyClass {
  private privateField = 1;
  protected protectedField = 2;
  public publicField = 3;

  private privateMethod() {
    return this.privateField;
  }
  protected protectedMethod() {
    return this.protectedField;
  }
  public publicMethod() {
    return this.publicField;
  }
}

// type Local = {
//   local: number;
// };
// type Pub = {
//   pub: number;
// };

// function fff(): Pub {
//   const fLocal: Local = { local: 1 };
//   return {
//     pub: fLocal.local,
//   };
// }
// export const x = fff();
