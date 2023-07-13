import * as myModule from "myModule";

var k;
(function (k) {
  k.x = "Hello from internal module";
  function j() {
    return k.x;
  }
  k.j = j;
})(k || (k = {}));
// Namespace
var q;
(function (q) {
  q.z = "Hello from namespace";
  function p() {
    return q.z;
  }
  q.p = p;
})(q || (q = {}));
window.myCustomFunction = () => "Hello from custom function";
const messages = {
  internal: k.j(),
  namespace: q.p(),
  window: window.myCustomFunction ? window.myCustomFunction() : "",
};
const f = myModule.myFunction("Hello, TypeScript!");
console.log(f);

export { messages };
