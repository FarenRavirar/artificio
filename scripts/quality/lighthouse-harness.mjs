#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_URLS = [
  "https://beta.artificiorpg.com/",
  "https://glossariobeta.artificiorpg.com/",
  "https://mesasbeta.artificiorpg.com/",
];

const METRICS = [
  ["performance", "categories.performance.score"],
  ["accessibility", "categories.accessibility.score"],
  ["best-practices", "categories.best-practices.score"],
  ["seo", "categories.seo.score"],
  ["fcp", "audits.first-contentful-paint.numericValue"],
  ["lcp", "audits.largest-contentful-paint.numericValue"],
  ["tbt", "audits.total-blocking-time.numericValue"],
  ["cls", "audits.cumulative-layout-shift.numericValue"],
  ["speed-index", "audits.speed-index.numericValue"],
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function parseArgs(argv) {
  const options = {
    urls: DEFAULT_URLS,
    runs: 3,
    profiles: ["mobile", "desktop"],
    outDir: path.join(repoRoot, "artifacts", "lighthouse", timestamp()),
    dryRun: false,
    keepProfiles: false,
    skipExisting: false,
  };
  let urlsProvided = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (!argv[index]) throw new Error(`Valor ausente para ${arg}`);
      return argv[index];
    };

    if (arg === "--url" || arg === "--urls") {
      const urls = next().split(",").map((value) => value.trim()).filter(Boolean);
      options.urls = urlsProvided ? [...options.urls, ...urls] : urls;
      urlsProvided = true;
    } else if (arg === "--runs") {
      const runs = Number(next());
      if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs deve ser inteiro >= 1");
      options.runs = runs;
    } else if (arg === "--profile" || arg === "--profiles") {
      const profiles = next().split(",").map((value) => value.trim()).filter(Boolean);
      for (const profile of profiles) {
        if (!["mobile", "desktop"].includes(profile)) {
          throw new Error(`Profile invalido: ${profile}. Use mobile, desktop ou ambos.`);
        }
      }
      options.profiles = profiles;
    } else if (arg === "--out") {
      options.outDir = path.resolve(next());
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--keep-profiles") {
      options.keepProfiles = true;
    } else if (arg === "--skip-existing") {
      options.skipExisting = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Argumento desconhecido: ${arg}`);
    }
  }

  return options;
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function printHelp() {
  console.log(`Uso:
  pnpm quality:lighthouse [opcoes]

Opcoes:
  --url <lista>       URLs separadas por virgula. Default: betas publicos.
  --runs <n>          Repeticoes por URL/perfil. Default: 3.
  --profile <lista>   mobile,desktop. Default: ambos.
  --out <dir>         Diretorio de artefatos. Default: artifacts/lighthouse/<timestamp>.
  --dry-run           Mostra plano sem executar Lighthouse.
  --keep-profiles     Nao remove perfis temporarios de Chrome.
  --skip-existing     Reusa JSON existente e roda so relatorios faltantes.

Ambiente:
  LIGHTHOUSE_BIN      Binario/comando Lighthouse alternativo.
  CHROME_PATH         Chrome/Chromium usado pelo Lighthouse.
`);
}

function slugUrl(url) {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function commandForLighthouse() {
  if (process.env.LIGHTHOUSE_BIN) {
    return { command: process.env.LIGHTHOUSE_BIN, argsPrefix: [] };
  }
  if (process.platform === "win32") {
    const pnpmCli = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.cjs");
    if (existsSync(pnpmCli)) {
      return { command: process.execPath, argsPrefix: [pnpmCli, "exec", "lighthouse"] };
    }
  }
  return { command: "pnpm", argsPrefix: ["exec", "lighthouse"] };
}

function chromeFlags(userDataDir) {
  return [
    "--headless=new",
    "--disable-extensions",
    "--disable-default-apps",
    "--disable-component-extensions-with-background-pages",
    "--disable-background-networking",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${userDataDir}`,
  ].join(" ");
}

