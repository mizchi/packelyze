import * as myModule from "myModule";

var k;
(function (k) {
  const internalMessage = "Hello from internal module";
  function x() {
    return internalMessage;
  }
  k.x = x;
})(k || (k = {}));
// Namespace
var j;
(function (j) {
  j.namespaceMessage = "Hello from namespace";
  function q() {
    return j.namespaceMessage;
  }
  j.q = q;
})(j || (j = {}));
window.myCustomFunction = () => "Hello from custom function";
const messages = {
  internal: /*InternalModule*/ k./*getInternalMessage*/ x(),
  namespace: /*MyNamespace*/ j./*getNamespaceMessage*/ q(),
  window: window.myCustomFunction ? window.myCustomFunction() : "",
};
const result = myModule.myFunction("Hello, TypeScript!");
console.log(result);

export { messages };
