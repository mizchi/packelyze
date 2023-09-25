type Internal = {
  internalKey: number;
};

type Output = {
  result: {
    value: number;
  };
};

export type PubType = {
  pubTypeKey: number;
};

export interface InterfaceType {
  ikey: number;
}

export function sub(opts: { xxx: number; yyy: string }) {
  const x = new X();
  return x.publicMethod().result;
}

type FetchRequestBodyType = {
  keepMe: string;
};

function createFetchRequestBodyType(): FetchRequestBodyType {
  return { keepMe: "xxx" } as FetchRequestBodyType;
}

export function effect(str: string) {
  const newBody = createFetchRequestBodyType();
  return fetch("https://example.com", {
    method: "POST",
    body: JSON.stringify(newBody),
  });
}

// internal class. do not export
class X {
  public publicMethod(): Output {
    return { result: { value: 1 } };
  }
}

export class PublicClass {
  #internal = 1;
  "A-B"(): void {}
  public publicMethod(): Output {
    return { result: { value: 1 } };
  }

  private privateMethod() {
    console.log("private method");
  }
  private privateMethod2() {
    console.log("private method2");
  }
  private privateMethod3() {
    console.log("private method3");
  }
  private privateMethod4() {
    console.log("private method4");
  }
}

export module PublicModule {
  const x = 1;
  module InnerModule {
    const inner = 1;
  }
  export module nested {
    export const y = 1;
  }
  export interface PublicModuleInterface {}
  export class PublicModuleClass {
    public publicModuleClassMethod(): Output {
      return { result: { value: 1 } };
    }
    private privateModuleClassMethod() {}
  }
  export type PublicModuleType = {
    pubModType: number;
  };
  export const pubModConst = 1;
  class InternalClass {}
}
