import { forEachChild, Node, SourceFile, SyntaxKind, TypeChecker, Type, TypeFlags } from "typescript";

// from typescript: https://github.com/microsoft/TypeScript/blob/d79ec186d6a4e39f57af6143761d453466a32e0c/src/compiler/program.ts#L3384-L3399
export function getNodeAtPosition(
  sourceFile: SourceFile,
  position: number,
): Node {
  let current: Node = sourceFile;
  const getContainingChild = (child: Node) => {
    if (
      child.pos <= position &&
      (position < child.end ||
        (position === child.end && (child.kind === SyntaxKind.EndOfFileToken)))
    ) {
      return child;
    }
  };
  while (true) {
    const child = forEachChild(current, getContainingChild);
    if (!child) {
      return current;
    }
    current = child;
  }
}

/**
 * Traverse type and call visitor function for each type.
 */
export function createTypeVisitor(checker: TypeChecker, debug = false) {
  const debugLog = debug ? console.log : () => {};

  return (node: Type, visitor: (type: Type) => boolean | void, onRevisit?: (type: Type) => boolean | void ) => {
    const visitedTypes = new Set<Type>();
    // TODO: need symbol cache?
    return traverse(node, 0);

    function traverse(type: Type, depth = 0, force = false) {
      if (visitedTypes.has(type) && !force) {
        debugLog("  ".repeat(depth), "[Revisit]", checker.typeToString(type));
        const again = onRevisit?.(type);
        if (again) {
          traverse(type, depth, true);
        }
        return;
      }
      if (visitor(type) === true) {
        debugLog("  ".repeat(depth), "[Stopped]", checker.typeToString(type));
        return;
      }

      const typeString = checker.typeToString(type);
      debugLog(
        "  ".repeat(depth),
        "[Type]",
        typeString,
      );
  
      // Do not trace primitive types
      // const typeString = checker.typeToString(type);
      // TODO: check is primitive type by type flags
      const primitives = [
        "string",
        "number",
        "boolean",
        "void",
        "any",
        "unknown",
        "never",
        "undefined",
        "null",
        "symbol",
        "object",
        "bigint",
      ];
      // if (!(type.flags & TypeFlags.NonPrimitive)) {
      //   console.log("is non primitive", typeString);
      // }
      // TODO FIX liternal type detction
      if (primitives.includes(typeString)) {
        return;
      }
      if (typeString.startsWith('"')) {
        return;
      }
      if (type.aliasSymbol) {
        const aliasType = checker.getDeclaredTypeOfSymbol(type.aliasSymbol);
        traverse(aliasType, depth + 1);
      }
      if (type.aliasTypeArguments) {
        for (const typeArg of type.aliasTypeArguments) {
          traverse(typeArg);
        }
      }
      if (type.isUnion()) {
        for (const t of type.types) {
          debugLog("  ".repeat(depth + 1), "[Union]");
          traverse(t, depth + 1);
        }
      }
      if (type.isIntersection()) {
        for (const t of type.types) {
          debugLog("  ".repeat(depth + 1), "[Intersection]");
          traverse(t, depth + 1);
        }
      }
      for (const property of type.getProperties()) {
        if (property.valueDeclaration == null) {
          // TODO
          continue;
        }
        const propertyType = checker.getTypeOfSymbolAtLocation(property, property.valueDeclaration);
        debugLog("  ".repeat(depth + 1), "[Property]", property.name);
        traverse(propertyType, depth + 2);
      };

      if (type.pattern) {
      // TODO: Handle pattern?
        // type.pattern
      }
    }
  };
}