// from: TypeScript/src/compiler/symbolWalker.ts

import ts from "typescript";
import { getOwnValues } from "../utils";
// import { toReadableSymbol } from "../nodeUtils";

export type SymbolWalkerVisited = {
  types: ts.Type[];
  symbols: ts.Symbol[];
};

// ---- TypeScript internal types ----

export interface SymbolWalker {
  /** Note: Return values are not ordered. */
  walkType(root: ts.Type): void;
  /** Note: Return values are not ordered. */
  walkSymbol(root: ts.Symbol): void;
  // additional
  getVisited(): SymbolWalkerVisited;
  clear(): void;
}

// An instantiated anonymous type has a target and a mapper
interface AnonymousType extends ts.ObjectType {
  target?: AnonymousType; // Instantiation target
  // mapper?: ts.TypeMapper;     // Instantiation mapper
  // instantiations?: Mapz<string, ts.Type>; // Instantiations of generic type alias (undefined if non-generic)
}
interface MappedType extends AnonymousType {
  declaration: ts.MappedTypeNode;
  typeParameter?: ts.TypeParameter;
  constraintType?: ts.Type;
  nameType?: ts.Type;
  templateType?: ts.Type;
  modifiersType?: ts.Type;
  resolvedApparentType?: ts.Type;
  containsError?: boolean;
}

interface TypeWithId extends ts.Type {
  // original hidden member
  id: number;
}
interface SymbolWithId extends ts.Symbol {
  // original hidden member
  id: number;
}

// rebuild symbolWalker with ts.TypeChecker
// with resolved types (expected)
// added: skip private/hard-private declaration in class
export function createGetSymbolWalker(checker: ts.TypeChecker, visited?: SymbolWalkerVisited) {
  return getSymbolWalker;
  function getSymbolWalker(accept: (symbol: ts.Symbol) => boolean = () => true): SymbolWalker {
    const visitedTypes: ts.Type[] = visited?.types ? [...visited.types] : []; // Sparse array from id to type
    const visitedSymbols: ts.Symbol[] = visited?.symbols ? [...visited.symbols] : []; // Sparse array from id to symbol
    // cached symbol id incrementer
    let symbolId = 0;

    return {
      clear: () => {
        clear(visitedTypes);
        clear(visitedSymbols);
      },
      getVisited: () => {
        return { types: getOwnValues(visitedTypes), symbols: getOwnValues(visitedSymbols) };
      },
      walkType: (type) => {
        visitType(type);
      },
      walkSymbol: (symbol) => {
        visitSymbol(symbol);
      },
    };

    function visitType(type: ts.Type | undefined): void {
      if (!type) {
        return;
      }

      if (visitedTypes[(type as TypeWithId).id]) {
        return;
      }
      visitedTypes[(type as TypeWithId).id] = type;

      // Reuse visitSymbol to visit the type's symbol,
      //  but be sure to bail on recuring into the type if accept declines the symbol.
      const shouldBail = visitSymbol(type.symbol);
      if (shouldBail) return;

      // Visit the type's related types, if any
      if (type.flags & ts.TypeFlags.Object) {
        const objectType = type as ts.ObjectType;
        const objectFlags = objectType.objectFlags;
        if (objectFlags & ts.ObjectFlags.Reference) {
          visitTypeReference(type as ts.TypeReference);
        }
        if (objectFlags & ts.ObjectFlags.Mapped) {
          visitMappedType(type as MappedType);
        }
        if (objectFlags & (ts.ObjectFlags.Class | ts.ObjectFlags.Interface)) {
          visitInterfaceType(type as ts.InterfaceType);
        }
        if (objectFlags & (ts.ObjectFlags.Tuple | ts.ObjectFlags.Anonymous)) {
          visitObjectType(objectType);
        }
      }
      if (type.flags & ts.TypeFlags.TypeParameter) {
        visitTypeParameter(type as ts.TypeParameter);
      }
      if (type.flags & ts.TypeFlags.UnionOrIntersection) {
        visitUnionOrIntersectionType(type as ts.UnionOrIntersectionType);
      }
      if (type.flags & ts.TypeFlags.Index) {
        visitIndexType(type as ts.IndexType);
      }
      if (type.flags & ts.TypeFlags.IndexedAccess) {
        visitIndexedAccessType(type as ts.IndexedAccessType);
      }
    }

    function visitTypeReference(type: ts.TypeReference): void {
      visitType(type.target);
      // forEach(getTypeArguments(type), visitType);
      forEach(type.typeArguments ?? [], visitType);
    }

    function visitTypeParameter(type: ts.TypeParameter): void {
      // const constraint = getConstraintOfTypeParameter(type);
      // visitType(getConstraintOfTypeParameter(type));

      // TODO: is it correct?
      const constraint = checker.getBaseConstraintOfType(type);
      visitType(constraint);
    }

    function visitUnionOrIntersectionType(type: ts.UnionOrIntersectionType): void {
      forEach(type.types, visitType);
    }

    function visitIndexType(type: ts.IndexType): void {
      visitType(type.type);
    }

    function visitIndexedAccessType(type: ts.IndexedAccessType): void {
      visitType(type.objectType);
      visitType(type.indexType);
      visitType(type.constraint);
    }

    function visitMappedType(type: MappedType): void {
      visitType(type.typeParameter);
      visitType(type.constraintType);
      visitType(type.templateType);
      visitType(type.modifiersType);
    }

    function visitSignature(signature: ts.Signature): void {
      const typePredicate = checker.getTypePredicateOfSignature(signature);
      if (typePredicate) {
        visitType(typePredicate.type);
      }
      forEach(signature.typeParameters, visitType);

      for (const parameter of signature.parameters) {
        visitSymbol(parameter);
      }
      // TODO: rest
      // visitType(getRestTypeOfSignature(signature));
      const returnType = checker.getReturnTypeOfSignature(signature);
      visitType(returnType);
    }

    function visitInterfaceType(interfaceT: ts.InterfaceType): void {
      visitObjectType(interfaceT);
      forEach(interfaceT.typeParameters, visitType);

      // forEach(getBaseTypes(interfaceT), visitType);
      const baseTypes = checker.getBaseTypes(interfaceT);
      forEach(baseTypes, visitType);
      visitType(interfaceT.thisType);

      // added: for class/interface implements
      if (interfaceT.symbol) {
        for (const decl of interfaceT.symbol.declarations ?? []) {
          if (decl && (ts.isClassDeclaration(decl) || ts.isInterfaceDeclaration(decl))) {
            for (const heritageClause of decl.heritageClauses ?? []) {
              for (const type of heritageClause.types) {
                const symbol = checker.getSymbolAtLocation(type.expression);
                visitSymbol(symbol);
              }
            }
          }
        }
      }
      // added: end
    }

    function visitObjectType(type: ts.ObjectType): void {
      const indexInfos = checker.getIndexInfosOfType(type);
      for (const info of indexInfos) {
        visitType(info.keyType);
        visitType(info.type);
      }

      const callSignatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
      for (const signature of callSignatures) {
        visitSignature(signature);
      }
      const constructSignatures = checker.getSignaturesOfType(type, ts.SignatureKind.Construct);
      for (const signature of constructSignatures) {
        visitSignature(signature);
      }
      for (const p of type.getProperties()) {
        // console.log("[skip:prop]", p.name, toReadableSymbol(p));
        if (isPrivateSignatureSymbol(p)) {
          // skip private declaration in class
          // console.log("[skip:prop]", p.name, toReadableSymbol(p));
        } else {
          visitSymbol(p);
        }
      }
    }

    function getSymbolId(symbol: SymbolWithId): number {
      if (symbol.id) return symbolId;
      (symbol as SymbolWithId).id = symbolId++;
      return symbolId;
    }

    function visitSymbol(symbol: ts.Symbol | undefined): boolean {
      if (!symbol) {
        return false;
      }
      // fix it

      const symbolId = getSymbolId(symbol as SymbolWithId);
      // const symbolId = (symbol as SymbolWithId).id;
      // console.log("visitSymbol", symbolId, symbol.name);
      if (visitedSymbols[symbolId]) {
        return false;
      }
      visitedSymbols[symbolId] = symbol;
      if (!accept(symbol)) {
        return true;
      }
      const t = checker.getTypeOfSymbol(symbol);
      visitType(t); // Should handle members on classes and such
      if (symbol.exports) {
        symbol.exports.forEach(visitSymbol);
      }
      forEach(symbol.declarations, (d) => {
        // Type queries are too far resolved when we just visit the symbol's type
        //  (their type resolved directly to the member deeply referenced)
        // So to get the intervening symbols, we need to check if there's a type
        // query node on any of the symbol's declarations and get symbols there
        if ((d as any).type && (d as any).type.kind === ts.SyntaxKind.TypeQuery) {
          const query = (d as any).type as ts.TypeQueryNode;
          // const entity = getResolvedSymbol(getFirstIdentifier(query.exprName));
          // visitSymbol(entity);
          const first = getFirstIdentifier(query.exprName);
          const symbol = checker.getSymbolAtLocation(first);
          visitSymbol(symbol);
        }
      });
      return false;
    }
  }
}

