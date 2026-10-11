/* 站点行为：渲染、交互、动画。内容全部来自 assets/data.js。 */
(function () {
  "use strict";

  var RD = window.RD;
  if (!RD) return;

  var $ = function (id) { return document.getElementById(id); };
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function clear(node) { if (node) node.textContent = ""; }
  function fmt(n, digits) {
    var value = typeof digits === "number" ? n.toFixed(digits) : Math.round(n);
    return Number(value).toLocaleString("zh-CN");
  }
  function setText(id, text) { var node = $(id); if (node) node.textContent = text == null ? "" : String(text); }

  /* ============================ 1. 顶部导航 ============================ */
  function buildNav() {
    var list = $("nav-list");
    if (!list || !RD.chapters) return;
    RD.chapters.forEach(function (chapter) {
      var li = el("li");
      var a = el("a", null, chapter.label);
      a.href = "#" + chapter.id;
      a.setAttribute("data-nav", chapter.id);
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function initNavBehaviour() {
    var toggle = $("nav-toggle");
    var nav = $("site-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      nav.addEventListener("click", function (event) {
        if (event.target.closest("a")) {
          nav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && nav.classList.contains("is-open")) {
          nav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.focus();
        }
      });
    }

    var bar = $("progress-bar");
    var ticking = false;
    function updateProgress() {
      ticking = false;
      if (!bar) return;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.width = (ratio * 100).toFixed(2) + "%";
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(updateProgress); }
    }, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();

    if (!("IntersectionObserver" in window)) return;
    var links = {};
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function (link) {
      links[link.getAttribute("data-nav")] = link;
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Object.keys(links).forEach(function (key) {
          links[key].removeAttribute("aria-current");
        });
        var active = links[entry.target.id];
        if (active) active.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    RD.chapters.forEach(function (chapter) {
      var section = document.getElementById(chapter.id);
      if (section) observer.observe(section);
    });
  }

  /* ============================ 2. 序章 ============================ */
  function countUp(node, target, digits) {
    if (reducedMotion || !window.requestAnimationFrame) {
      node.textContent = fmt(target, digits);
      return;
    }
    var start = 0;
    var duration = 1200;
    var began = 0;
    function step(now) {
      if (!began) began = now;
      var p = Math.min(1, (now - began) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(start + (target - start) * eased, digits);
      if (p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  function renderHero() {
    setText("hero-eyebrow", RD.hero.eyebrow);
    setText("hero-lead", RD.hero.lead);
    setText("hero-disclaimer", RD.meta.disclaimer);
    Array.prototype.forEach.call(document.querySelectorAll(".hero__line"), function (line) {
      var index = Number(line.getAttribute("data-line")) - 1;
      line.textContent = RD.hero.headline[index] || "";
    });
    var stats = $("hero-stats");
    clear(stats);
    RD.hero.stats.forEach(function (stat) {
      var li = el("li");
      var b = el("b");
      var num = el("span", "num");
      num.setAttribute("data-count", stat.value);
      num.textContent = reducedMotion ? fmt(stat.value) : "0";
      b.appendChild(num);
      b.appendChild(el("small", null, stat.unit));
      li.appendChild(b);
      li.appendChild(el("span", null, stat.label));
      li.appendChild(el("p", "source-line", stat.note));
      stats.appendChild(li);
    });
  }

  /* ============================ 3. 两座 800MW ============================ */
  function renderTwins() {
    setText("twins-title", RD.twins.title);
    setText("twins-lead", RD.twins.lead);
    var grid = $("twin-grid");
    clear(grid);
    RD.twins.items.forEach(function (item) {
      var card = el("article", "twin" + (item.highlight ? " twin--primary" : ""));
      card.appendChild(el("h3", "twin__owner", item.owner));
      card.appendChild(el("p", "twin__badge", item.highlight ? "本站主线" : "对照案例"));
      var dl = el("dl");
      item.fields.forEach(function (pair) {
        dl.appendChild(el("dt", null, pair[0]));
        dl.appendChild(el("dd", null, pair[1]));
      });
      card.appendChild(dl);
      grid.appendChild(card);
    });
  }

  /* ============================ 4. 时间轴 ============================ */
  var timelineState = { index: 5, meters: {} };

  function buildMeters() {
    var panel = $("meter-panel");
    if (!panel) return;
    clear(panel);
    Object.keys(RD.metricRows).forEach(function (key) {
      var config = RD.metricRows[key];
      var meter = el("div", "meter");
      meter.setAttribute("data-key", key);
      var top = el("div", "meter__top");
      top.appendChild(el("span", null, config.label));
      var val = el("span", "meter__val num", "—");
      top.appendChild(val);
      meter.appendChild(top);
      var track = el("div", "meter__track");
      var fill = el("div", "meter__fill");
      fill.style.width = "0%";
      track.appendChild(fill);
      meter.appendChild(track);
      panel.appendChild(meter);
      timelineState.meters[key] = { meter: meter, val: val, fill: fill, config: config };
    });
    panel.appendChild(el("p", "source-line meter__note", "空白＝该年份无公开口径；数值均标注来源与时间。"));
  }

  function renderStop(index) {
    var stop = RD.timeline[index];
    if (!stop) return;
    timelineState.index = index;
    setText("year-out", stop.y);
    setText("event-tag", stop.tag);
    setText("event-year", stop.y);
    setText("event-title", stop.title);
    setText("event-detail", stop.detail);
    setText("event-src", stop.note ? stop.src + "　" + stop.note : stop.src);
    Object.keys(timelineState.meters).forEach(function (key) {
      var entry = timelineState.meters[key];
      var value = stop.m[key];
      if (value === null || value === undefined) {
        entry.val.textContent = "—";
        entry.fill.style.width = "0%";
        entry.meter.setAttribute("data-empty", "true");
      } else {
        entry.val.textContent = value + " " + entry.config.unit;
        entry.fill.style.width = Math.max(3, Math.round((value / entry.config.max) * 100)) + "%";
        entry.meter.setAttribute("data-empty", "false");
      }
    });
  }

  function initTimeline() {
    var range = $("year-range");
    var ticks = $("timeline-ticks");
    if (!range) return;
    if (ticks) {
      clear(ticks);
      RD.timeline.forEach(function (stop) {
        ticks.appendChild(el("span", null, stop.y));
      });
    }
    range.max = String(RD.timeline.length - 1);
    range.value = String(timelineState.index);
    range.addEventListener("input", function () {
      renderStop(Number(range.value));
    });
    buildMeters();
    renderStop(Number(range.value));
  }

  function renderUnitChart() {
    setText("unit-chart-title", RD.unitChart.title);
    setText("unit-chart-caveat", RD.unitChart.caveat + "　柱高按容量线性比例。");
    var wrap = $("unit-bars");
    var facts = $("unit-chart-facts");
    if (!wrap) return;
    clear(wrap);
    var max = RD.unitChart.bars.reduce(function (acc, bar) { return Math.max(acc, bar.mw); }, 1);
    RD.unitChart.bars.forEach(function (bar) {
      var node = el("div", "bar");
      var value = el("span", "bar__value num", bar.mw);
      value.appendChild(el("small", null, "MW"));
      node.appendChild(value);
      var col = el("div", "bar__col");
      col.style.setProperty("--h", Math.max(8, Math.round((bar.mw / max) * 100)) + "%");
      node.appendChild(col);
      node.appendChild(el("span", "bar__label", bar.y + "　" + bar.label));
      node.appendChild(el("span", "bar__meta", bar.note));
      wrap.appendChild(node);
    });
    if (facts) {
      clear(facts);
      RD.unitChart.facts.forEach(function (text) {
        facts.appendChild(el("li", null, text));
      });
    }
  }

  /* ============================ 5. 风机部件 ============================ */
  function initTurbine() {
    var diagram = $("diagram");
    var hots = $("diagram-hots");
    var chips = $("part-chips");
    if (!diagram || !hots || !chips) return;
    var buttons = [];

    RD.turbine.forEach(function (part) {
      var hot = el("button", "hot");
      hot.type = "button";
      hot.setAttribute("data-part", part.key);
      hot.setAttribute("aria-pressed", "false");
      hot.style.left = part.x + "%";
      hot.style.top = part.y + "%";
      hot.appendChild(el("span", "visually-hidden", part.name));
      hots.appendChild(hot);
      buttons.push(hot);

      var chip = el("button", "chip", part.name);
      chip.type = "button";
      chip.setAttribute("data-part", part.key);
      chip.setAttribute("aria-pressed", "false");
      chips.appendChild(chip);
      buttons.push(chip);
    });

    function select(key) {
      var part = RD.turbine.filter(function (item) { return item.key === key; })[0];
      if (!part) return;
      diagram.setAttribute("data-part", key);
      setText("part-name", part.name);
      setText("part-plain", part.plain);
      setText("part-spec", part.spec);
      buttons.forEach(function (button) {
        button.setAttribute("aria-pressed", button.getAttribute("data-part") === key ? "true" : "false");
      });
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        select(button.getAttribute("data-part"));
      });
    });
    select("station");
  }

  /* ============================ 6. 柔性直流 ============================ */
  function initHvdc() {
    var svg = $("hvdc-svg");
    var path = $("hvdc-path");
    var flow = $("hvdc-flow");
    var nodeLayer = $("hvdc-nodes");
    var list = $("hvdc-node-list");
    var button = $("hvdc-run");
    if (!svg || !path || !flow || !nodeLayer || !list) return;

    setText("hvdc-title", RD.hvdc.title);
    setText("hvdc-lead", RD.hvdc.lead);
    setText("hvdc-source", RD.hvdc.source);
    var facts = $("hvdc-facts");
    if (facts) {
      clear(facts);
      RD.hvdc.facts.forEach(function (text) { facts.appendChild(el("li", null, text)); });
    }
    clear(list);
    RD.hvdc.nodes.forEach(function (node) {
      var li = el("li");
      li.appendChild(el("b", null, node.label));
      li.appendChild(el("span", null, node.note));
      list.appendChild(li);
    });

    var total = path.getTotalLength ? path.getTotalLength() : 680;
    var fractions = [0.012, 0.345, 0.67, 0.988];
    var nodeGroups = [];
    clear(nodeLayer);
    RD.hvdc.nodes.forEach(function (node, index) {
      var point = path.getPointAtLength(total * fractions[index]);
      var group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", "hvdc-node");
      var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", "9");
      group.appendChild(circle);
      var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", point.x);
      label.setAttribute("y", point.y + 32);
      label.setAttribute("text-anchor", "middle");
      label.textContent = node.label;
      group.appendChild(label);
      nodeLayer.appendChild(group);
      nodeGroups.push(group);
    });

    var DOTS = 16;
    var dots = [];
    clear(flow);
    for (var i = 0; i < DOTS; i += 1) {
      var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("r", "3.6");
      dot.setAttribute("fill", "#ffd700");
      dot.setAttribute("opacity", "0");
      flow.appendChild(dot);
      dots.push(dot);
    }

    var rafId = 0;
    var running = false;

    function place(progress) {
      dots.forEach(function (dot, index) {
        var p = (index / DOTS + progress) % 1;
        var point = path.getPointAtLength(total * p);
        dot.setAttribute("cx", point.x);
        dot.setAttribute("cy", point.y);
        dot.setAttribute("opacity", String(0.25 + 0.75 * Math.sin(Math.PI * p)));
      });
    }

    function markNodes(progress) {
      nodeGroups.forEach(function (group, index) {
        if (progress >= fractions[index] - 0.02) group.classList.add("is-live");
        else group.classList.remove("is-live");
      });
    }

    function finish() {
      running = false;
      place(0);
      markNodes(1);
      setText("hvdc-status", "送电完成：200 台机组的电，经海上换流站整流、50 公里直流海缆上岸，再变回交流并入电网。");
    }

    function run() {
      if (reducedMotion) { finish(); return; }
      if (running) return;
      running = true;
      var began = 0;
      var duration = 5200;
      setText("hvdc-status", "正在送电……");
      function frame(now) {
        if (!began) began = now;
        var p = Math.min(1, (now - began) / duration);
        place(p * 1.2);
        markNodes(p);
        if (p < 1) rafId = window.requestAnimationFrame(frame);
        else { rafId = 0; finish(); }
      }
      rafId = window.requestAnimationFrame(frame);
    }

    if (button) button.addEventListener("click", run);
    if (reducedMotion) finish();
    else { place(0); markNodes(0); }
  }

  /* ============================ 7. 劳动者与产业链 ============================ */
  function renderPeople() {
    setText("people-lead", RD.jobsNote);
    var grid = $("job-grid");
    if (grid) {
      clear(grid);
      RD.jobs.forEach(function (job) {
        var card = el("article", "job");
        card.appendChild(el("h3", "job__name", job.name));
        card.appendChild(el("p", "job__role", job.role));
        var ul = el("ul");
        job.facts.forEach(function (fact) { ul.appendChild(el("li", null, fact)); });
        card.appendChild(ul);
        card.appendChild(el("p", "source-line", job.src));
        grid.appendChild(card);
      });
    }

    setText("chain-title", RD.chain.title);
    setText("chain-lead", RD.chain.lead);
    setText("chain-source", RD.chain.src);
    var list = $("chain-list");
    if (list) {
      clear(list);
      RD.chain.links.forEach(function (link) {
        var li = el("li");
        li.appendChild(el("b", null, link.name));
        li.appendChild(el("span", null, link.note));
        list.appendChild(li);
      });
    }
    var stats = $("chain-stats");
    if (stats) {
      clear(stats);
      RD.chain.stats.forEach(function (stat) {
        var li = el("li");
        var b = el("b");
        b.appendChild(el("span", "num", stat.value));
        b.appendChild(el("small", null, stat.unit));
        li.appendChild(b);
        li.appendChild(el("span", null, stat.label));
        li.appendChild(el("p", "source-line", stat.note));
        stats.appendChild(li);
      });
    }
  }

  /* ============================ 8. 思想对照 ============================ */
  function initTheory() {
    var list = $("theory-list");
    if (!list) return;
    setText("theory-note", RD.theoryNote);
    var buttons = [];
    RD.theory.forEach(function (item, index) {
      var button = el("button", "theory-btn");
      button.type = "button";
      button.setAttribute("data-key", item.key);
      button.setAttribute("aria-pressed", "false");
      button.appendChild(el("span", "theory-btn__idx", String(index + 1).padStart(2, "0")));
      button.appendChild(el("span", "theory-btn__label", item.label));
      list.appendChild(button);
      buttons.push(button);
    });

    function select(key) {
      var item = RD.theory.filter(function (entry) { return entry.key === key; })[0];
      if (!item) return;
      setText("theory-label", item.label);
      setText("theory-quote", item.quote);
      setText("theory-source", item.source);
      setText("theory-fact", item.fact);
      setText("theory-fact-src", "事实来源：" + item.factSrc);
      buttons.forEach(function (button) {
        button.setAttribute("aria-pressed", button.getAttribute("data-key") === key ? "true" : "false");
      });
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () { select(button.getAttribute("data-key")); });
    });
    select(RD.theory[0].key);
  }

  /* ============================ 9. 换算器 ============================ */
  function initConverter() {
    var range = $("kwh-range");
    var out = $("kwh-out");
    var results = $("convert-results");
    if (!range || !results) return;
    var config = RD.converter;
    setText("converter-title", config.title);
    setText("converter-lead", config.lead);
    setText("converter-note", config.note + "　" + config.source);
    range.min = String(config.min);
    range.max = String(config.max);
    range.value = String(config.default);

    var cells = [
      { key: "households", label: "相当于多少户家庭一年的用电量", unit: "万户" },
      { key: "coal", label: "相当于减少标准煤消耗", unit: "万吨" },
      { key: "co2", label: "相当于减少二氧化碳排放", unit: "万吨" }
    ];
    var nodes = {};
    clear(results);
    cells.forEach(function (cell) {
      var li = el("li");
      var b = el("b");
      var value = el("span", "num", "0");
      b.appendChild(value);
      b.appendChild(el("small", null, cell.unit));
      li.appendChild(b);
      li.appendChild(el("span", null, cell.label));
      results.appendChild(li);
      nodes[cell.key] = value;
    });

    function update() {
      var gwh = Number(range.value);
      if (out) out.textContent = String(gwh);
      nodes.households.textContent = fmt((gwh * config.householdsPerGwh) / 10000);
      /* 亿千瓦时 → 万吨：× 1e8 千瓦时 × 千克/千瓦时 ÷ 1e7 千克/万吨 = × 系数 × 10 */
      nodes.coal.textContent = fmt(gwh * config.coalKgPerKwh * 10);
      nodes.co2.textContent = fmt(gwh * config.co2KgPerKwh * 10);
    }
    range.addEventListener("input", update);
    update();
  }

  /* ============================ 10. 小测 ============================ */
  function initQuiz() {
    var wrap = $("quiz-list");
    var score = $("quiz-score");
    if (!wrap) return;
    clear(wrap);
    var answered = 0;
    var correct = 0;

    function refreshScore() {
      if (score) {
        score.textContent = "已答 " + answered + " / " + RD.quiz.length + " 题，答对 " + correct + " 题。";
      }
    }

    RD.quiz.forEach(function (item, index) {
      var box = el("article", "quiz-item");
      box.appendChild(el("h4", "quiz-item__q", (index + 1) + ". " + item.q));
      var opts = el("div", "quiz-item__opts");
      var feedback = el("p", "quiz-item__feedback", "");
      var done = false;
      item.options.forEach(function (text, optionIndex) {
        var button = el("button", "quiz-opt", text);
        button.type = "button";
        button.addEventListener("click", function () {
          if (done) return;
          done = true;
          answered += 1;
          var isRight = optionIndex === item.answer;
          if (isRight) correct += 1;
          button.setAttribute("data-state", isRight ? "right" : "wrong");
          if (!isRight) {
            var rightButton = opts.querySelector('[data-index="' + item.answer + '"]');
            if (rightButton) rightButton.setAttribute("data-state", "right");
          }
          feedback.innerHTML = "";
          feedback.appendChild(el("b", null, isRight ? "答对了。" : "再看看。"));
          feedback.appendChild(document.createTextNode(" " + item.explain));
          refreshScore();
        });
        button.setAttribute("data-index", String(optionIndex));
        opts.appendChild(button);
      });
      box.appendChild(opts);
      box.appendChild(feedback);
      wrap.appendChild(box);
    });
    refreshScore();
  }

  /* ============================ 11. 留言墙 ============================ */
  function initPledge() {
    var form = $("pledge-form");
    var input = $("pledge-input");
    var list = $("pledge-list");
    var presets = $("pledge-presets");
    var clearBtn = $("pledge-clear");
    if (!form || !list) return;
    setText("pledge-title", RD.pledge.title);
    setText("pledge-lead", RD.pledge.lead);
    var STORAGE_KEY = "rd-pledges-v1";
    var items = [];
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      items = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(items)) items = [];
    } catch (error) { items = []; }

    function save() {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (error) { /* 忽略隐私模式 */ }
    }
    function render() {
      clear(list);
      if (!items.length) {
        list.appendChild(el("li", "source-line", "还没有记录。写下第一件小事吧。"));
        return;
      }
      items.forEach(function (item) {
        var li = el("li");
        li.appendChild(el("span", null, item.text));
        var time = el("time", null, item.time || "");
        li.appendChild(time);
        var remove = el("button", "chip", "删除");
        remove.type = "button";
        remove.setAttribute("aria-label", "删除这条记录：" + item.text);
        remove.addEventListener("click", function () {
          items = items.filter(function (entry) { return entry.id !== item.id; });
          save();
          render();
        });
        li.appendChild(remove);
        list.appendChild(li);
      });
    }
    function add(text) {
      var trimmed = String(text || "").trim();
      if (!trimmed) return;
      items.unshift({ id: Date.now() + "-" + items.length, text: trimmed.slice(0, 40), time: new Date().toLocaleDateString("zh-CN") });
      save();
      render();
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      add(input.value);
      input.value = "";
    });
    if (presets) {
      RD.pledge.presetOptions.forEach(function (text) {
        var button = el("button", "chip", text);
        button.type = "button";
        button.addEventListener("click", function () { add(text); });
        presets.appendChild(button);
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        items = [];
        save();
        render();
      });
    }
    render();
  }

  /* ============================ 12. 数据与来源 ============================ */
  function renderSources() {
    setText("sources-title", RD.sourcesTitle);
    setText("sources-lead", RD.sourcesLead);
    var body = $("sources-body");
    if (!body) return;
    clear(body);
    RD.sources.forEach(function (row) {
      var tr = el("tr");
      tr.appendChild(el("td", null, row.fact));
      tr.appendChild(el("td", null, row.value));
      tr.appendChild(el("td", null, row.src));
      tr.appendChild(el("td", null, row.date));
      var td = el("td");
      var badge = el("span", "badge " + (row.status === "已核实" ? "badge--ok" : "badge--warn"), row.status);
      td.appendChild(badge);
      tr.appendChild(td);
      body.appendChild(tr);
    });
  }

  /* ============================ 13. 进场动画 ============================ */
  function initReveals() {
    var hasGsap = !!(window.gsap && window.ScrollTrigger);
    var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    var heroSelector = ".hero__line, .hero__lead, .hero__foot, .stat-grid > li";
    var heroNodes = Array.prototype.slice.call(document.querySelectorAll(heroSelector));

    if (hasGsap && !reducedMotion) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      reveals.forEach(function (node) {
        window.gsap.fromTo(node, { opacity: 0, y: 22 }, {
          opacity: 1, y: 0, duration: 0.7, ease: "power2.out",
          scrollTrigger: { trigger: node, start: "top 86%", once: true }
        });
      });
      window.gsap.fromTo(heroNodes, { opacity: 0, y: 18 }, {
        opacity: 1, y: 0, duration: 0.9, ease: "power2.out", stagger: 0.08, delay: 0.1
      });
      /* 序章视差：海面比文字移动得慢，制造纵深 */
      window.gsap.to(".hero__canvas", {
        yPercent: 14, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
      });
      window.gsap.to(".hero__inner", {
        yPercent: -6, opacity: 0.35, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "center center", end: "bottom top", scrub: true }
      });
      window.setTimeout(countHeroStats, 420);
      return;
    }

    heroNodes.forEach(function (node) { node.classList.add("is-in"); });

    if ("IntersectionObserver" in window && !reducedMotion) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0.05 });
      reveals.forEach(function (node) { observer.observe(node); });
    } else {
      reveals.forEach(function (node) { node.classList.add("is-in"); });
    }
    countHeroStats();
  }

  function countHeroStats() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-count]"), function (node) {
      countUp(node, Number(node.getAttribute("data-count")));
    });
  }

  /* ============================ 启动 ============================ */
  function boot() {
    setText("footer-disclaimer", RD.meta.disclaimer);
    setText("footer-updated", RD.meta.updated);
    buildNav();
    renderHero();
    renderTwins();
    initTimeline();
    renderUnitChart();
    initTurbine();
    initHvdc();
    renderPeople();
    initTheory();
    initConverter();
    initQuiz();
    initPledge();
    renderSources();
    initNavBehaviour();
    initReveals();

    var canvas = $("hero-canvas");
    if (canvas && window.RDScene) {
      var scene = window.RDScene.create(canvas);
      window.__rdHeroScene = scene;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
