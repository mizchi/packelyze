import { cloneNode } from "ts-clone-node";
import ts, { ClassDeclaration, FunctionDeclaration, FunctionExpression, VariableStatement, factory } from "typescript";
// import { TS } from "../types";
import { IncrementalLanguageService } from "../ts/services";
import { getAccessesFromExpression, getUnscopedAccesses } from "./scope";

export function bundle(service: IncrementalLanguageService, entryFileName: string) {
  const program = service.getProgram()!;
  const checker = program.getTypeChecker();
  const indexFile = program.getSourceFile(entryFileName)!;
  const result = ts.transform(indexFile, [createBundleTransformerFactory(checker)]);
  const transformed = result.transformed[0];
  const printed = ts.createPrinter().printFile(transformed);
  return printed;
}

export const flattenGraph = (graph: Map<ts.Symbol, Set<ts.Symbol>>) => {
  const result: Array<[from: string, to: string]> = [];
  for (const [from, tos] of graph) {
    for (const to of tos) {
      result.push([from.name, to.name]);
    }
  }
  return result;
};

export function createModuleGraph(program: ts.Program, root: ts.SourceFile) {
  const checker = program.getTypeChecker();
  const graph = new Map<ts.Symbol, Set<ts.Symbol>>();
  const visitedSymbols = new Set<ts.Symbol>();

  const addDep = (from: ts.Symbol, to: ts.Symbol) => {
    if (!graph.has(from)) {
      graph.set(from, new Set());
    }
    graph.get(from)!.add(to);
  };

  const symbol = checker.getSymbolAtLocation(root)!;
  const symbols = checker.getExportsOfModule(symbol);
  for (const sym of symbols) {
    addDep(symbol, sym);
    visit(sym);
  }

  return graph;

  function visit(symbol: ts.Symbol) {
    // console.log(
    //   "[visit]",
    //   symbol.name,
    //   ":",
    //   symbol.valueDeclaration && ts.SyntaxKind[symbol.valueDeclaration.kind],
    //   "=>",
    //   symbol.valueDeclaration?.getText(),
    //   "[decls]",
    //   symbol.declarations?.map((x) => x.getText()),
    // );
    if (visitedSymbols.has(symbol)) {
      return;
    }
    visitedSymbols.add(symbol);

    for (const decl of symbol.declarations ?? []) {
      if (ts.isSourceFile(decl)) {
        const exports = checker.getExportsOfModule(symbol);
        for (const sym of exports) {
          addDep(symbol, sym);
          visit(sym);
        }
      }
    }
    if (!symbol.valueDeclaration) return;
    const decl = symbol.valueDeclaration!;
    if (ts.isFunctionDeclaration(decl)) {
      const accesses = getUnscopedAccesses(checker, decl.body!);
      for (const access of accesses) {
        addDep(symbol, access);
        visit(access);
      }
    }
    if (ts.isVariableDeclaration(decl)) {
      if (decl.initializer) {
        const accesses = getAccessesFromExpression(checker, decl.initializer);
        for (const access of accesses) {
          addDep(symbol, access);
          visit(access);
        }
      }
    }
  }
}

