#!/usr/bin/env node
/**
 * 如东 · 向海问风 —— 站点自动化测试
 * 用法：node tests/run.mjs [--headed] [--keep]
 * 依赖：本地已安装的 Microsoft Edge（channel: msedge），或设置 RD_BROWSER_PATH 指定 Chromium 可执行文件。
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.resolve(HERE, "..");

function loadPlaywright() {
  const candidates = [
    "C:/Users/18250/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "playwright"
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) { /* 继续尝试下一个 */ }
  }
  throw new Error("未找到 playwright 依赖，请先安装：npm i -D playwright");
}

const { chromium } = loadPlaywright();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function startServer(root) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || "/").split("?")[0]);
    const target = path.join(root, url === "/" ? "index.html" : url);
    if (!target.startsWith(root)) {
      res.writeHead(403).end("forbidden");
      return;
    }
    fs.readFile(target, (error, data) => {
      if (error) {
        res.writeHead(404).end("not found");
        return;
      }
      res.writeHead(200, { "content-type": MIME[path.extname(target)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

/* ------------------------------------------------------------------ */

const results = [];
let currentGroup = "未分组";
function group(name) { currentGroup = name; results.push({ group: name, kind: "group" }); }
function record(name, ok, detail) {
  results.push({ group: currentGroup, name, ok, detail: detail === undefined ? "" : String(detail) });
}
async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail);
  } catch (error) {
    record(name, false, error && error.message ? error.message : error);
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message || "断言失败");
}
function expectEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || "值不相等") + "：实际 " + JSON.stringify(actual) + "，期望 " + JSON.stringify(expected));
  }
}

/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const headed = args.includes("--headed");

const { server, port } = await startServer(SITE_DIR);
const base = `http://127.0.0.1:${port}/`;
const fileUrl = "file:///" + path.join(SITE_DIR, "index.html").replace(/\\/g, "/");

const launchOptions = { headless: !headed };
if (process.env.RD_BROWSER_PATH) launchOptions.executablePath = process.env.RD_BROWSER_PATH;
else launchOptions.channel = "msedge";

const browser = await chromium.launch(launchOptions);

async function newPage(contextOptions = {}) {
  const context = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, contextOptions));
  const page = await context.newPage();
  page.__issues = [];
  page.on("pageerror", (error) => page.__issues.push("pageerror: " + error.message));
  page.on("console", (message) => {
    if (message.type() === "error") page.__issues.push("console: " + message.text());
  });
  page.on("requestfailed", (request) => page.__issues.push("requestfailed: " + request.url()));
  page.__requests = [];
  page.on("request", (request) => page.__requests.push(request.url()));
  page.__context = context;
  return page;
}

/* ============================ A. 启动与报错 ============================ */
group("A 启动与控制台");
const page = await newPage();
await page.goto(base, { waitUntil: "load" });
await page.waitForTimeout(700);
const data = await page.evaluate(() => window.RD);
expect(data && data.timeline && data.timeline.length === 9, "站点数据未加载");

await check("首页加载无 JS 报错、无控制台错误、无失败请求", async () => {
  expect(page.__issues.length === 0, page.__issues.join(" | "));
  return "0 个问题";
});

await check("所有资源请求均来自本地（无外部 CDN / 网络依赖）", async () => {
  const external = page.__requests.filter((url) => !url.startsWith(base) && !url.startsWith("data:"));
  expect(external.length === 0, "存在外部请求：" + external.join(", "));
  return page.__requests.length + " 个本地请求";
});

await check("脚本文件数量为 5（GSAP、ScrollTrigger、data、scene、app）", async () => {
  const count = await page.evaluate(() => document.querySelectorAll("script[src]").length);
  expectEqual(count, 5);
  return count + " 个";
});

await check("离线双击打开（file://）同样无报错", async () => {
  const localPage = await newPage();
  await localPage.goto(fileUrl, { waitUntil: "load" });
  await localPage.waitForTimeout(600);
  const problems = localPage.__issues.filter((item) => !item.includes("localStorage"));
  expect(problems.length === 0, problems.join(" | "));
  const year = await localPage.textContent("#year-out");
  await localPage.__context.close();
  return "file:// 正常渲染，初始年份 " + year;
});

