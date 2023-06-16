import { cloneNode } from 'ts-clone-node';
import {
  ExportDeclaration,
  Identifier,
  Node,
  SourceFile,
  SyntaxKind, TransformerFactory,
  Visitor,
  factory,
  isExportDeclaration,
  isIdentifier,
  isNamedExports,
  isSourceFile,
  isVariableStatement,
  transform,
  visitEachChild,
  visitNode,
  createPrinter,
  createSourceFile
} from "typescript";
import { AnyExportableDeclaration, isExportableDeclaration } from "./nodeUtils";

const hasExportKeyword = (node: AnyExportableDeclaration) => node.modifiers?.find(mod => mod.kind === SyntaxKind.ExportKeyword);
const cloneWithoutExport = (node: AnyExportableDeclaration) => {
  return cloneNode(node, {
    hook: _child => {
      return {
        modifiers: modifiers => {
          return modifiers?.filter(mod => mod.kind !== SyntaxKind.ExportKeyword);
        }
      };
    }
  });
}

const SEARCH_EXPORT_DECL_REGEX = /export\s+(const |let |var |function|class |type(?!\s*{)|interface |enum )/;
export function isPreprocessedNeeded(code: string) {
  return SEARCH_EXPORT_DECL_REGEX.test(code);
}

export function preprocess(file: SourceFile | string) {
  const transformed = transform(file, [exportRewireTransformerFactory]);
  const printer = createPrinter();
  const out = printer.printFile(
    transformed.transformed[0],
  );
  return out;
}

export const exportRewireTransformerFactory: TransformerFactory<any> = (context) => {
  return (node) => {
    const exportedIdentifiers: Identifier[] = [];
    const noModuleSpecifierExportDeclarations: ExportDeclaration[] = [];

    const visit: Visitor = (node: Node) => {
      if (isExportDeclaration(node) && !node.moduleSpecifier) {
        noModuleSpecifierExportDeclarations.push(node);
        return undefined;
      }
      if (isExportableDeclaration(node)) {
        if (isVariableStatement(node)) {
          if (hasExportKeyword(node)) {
            for (const decl of node.declarationList.declarations) {
              if (isIdentifier(decl.name)) {
                exportedIdentifiers.push(decl.name);
              }
            }  
          }
          return cloneWithoutExport(node);
        }
        if (hasExportKeyword(node)) {
          if (node.name && isIdentifier(node.name)) {
            exportedIdentifiers.push(node.name);
          }      
        }
        return cloneWithoutExport(node);
      }
      if (isSourceFile(node)) {
        const visited = visitEachChild(node, visit, context);
        // console.log("export strip", exportedIdentifiers.map(x => x.getText()));
        const exsitedSpecifiers = noModuleSpecifierExportDeclarations.map((stmt) => {
          if (stmt.exportClause && isNamedExports(stmt.exportClause)) {
            return stmt.exportClause.elements.map((elem) => cloneNode(elem));
          }
          return [];
        }).flat();

        const needRewired = exportedIdentifiers.length > 0 || exsitedSpecifiers.length > 0;
        const rewiredExportDeclaration = factory.createExportDeclaration(
          undefined,
          // TODO: keep typeOnly
          false,
          factory.createNamedExports(
            [
              ...exsitedSpecifiers,
              ...exportedIdentifiers.map((id) => {
                return factory.createExportSpecifier(
                  false,
                  undefined,
                  id
                  );
              })  
            ]
          ),
        );

        return factory.updateSourceFile(
          visited,
          [
            ...visited.statements,
            ...(needRewired ? [rewiredExportDeclaration] : []),
          ],
          visited.isDeclarationFile,
          visited.referencedFiles,
          visited.typeReferenceDirectives,
          visited.hasNoDefaultLib,
          visited.libReferenceDirectives,
        );
      }
      return node;
    }
    return visitNode(node, (node) => visit(node));
  }
}
