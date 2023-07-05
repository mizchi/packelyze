import { cloneNode } from "ts-clone-node";
import ts from "typescript";
import { AnyExportableDeclaration, isExportableDeclaration } from "../nodeUtils";

const hasExportKeyword = (node: AnyExportableDeclaration) =>
  node.modifiers?.find((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
const cloneWithoutExport = (node: AnyExportableDeclaration) => {
  return cloneNode(node, {
    hook: (_child) => {
      return {
        modifiers: (modifiers) => {
          return modifiers?.filter((mod) => mod.kind !== ts.SyntaxKind.ExportKeyword);
        },
      };
    },
  });
};

const SEARCH_EXPORT_DECL_REGEX = /export\s+(const |let |var |function|class |type(?!\s*{)|interface |enum )/;
export function isPreprocessedNeeded(code: string) {
  return SEARCH_EXPORT_DECL_REGEX.test(code);
}

export function preprocess(file: ts.SourceFile | string) {
  file =
    typeof file === "string"
      ? ts.createSourceFile(`${Math.random().toString(32).substring(2)}_tmp.tsx`, file, ts.ScriptTarget.Latest)
      : file;
  const transformed = ts.transform(file, [exportRewireTransformerFactory]);
  const printer = ts.createPrinter();
  const out = printer.printFile(transformed.transformed[0]);
  return out;
}

export const exportRewireTransformerFactory: ts.TransformerFactory<any> = (context) => {
  return (node) => {
    const exportedIdentifiers: ts.Identifier[] = [];
    const noModuleSpecifierExportDeclarations: ts.ExportDeclaration[] = [];

    const visit: ts.Visitor = (node: ts.Node) => {
      if (ts.isExportDeclaration(node) && !node.moduleSpecifier) {
        noModuleSpecifierExportDeclarations.push(node);
        return undefined;
      }
      if (isExportableDeclaration(node)) {
        if (ts.isVariableStatement(node)) {
          if (hasExportKeyword(node)) {
            for (const decl of node.declarationList.declarations) {
              if (ts.isIdentifier(decl.name)) {
                exportedIdentifiers.push(decl.name);
              }
            }
          }
          return cloneWithoutExport(node);
        }
        if (hasExportKeyword(node)) {
          if (node.name && ts.isIdentifier(node.name)) {
            exportedIdentifiers.push(node.name);
          }
        }
        return cloneWithoutExport(node);
      }
      if (ts.isSourceFile(node)) {
        const visited = ts.visitEachChild(node, visit, context);
        // console.log("export strip", exportedIdentifiers.map(x => x.getText()));
        const exsitedSpecifiers = noModuleSpecifierExportDeclarations
          .map((stmt) => {
            if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
              return stmt.exportClause.elements.map((elem) => cloneNode(elem));
            }
            return [];
          })
          .flat();

        const needRewired = exportedIdentifiers.length > 0 || exsitedSpecifiers.length > 0;
        const rewiredExportDeclaration = ts.factory.createExportDeclaration(
          undefined,
          // TODO: keep typeOnly
          false,
          ts.factory.createNamedExports([
            ...exsitedSpecifiers,
            ...exportedIdentifiers.map((id) => {
              return ts.factory.createExportSpecifier(false, undefined, id);
            }),
          ]),
        );

        return ts.factory.updateSourceFile(
          visited,
          [...visited.statements, ...(needRewired ? [rewiredExportDeclaration] : [])],
          visited.isDeclarationFile,
          visited.referencedFiles,
          visited.typeReferenceDirectives,
          visited.hasNoDefaultLib,
          visited.libReferenceDirectives,
        );
      }
      return node;
    };
    return ts.visitNode(node, (node) => visit(node));
  };
};
