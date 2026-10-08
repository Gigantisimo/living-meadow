import { mkdir, copyFile, readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const project = resolve(".");
const release = resolve("release");
await mkdir(release, { recursive: true });
// The thumbnail must be captured from the actual final scene before shipping.
await stat(resolve("public/thumbnail.jpg"));
for (const file of ["README.md", "LICENSE", "TEST-REPORT.md", "QA.md"])
  await copyFile(resolve(file), resolve("dist", file));
const threeLicense = await readFile(
  resolve("node_modules/three/LICENSE"),
  "utf8",
);
await writeFile(
  resolve("dist/THIRD-PARTY-LICENSES.txt"),
  "Three.js 0.180.0\nhttps://threejs.org\n\n" + threeLicense,
  "utf8",
);
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
function archive(paths, destination) {
  const command = `$ErrorActionPreference = 'Stop'; Compress-Archive -LiteralPath ${paths.map(quote).join(",")} -DestinationPath ${quote(destination)} -Force`;
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { cwd: project, windowsHide: true, encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(
      result.stderr || result.stdout || "Archive creation failed",
    );
}
archive(
  [
    "index.html",
    "LivelyInfo.json",
    "LivelyProperties.json",
    "thumbnail.jpg",
    "README.md",
    "LICENSE",
    "THIRD-PARTY-LICENSES.txt",
    "TEST-REPORT.md",
    "QA.md",
  ].map((f) => resolve("dist", f)),
  resolve(release, "Living-Meadow-Lively.zip"),
);
archive(
  [
    "src",
    "public",
    "tests",
    "scripts",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html",
    "README.md",
    "LICENSE",
    "QA.md",
    "TEST-REPORT.md",
    ".gitignore",
  ].map((f) => resolve(f)),
  resolve(release, "Living-Meadow-Source.zip"),
);
console.log(
  "Created release/Living-Meadow-Lively.zip and release/Living-Meadow-Source.zip",
);
archive(
  [
    "morning-desktop.png",
    "golden-desktop.png",
    "night-desktop.png",
    "Night-brush.png",
    "Night-rising-fireflies.png",
    "Birds-flight.png",
    "browser-report.json",
    "lifecycle-report.json",
  ].map((file) => resolve("artifacts", file)),
  resolve(release, "Living-Meadow-Screenshots.zip"),
);
