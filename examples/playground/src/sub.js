export function sub(opts) {
    const x = new X();
    return x.publicMethod().result;
}
function createFetchRequestBodyType() {
    return { keepMe: "xxx" };
}
export function effect(str) {
    const newBody = createFetchRequestBodyType();
    return fetch("https://example.com", {
        method: "POST",
        body: JSON.stringify(newBody),
    });
}
// internal class. do not export
class X {
    publicMethod() {
        return { result: { value: 1 } };
    }
}
export class PublicClass {
    #internal = 1;
    "A-B"() { }
    publicMethod() {
        return { result: { value: 1 } };
    }
    privateMethod() {
        console.log("private method");
    }
    privateMethod2() {
        console.log("private method2");
    }
    privateMethod3() {
        console.log("private method3");
    }
    privateMethod4() {
        console.log("private method4");
    }
}
export var PublicModule;
(function (PublicModule) {
    const x = 1;
    let InnerModule;
    (function (InnerModule) {
        const inner = 1;
    })(InnerModule || (InnerModule = {}));
    let nested;
    (function (nested) {
        nested.y = 1;
    })(nested = PublicModule.nested || (PublicModule.nested = {}));
    class PublicModuleClass {
        publicModuleClassMethod() {
            return { result: { value: 1 } };
        }
        privateModuleClassMethod() { }
    }
    PublicModule.PublicModuleClass = PublicModuleClass;
    PublicModule.pubModConst = 1;
    class InternalClass {
    }
})(PublicModule || (PublicModule = {}));
