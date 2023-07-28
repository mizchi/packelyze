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
var k;
(function (k) {
  k[(k["Red"] = 0)] = "Red";
  k[(k["Green"] = 1)] = "Green";
  k[(k["Blue"] = 2)] = "Blue";
})(k || (k = {}));
var x;
(function (x) {
  function foo() {}
  x.foo = foo;
})(x || (x = {}));
/*Color*/ k.Red;
/*MyNamespace*/ x.foo();
const mapped = {
  propA: "propA",
  propB: "propB",
};
// Decorators
function log(target, propertyName) {
  console.log(`log: ${propertyName.toString()}`);
}
class DecoratorTest {
  j = "property";
}
__decorate([log], DecoratorTest.prototype, "j", void 0);

export { DecoratorTest, GenericClass, genericFunction, k, mapped, x };
