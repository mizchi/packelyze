import "./__vitestUtils";
import { expect, test } from "vitest";
import ts from "typescript";
import path from "node:path";

import { createIncrementalLanguageServiceHost, createIncrementalLanguageService } from "./services";

test("IncrementalLanguageService", () => {
  const projectPath = path.join(__dirname, "../examples");
  const registory = ts.createDocumentRegistry();
  const host = createIncrementalLanguageServiceHost(projectPath);
  const service = createIncrementalLanguageService(host, registory);
  // host.logger.on();
  // service.logger.on();

  const indexFilePath = "src/index.ts";
  expect(service.getSemanticDiagnostics(indexFilePath).length).toBe(1);

  const s0 = service.getCurrentSourceFile(indexFilePath);
  expect(s0!.text).not.includes("const x: number = 1;");
  // console.log("--------------- write")
  service.writeSnapshotContent("src/index.ts", "const x: number = 1;");
  // console.log("---------------- diagnostics");

  // force load
  const s1 = service.getCurrentSourceFile(indexFilePath);
  expect(s1!.text).includes("const x: number = 1;");

  // console.log("---------------- changes");
  expect(host.getScriptVersion(indexFilePath)).toBe("1");
  // service.logger.on();
  // host.logger.on();
  service.writeSnapshotContent("src/index.ts", "const x: number = 2;");

  const snap1 = service.readSnapshot(indexFilePath)!;
  expect(snap1.loaded).toBeFalsy();
  expect(service.readSnapshotContent(indexFilePath)).toBe("const x: number = 2;");
  // multi write and skip intermediate one
  // console.log("------ write and skip")
  service.writeSnapshotContent(indexFilePath, "const x: number = 3;");
  const s2 = service.readSnapshot(indexFilePath)!;

  service.writeSnapshotContent(indexFilePath, "const x: number = 4;");
  const s3 = service.readSnapshot(indexFilePath)!;
  expect(s3.getText(0, s3.getLength())).toBe("const x: number = 4;");
  expect(s2 === s3).toBe(false);

  const s4 = service.readSnapshot(indexFilePath)!;
  expect(s3 === s4).toBe(true);

  // create new file
  const newFilePath = service.normalizePath("src/new.ts");
  service.writeSnapshotContent(newFilePath, "const v: number = '';");
  const s5 = service.readSnapshot(newFilePath)!;
  expect(s5.getText(0, s5.getLength())).toBe("const v: number = '';");
  const source = service.getCurrentSourceFile(newFilePath);
  expect(source!.text).toBe("const v: number = '';");
  expect(service.getSemanticDiagnostics(newFilePath).length).toBe(1);

  // create file under virtual directory
  {
    const nestedNewFilePath = service.normalizePath("src/nested/new.ts");
    const nestedNew2FilePath = service.normalizePath("src/nested/new2.ts");

    // console.log("-----------");
    service.writeSnapshotContent(nestedNewFilePath, "const w: number = '';");
    service.writeSnapshotContent(nestedNew2FilePath, "const z: number = '';");

    const dirname = service.normalizePath("src/nested");
    expect(host.directoryExists!(dirname)).toBe(true);

    expect(host.readDirectory!(dirname)).toEqualSet(["new.ts", "new2.ts"]);

    const s5 = service.readSnapshot(nestedNewFilePath)!;
    expect(s5.getText(0, s5.getLength())).toBe("const w: number = '';");
    const source = service.getCurrentSourceFile(nestedNewFilePath);
    expect(source!.text).toBe("const w: number = '';");
    expect(service.getSemanticDiagnostics(nestedNewFilePath).length).toBe(1);
  }
});

test("IncrementalLanguageService: reuse last state", () => {
  const projectPath = path.join(__dirname, "../examples");
  const registory = ts.createDocumentRegistry();
  const host1 = createIncrementalLanguageServiceHost(projectPath);
  const service1 = createIncrementalLanguageService(host1, registory);

  service1.writeSnapshotContent("src/index.ts", "const x: number = 1;");

  // console.time("recreate with cache");
  const host2 = createIncrementalLanguageServiceHost(projectPath, undefined, undefined, host1);
  // console.timeEnd("recreate with cache");
  const service2 = createIncrementalLanguageService(host2, registory);
  const reused = service2.getCurrentSourceFile("src/index.ts");
  expect(reused!.text).toBe("const x: number = 1;");

  // --- new
  // console.time("recreate without cache");
  const host3 = createIncrementalLanguageServiceHost(projectPath);
  // console.timeEnd("recreate without cache");
  const service3 = createIncrementalLanguageService(host3, registory);
  const reused2 = service3.getCurrentSourceFile("src/index.ts");
  expect(reused2!.text).not.toBe("const x: number = 1;");
});
