import ts from "typescript";

const hasModifier = (
  modifiers: ts.NodeArray<ts.ModifierLike>,
  predicate: ts.SyntaxKind,
) => modifiers?.some((m) => m.kind === predicate);

function transformCstrToNewFunc(
  cstr: ts.ConstructorDeclaration,
  decl: ts.ClassDeclaration,
  properties: ts.PropertyDeclaration[],
  classCstrInitializers: ts.ParameterDeclaration[],
  selfRewriter: (node: ts.Node) => ts.Node,
): ts.FunctionDeclaration {
  const className = cstr.parent.name.getText();

  const thisAssignments = cstr.body.statements.filter((stmt) => {
    if (
      ts.isExpressionStatement(stmt) &&
      ts.isBinaryExpression(stmt.expression) &&
      stmt.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(stmt.expression.left) &&
      stmt.expression.left.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
      return true;
    }
    return false;
  });

  const transformedBody = ts.factory.updateBlock(
    cstr.body,
    [
      ts.factory.createVariableStatement(
        [],
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              ts.factory.createIdentifier("self"),
              undefined,
              ts.factory.createTypeReferenceNode(
                ts.factory.createIdentifier(className),
                decl.typeParameters?.map((t) => {
                  return ts.factory.createTypeReferenceNode(t.name);
                }),
              ),
              ts.factory.createObjectLiteralExpression(
                // [],
                [
                  ...properties.map((p) => {
                    for (const stmt of thisAssignments) {
                      if (
                        ts.isExpressionStatement(stmt) &&
                        ts.isBinaryExpression(stmt.expression) &&
                        stmt.expression.operatorToken.kind ===
                          ts.SyntaxKind.EqualsToken &&
                        ts.isPropertyAccessExpression(stmt.expression.left) &&
                        stmt.expression.left.expression.kind ===
                          ts.SyntaxKind.ThisKeyword &&
                        ts.isIdentifier(stmt.expression.left.name) &&
                        ts.isIdentifier(p.name) &&
                        stmt.expression.left.name.text === p.name.text
                      ) {
                        return ts.factory.createPropertyAssignment(
                          p.name,
                          stmt.expression.right,
                        );
                      }
                    }
                    return ts.factory.createPropertyAssignment(
                      p.name,
                      ts.factory.createNull(),
                    );
                  }),
                  ...classCstrInitializers.map((p) => {
                    // for (const stmt of thisAssignments) {
                    if (!ts.isIdentifier(p.name)) {
                      throw new Error(
                        `Not supported: ${
                          ts.SyntaxKind[p.name.kind]
                        } as private initializer`,
                      );
                    }
                    return ts.factory.createPropertyAssignment(
                      p.name,
                      p.name,
                    );
                  }),
                ],
              ),
            ),
          ],
          ts.NodeFlags.Const,
        ),
      ),
      ...cstr.body.statements.filter((stmt) => {
        return !thisAssignments.includes(stmt);
      }),
      ts.factory.createReturnStatement(
        ts.factory.createIdentifier("self"),
      ),
    ],
  );

  return ts.factory.createFunctionDeclaration(
    hasModifier(decl.modifiers, ts.SyntaxKind.ExportKeyword)
      ? [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)]
      : [],
    undefined,
    ts.factory.createIdentifier(`${className}$new`),
    decl.typeParameters,
    cstr.parameters.map((p) => {
      return ts.factory.createParameterDeclaration(
        [],
        p.dotDotDotToken,
        p.name,
        p.questionToken,
        p.type,
        p.initializer,
      );
    }),
    ts.factory.createTypeReferenceNode(
      ts.factory.createIdentifier(className),
    ),
    selfRewriter(transformedBody) as ts.Block,
  );
}

