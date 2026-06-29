#!/usr/bin/env node

const { createRequire } = require("node:module");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const consumerRequire = createRequire(`${process.cwd()}/apps/mesas/backend/package.json`);

const requiredSubpaths = [
  "@artificio/config",
  "@artificio/config/secret-crypto",
  "@artificio/media",
  "@artificio/changelog",
];

function hasRequireCondition(exportsMap, subpath) {
  const entry = exportsMap?.[subpath];
  return Boolean(entry && typeof entry === "object" && typeof entry.require === "string");
}

function assertManifestHasRequireConditions(pkgName, subpaths) {
  const packageDir = pkgName.replace("@artificio/", "");
  const manifest = JSON.parse(readFileSync(join(process.cwd(), "packages", packageDir, "package.json"), "utf8"));
  for (const subpath of subpaths) {
    if (!hasRequireCondition(manifest.exports, subpath)) {
      throw new Error(`${pkgName}${subpath === "." ? "" : subpath.slice(1)} sem condição "require" em exports`);
    }
  }
}

function runRuntimeSmoke() {
  for (const id of requiredSubpaths) {
    consumerRequire(id);
    console.log(`ok require(${id})`);
  }
}

function runRegressionProof() {
  const brokenExports = {
    ".": {
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    },
    "./secret-crypto": {
      types: "./dist/secretCrypto.d.ts",
      import: "./dist/secretCrypto.js",
    },
  };

  if (hasRequireCondition(brokenExports, ".") || hasRequireCondition(brokenExports, "./secret-crypto")) {
    throw new Error("fixture de regressão inválida");
  }

  try {
    for (const subpath of [".", "./secret-crypto"]) {
      if (!hasRequireCondition(brokenExports, subpath)) {
        throw new Error(`@artificio/config${subpath === "." ? "" : subpath.slice(1)} sem condição "require" em exports`);
      }
    }
  } catch (error) {
    console.log(`ok regressão detectada: ${error.message}`);
    return;
  }

  throw new Error("regressão DEB-048-36 não foi detectada");
}

assertManifestHasRequireConditions("@artificio/config", [".", "./secret-crypto"]);
assertManifestHasRequireConditions("@artificio/media", ["."]);
assertManifestHasRequireConditions("@artificio/changelog", ["."]);
runRuntimeSmoke();

if (process.argv.includes("--prove-regression")) {
  runRegressionProof();
}