/* ============================ B. 结构与渲染 ============================ */
group("B 结构与数据渲染");

await check("七个章节与导航一一对应", async () => {
  const info = await page.evaluate(() => {
    const ids = window.RD.chapters.map((c) => c.id);
    return {
      missingSections: ids.filter((id) => !document.getElementById(id)),
      navCount: document.querySelectorAll("[data-nav]").length,
      expected: ids.length
    };
  });
  expect(info.missingSections.length === 0, "缺少章节：" + info.missingSections.join(","));
  expectEqual(info.navCount, info.expected, "导航条数");
  return info.expected + " 个章节";
});

await check("时间轴刻度 9 个、指标 4 行", async () => {
  const ticks = await page.locator("#timeline-ticks span").count();
  const meters = await page.locator("#meter-panel .meter").count();
  expectEqual(ticks, data.timeline.length, "刻度数");
  expectEqual(meters, Object.keys(data.metricRows).length, "指标行数");
  return ticks + " 刻度 / " + meters + " 指标";
});

await check("风机部件 8 个（圆点 + 标签各 8）", async () => {
  const hots = await page.locator("#diagram-hots .hot").count();
  const chips = await page.locator("#part-chips .chip").count();
  expectEqual(hots, data.turbine.length);
  expectEqual(chips, data.turbine.length);
  return hots + " 个热区";
});

await check("劳动者 5 张卡、产业链 6 环、理论 8 条、小测 4 题", async () => {
  const counts = {
    jobs: await page.locator("#job-grid .job").count(),
    chain: await page.locator("#chain-list li").count(),
    theory: await page.locator("#theory-list .theory-btn").count(),
    quiz: await page.locator("#quiz-list .quiz-item").count()
  };
  expectEqual(counts.jobs, data.jobs.length, "劳动者卡片");
  expectEqual(counts.chain, data.chain.links.length, "产业链环节");
  expectEqual(counts.theory, data.theory.length, "理论条目");
  expectEqual(counts.quiz, data.quiz.length, "小测题目");
  return JSON.stringify(counts);
});

await check("来源表 19 行且全部带来源与状态徽标", async () => {
  const rows = await page.locator("#sources-body tr").count();
  expectEqual(rows, data.sources.length);
  const badges = await page.locator("#sources-body .badge").count();
  expectEqual(badges, data.sources.length);
  return rows + " 行";
});

await check("页面只有 1 个 h1，且标题与描述不为空", async () => {
  const h1 = await page.locator("h1").count();
  const title = await page.title();
  const desc = await page.getAttribute('meta[name="description"]', "content");
  expectEqual(h1, 1);
  expect(title.length > 6, "页面标题过短");
  expect(desc && desc.length > 20, "页面描述缺失");
  return title;
});

/* ============================ C. 可访问性 ============================ */
group("C 可访问性");

await check("所有交互控件都有可访问名称", async () => {
  const unnamed = await page.evaluate(() => {
    function name(el) {
      const label = el.getAttribute("aria-label");
      if (label) return label.trim();
      const labelledBy = el.getAttribute("aria-labelledby");
      if (labelledBy) {
        const text = labelledBy.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || "").join(" ");
        if (text.trim()) return text.trim();
      }
      const id = el.getAttribute("id");
      if (id) {
        const explicit = document.querySelector('label[for="' + id + '"]');
        if (explicit && explicit.textContent.trim()) return explicit.textContent.trim();
      }
      if (el.closest("label")) return el.closest("label").textContent.trim();
      const text = (el.textContent || "").trim();
      if (text) return text;
      return el.getAttribute("placeholder") || el.getAttribute("title") || "";
    }
    return Array.prototype.filter.call(
      document.querySelectorAll("button, a[href], input, select, textarea"),
      (el) => {
        if (el.hasAttribute("aria-hidden")) return false;
        return name(el) === "";
      }
    ).map((el) => el.tagName + "." + el.className);
  });
  expect(unnamed.length === 0, "缺少名称：" + unnamed.join(", "));
  return "全部有名称";
});

