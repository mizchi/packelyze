import { TS } from "./types";
import { expect, test } from "vitest";
import { createTestLanguageService } from "./testHarness";
import { IncrementalLanguageService } from "./services";
import ts, { ClassDeclaration, FunctionDeclaration, FunctionExpression, VariableStatement, factory } from "typescript";
import { cloneNode } from "ts-clone-node";

test("bundle", () => {
  const { service, normalizePath } = createTestLanguageService();
  // TODO: skip declare function
  const codeSub = `
  export function f() {
    return 1;
  }
  export function ff() {
    return 1;
  }
  export class C {
    public x: number = 1;
  }
  export const sub = () => 1;
  export const sub2 = () => 2;
`;

  const codeIndex = `
    import { sub, f as g, C, ff } from "./sub";
    export const x = sub();
  `;
  service.writeSnapshotContent(normalizePath("src/index.ts"), codeIndex);
  service.writeSnapshotContent(normalizePath("src/sub.ts"), codeSub);
  // const program = service.getProgram()!;
  const bundled = bundleFromEntry(service, normalizePath("src/index.ts"));

  console.log(bundled);
  expect(bundled).toBe(`const sub = () => 1;
const f = function g() { return 1; };
class C {
    public x: number = 1;
}
function ff() { return 1; }
export const x = sub();
`);
});

test.only("bundle #2 with scope access", () => {
  const { service, normalizePath } = createTestLanguageService();
  // TODO: skip declare function
  const codeSub = `
  // const x = 2;
  export function f() {
    return internal();
  }
  function internal() {
    return 1;
    // return x;
  }
`;
  const codeIndex = `
    import { f } from "./sub";
    export const x = f();
  `;

  service.writeSnapshotContent(normalizePath("src/index.ts"), codeIndex);
  service.writeSnapshotContent(normalizePath("src/sub.ts"), codeSub);
  // const program = service.getProgram()!;
  const bundled = bundleFromEntry(service, normalizePath("src/index.ts"));

  console.log(bundled);
});

test.skip("bundle #3 re-export", () => {});

function bundleFromEntry(service: IncrementalLanguageService, entryFileName: string) {
  const program = service.getProgram()!;
  const checker = program.getTypeChecker();
  const indexFile = program.getSourceFile(entryFileName)!;
  const result = ts.transform(indexFile, [createBundleTransformerFactory(checker)]);
  const transformed = result.transformed[0];
  const printed = ts.createPrinter().printFile(transformed);
  return printed;
}

