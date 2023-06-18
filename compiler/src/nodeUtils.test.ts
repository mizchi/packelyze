import ts from "typescript";
import { expect, test } from "vitest";
import { createTestLanguageService } from "./testHarness";
import { createVisitScoped, composeVisitors, findFirstNode, createVisitSignature } from "./nodeUtils";
import { collectExportSymbols, createCollector } from "./analyzer";
import { createLogger } from './logger';

const code1 = `
// export const local: number = 1;
// export const str: string = "x";

export type Tree = {
  value: number;
  children: Tree[];
}

// type Arg ={
//   input: string
// }
// type Result = {
//   v: number;
// }
// export function fff(arg: Arg): Result {
//   return { v: number };
// }
`;
export type Tree = {
  value: number;
  children: Tree[];
}

test("createTypeVisitor", () => {
  const { service, normalizePath } = createTestLanguageService();
  const code = `

  type LocalType = {
    vvv: number;
  }

  type Tree = {
    value: number;
    children: Tree[];
  }

  export const tree: Tree = {
    value: 1,
    children: []
  };
  `;
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    code
  );
  const program = service.getProgram()!;

  const exportedSymbols = collectExportSymbols(
    program,
    service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!,
  );
  const checker = program.getTypeChecker();

  const valueNode = findFirstNode(program, normalizePath("src/index.ts"), /Tree/);
  const valueSymbol = checker.getSymbolAtLocation(valueNode!)!;

  const xxxNode = findFirstNode(program, normalizePath("src/index.ts"), /xxx/)!;
  const xxxSymbol = checker.getSymbolAtLocation(xxxNode)!;
  const collector = createCollector(checker);

  for (const symbol of exportedSymbols) {
    collector.visitSymbol(symbol);
  }
  expect(collector.isRelatedNode(
    findFirstNode(program, normalizePath("src/index.ts"), /Tree/)!
  )).toBe(true);
  expect(collector.isRelated(valueSymbol)).toBe(true);
  expect(collector.isRelated(xxxSymbol)).toBe(false);
});


test("createCollector", () => {

  const log = createLogger("[relate]", false);
  log.off();
  const { service, normalizePath } = createTestLanguageService();
  const code = `
  type LocalType = {
    hidden: number;
  }
  type PubType = {
    vvv: number;
  }
  type PartialPub = {
    priv: {
      __priv: number;
      __priv2(): void;
    }
    pub: {
      partialPub: number;
    }
  }

  const local: LocalType = { hidden: 1 };
  export const pub: PubType = { vvv: 1 };
  export const partial: PartialPub['pub'] = { partialPub: 1 };
  `;
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    code
  );
  const program = service.getProgram()!;
  const checker = program.getTypeChecker();

  const exportedSymbols = collectExportSymbols(
    program,
    service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!,
  );

  const collector = createCollector(checker);

  for (const symbol of exportedSymbols) {
    collector.visitSymbol(symbol);
    // log.on();
  }

  {
    const filePath = normalizePath("src/index.ts");
    // check node is related
    expect(
      collector.isRelated(findFirstNode(program, filePath, /type PubType/)!)
    ).toBe(true);
    expect(
      collector.isRelatedNode(findFirstNode(program, filePath, /type PubType/)!)
    ).toBe(true);

    expect(
      collector.isRelatedNode(findFirstNode(program, filePath, /type LocalType/)!)
    ).toBe(false);
    expect(
      collector.isRelatedNode(findFirstNode(program, filePath, /hidden:/)!)
    ).toBe(false);

    expect(
      collector.isRelatedNode(findFirstNode(program, filePath, /priv:/)!)
    ).toBe(false);
    expect(
      collector.isRelatedNode(findFirstNode(program, filePath, /__priv:/)!)
    ).toBe(false);
    expect(
      collector.isRelatedNode(findFirstNode(program, filePath, /__priv2/)!)
    ).toBe(false);

    // expect(
    //   isRelatedNode(findFirstNode(program, filePath, /pub:/)!)
    // ).toBe(true);
  }

  return;

});

test("visitScopedIdentifierSymbols", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
export const exported = 1;
const local = 1;
function fff(arg) {}
{
  const nested = 2;

  class Class {
    v = 1;
    constructor () {
      const cstrInternal = 1;
    }
    method () {
      const internal = 1;
    }
  }
}
`
  );
  const symbols: ts.Symbol[] = [];
  const visitScopedIdentifierSymbols = createVisitScoped(service.getProgram()!.getTypeChecker(), (symbol, parentBlock) => {
    symbols.push(symbol);
  });
  const visit = composeVisitors(
    visitScopedIdentifierSymbols,
  );
  visit(service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!);
  // console.log(symbols.map(s => s.name));
  expect(symbols.map(s => s.name)).toEqual([
    "exported", "local", "fff", "arg", "nested", "Class", "v",  "cstrInternal", "method", "internal"
  ]);
});

test("visitScoped: type alias signatrue", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
type T = {
  vvv: number;
  foo() {};
  // "str": number;
  // get bar(): number;
  // set bar(v: number);
}
    `
  );
  const checker = service.getProgram()!.getTypeChecker();
  const symbols: ts.Symbol[] = [];
  // const sourceFile = service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!;
  const visitScoped = createVisitScoped(checker, (symbol, parentBlock) => {
    symbols.push(symbol);
  });

  const visitSignature = createVisitSignature(checker, (symbol, parentBlock) => {
    symbols.push(symbol);
  });

  const visit = composeVisitors(
    visitScoped,
    visitSignature
  );
  visit(service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!);

  expect(symbols.map(s => s.name)).toEqual([
    "vvv", "foo"
  ]);
});

test("visitScoped: enum", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
enum Enum {
  aaaa = 1,
  bbbb = 2,
  cccc,
}
    `
  );
  const symbols: ts.Symbol[] = [];
  const visitScopedIdentifierSymbols = createVisitScoped(service.getProgram()!.getTypeChecker(), (symbol, parentBlock) => {
    symbols.push(symbol);
  });
  composeVisitors(
    visitScopedIdentifierSymbols,
  )(service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!);

  expect(symbols.map(s => s.name)).toEqual([
    "Enum", "aaaa", "bbbb", "cccc"
  ]);
});


test("visitScoped: class", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
class Class {
  vvv: number;
  foo(arg: number) {
    const local = 1;
  };
  consturctor() {
  }
}
    `
  );
  const symbols: ts.Symbol[] = [];
  // const visitScopedIdentifierSymbols =
  composeVisitors(
    createVisitScoped(service.getProgram()!.getTypeChecker(), (symbol, parentBlock) => {
      symbols.push(symbol);
    })
  )(service.getCurrentSourceFile(normalizePath("src/index.ts"))!);
  expect(symbols.map(s => s.name)).toEqual([
    "Class", "vvv", "foo", "arg", "local", "consturctor"
  ]);
});


test.skip("visitLocalIdentifierSymbols: object member", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
const localObj = {
  vvv: 1,
};
export const exportedObj = {
  foo: 1,
}
    `
  );
  const symbols: ts.Symbol[] = [];
  composeVisitors(
    createVisitScoped(service.getProgram()!.getTypeChecker(), (symbol, parentBlock) => {
      symbols.push(symbol);
    })
  )(service.getCurrentSourceFile(normalizePath("src/index.ts"))!);
  expect(symbols.map(s => s.name)).toEqual([
    "localObj", "vvv", "exportedObj", "foo"
    // "Class", "vvv", "foo", "arg", "local", "consturctor"
  ]);
});