await check("装饰性 canvas 已隐形、示意图有角色与说明", async () => {
  const info = await page.evaluate(() => {
    const canvas = document.getElementById("hero-canvas");
    const svg = document.querySelector(".diagram svg");
    return {
      canvasHidden: canvas.getAttribute("aria-hidden") === "true",
      svgRole: svg.getAttribute("role"),
      hasTitle: !!svg.querySelector("title"),
      hasDesc: !!svg.querySelector("desc")
    };
  });
  expect(info.canvasHidden, "canvas 未标记 aria-hidden");
  expectEqual(info.svgRole, "img");
  expect(info.hasTitle && info.hasDesc, "示意图缺少 title/desc");
  return "正常";
});

await check("跳转链接指向主内容并可用键盘触发", async () => {
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.className);
  expect(String(focused).includes("skip-link"), "首个 Tab 焦点不是跳转链接，而是 " + focused);
  return focused;
});

await check("配色对比度达标（正文与强调色均 ≥ 4.5:1）", async () => {
  const ratios = await page.evaluate(() => {
    function luminance(hex) {
      const value = hex.trim().replace("#", "");
      const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
      const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    }
    function ratio(a, b) {
      const la = luminance(a);
      const lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }
    const styles = getComputedStyle(document.documentElement);
    const read = (name) => styles.getPropertyValue(name);
    const pairs = {
      正文: ["--c-ink", "--c-bg"],
      次要文字: ["--c-dim", "--c-bg"],
      更次要: ["--c-dim-2", "--c-bg-2"],
      金色强调: ["--c-gold", "--c-bg"],
      浅蓝数据色: ["--c-blue", "--c-bg"],
      品牌蓝底正文: ["--c-ink", "--c-brand"],
      品牌蓝底次要文字: ["--c-dim", "--c-brand"],
      品牌蓝底金色: ["--c-gold", "--c-brand"]
    };
    const result = {};
    Object.keys(pairs).forEach((key) => {
      result[key] = Number(ratio(read(pairs[key][0]), read(pairs[key][1])).toFixed(2));
    });
    return result;
  });
  Object.keys(ratios).forEach((key) => {
    expect(ratios[key] >= 4.5, key + " 对比度仅 " + ratios[key] + ":1");
  });
  return JSON.stringify(ratios);
});

await check("主色确为深蓝 #194891 与金色 #FFD700", async () => {
  const info = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    const value = (name) => styles.getPropertyValue(name).trim().toLowerCase();
    return {
      brand: value("--c-brand"),
      gold: value("--c-gold"),
      surface2: value("--c-surface-2"),
      legacyAmber: value("--c-amber"),
      legacySea: value("--c-sea"),
      heroGradient: getComputedStyle(document.querySelector(".hero")).backgroundImage,
      progressGradient: getComputedStyle(document.getElementById("progress-bar")).backgroundImage
    };
  });
  expectEqual(info.brand, "#194891", "品牌深蓝");
  expectEqual(info.gold, "#ffd700", "金色");
  expectEqual(info.surface2, "#194891", "深蓝面");
  expectEqual(info.legacyAmber, "", "旧的橙色 token 应已移除");
  expectEqual(info.legacySea, "", "旧的青色 token 应已移除");
  expect(info.heroGradient.includes("rgb(25, 72, 145)"), "首屏渐变没有使用深蓝主色");
  expect(info.progressGradient.includes("rgb(25, 72, 145)"), "进度条渐变没有使用深蓝主色");
  expect(info.progressGradient.includes("rgb(255, 215, 0)"), "进度条渐变没有使用金色");
  return "#194891 + #FFD700 已应用";
});

/* ============================ D. 时间轴 ============================ */
group("D 时间轴交互");

await check("初始停在 2021 年、事件卡与数据一致", async () => {
  const year = (await page.textContent("#year-out")).trim();
  const title = (await page.textContent("#event-title")).trim();
  const expected = data.timeline[5];
  expectEqual(year, String(expected.y));
  expectEqual(title, expected.title);
  return year + " " + title;
});

