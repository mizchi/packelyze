module InternalModule {
  const internalMessage = "Hello from internal module";

  export function getInternalMessage(): string {
    return internalMessage;
  }
}

// Namespace
namespace MyNamespace {
  export const namespaceMessage = "Hello from namespace";

  export function getNamespaceMessage(): string {
    return namespaceMessage;
  }
}

// Global augmentation of the 'window' object
declare global {
  interface Window {
    myCustomFunction?: () => string;
  }
}

window.myCustomFunction = () => "Hello from custom function";

export const messages = {
  internal: InternalModule.getInternalMessage(),
  namespace: MyNamespace.getNamespaceMessage(),
  window: window.myCustomFunction ? window.myCustomFunction() : "",
};

import * as myModule from "myModule";

const result = myModule.myFunction("Hello, TypeScript!");

console.log(result);
