import ts from "typescript";

const hasModifier = (
  modifiers: ts.NodeArray<ts.ModifierLike> | undefined,
  predicate: ts.SyntaxKind,
): boolean => !!modifiers?.some((m) => m.kind === predicate);

function transformCstrToNewFunc(
  cstr: ts.ConstructorDeclaration | undefined,
  decl: ts.ClassDeclaration | ts.ClassExpression,
  rewriteInternal: (node: ts.Node) => ts.Node,
  givenName: ts.Identifier | undefined = undefined,
): ts.FunctionDeclaration {
  const className = decl.name?.getText() ?? givenName?.getText() ??
    "_AnonymousClass";
  const properties = decl.members.filter((t) =>
    ts.isPropertyDeclaration(t) &&
    !hasModifier(t.modifiers, ts.SyntaxKind.StaticKeyword)
  ) as ts.PropertyDeclaration[];

  const getters = decl.members.filter((t) =>
    ts.isGetAccessorDeclaration(t) &&
    !hasModifier(t.modifiers, ts.SyntaxKind.StaticKeyword)
  ) as ts.GetAccessorDeclaration[];

  const setters = decl.members.filter((t) =>
    ts.isSetAccessorDeclaration(t) &&
    !hasModifier(t.modifiers, ts.SyntaxKind.StaticKeyword)
  ) as ts.SetAccessorDeclaration[];

  const classCstr = decl.members.find((t) => ts.isConstructorDeclaration(t)) as
    | ts.ConstructorDeclaration
    | undefined;

  const classCstrInitializers = classCstr?.parameters.filter((t) => {
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
  }) ?? [];

  const thisAssignStatements = cstr?.body?.statements.filter((stmt) => {
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
  }) ?? [];

  /**
    convert constructor body
      {
        this.x = x;
        this.y = y;
        // ...body
      }

      {
        const self = { x, y };
        // ...body
        return self
      }
   */
  const transformedBody = ts.factory.updateBlock(
    cstr?.body ?? ts.factory.createBlock([]),
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
                [
                  ...getters.map((g) => {
                    if (!ts.isIdentifier(g.name)) {
                      throw new Error(
                        `Not supported: ${
                          ts.SyntaxKind[g.name.kind]
                        } as getter`,
                      );
                    }
                    return ts.factory.createGetAccessorDeclaration(
                      [],
                      g.name,
                      g.parameters,
                      g.type,
                      g.body,
                    );
                  }),
                  ...setters.map((g) => {
                    if (!ts.isIdentifier(g.name)) {
                      throw new Error(
                        `Not supported: ${
                          ts.SyntaxKind[g.name.kind]
                        } as getter`,
                      );
                    }
                    return ts.factory.createSetAccessorDeclaration(
                      [],
                      g.name,
                      g.parameters,
                      g.body,
                    );
                  }),
                  ...properties.map((p) => {
                    if (p.initializer) {
                      return ts.factory.createPropertyAssignment(
                        p.name,
                        p.initializer,
                      );
                    }
                    for (const stmt of thisAssignStatements) {
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
      ...(
        cstr?.body
          ? [
            ...cstr.body.statements.filter((stmt) => {
              return !thisAssignStatements.includes(stmt);
            }),
          ]
          : []
      ),
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
    cstr?.parameters.map((p) => {
      return ts.factory.createParameterDeclaration(
        [],
        p.dotDotDotToken,
        p.name,
        p.questionToken,
        p.type,
        p.initializer,
      );
    }) ?? [],
    ts.factory.createTypeReferenceNode(
      ts.factory.createIdentifier(className),
    ),
    rewriteInternal(transformedBody) as ts.Block,
  );
}

function classToTypeAliasAndFunctions(
  ctx: ts.TransformationContext,
  transformed: Map<
    string,
    ts.ClassDeclaration | ts.ClassExpression
  >,
  node: ts.ClassDeclaration | ts.ClassExpression,
  givenName: ts.Identifier | undefined = undefined,
) {
  const resolvedClassName = node.name?.getText() ?? givenName?.getText() ??
    "_AnonymousClass";

  const properties = node.members.filter((t) =>
    ts.isPropertyDeclaration(t) &&
    !hasModifier(t.modifiers, ts.SyntaxKind.StaticKeyword)
  ) as ts.PropertyDeclaration[];

  const staticProperties = node.members.filter((t) =>
    ts.isPropertyDeclaration(t) &&
    hasModifier(t.modifiers, ts.SyntaxKind.StaticKeyword)
  ) as ts.PropertyDeclaration[];

  const methods = node.members.filter((t) =>
    ts.isMethodDeclaration(t) &&
    !hasModifier(t.modifiers, ts.SyntaxKind.StaticKeyword)
  ) as ts.MethodDeclaration[];

  const staticMethods = node.members.filter((t) =>
    ts.isMethodDeclaration(t) &&
    hasModifier(t.modifiers, ts.SyntaxKind.StaticKeyword)
  ) as ts.MethodDeclaration[];

  const getters = node.members.filter((t) =>
    ts.isGetAccessorDeclaration(t) &&
    !hasModifier(t.modifiers, ts.SyntaxKind.StaticKeyword)
  ) as ts.GetAccessorDeclaration[];

  const setters = node.members.filter((t) =>
    ts.isSetAccessorDeclaration(t) &&
    !hasModifier(t.modifiers, ts.SyntaxKind.StaticKeyword)
  ) as ts.SetAccessorDeclaration[];

  const classCstr = node.members.find((t) => ts.isConstructorDeclaration(t)) as
    | ts.ConstructorDeclaration
    | undefined;

  const classCstrInitializers = classCstr?.parameters.filter((t) => {
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
  }) ?? [];

  const classDecl = node;

  const scopeRewriter = <T extends ts.Node>(node: T): ts.Node => {
    if (ts.isFunctionDeclaration(node)) {
      return node;
    }
    if (ts.isGetAccessorDeclaration(node)) {
      return node;
    }
    if (ts.isSetAccessorDeclaration(node)) {
      return node;
    }
    // new Foo() => Foo$new()
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === classDecl.name!.text
    ) {
      return ts.factory.createCallExpression(
        ts.factory.createIdentifier(`${resolvedClassName}$new`),
        node.typeArguments,
        node.arguments,
      );
    }
    // this.foo(arg) => Class$foo(self, arg)
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
      const className = classDecl.name?.getText()!;
      const caller = node.expression.name.text;
      const isCallerStatic = staticMethods.some((m) => {
        return m.name.getText() === caller;
      });
      return ts.factory.createCallExpression(
        ts.factory.createIdentifier(
          isCallerStatic
            ? `${className}$static$${caller}`
            : `${className}$${caller}`,
        ),
        node.typeArguments,
        isCallerStatic ? node.arguments : [
          ts.factory.createIdentifier("self"),
          ...node.arguments,
        ],
      );
    }
    if (node.kind === ts.SyntaxKind.ThisKeyword) {
      return ts.factory.createIdentifier("self");
    }
    return ts.visitEachChild(node, scopeRewriter, ctx);
  };

  const transformedTypeLiteral = ts.factory.createTypeLiteralNode([
    ...getters.map((p) => {
      return ts.factory.createGetAccessorDeclaration(
        [],
        p.name,
        p.parameters,
        p.type,
        undefined,
      );
    }),

    ...setters.map((p) => {
      return ts.factory.createSetAccessorDeclaration(
        [],
        p.name,
        p.parameters,
        undefined,
      );
    }),

    ...properties.map((p) => {
      return ts.factory.createPropertySignature(
        // [],
        p.modifiers?.filter((m) => {
          return [ts.SyntaxKind.ReadonlyKeyword].includes(m.kind);
        }) as ts.Modifier[] ?? [],
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
  ]);

  return [
    // class static property
    ...staticProperties.map((staticProperty) => {
      return ts.factory.createVariableStatement(
        hasModifier(
            staticProperty.modifiers,
            ts.SyntaxKind.PrivateKeyword,
          )
          ? []
          : [
            ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
          ],
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              ts.factory.createIdentifier(
                `${resolvedClassName}$static$${staticProperty.name.getText()}`,
              ),
              undefined,
              staticProperty.type,
              staticProperty.initializer
                ? scopeRewriter(
                  staticProperty.initializer,
                ) as ts.Expression
                : undefined,
            ),
          ],
          ts.NodeFlags.Const,
        ),
      );
    }),
    // class static method
    ...staticMethods.map((staticMethod) => {
      return ts.factory.createFunctionDeclaration(
        hasModifier(
            staticMethod.modifiers,
            ts.SyntaxKind.PrivateKeyword,
          )
          ? []
          : [
            ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
          ],
        staticMethod.asteriskToken,
        ts.factory.createIdentifier(
          `${resolvedClassName}$static$${staticMethod.name.getText()}`,
        ),
        staticMethod.typeParameters,
        staticMethod.parameters,
        staticMethod.type,
        staticMethod.body && scopeRewriter(staticMethod.body) as ts.Block,
      );
    }),

    // export type Class = {...}
    ts.factory.createTypeAliasDeclaration(
      node &&
        hasModifier(node.modifiers, ts.SyntaxKind.ExportKeyword)
        ? [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)]
        : [],
      resolvedClassName,
      node.typeParameters,
      node.heritageClauses
        ? ts.factory.createIntersectionTypeNode([
          transformedTypeLiteral,
          ...node.heritageClauses.map((h) => {
            return h.types.map((t) => {
              if (!ts.isIdentifier(t.expression)) {
                throw new Error(
                  `Not supported: ${ts.SyntaxKind[t.expression.kind]}`,
                );
              }
              if (!transformed.has(t.expression.text)) {
                throw new Error(
                  `Not supported: extends to outer symbol - ${t.expression.text}`,
                );
              }
              return ts.factory.createTypeReferenceNode(
                t.expression,
                t.typeArguments,
              );
            });
          }).flat(),
        ])
        : transformedTypeLiteral,
    ),
    // Constructor
    transformCstrToNewFunc(
      classCstr,
      node,
      scopeRewriter,
      givenName,
    ),
    ...methods.map((m) => {
      if (!ts.isIdentifier(m.name)) {
        throw new Error(`Not supported: ${ts.SyntaxKind[m.name.kind]}`);
      }

      // const vars = checker.getSymbolsInScope(
      //   node.getSourceFile(),
      //   ts.SymbolFlags.Variable,
      // );
      // const vars: [] = [];
      // console.log("vars", node.getSourceFile(), vars.map((v) => v.name));
      // console.log(node.getSy)

      const name = m.name.text === "constructor" ? "new" : m.name.text;
      const fname = ts.factory.createIdentifier(
        `${resolvedClassName}$${name}`,
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
              ts.factory.createIdentifier(node.name!.text),
            ),
          ),
          ...m.parameters,
        ],
        m.type,
        m.body && scopeRewriter(m.body) as ts.Block,
      );
    }),
  ];
}