await check("拖动到全部 9 个节点，事件与指标均正确", async () => {
  const report = [];
  for (let index = 0; index < data.timeline.length; index += 1) {
    const stop = data.timeline[index];
    await page.$eval("#year-range", (input, value) => {
      input.value = String(value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, index);
    const state = await page.evaluate(() => ({
      year: document.getElementById("year-out").textContent.trim(),
      title: document.getElementById("event-title").textContent.trim(),
      meters: Array.prototype.map.call(document.querySelectorAll("#meter-panel .meter"), (meter) => ({
        key: meter.getAttribute("data-key"),
        value: meter.querySelector(".meter__val").textContent.trim(),
        empty: meter.getAttribute("data-empty")
      }))
    }));
    expectEqual(state.year, String(stop.y), "第 " + index + " 个节点年份");
    expectEqual(state.title, stop.title, "第 " + index + " 个节点标题");
    state.meters.forEach((meter) => {
      const raw = stop.m[meter.key];
      if (raw === null) expect(meter.empty === "true", meter.key + " 应为空值状态");
      else expect(meter.value.startsWith(String(raw)), meter.key + " 应为 " + raw + "，实际 " + meter.value);
    });
    report.push(stop.y);
  }
  return report.join(" → ");
});

await check("键盘可操作：End 跳到最后一年，ArrowLeft 回退一年", async () => {
  await page.focus("#year-range");
  await page.keyboard.press("End");
  const last = (await page.textContent("#year-out")).trim();
  expectEqual(last, String(data.timeline[data.timeline.length - 1].y));
  await page.keyboard.press("ArrowLeft");
  const previous = (await page.textContent("#year-out")).trim();
  expectEqual(previous, String(data.timeline[data.timeline.length - 2].y));
  return last + " → " + previous;
});

/* ============================ E. 风机部件 ============================ */
group("E 风机部件交互");

await check("逐个点击 8 个部件，说明与高亮状态同步", async () => {
  const names = [];
  for (const part of data.turbine) {
    await page.click('.chip[data-part="' + part.key + '"]');
    const state = await page.evaluate(() => ({
      name: document.getElementById("part-name").textContent.trim(),
      plain: document.getElementById("part-plain").textContent.trim(),
      part: document.getElementById("diagram").getAttribute("data-part"),
      pressedChip: document.querySelectorAll('.chip[aria-pressed="true"]').length,
      pressedHot: document.querySelectorAll('.hot[aria-pressed="true"]').length
    }));
    expectEqual(state.name, part.name, part.key + " 名称");
    expectEqual(state.plain, part.plain, part.key + " 说明");
    expectEqual(state.part, part.key, part.key + " 高亮");
    expectEqual(state.pressedChip, 1, part.key + " 选中数量");
    expectEqual(state.pressedHot, 1, part.key + " 圆点选中数量");
    names.push(state.name);
  }
  return names.join("/");
});

await check("点击图上的圆点同样生效（发电机）", async () => {
  await page.click('.hot[data-part="gen"]');
  const name = (await page.textContent("#part-name")).trim();
  expectEqual(name, "发电机");
  return name;
});

/* ============================ F. 柔性直流 ============================ */
group("F 柔性直流演示");

await check("点击播放后四个节点依次点亮，状态文案更新", async () => {
  await page.locator("#hvdc-run").scrollIntoViewIfNeeded();
  await page.click("#hvdc-run");
  await page.waitForFunction(
    () => document.getElementById("hvdc-status").textContent.includes("送电完成"),
    null,
    { timeout: 12000 }
  );
  await page.waitForFunction(
    () => document.querySelectorAll("#hvdc-nodes .hvdc-node.is-live").length === 4,
    null,
    { timeout: 9000 }
  );
  const status = (await page.textContent("#hvdc-status")).trim();
  expect(status.includes("送电完成"), "状态文案未更新：" + status);
  const dots = await page.locator("#hvdc-flow circle").count();
  expect(dots > 0, "电流点未渲染");
  return status.slice(0, 24) + "…";
});

await check("减少动态效果时直接给出结果（不做动画）", async () => {
  const calm = await newPage({ reducedMotion: "reduce" });
  await calm.goto(base, { waitUntil: "load" });
  await calm.waitForTimeout(500);
  const live = await calm.locator("#hvdc-nodes .hvdc-node.is-live").count();
  expectEqual(live, 4);
  const status = (await calm.textContent("#hvdc-status")).trim();
  expect(status.includes("送电完成"), "静态状态文案缺失");
  await calm.__context.close();
  return "4 个节点直接点亮";
});

/* ============================ G. 换算器 ============================ */
group("G 能量换算器");

await check("默认 50 亿千瓦时与公开口径一致（减标煤 150 万吨、CO₂ 375 万吨）", async () => {
  const values = await page.evaluate(() => Array.prototype.map.call(
    document.querySelectorAll("#convert-results li .num"),
    (node) => node.textContent.trim()
  ));
  expectEqual(values[1], "150", "标准煤");
  expectEqual(values[2], "375", "二氧化碳");
  return values.join(" / ");
});

await check("滑杆边界值正确（10 与 100 亿千瓦时）", async () => {
  async function read(value) {
    await page.$eval("#kwh-range", (input, v) => {
      input.value = String(v);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    return page.evaluate(() => ({
      out: document.getElementById("kwh-out").textContent.trim(),
      values: Array.prototype.map.call(document.querySelectorAll("#convert-results li .num"), (node) => node.textContent.trim())
    }));
  }
  const low = await read(10);
  const high = await read(100);
  expectEqual(low.values[0], "42", "10 亿千瓦时户数");
  expectEqual(low.values[1], "30", "10 亿千瓦时标准煤");
  expectEqual(high.values[0], "417", "100 亿千瓦时户数");
  expectEqual(high.values[2], "750", "100 亿千瓦时二氧化碳");
  await read(data.converter.default);
  return "10→42 万户 / 100→417 万户";
});

/* ============================ H. 小测 ============================ */
group("H 互动小测");

await check("全部答对后计分正确", async () => {
  const items = await page.locator("#quiz-list .quiz-item").count();
  for (let i = 0; i < items; i += 1) {
    const answer = data.quiz[i].answer;
    await page.click(`#quiz-list .quiz-item:nth-child(${i + 1}) .quiz-opt:nth-child(${answer + 1})`);
  }
  const score = (await page.textContent("#quiz-score")).trim();
  expectEqual(score, "已答 4 / 4 题，答对 4 题。");
  const right = await page.locator('#quiz-list .quiz-opt[data-state="right"]').count();
  expectEqual(right, items);
  return score;
});

await check("答错时同时标出正确项与解释", async () => {
  const fresh = await newPage();
  await fresh.goto(base, { waitUntil: "load" });
  await fresh.waitForTimeout(500);
  await fresh.click("#quiz-list .quiz-item:nth-child(1) .quiz-opt:nth-child(2)");
  const wrong = await fresh.locator('#quiz-list .quiz-opt[data-state="wrong"]').count();
  const right = await fresh.locator('#quiz-list .quiz-opt[data-state="right"]').count();
  const feedback = (await fresh.textContent("#quiz-list .quiz-item:nth-child(1) .quiz-item__feedback")).trim();
  expectEqual(wrong, 1);
  expectEqual(right, 1);
  expect(feedback.includes(data.quiz[0].explain.slice(0, 10)), "缺少解释文案");
  await fresh.__context.close();
  return feedback.slice(0, 18) + "…";
});

/* ============================ I. 留言墙 ============================ */
group("I 留言墙（本地存储）");

await check("提交后写入列表并在刷新后保留", async () => {
  await page.locator("#pledge-input").scrollIntoViewIfNeeded();
  await page.fill("#pledge-input", "测试：少开一次车");
  await page.click("#pledge-form button[type=submit]");
  await page.waitForTimeout(200);
  let count = await page.locator("#pledge-list li").count();
  expect(count >= 1, "列表未新增");
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(600);
  const text = await page.textContent("#pledge-list");
  expect(text.includes("测试：少开一次车"), "刷新后记录丢失");
  return "刷新后仍在";
});

await check("清空按钮移除全部记录", async () => {
  await page.click("#pledge-clear");
  await page.waitForTimeout(200);
  const text = (await page.textContent("#pledge-list")).trim();
  expect(text.includes("还没有记录"), "未清空：" + text);
  return text;
});

/* ============================ J. 导航与滚动 ============================ */
group("J 导航与滚动");

await check("点击导航跳到对应章节并高亮当前章节", async () => {
  await page.click('[data-nav="thought"]');
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => {
    const section = document.getElementById("thought");
    const rect = section.getBoundingClientRect();
    return {
      inView: rect.top < window.innerHeight * 0.5 && rect.bottom > 0,
      current: (document.querySelector('[data-nav][aria-current]') || {}).textContent || ""
    };
  });
  expect(info.inView, "目标章节未进入视口");
  expectEqual(info.current.trim(), "思想之光");
  return info.current;
});

await check("阅读进度条随滚动增长", async () => {
  const before = await page.evaluate(() => document.getElementById("progress-bar").style.width);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => document.getElementById("progress-bar").style.width);
  expect(parseFloat(after) > parseFloat(before || "0"), "进度条未增长：" + before + " → " + after);
  await page.evaluate(() => window.scrollTo(0, 0));
  return before + " → " + after;
});

await check("滚动到位的区块完成进场动画（opacity 1）", async () => {
  await page.evaluate(() => {
    document.querySelectorAll(".reveal").forEach((node) => node.scrollIntoView());
  });
  await page.waitForTimeout(1200);
  const hidden = await page.evaluate(() => Array.prototype.filter.call(
    document.querySelectorAll(".reveal"),
    (node) => Number(getComputedStyle(node).opacity) < 0.9
  ).length);
  expectEqual(hidden, 0);
  return "全部可见";
});

/* ============================ K. 响应式与布局 ============================ */
group("K 响应式与布局");

for (const width of [1440, 1024, 768, 390]) {
  await check(`${width}px 宽无横向溢出、控件不重叠`, async () => {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(400);
    const audit = await page.evaluate(() => {
      const doc = document.documentElement;
      const overflow = doc.scrollWidth - doc.clientWidth;
      const wide = Array.prototype.filter.call(document.querySelectorAll("body *"), (node) => {
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.right <= window.innerWidth + 1.5) return false;
        /* 可横向滚动的容器（如数据表）内部元素超出视口是设计行为 */
        let parent = node.parentElement;
        while (parent && parent !== document.body) {
          const overflowX = getComputedStyle(parent).overflowX;
          if (overflowX === "auto" || overflowX === "scroll" || overflowX === "hidden") return false;
          parent = parent.parentElement;
        }
        return true;
      }).map((node) => node.tagName + "." + (node.className || "")).slice(0, 4);
      const hots = Array.prototype.filter.call(document.querySelectorAll("#diagram-hots .hot"), (node) => {
        return getComputedStyle(node).display !== "none";
      }).map((node) => node.getBoundingClientRect());
      const overlaps = [];
      for (let i = 0; i < hots.length; i += 1) {
        for (let j = i + 1; j < hots.length; j += 1) {
          const a = hots[i];
          const b = hots[j];
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ox > 0 && oy > 0) overlaps.push(Math.round(ox) + "x" + Math.round(oy));
        }
      }
      return { overflow, wide, overlaps };
    });
    expect(audit.overflow <= 1, "横向溢出 " + audit.overflow + "px");
    expect(audit.wide.length === 0, "超出视口的元素：" + audit.wide.join(", "));
    expect(audit.overlaps.length === 0, "热区重叠：" + audit.overlaps.join(", "));
    return "溢出 " + audit.overflow + "px";
  });

  await check(`${width}px 宽文字没有被裁切`, async () => {
    const clipped = await page.evaluate(() => {
      return Array.prototype.filter.call(
        document.querySelectorAll("h1, h2, h3, h4, p, li, dd, dt, td, th, span, b, small, button, a"),
        (node) => {
          if (!node.textContent.trim()) return false;
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          if (rect.width <= 2 && rect.height <= 2) return false;   // 仅屏幕阅读器可见的辅助文本
          if (style.clipPath && style.clipPath !== "none") return false;
          if (style.overflowX === "auto" || style.overflow === "scroll") return false;
          if (style.webkitLineClamp && style.webkitLineClamp !== "none") return false;
          if (style.textOverflow === "ellipsis") return false;
          const fontSize = parseFloat(style.fontSize) || 16;
          const clippedHorizontally = node.scrollWidth > node.clientWidth + 1;
          const overflowingVertically = node.scrollHeight - node.clientHeight > fontSize * 0.4;
          const hidesOverflow = style.overflow === "hidden" || style.overflow === "clip";
          const minorVertical = node.scrollHeight > node.clientHeight + 1;
          if (hidesOverflow && (minorVertical || clippedHorizontally)) return true;
          /* overflow: visible 时，行高小于字体自身度量会带来几像素的“假溢出”，只拦真正溢出的情况 */
          return clippedHorizontally || overflowingVertically;
        }
      ).map((node) => node.tagName + "." + (node.className || "") + " :: " + node.textContent.trim().slice(0, 16)).slice(0, 5);
    });
    expect(clipped.length === 0, "被裁切：" + clipped.join(" | "));
    return "无裁切";
  });
}