export const declassTransformerFactory: ts.TransformerFactory<ts.SourceFile> = (
  context,
) => {
  return ((sourceFile: ts.SourceFile) => {
    const visitor: ts.Visitor = (node: ts.Node) => {
      // is this keyword
      if (node.kind === ts.SyntaxKind.ThisKeyword) {
        return ts.factory.createIdentifier("self");
      }

      if (ts.isClassDeclaration(node)) {
        const classProperties = node.members.filter((t) =>
          ts.isPropertyDeclaration(t)
        ) as ts.PropertyDeclaration[];

        const classMethods = node.members.filter((t) =>
          ts.isMethodDeclaration(t)
        ) as ts.MethodDeclaration[];

        const classCstr = node.members.find((t) =>
          ts.isConstructorDeclaration(t)
        ) as ts.ConstructorDeclaration;

        const classCstrInitializers = classCstr.parameters.filter((t) => {
          const isPrivate = hasModifier(
            t.modifiers,
            ts.SyntaxKind.PrivateKeyword,
          );
          const isPublic = hasModifier(
            t.modifiers,
            ts.SyntaxKind.PublicKeyword,
          );
          if (isPrivate || isPublic) {
            return true;
          }
          return false;
        });

        const selfRewriter = <T extends ts.Node>(node: T): ts.Node => {
          if (ts.isFunctionDeclaration(node)) {
            return node;
          }
          if (
            // this.func();
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.expression.kind === ts.SyntaxKind.ThisKeyword
          ) {
            const className = classCstr.parent.name.getText();
            return ts.factory.createCallExpression(
              ts.factory.createIdentifier(
                `${className}$${node.expression.name.text}`,
              ),
              node.typeArguments,
              [
                ts.factory.createIdentifier("self"),
                ...node.arguments,
              ],
            );
          }
          if (node.kind === ts.SyntaxKind.ThisKeyword) {
            return ts.factory.createIdentifier("self");
          }
          return ts.visitEachChild(node, selfRewriter, context);
        };

        return [
          ts.factory.createTypeAliasDeclaration(
            node &&
              hasModifier(node.modifiers, ts.SyntaxKind.ExportKeyword)
              ? [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)]
              : [],
            node.name,
            node.typeParameters,
            ts.factory.createTypeLiteralNode([
              ...classProperties.map((p) => {
                return ts.factory.createPropertySignature(
                  [],
                  p.name,
                  p.questionToken,
                  p.type,
                );
              }),
              ...classCstrInitializers.map((p) => {
                return ts.factory.createPropertySignature(
                  [],
                  p.name as ts.Identifier,
                  p.questionToken,
                  p.type,
                );
              }),
            ]),
          ),
          // Constructor
          // TODO: No constructor
          transformCstrToNewFunc(
            classCstr!,
            node,
            classProperties,
            classCstrInitializers,
            selfRewriter,
          ),
          ...classMethods.map((m) => {
            if (!ts.isIdentifier(m.name)) {
              throw new Error(`Not supported: ${ts.SyntaxKind[m.name.kind]}`);
            }

            const name = m.name.text === "constructor" ? "new" : m.name.text;
            const fname = ts.factory.createIdentifier(
              `${node.name.text}$${name}`,
            );
            return ts.factory.createFunctionDeclaration(
              hasModifier(m.modifiers, ts.SyntaxKind.PrivateKeyword)
                ? []
                : [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
              m.asteriskToken,
              fname,
              m.typeParameters,
              [
                ts.factory.createParameterDeclaration(
                  [],
                  undefined,
                  "self",
                  undefined,
                  ts.factory.createTypeReferenceNode(
                    ts.factory.createIdentifier(node.name.text),
                  ),
                ),
                ...m.parameters,
              ],
              m.type,
              selfRewriter(m.body) as ts.Block,
            );
          }),
        ];
      }
      return ts.visitEachChild(node, visitor, context);
    };
    return ts.visitNode(sourceFile, visitor);
  }) as any;
};

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;
  test("transform", () => {
    const code = `// input
export class Point {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    console.log("Point created", x, y);
  }
  distance(other: Point) {
    return Math.sqrt(Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2));
  }
}
export class Point3d {
  constructor(public x: number, public y: number, public z: number) {}
}
`;
    const source = ts.createSourceFile(
      "input.ts",
      code,
      ts.ScriptTarget.ES2019,
      true,
    );

    const thisTransformed = ts.transform(source, [
      declassTransformerFactory,
    ]);

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
    });
    const result = printer.printFile(
      thisTransformed.transformed[0],
    );
    // console.log(result);
    expect(result).toBe(`export type Point = {
    x: number;
    y: number;
};
export function Point$new(x: number, y: number): Point {
    const self: Point = { x: x, y: y };
    console.log("Point created", x, y);
    return self;
}
export function Point$distance(self: Point, other: Point) {
    return Math.sqrt(Math.pow(self.x - other.x, 2) + Math.pow(self.y - other.y, 2));
}
export type Point3d = {
    x: number;
    y: number;
    z: number;
};
export function Point3d$new(x: number, y: number, z: number): Point3d { const self: Point3d = { x: x, y: y, z: z }; return self; }
`);
  });

  test("transform with type parameter", () => {
    const code = `// input
export class X<T> {
  value: T;
  constructor(v: T) {
    this.value = v;
  }
}
`;
    const source = ts.createSourceFile(
      "input.ts",
      code,
      ts.ScriptTarget.ES2019,
      true,
    );

    const thisTransformed = ts.transform(source, [
      declassTransformerFactory,
    ]);

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
    });
    const result = printer.printFile(
      thisTransformed.transformed[0],
    );
    // console.log(result);
    expect(result).toBe(`export type X<T> = {
    value: T;
};
export function X$new<T>(v: T): X {
    const self: X<T> = { value: v };
    return self;
}
`);
  });
  test("transform with constructor public/private", () => {
    const code = `// input
export class C {
  constructor(private x: number) {}
}
`;
    const source = ts.createSourceFile(
      "input.ts",
      code,
      ts.ScriptTarget.ES2019,
      true,
    );

    const thisTransformed = ts.transform(source, [
      declassTransformerFactory,
    ]);

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
    });
    const result = printer.printFile(
      thisTransformed.transformed[0],
    );
    // console.log(result);
    expect(result).toBe(`export type C = {
    x: number;
};
export function C$new(x: number): C { const self: C = { x: x }; return self; }
`);
  });

  test("transform internal call other methods", () => {
    const code = `// input
export class C {
  constructor() {
    this.internal();
  }
  private internal() {}
}
`;
    const source = ts.createSourceFile(
      "input.ts",
      code,
      ts.ScriptTarget.ES2019,
      true,
    );

    const thisTransformed = ts.transform(source, [
      declassTransformerFactory,
    ]);

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
    });
    const result = printer.printFile(
      thisTransformed.transformed[0],
    );
    // console.log(result);
    expect(result).toBe(`export type C = {};
export function C$new(): C {
    const self: C = {};
    C$internal(self);
    return self;
}
function C$internal(self: C) { }
`);
  });
}
