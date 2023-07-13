var __decorate =
  (undefined && undefined.__decorate) ||
  function (decorators, target, key, desc) {
    var c = arguments.length,
      r =
        c < 3
          ? target
          : desc === null
          ? (desc = Object.getOwnPropertyDescriptor(target, key))
          : desc,
      d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
      r = Reflect.decorate(decorators, target, key, desc);
    else
      for (var i = decorators.length - 1; i >= 0; i--)
        if ((d = decorators[i]))
          r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
// Generic function and Class
class GenericClass {
  value;
  constructor(value) {
    this.value = value;
  }
}
function genericFunction(arg) {
  return arg;
}
// Enums and namespaces
var Color;
(function (Color) {
  Color[(Color["Red"] = 0)] = "Red";
  Color[(Color["Green"] = 1)] = "Green";
  Color[(Color["Blue"] = 2)] = "Blue";
})(Color || (Color = {}));
var MyNamespace;
(function (MyNamespace) {
  function p() {}
  MyNamespace.p = p;
})(MyNamespace || (MyNamespace = {}));
Color.Red;
MyNamespace.p();
const mapped = {
  propA: "propA",
  propB: "propB",
};
// Decorators
function w(target, propertyName) {
  console.log(`log: ${propertyName.toString()}`);
}
class DecoratorTest {
  g = "property";
}
__decorate([w], DecoratorTest.prototype, "g", void 0);

export {
  Color,
  DecoratorTest,
  GenericClass,
  MyNamespace,
  genericFunction,
  mapped,
};
