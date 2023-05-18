import ts from "typescript";

export function isHiddenMemberOfClass(
  node: ts.MethodDeclaration | ts.PropertyDeclaration,
) {
  const hasPrivateKeyword = node.modifiers?.some((m) => {
    return m.kind === ts.SyntaxKind.PrivateKeyword;
  });
  return hasPrivateKeyword || ts.isPrivateIdentifier(node.name!);
}

export const collectReservedProperties = (root: ts.Node, debug: boolean = false) => {
  const debugLog = (...args: any) => {
    if (debug) {
      console.log(...args);
    }
  };
  const reserved_props: Set<string> = new Set();
  const _traverse = (node: ts.Node, depth: number = 0) => {
    const prefix = " ".repeat(depth * 2);
    const prefix1 = " ".repeat((depth + 1) * 2);
    // module X { class x = 1; }
    const underModule = node.parent &&
      ts.isModuleBlock(node.parent);
    debugLog(prefix, "[", ts.SyntaxKind[node.kind], "]", !!underModule);

    // console.log(prefix, "isParentModule", isParentModule);
    // TODO: internal module

    if (ts.isModuleDeclaration(node)) {
      if (node.name) {
        debugLog(prefix1, "-module:", node.name.getText());
        reserved_props.add(node.name?.getText() ?? "");
      }
    }

    if (ts.isVariableStatement(node) && underModule) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          debugLog(prefix1, "-module-variable:", decl.name.getText());
          reserved_props.add(decl.name?.getText() ?? "");
        }
      }
      // console.log(node);
      // throw "stop";
      // if (nod ts.isIdentifier(node.initializer) {

      // }
      // if (node.name) {
      //   debugLog(prefix1, "module-variable:", node.name.getText());
      //   // reserved_props.add(node.name?.getText() ?? "");
      // }
    }

    if (ts.isTypeLiteralNode(node)) {
      node.members.forEach((member) => {
        if (ts.isPropertySignature(member)) {
          debugLog(prefix1, "-property:", member.name?.getText());
          reserved_props.add(member.name?.getText() ?? "");
        }
        // member.name
      });
    }
    if (ts.isInterfaceDeclaration(node)) {
      node.members.forEach((member) => {
        if (ts.isMethodSignature(member)) {
          debugLog(prefix1, "-method:", member.name?.getText());
          reserved_props.add(member.name?.getText() ?? "");
        }
        if (ts.isPropertySignature(member)) {
          debugLog(prefix1, "-property:", member.name?.getText());
          reserved_props.add(member.name?.getText() ?? "");
        }
      });
      if (underModule) {
        if (node.name) {
          debugLog(prefix1, "-interface:", node.name.getText());
          reserved_props.add(node.name?.getText() ?? "");
        }
      }
    }
    if (ts.isTypeAliasDeclaration(node)) {
      if (underModule) {
        if (node.name) {
          debugLog(prefix1, "-typeAlias:", node.name.getText());
          reserved_props.add(node.name?.getText() ?? "");
        }
      }
    }

    if (ts.isClassDeclaration(node)) {
      node.members.forEach((member) => {
        if (ts.isMethodDeclaration(member)) {
          if (!isHiddenMemberOfClass(member)) {
            debugLog(prefix1, "-method:", member.name?.getText());
            reserved_props.add(member.name?.getText() ?? "");
          }
        }
        if (ts.isPropertyDeclaration(member)) {
          const hidden = isHiddenMemberOfClass(member);
          debugLog(
            prefix,
            "-property:",
            member.name?.getText(),
            hidden,
          );
          if (!hidden) {
            reserved_props.add(member.name?.getText() ?? "");
          }
        }
        // member.name
      });

      if (underModule) {
        if (node.name) {
          debugLog(prefix1, "-class:", node.name.getText());
          reserved_props.add(node.name?.getText() ?? "");
        }
      }
    }

    // terser will mangle exported names
    // if (ts.isExportDeclaration(node)) {
    //   if (ts.isNamedExports(node.exportClause!)) {
    //     for (const element of node.exportClause.elements) {
    //       debugLog("exports", element.name?.getText());
    //       reserved_keys.add(element.name?.getText());
    //     }
    //   }
    // }

    ts.forEachChild(node, (node) => {
      _traverse(node, depth + 1);
    });
  };
  _traverse(root);
  return reserved_props;
};