function lighthouseArgs(url, profile, outputBase, userDataDir) {
  const args = [
    url,
    "--output=json",
    "--output=html",
    `--output-path=${outputBase}`,
    "--save-assets",
    "--quiet",
    `--chrome-flags=${chromeFlags(userDataDir)}`,
  ];

  if (profile === "desktop") {
    args.push("--preset=desktop");
  }

  return args;
}

async function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      resolve(code ?? 1);
    });
  });
}

function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((current, key) => current?.[key], object);
}

function median(values) {
  const sorted = values.filter((value) => typeof value === "number").sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function readReport(reportBase) {
  const candidates = [
    `${reportBase}.report.json`,
    `${reportBase}.json`,
  ];
  const jsonPath = candidates.find((candidate) => existsSync(candidate));
  if (!jsonPath) {
    throw new Error(`JSON Lighthouse nao encontrado para ${reportBase}`);
  }
  const raw = await readFile(jsonPath, "utf8");
  const report = JSON.parse(raw);
  const metrics = Object.fromEntries(
    METRICS.map(([name, metricPath]) => [name, getPath(report, metricPath)]),
  );
  return { jsonPath, metrics };
}

function hasReport(reportBase) {
  return [`${reportBase}.report.json`, `${reportBase}.json`].some((candidate) => existsSync(candidate));
}

function summarizeRun({ url, profile, run, jsonPath, metrics }) {
  return {
    url,
    profile,
    run,
    jsonPath: path.relative(repoRoot, jsonPath).replaceAll("\\", "/"),
    metrics,
  };
}

function summarizeMedian(runs) {
  const metrics = {};
  for (const [name] of METRICS) {
    metrics[name] = median(runs.map((run) => run.metrics[name]));
  }
  return metrics;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const lighthouse = commandForLighthouse();

  console.log("Harness Lighthouse limpo");
  console.log(JSON.stringify({
    urls: options.urls,
    profiles: options.profiles,
    runs: options.runs,
    outDir: path.relative(repoRoot, options.outDir).replaceAll("\\", "/"),
    command: [lighthouse.command, ...lighthouse.argsPrefix].join(" "),
    dryRun: options.dryRun,
  }, null, 2));

  if (options.dryRun) return;

  await mkdir(options.outDir, { recursive: true });
  const summaries = [];

  for (const url of options.urls) {
    for (const profile of options.profiles) {
      const runSummaries = [];
      for (let run = 1; run <= options.runs; run += 1) {
        const userDataDir = await mkdtemp(path.join(tmpdir(), "artificio-lh-"));
        const reportBase = path.join(options.outDir, `${slugUrl(url)}-${profile}-run${run}`);
        const args = [
          ...lighthouse.argsPrefix,
          ...lighthouseArgs(url, profile, reportBase, userDataDir),
        ];

        try {
          console.log(`\n[${profile}] ${url} run ${run}/${options.runs}`);
          if (options.skipExisting && hasReport(reportBase)) {
            console.log("Relatorio existente encontrado; reusando.");
          } else {
            const exitCode = await runCommand(lighthouse.command, args, repoRoot);
            if (exitCode !== 0 && !hasReport(reportBase)) {
              throw new Error(`${lighthouse.command} saiu com codigo ${exitCode}`);
            }
            if (exitCode !== 0) {
              console.warn(`Lighthouse saiu com codigo ${exitCode}, mas JSON foi gerado; aceitando relatorio.`);
            }
          }
          const report = await readReport(reportBase);
          runSummaries.push(summarizeRun({ url, profile, run, ...report }));
        } finally {
          if (!options.keepProfiles) {
            await rm(userDataDir, { recursive: true, force: true });
          }
        }
      }
      summaries.push({
        url,
        profile,
        runs: runSummaries,
        median: summarizeMedian(runSummaries),
      });
    }
  }

  const summaryPath = path.join(options.outDir, "summary.json");
  await writeFile(summaryPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), summaries }, null, 2)}\n`);
  console.log(`\nResumo: ${path.relative(repoRoot, summaryPath)}`);
}

main().catch((error) => {
  console.error(`Erro: ${error.message}`);
  if (/lighthouse|ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL|Command failed/i.test(error.message)) {
    console.error("Se o binario Lighthouse faltar, adicione a dependencia: pnpm add -D lighthouse");
  }
  process.exit(1);
});
