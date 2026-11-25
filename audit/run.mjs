import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { platform, release, cpus, totalmem } from "node:os";
import { setTimeout as wait } from "node:timers/promises";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { launch } from "chrome-launcher";
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { profiles, runs, targets, thresholds } from "./config.mjs";

const output = new URL("../audit-results/", import.meta.url);
await mkdir(output, { recursive: true });
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4173",
    "--strictPort",
  ],
  { stdio: "pipe", windowsHide: true },
);
let started = false;
server.stdout.on("data", (data) => {
  if (String(data).includes("4173")) started = true;
});
let serverError = "";
server.stderr.on("data", (data) => {
  serverError += data.toString();
});
const measurements = [];
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const sourceDirty = !!execFileSync("git", ["status", "--porcelain"], {
  encoding: "utf8",
}).trim();
try {
  for (
    let attempt = 0;
    attempt < 100 && !started && server.exitCode === null;
    attempt++
  )
    await wait(100);
  if (!started) throw new Error(`Preview unavailable: ${serverError}`);
  for (const target of targets)
    for (const profile of profiles)
      for (let run = 1; run <= runs; run++) {
        const chrome = await launch({
          chromePath: chromium.executablePath(),
          chromeFlags: ["--headless", "--disable-gpu", "--no-first-run"],
          logLevel: "error",
        });
        try {
          const result = await lighthouse(
            `http://127.0.0.1:4173${target.path}`,
            {
              port: chrome.port,
              logLevel: "error",
              output: ["html", "json"],
              onlyCategories: Object.keys(thresholds),
              maxWaitForLoad: 45_000,
            },
            profile === "desktop" ? desktopConfig : undefined,
          );
          const lhr = result.lhr;
          if (lhr.runtimeError)
            throw new Error(
              `${lhr.runtimeError.code}: ${lhr.runtimeError.message}`,
            );
          const name = `${target.id}-${profile}-${run}`;
          await writeFile(new URL(`${name}.html`, output), result.report[0]);
          await writeFile(new URL(`${name}.json`, output), result.report[1]);
          const scores = Object.fromEntries(
            Object.entries(lhr.categories).map(([key, category]) => [
              key,
              Math.round(category.score * 100),
            ]),
          );
          measurements.push({
            page: target.id,
            profile,
            run,
            scores,
            lcp: lhr.audits["largest-contentful-paint"].numericValue,
            cls: lhr.audits["cumulative-layout-shift"].numericValue,
            tbt: lhr.audits["total-blocking-time"].numericValue,
            lighthouseVersion: lhr.lighthouseVersion,
            browser: lhr.environment.hostUserAgent,
          });
          console.log(name, scores);
        } finally {
          await chrome.kill();
        }
      }
  const median = (values) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const summaries = targets.flatMap((target) =>
    profiles.map((profile) => {
      const group = measurements.filter(
        (value) => value.page === target.id && value.profile === profile,
      );
      return {
        page: target.id,
        profile,
        scores: Object.fromEntries(
          Object.keys(thresholds).map((key) => [
            key,
            median(group.map((value) => value.scores[key])),
          ]),
        ),
        lcp: median(group.map((value) => value.lcp)),
        cls: median(group.map((value) => value.cls)),
        tbt: median(group.map((value) => value.tbt)),
      };
    }),
  );
  const failures = summaries.flatMap(({ page, profile, scores }) =>
      Object.entries(thresholds)
        .filter(([category, minimum]) => scores[category] < minimum)
        .map(([category, minimum]) => ({
          page,
          profile,
          category,
          score: scores[category],
          minimum,
        })),
    ),
    passed = failures.length === 0;
  await writeFile(
    new URL("summary.json", output),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceCommit,
        sourceDirty,
        passed,
        failures,
        conditions: {
          node: process.version,
          os: `${platform()} ${release()}`,
          cpu: cpus()[0]?.model,
          logicalCpus: cpus().length,
          memoryGiB: Math.round(totalmem() / 1024 ** 3),
          throttling: "Lighthouse default simulated mobile / desktop preset",
          server:
            "Vite production preview, mock scenario default, fresh browser profile per measurement",
          delivery:
            "Full local fonts, images, MSW and Socket.IO; no audit-specific app changes",
        },
        thresholds,
        summaries,
        measurements,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(summaries, null, 2));
  if (!passed) {
    console.error("Lighthouse thresholds failed:", failures);
    process.exitCode = 1;
  }
} finally {
  server.kill();
}
