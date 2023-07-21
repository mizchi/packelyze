import ts from "typescript";
import { IncrementalLanguageService } from "./services";
import { getNodeAtRange } from "./tsUtils";

const MAX_UNCHANGED_COUNT = 10;

export function deleteUnusedInProjectUntilNoErrors(service: IncrementalLanguageService) {
  let unchangedCount = 0;

  let lastErrorCount = 0;
  while (true) {
    const program = service.getProgram()!;
    const diagnostics = program.getSemanticDiagnostics();
    if (diagnostics.length === 0) {
      break;
    }
    if (diagnostics.length === lastErrorCount) {
      unchangedCount++;
      if (unchangedCount >= MAX_UNCHANGED_COUNT) {
        break;
      }
    }
    lastErrorCount = diagnostics.length;
    deleteUnusedInProject(service);
  }
}

export function deleteUnusedInProject(service: IncrementalLanguageService) {
  const program = service.getProgram()!;
  const diagnostics = program.getSemanticDiagnostics();
  const ranges = diagnostics.map((d) => {
    return {
      file: d.file!,
      start: d.start!,
      end: d.start! + d.length!,
    };
  });
  // console.log(ranges.map((r) => r.code));
  const files = [...new Set(diagnostics.map((d) => d.file!))];
  for (const file of files) {
    const rangesforFiles = ranges.filter((r) => r.file === file);
    const unusedNodes = rangesforFiles
      .map((r) => getNodeAtRange(file, r.start, r.end))
      .filter((x) => x !== undefined) as ts.Node[];

    const finalUnusedNodes: ts.Node[] = [];
    for (const node of unusedNodes) {
      // TODO: check rhs expression is pure
      if (ts.isVariableDeclaration(node.parent)) {
        if (node.parent?.parent?.parent && ts.isVariableStatement(node.parent.parent.parent)) {
          finalUnusedNodes.push(node.parent.parent.parent);
        }
      }
      if (ts.isParameter(node.parent)) {
        finalUnusedNodes.push(node.parent);
      }
    }
    const transformer: ts.TransformerFactory<any> = (context) => {
      return (node) => {
        const visit: ts.Visitor = (node) => {
          if (finalUnusedNodes.includes(node)) {
            return undefined;
          }
          return ts.visitEachChild(node, visit, context);
        };
        return ts.visitNode(node, visit);
      };
    };
    const transformed = ts.transform(file, [transformer]).transformed[0] as ts.SourceFile;
    const printer = ts.createPrinter();
    const updatedCode = printer.printFile(transformed);
    service.writeSnapshotContent("index.ts", updatedCode);
  }
}