const createBundleTransformerFactory: (checker: ts.TypeChecker) => ts.TransformerFactory<any> =
  (checker) => (context) => {
    // const logger = createLogger("[transformer]");
    const hoistedDeclarations: ts.Statement[] = [];
    return (file) => {
      const toplevelHoisted: ts.Statement[] = [];
      const visit: ts.Visitor = (node) => {
        // delete imports
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
      node: ts.ImportDeclaration,
      checker: ts.TypeChecker,
    ): ts.Statement[] {
      if (
        node.importClause &&
        ts.isImportClause(node.importClause) &&
        node.importClause.namedBindings &&
        ts.isNamedImports(node.importClause.namedBindings)
      ) {
        for (const specifier of node.importClause.namedBindings.elements) {
          insertFromImportSpecifier(specifier);
        }
      }
      return hoistedDeclarations;

      function insertFromImportSpecifier(specifier: ts.ImportSpecifier) {
        const targetModule = checker.getSymbolAtLocation(node.moduleSpecifier);
        const outerSymbol = findDeclarationByName(
          checker,
          targetModule?.valueDeclaration! as ts.SourceFile,
          (specifier.propertyName ?? specifier.name).text,
        );
        if (!outerSymbol) {
          throw new Error("No specified symbol");
        }

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
                  return modifiers && ensureNoExportModifier(modifiers as ts.Modifier[]);
                },
              };
            },
          });
          hoistedDeclarations.push(cloned as ts.Node as ts.VariableStatement);
          return;
          // continue;
        }
        if (
          outerSymbol?.valueDeclaration &&
          (ts.isFunctionDeclaration(outerSymbol.valueDeclaration) ||
            ts.isFunctionExpression(outerSymbol.valueDeclaration))
        ) {
          const func = outerSymbol.valueDeclaration as FunctionDeclaration | FunctionExpression;

          const touchingSymbols: ts.Symbol[] = [];
          const visit = (node: ts.Node): void => {
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

          const accesses = getUnscopedAccesses(checker, func.body!);
          for (const access of accesses) {
            if (access.valueDeclaration) {
              if (ts.isFunctionDeclaration(access.valueDeclaration)) {
                // TODO: recursive
                const accesses = getUnscopedAccesses(checker, access.valueDeclaration.body!);
                for (const access of accesses) {
                  insertAccessingSymbol(access);
                }

                const clonedFunction = cloneImportedFunction(
                  access.valueDeclaration,
                  specifier.name.text,
                  specifier.propertyName?.text,
                );
                hoistedDeclarations.push(...clonedFunction);
              }
            }
          }
          const clonedFunction = cloneImportedFunction(
            outerSymbol.valueDeclaration,
            specifier.name.text,
            specifier.propertyName?.text,
          );
          hoistedDeclarations.push(...clonedFunction);
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
      function insertAccessingSymbol(symbol: ts.Symbol) {
        if (!symbol.valueDeclaration) {
          throw new Error("No value declaration");
        }
        // if (ts.isFunctionDeclaration(symbol.valueDeclaration)) {
        //   const accesses = getUnscopedAccesses(checker, symbol.valueDeclaration.body!);
        //   for (const access of accesses) {
        //     const children = insertAccessingDeclarationFromSymbol(access, specifier);
        //     stmts.push(...children);
        //   }
        //   const clonedFunction = cloneImportedFunction(
        //     symbol.valueDeclaration,
        //     specifier!.name.text,
        //     specifier!.propertyName?.text,
        //   );
        //   stmts.push(...clonedFunction);
        // }
        if (ts.isVariableDeclaration(symbol.valueDeclaration)) {
          const clonedVariableDecl = cloneNode<ts.VariableDeclaration>(symbol.valueDeclaration);
          hoistedDeclarations.push(
            ts.factory.createVariableStatement(
              undefined,
              ts.factory.createVariableDeclarationList([clonedVariableDecl], ts.NodeFlags.Const),
            ),
          );
        }
      }
    }

    function cloneImportedFunction(
      node: ts.FunctionDeclaration | ts.FunctionExpression,
      originalName: string,
      nameAs?: string,
    ): Array<ts.VariableStatement | ts.FunctionDeclaration> {
      if (node.body == null) {
        return [];
      }
      const hoistedDeclarations: Array<ts.VariableStatement | ts.FunctionDeclaration> = [];
      if (nameAs == null) {
        const cloned = cloneNode(node as FunctionDeclaration, {
          hook: (_node) => {
            return {
              modifiers: (modifiers) => {
                return modifiers && ensureNoExportModifier(modifiers as ts.Modifier[]);
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
        node.modifiers && (ensureNoExportModifier(node.modifiers) as ts.Modifier[]),
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
      node: ts.ClassDeclaration | ts.ClassExpression,
      originalName: string,
      nameAs?: string,
    ): ts.VariableStatement | ts.ClassDeclaration | undefined {
      if (nameAs == null) {
        const cloned = cloneNode(node as ClassDeclaration, {
          hook: (_node) => {
            return {
              modifiers: (modifiers) => {
                return modifiers && ensureNoExportModifier(modifiers as ts.Modifier[]);
              },
            };
          },
        });
        return cloned;
      }
      const clonedAsExpression = ts.factory.createClassExpression(
        node.modifiers && (ensureNoExportModifier(node.modifiers) as ts.Modifier[]),
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

const ensureNoExportModifier = <M extends ts.ModifierLike>(modifiers: M[] | ts.NodeArray<M>): M[] => {
  return modifiers.filter((modifier) => {
    return modifier.kind !== ts.SyntaxKind.ExportKeyword;
  });
};

function findDeclarationByName(checker: ts.TypeChecker, outer: ts.SourceFile, name: string): ts.Symbol | undefined {
  // const exportedSymbols = collectExportSymbols(checker, outer);
  // const checker = program.getTypeChecker();
  const symbol = checker.getSymbolAtLocation(outer);
  const exportSymbols = checker.getExportsOfModule(symbol!);
  return exportSymbols.find((symbol) => symbol.name === name);
}