const createBundleTransformerFactory: (checker: TS.TypeChecker) => TS.TransformerFactory<any> =
  (checker) => (context) => {
    // const logger = createLogger("[transformer]");
    // const visitedModules: Set<TS.ModuleDeclaration> = new Set();
    return (file) => {
      const toplevelHoisted: TS.Statement[] = [];
      const visit: TS.Visitor = (node) => {
        if (ts.isImportDeclaration(node)) {
          const hoisted = transformImportDeclarationToVariableDeclaration(node, checker);
          toplevelHoisted.push(...hoisted);
          return;
        }
        if (ts.isSourceFile(node)) {
          const visited = ts.visitEachChild(node, visit, context);
          return ts.factory.updateSourceFile(node, [...toplevelHoisted, ...visited.statements]);
        }
        return node;
      };
      return visit(file);
    };

    // TODO: Recursive
    function transformImportDeclarationToVariableDeclaration(
      node: TS.ImportDeclaration,
      checker: TS.TypeChecker,
    ): TS.Statement[] {
      const hoistedDeclarations: TS.Statement[] = [];
      if (
        node.importClause &&
        ts.isImportClause(node.importClause) &&
        node.importClause.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        for (const specifier of node.importClause.namedBindings.elements) {
          const targetModule = checker.getSymbolAtLocation(node.moduleSpecifier);
          const outerSymbol = findDeclarationByName(
            checker,
            targetModule?.valueDeclaration! as TS.SourceFile,
            (specifier.propertyName ?? specifier.name).text,
          );
          // DeclarationList > VariableDeclaration
          if (
            outerSymbol?.valueDeclaration &&
            outerSymbol.valueDeclaration.parent?.parent &&
            ts.isVariableStatement(outerSymbol.valueDeclaration.parent.parent)
          ) {
            const cloned = cloneNode(outerSymbol.valueDeclaration.parent.parent, {
              hook: (_node) => {
                return {
                  modifiers: (modifiers) => {
                    return modifiers && ensureNoExportModifier(modifiers as TS.Modifier[]);
                  },
                };
              },
            });
            hoistedDeclarations.push(cloned as TS.Node as TS.VariableStatement);
            continue;
          }
          if (
            outerSymbol?.valueDeclaration &&
            (ts.isFunctionDeclaration(outerSymbol.valueDeclaration) ||
              ts.isFunctionExpression(outerSymbol.valueDeclaration))
          ) {
            const func = outerSymbol.valueDeclaration as FunctionDeclaration | FunctionExpression;

            const touchingSymbols: TS.Symbol[] = [];
            const visit = (node: TS.Node): void => {
              if (ts.isIdentifier(node)) {
                // skip self name
                if (node === func.name) {
                  return;
                }
                const symbol = checker.getSymbolAtLocation(node);
                symbol && touchingSymbols.push(symbol);
              }
              ts.forEachChild(node, visit);
            };
            visit(func);

            const ensuredNodes: ts.Node[] = [];
            for (const symbol of touchingSymbols) {
              if (symbol.valueDeclaration) {
                ensuredNodes.push(symbol.valueDeclaration);
              }
            }
            // console.log(touchingSymbols);

            // console.log(outerSymbol.valueDeclaration.parent.getText());
            const clonedFunction = cloneImportedFunction(
              outerSymbol.valueDeclaration,
              specifier.name.text,
              specifier.propertyName?.text,
            );
            hoistedDeclarations.push(...clonedFunction);
            // if (clonedFunction) {
            //   hoistedDeclarations.push(clonedFunction);
            // }
          }
          if (
            outerSymbol?.valueDeclaration &&
            (ts.isClassDeclaration(outerSymbol.valueDeclaration) || ts.isClassExpression(outerSymbol.valueDeclaration))
          ) {
            const clonedFunction = cloneImportedClass(
              outerSymbol.valueDeclaration,
              specifier.name.text,
              specifier.propertyName?.text,
            );
            if (clonedFunction) {
              hoistedDeclarations.push(clonedFunction);
            }
          }
        }
      }
      return hoistedDeclarations;
    }
    function cloneImportedFunction(
      node: TS.FunctionDeclaration | TS.FunctionExpression,
      originalName: string,
      nameAs?: string,
    ): Array<TS.VariableStatement | TS.FunctionDeclaration> {
      if (node.body == null) {
        return [];
      }
      const hoistedDeclarations: Array<TS.VariableStatement | TS.FunctionDeclaration> = [];
      if (nameAs == null) {
        const cloned = cloneNode(node as FunctionDeclaration, {
          hook: (_node) => {
            return {
              modifiers: (modifiers) => {
                return modifiers && ensureNoExportModifier(modifiers as TS.Modifier[]);
              },
            };
          },
        });
        hoistedDeclarations.push(cloned);
        return hoistedDeclarations;
        // hoistedDeclarations.push(cloned);
      }
      if (node.body == null) {
        return hoistedDeclarations;
      }
      const clonedAsExpression = ts.factory.createFunctionExpression(
        node.modifiers && (ensureNoExportModifier(node.modifiers) as TS.Modifier[]),
        node.asteriskToken,
        ts.factory.createIdentifier(originalName),
        node.typeParameters,
        node.parameters,
        node.type,
        cloneNode(node.body),
      );
      const clonedStatement = ts.factory.createVariableStatement(
        undefined,
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              ts.factory.createIdentifier(nameAs),
              // ts.factory.createIdentifier(outerName),
              undefined,
              undefined,
              clonedAsExpression,
            ),
          ],
          ts.NodeFlags.Const,
        ),
      );
      return [clonedStatement];
    }

    function cloneImportedClass(
      node: TS.ClassDeclaration | TS.ClassExpression,
      originalName: string,
      nameAs?: string,
    ): TS.VariableStatement | TS.ClassDeclaration | undefined {
      if (nameAs == null) {
        const cloned = cloneNode(node as ClassDeclaration, {
          hook: (_node) => {
            return {
              modifiers: (modifiers) => {
                return modifiers && ensureNoExportModifier(modifiers as TS.Modifier[]);
              },
            };
          },
        });
        return cloned;
      }
      const clonedAsExpression = ts.factory.createClassExpression(
        node.modifiers && (ensureNoExportModifier(node.modifiers) as TS.Modifier[]),
        node.name,
        node.typeParameters,
        node.heritageClauses,
        node.members,
      );
      const clonedStatement = ts.factory.createVariableStatement(
        undefined,
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              ts.factory.createIdentifier(nameAs),
              // ts.factory.createIdentifier(outerName),
              undefined,
              undefined,
              clonedAsExpression,
            ),
          ],
          ts.NodeFlags.Const,
        ),
      );
      return clonedStatement;
    }
  };

const ensureNoExportModifier = <M extends TS.ModifierLike>(modifiers: M[] | TS.NodeArray<M>): M[] => {
  return modifiers.filter((modifier) => {
    return modifier.kind !== ts.SyntaxKind.ExportKeyword;
  });
};

function findDeclarationByName(checker: TS.TypeChecker, outer: ts.SourceFile, name: string): TS.Symbol | undefined {
  // const exportedSymbols = collectExportSymbols(checker, outer);
  // const checker = program.getTypeChecker();
  const symbol = checker.getSymbolAtLocation(outer);
  const exportSymbols = checker.getExportsOfModule(symbol!);
  return exportSymbols.find((symbol) => symbol.name === name);
}
