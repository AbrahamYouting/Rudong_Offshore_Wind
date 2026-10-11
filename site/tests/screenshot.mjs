#!/usr/bin/env node
/** 生成用于课程报告与答辩的页面截图：node tests/screenshot.mjs  → 输出到 site/screenshots/ */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(HERE, "..");
const OUT_DIR = path.join(SITE_DIR, "screenshots");

function loadPlaywright() {
  for (const candidate of [
    "C:/Users/18250/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "playwright"
  ]) {
    try { return require(candidate); } catch (error) { /* 继续 */ }
  }
  throw new Error("未找到 playwright");
}
const { chromium } = loadPlaywright();

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  const target = path.join(SITE_DIR, url === "/" ? "index.html" : url);
  fs.readFile(target, (error, data) => {
    if (error) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(target)] || "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ channel: process.env.RD_BROWSER_PATH ? undefined : "msedge", executablePath: process.env.RD_BROWSER_PATH || undefined });

async function shoot(name, { width, height, selector, wait = 900, pre }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "load" });
  await page.waitForTimeout(900);
  if (pre) await pre(page);
  if (selector) {
    await page.$eval(selector, (node) => node.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(wait);
  }
  const file = path.join(OUT_DIR, name + ".png");
  await page.screenshot({ path: file });
  const { size } = fs.statSync(file);
  console.log(name.padEnd(26) + (size / 1024).toFixed(0) + "KB  " + width + "×" + height);
  await context.close();
}

await shoot("01-hero-desktop", { width: 1440, height: 900 });
await shoot("02-twins", { width: 1440, height: 900, selector: "#twins" });
await shoot("03-timeline", { width: 1440, height: 1000, selector: "#history" });
await shoot("04-unit-chart", {
  width: 1440, height: 900,
  pre: async (page) => {
    await page.$eval("#unit-bars", (node) => node.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(700);
  }
});
await shoot("05-turbine", { width: 1440, height: 1000, selector: "#tech" });
await shoot("06-hvdc", {
  width: 1440, height: 900,
  pre: async (page) => {
    await page.$eval(".hvdc", (node) => node.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(600);
    await page.click("#hvdc-run");
    await page.waitForTimeout(2600);
  }
});
await shoot("07-people", { width: 1440, height: 1000, selector: "#people" });
await shoot("08-thought", { width: 1440, height: 1000, selector: "#thought" });
await shoot("09-interact", { width: 1440, height: 1000, selector: "#interact" });
await shoot("10-sources", { width: 1440, height: 1000, selector: "#sources" });
await shoot("11-mobile-hero", { width: 390, height: 844 });
await shoot("12-mobile-timeline", { width: 390, height: 844, selector: "#history" });
await shoot("13-frog-easter-egg", {
  width: 1440, height: 900,
  pre: async (page) => {
    /* 点一下序章，把奶蛙叫出来（彩蛋截图） */
    await page.evaluate(() => document.getElementById("hero").click());
    await page.waitForTimeout(420);
  }
});

await browser.close();
server.close();
console.log("\n截图输出：" + OUT_DIR);