// from src/compiler/checker.ts
function getFirstIdentifier(node: ts.EntityNameOrEntityNameExpression): ts.Identifier {
  switch (node.kind) {
    case ts.SyntaxKind.Identifier:
      return node;
    case ts.SyntaxKind.QualifiedName:
      do {
        node = node.left;
      } while (node.kind !== ts.SyntaxKind.Identifier);
      return node;
    case ts.SyntaxKind.PropertyAccessExpression:
      do {
        node = node.expression;
      } while (node.kind !== ts.SyntaxKind.Identifier);
      return node;
  }
}

function clear(array: unknown[]): void {
  array.length = 0;
}

function forEach<T, U>(
  array: readonly T[] | undefined,
  callback: (element: T, index: number) => U | undefined,
): U | undefined {
  if (array) {
    for (let i = 0; i < array.length; i++) {
      const result = callback(array[i], i);
      if (result) {
        return result;
      }
    }
  }
  return undefined;
}

// added to skip private declaration in class
function isPrivateSignatureSymbol(symbol: ts.Symbol) {
  if (
    symbol.valueDeclaration &&
    (ts.isPropertyDeclaration(symbol.valueDeclaration) || ts.isMethodDeclaration(symbol.valueDeclaration))
  ) {
    // hard private #foo
    if (ts.isPrivateIdentifier(symbol.valueDeclaration.name)) {
      return true;
    }
    // private xxx;
    const hasPrivateKeyword = symbol.valueDeclaration.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword);
    return hasPrivateKeyword ?? false;
  }
  return false;
}