await check("390px 下折叠菜单可用（展开 → 点击链接 → 收起）", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const visibleBefore = await page.isVisible("#nav-list");
  expect(!visibleBefore, "窄屏下菜单不应默认展开");
  await page.click("#nav-toggle");
  await page.waitForTimeout(250);
  expect(await page.isVisible("#nav-list"), "点击后菜单未展开");
  const expanded = await page.getAttribute("#nav-toggle", "aria-expanded");
  expectEqual(expanded, "true");
  await page.click('[data-nav="tech"]');
  await page.waitForTimeout(700);
  expectEqual(await page.getAttribute("#nav-toggle", "aria-expanded"), "false", "点击链接后应收起");
  return "展开/收起正常";
});

await page.setViewportSize({ width: 1440, height: 900 });

/* ============================ M. 序章场景 ============================ */
group("M 序章场景（画布动画）");

await check("GSAP 与 ScrollTrigger 已加载并注册了滚动动画", async () => {
  const info = await page.evaluate(() => ({
    gsap: !!window.gsap,
    scrollTrigger: !!window.ScrollTrigger,
    triggers: window.ScrollTrigger && window.ScrollTrigger.getAll ? window.ScrollTrigger.getAll().length : -1
  }));
  expect(info.gsap && info.scrollTrigger, "动画库未加载");
  expect(info.triggers > 0, "未注册滚动触发器");
  return info.triggers + " 个触发器";
});