export const declassTransformerFactory: ts.TransformerFactory<ts.SourceFile> = (
  ctx,
) => {
  // TODO: use program to get type and scope information
  // const host = ts.createCompilerHost(context.getCompilerOptions(), true);
  // const program = ts.createProgram({
  //   rootNames: ["input.ts"],
  //   options: context.getCompilerOptions(),
  //   host,
  // });

  // const checker = program.getTypeChecker();
  return ((sourceFile: ts.SourceFile) => {
    const transformedClasses: Map<
      string,
      ts.ClassDeclaration | ts.ClassExpression
    > = new Map();
    const visitor: ts.Visitor = (node: ts.Node) => {
      // is this keyword
      if (node.kind === ts.SyntaxKind.ThisKeyword) {
        return ts.factory.createIdentifier("self");
      }
      // detect: const x = class {}
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (
            decl.initializer && ts.isIdentifier(decl.name) &&
            ts.isClassExpression(decl.initializer)
          ) {
            const className = decl.name.getText();
            const transformed = classToTypeAliasAndFunctions(
              ctx,
              transformedClasses,
              decl.initializer,
              decl.name,
            );
            transformedClasses.set(className, decl.initializer);
            return transformed;
          }
        }
      }
      if (ts.isClassDeclaration(node)) {
        const transformed = classToTypeAliasAndFunctions(
          ctx,
          transformedClasses,
          node,
        );
        transformedClasses.set(node.name!.getText(), node);
        return transformed;
      }
      return ts.visitEachChild(node, visitor, ctx);
    };
    return ts.visitNode(sourceFile, visitor);
  }) as any;
};

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;

  const print = (code: string) => {
    const source = ts.createSourceFile(
      "input.ts",
      code,
      ts.ScriptTarget.ES2019,
      true,
    );

    const transformed = ts.transform(source, [
      declassTransformerFactory,
    ]);

    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
    });
    const result = printer.printFile(
      transformed.transformed[0],
    );
    return result;
  };
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
    const result = print(code);
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

  test("transform with readonly", () => {
    const code = `// input
export class Value {
  readonly v: number;
  constructor(v: number) {
    this.v = v;
  }
}
`;
    const result = print(code);
    // console.log(result);
    expect(result).toBe(`export type Value = {
    readonly v: number;
};
export function Value$new(v: number): Value {
    const self: Value = { v: v };
    return self;
}
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
    const result = print(code);

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
    const result = print(code);

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

  test("transform with static", () => {
    const code = `// input
export class X {
  static v = 1;
  static x() {
    this.y();
  }
  static y() {}
  constructor() {}
}
`;

    const result = print(code);

    // console.log(result);
    expect(result).toBe(`export const X$static$v = 1;
export function X$static$x() {
    X$static$y();
}
export function X$static$y() { }
export type X = {};
export function X$new(): X { const self: X = {}; return self; }
`);
  });

  test("transform with getter/settre", () => {
    const code = `// input
export class X {
  get v() {
    return this._v;
  },
  set v(v) {
    this._v = v;
  }
  constructor(private _v: number) {}
}
`;
    const result = print(code);

    // console.log(result);
    expect(result).toBe(`export type X = {
    get v();
    set v(v);
    _v: number;
};
export function X$new(_v: number): X { const self: X = { get v() {
        return this._v;
    }, set v(v) {
        this._v = v;
    }, _v: _v }; return self; }
`);
  });

  test("transform with getter/setter", () => {
    const code = `// input
export class X {
  const x: number = 1;
}
`;
    const result = print(code);

    expect(result).toBe(`export type X = {
    x: number;
};
export function X$new(): X { const self: X = { x: 1 }; return self; }
`);
  });

  test("transform with class expression assignment", () => {
    const code = `// input
export const Class = class {
  constructor(public x: number, public y: number) {}
}
console.log(1);
`;
    const result = print(code);

    // TODO: support super to `self = {...Other$new(), ...}`
    expect(result).toBe(`type Class = {
    x: number;
    y: number;
};
function Class$new(x: number, y: number): Class { const self: Class = { x: x, y: y }; return self; }
console.log(1);
`);
  });

  test("transform with extend", () => {
    const code = `// input
export class Position {
  constructor(public x: number, public y: number) {}
}
export class Entity extends Position {
  getPosition(): Position {
    return this;
  }
}
`;
    const result = print(code);
    // console.log(result);
    expect(result).toBe(`export type Position = {
    x: number;
    y: number;
};
export function Position$new(x: number, y: number): Position { const self: Position = { x: x, y: y }; return self; }
export type Entity = {} & Position;
export function Entity$new(): Entity { const self: Entity = {}; return self; }
export function Entity$getPosition(self: Entity): Position {
    return self;
}
`);
  });

  test("throw error to outside class extends", () => {
    try {
      const code = `// input
      class X extends External {
        constructor(public x: number, public y: number) {}
      }
      `;
      const _result = print(code);
      throw new Error("unreachable");
    } catch (err) {
      if (err instanceof Error) {
        expect(err.message).toBe(
          "Not supported: extends to outer symbol - External",
        );
      } else {
        throw err;
      }
    }
  });

  test("transform with extend", () => {
    const code = `// input
export class Position {
  constructor(public x: number, public y: number) {}
}
export class Entity extends Position {
  getPosition(): Position {
    return this;
  }
}
`;
    const result = print(code);
    // console.log(result);
    expect(result).toBe(`export type Position = {
    x: number;
    y: number;
};
export function Position$new(x: number, y: number): Position { const self: Position = { x: x, y: y }; return self; }
export type Entity = {} & Position;
export function Entity$new(): Entity { const self: Entity = {}; return self; }
export function Entity$getPosition(self: Entity): Position {
    return self;
}
`);
  });
}