await check("序章画布真的画出了内容（海面渐变 + 风机剪影）", async () => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const pixels = await page.evaluate(() => {
    const canvas = document.getElementById("hero-canvas");
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    function strip(from, to) {
      const data = ctx.getImageData(0, Math.round(height * from), width, Math.round(height * (to - from))).data;
      const total = data.length / 4;
      let opaque = 0;
      let dark = 0;
      let colored = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 200) opaque += 1;
        if (data[i] + data[i + 1] + data[i + 2] < 90) dark += 1;
        if (Math.abs(data[i] - data[i + 1]) + Math.abs(data[i + 1] - data[i + 2]) > 24) colored += 1;
      }
      return { opaque: opaque / total, dark: dark / total, colored: colored / total };
    }
    return {
      size: { width: width, height: height },
      sky: strip(0, 0.4),
      horizon: strip(0.55, 0.66),
      deep: strip(0.86, 0.96)
    };
  });
  expect(pixels.horizon.opaque > 0.55, "海平线附近不是实心海面（" + pixels.horizon.opaque.toFixed(2) + "）");
  expect(pixels.horizon.dark > 0.002, "海平线上看不到风机剪影（深色像素 " + (pixels.horizon.dark * 100).toFixed(2) + "%）");
  expect(pixels.deep.opaque > 0.95, "画布下半部未铺满海水");
  expect(pixels.sky.opaque < 0.2, "天空区域被画布覆盖，CSS 渐变会被挡住");
  return "风机剪影 " + (pixels.horizon.dark * 100).toFixed(2) + "% / 海面 " + (pixels.deep.opaque * 100).toFixed(0) + "%";
});

await check("场景画出 200 台风机，并在离开视口时暂停", async () => {
  const count = await page.evaluate(() => window.__rdHeroScene && window.__rdHeroScene.turbineCount);
  expectEqual(count, 200, "风机数量");
  const runningAtTop = await page.evaluate(() => window.__rdHeroScene.isRunning);
  expect(runningAtTop === true, "序章可见时动画应在运行");
  await page.evaluate(() => document.getElementById("sources").scrollIntoView());
  await page.waitForTimeout(700);
  const runningAway = await page.evaluate(() => window.__rdHeroScene.isRunning);
  expect(runningAway === false, "离开视口后动画未暂停（会浪费性能）");
  await page.evaluate(() => window.scrollTo(0, 0));
  return "200 台，滚动离开后暂停";
});

await check("减少动态效果时画布仍然出图（静态首帧）", async () => {
  const calm = await newPage({ reducedMotion: "reduce" });
  await calm.goto(base, { waitUntil: "load" });
  await calm.waitForTimeout(700);
  const painted = await calm.evaluate(() => {
    const canvas = document.getElementById("hero-canvas");
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, Math.round(canvas.height * 0.8), canvas.width, 8).data;
    let opaque = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 200) opaque += 1;
    return opaque;
  });
  expect(painted > 0, "静态模式下画布空白");
  await calm.__context.close();
  return "静态首帧已绘制";
});

/* ============================ L. 打印与性能 ============================ */
group("L 打印与预算");

await check("打印样式隐藏导航与画布、保留数据表", async () => {
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => ({
    header: getComputedStyle(document.querySelector(".site-header")).display,
    canvas: getComputedStyle(document.querySelector(".hero__canvas")).display,
    table: getComputedStyle(document.getElementById("sources-table")).display
  }));
  await page.emulateMedia({ media: "screen" });
  expectEqual(state.header, "none");
  expectEqual(state.canvas, "none");
  expect(state.table !== "none", "打印时数据表被隐藏");
  return "导航/画布已隐藏";
});

await check("体积与 DOM 规模在预算内（< 1.5MB / < 3000 节点）", async () => {
  const files = ["index.html", "assets/style.css", "assets/app.js", "assets/data.js", "assets/scene.js", "vendor/gsap.min.js", "vendor/ScrollTrigger.min.js"];
  const bytes = files.reduce((sum, file) => sum + fs.statSync(path.join(SITE_DIR, file)).size, 0);
  expect(bytes < 1.5 * 1024 * 1024, "静态资源合计 " + (bytes / 1024).toFixed(0) + "KB");
  const nodes = await page.evaluate(() => document.getElementsByTagName("*").length);
  expect(nodes < 3000, "DOM 节点 " + nodes);
  return (bytes / 1024).toFixed(0) + "KB / " + nodes + " 节点";
});

/* ============================ 汇总 ============================ */

await browser.close();
server.close();

const failed = results.filter((item) => item.kind !== "group" && !item.ok);
const passed = results.filter((item) => item.kind !== "group" && item.ok);

const reportPath = path.join(HERE, "report.json");
fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), base, passed: passed.length, failed: failed.length, results }, null, 2));

let lastGroup = "";
for (const item of results) {
  if (item.kind === "group") {
    lastGroup = item.group;
    console.log("\n" + item.group);
    continue;
  }
  console.log((item.ok ? "  PASS  " : "  FAIL  ") + item.name + (item.detail ? "  → " + item.detail : ""));
}

console.log("\n" + "=".repeat(72));
console.log(`测试完成：通过 ${passed.length}，失败 ${failed.length}`);
if (failed.length) {
  console.log("\n失败项：");
  failed.forEach((item) => console.log("  - [" + item.group + "] " + item.name + "：" + item.detail));
}
console.log("报告：" + reportPath);

process.exit(failed.length ? 1 : 0);
