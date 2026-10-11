/* 序章循环场景：夜空 / 月光 / 海浪 / 200 台风机 / 一只奶蛙（彩蛋）
 * 纯 canvas 绘制，不依赖任何外部资源；尊重 prefers-reduced-motion。
 *
 * 图层由远及近（这就是"多图层"的地方）：
 *   ① 星空 · 月亮 · 流星 · 海鸟          ⑤ 中景风机 60 台 · 运维船
 *   ② 远处海雾                            ⑥ 中景浪 3–5 道 · 月光碎波
 *   ③ 远景风机 100 台                     ⑦ 近景风机 40 台
 *   ④ 中景浪 1–2 道                       ⑧ 近景浪 6–8 道
 *   ⑨ 两侧取景大风机（宽屏才出现）  ⑩ 水面涟漪 · 奶蛙
 *
 * 彩蛋：每 26 秒会有一只奶蛙从海面游过（点击序章任意位置可以让它跳一下）。
 */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var TOTAL_TURBINES = 200;

  /* Catppuccin Mocha：与 assets/style.css 共用同一套色板 */
  var C = {
    crust: "#11111b",
    mantle: "#181825",
    base: "#1e1e2e",
    surface0: "#313244",
    overlay2: "#9399b2",
    text: "#cdd6f4",
    rosewater: "#f5e0dc",
    pink: "#f5c2e7",
    red: "#f38ba8",
    yellow: "#f9e2af",
    green: "#a6e3a1",
    teal: "#94e2d5",
    sapphire: "#74c7ec",
    blue: "#89b4fa",
    lavender: "#b4befe"
  };

  /* 三层景深的风机剪影：越远越淡，融进靛蓝夜色；最前一层接近纯黑，
   * 保证海平线上始终能看清剪影，又不会让画面发灰。 */
  var LAYER_COLORS = ["#2c2d42", "#191a29", "#0b0c15"];

  /* 七道浪：k 为"离海平线多远"（相对海面高度），由远及近依次变暗、变陡。
   * k 必须 < 1，否则浪脊落到画布外面就白画了。 */
  var WAVES = [
    { k: 0.08, amp: 2.4, len: 300, speed: 0.16, fill: "rgba(24,24,37,.40)", edge: "rgba(180,190,254,.10)", lw: 1 },
    { k: 0.22, amp: 3.8, len: 250, speed: 0.23, fill: "rgba(20,20,32,.50)", edge: "rgba(116,199,236,.13)", lw: 1 },
    { k: 0.36, amp: 5.4, len: 212, speed: 0.32, fill: "rgba(17,17,27,.58)", edge: "rgba(148,226,213,.14)", lw: 1.2 },
    { k: 0.50, amp: 7.2, len: 182, speed: 0.43, fill: "rgba(14,14,23,.68)", edge: "rgba(137,180,250,.16)", lw: 1.4 },
    { k: 0.64, amp: 9.4, len: 152, speed: 0.55, fill: "rgba(11,11,19,.78)", edge: "rgba(148,226,213,.18)", lw: 1.6 },
    { k: 0.78, amp: 12.0, len: 124, speed: 0.70, fill: "rgba(9,9,15,.87)", edge: "rgba(205,214,244,.20)", lw: 1.8 },
    { k: 0.92, amp: 15.5, len: 98, speed: 0.88, fill: "rgba(7,7,12,.94)", edge: "rgba(205,214,244,.22)", lw: 2, full: true }
  ];

  var STAR_COUNT = 84;
  var FROG_CYCLE = 26;      /* 奶蛙出现的周期（秒） */
  var FROG_WINDOW = 13;     /* 其中"在场"的时长（秒） */

  function prefersReduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function makeRandom(seed) {
    var s = seed;
    return function () {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }

  /* ------------------------------ 预生成数据 ------------------------------ */
  function buildFleet() {
    var rand = makeRandom(20211009);
    var layers = [
      { count: 100, scale: 0.24, alpha: 0.42, yOff: 2, speed: 0.20 },
      { count: 60, scale: 0.42, alpha: 0.58, yOff: 11, speed: 0.28 },
      { count: 40, scale: 0.76, alpha: 0.78, yOff: 22, speed: 0.36 }
    ];
    var fleet = [];
    var used = 0;
    layers.forEach(function (layer, li) {
      for (var i = 0; i < layer.count && used < TOTAL_TURBINES; i += 1) {
        used += 1;
        fleet.push({
          x: (i + rand() * 0.9) / layer.count,
          scale: layer.scale * (0.85 + rand() * 0.3),
          alpha: layer.alpha * (0.85 + rand() * 0.3),
          yOff: layer.yOff + rand() * 7,
          speed: layer.speed * (0.7 + rand() * 0.8),
          phase: rand() * TAU,
          layer: li,
          light: rand() * TAU          /* 机舱警示灯的闪烁相位 */
        });
      }
    });
    return fleet;
  }

  function buildStars() {
    var rand = makeRandom(20020917);
    var list = [];
    for (var i = 0; i < STAR_COUNT; i += 1) {
      list.push({
        x: rand(),
        y: rand() * 0.86,
        r: 0.5 + rand() * 0.95,
        a: 0.16 + rand() * 0.34,
        speed: 0.5 + rand() * 1.6,
        phase: rand() * TAU
      });
    }
    return list;
  }

  function buildFoam() {
    var rand = makeRandom(20211231);
    var list = [];
    for (var i = 0; i < 64; i += 1) {
      list.push({
        x: rand(),
        k: 0.5 + rand() * 0.5,
        w: 6 + rand() * 26,
        a: 0.05 + rand() * 0.16,
        speed: 0.5 + rand() * 1.2,
        phase: rand() * TAU
      });
    }
    return list;
  }

  function createScene(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    var fleet = buildFleet();
    var stars = buildStars();
    var foam = buildFoam();
    var width = 0;
    var height = 0;
    var seaH = 0;
    var dpr = 1;
    var horizon = 0;
    var scaleFit = 1;
    var running = false;
    var visible = true;
    var rafId = 0;
    var last = 0;
    /* 从"奶蛙还没出现"的那一刻开始计时：首屏干净，约 10 秒后它自己游过来，
       着急的时候点一下序章就能把它叫出来。 */
    var time = FROG_WINDOW + 3.2;
    var reduced = prefersReduced();
    var ripples = [];
    var hop = 0;
    var airborne = false;

    function seaY(k) { return horizon + seaH * k; }

    /* 两个正弦叠加：浪形不会机械地重复 */
    function wobble(x, len, speed, phase, t) {
      var base = Math.sin((x / len) * TAU + t * speed + phase);
      var second = Math.sin((x / (len * 0.41)) * TAU - t * speed * 1.7 + phase * 1.7) * 0.34;
      return base + second;
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      horizon = Math.round(height * 0.58);
      seaH = height - horizon;
      scaleFit = 0.72 + (Math.min(width, 1600) / 1600) * 0.36;
      if (reduced) draw(0);
    }

    /* ------------------------------ ① 星空 / 月亮 / 薄云 ------------------------------ */
    function drawSky() {
      /* 窄屏时正文会占满整个首屏，月亮要挪到右上角，别落到标题后面 */
      var narrow = width < 720;
      var moonX = width * (narrow ? 0.84 : 0.74);
      var moonY = height * (narrow ? 0.075 : 0.17);
      var moonR = Math.max(narrow ? 11 : 14, Math.min(width, 1500) * 0.019);

      ctx.save();
      for (var i = 0; i < stars.length; i += 1) {
        var star = stars[i];
        var twinkle = 0.55 + 0.45 * Math.sin(time * star.speed + star.phase);
        ctx.globalAlpha = star.a * twinkle;
        ctx.fillStyle = i % 7 === 0 ? C.lavender : C.text;
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * horizon, star.r, 0, TAU);
        ctx.fill();
      }

      var glow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 9);
      glow.addColorStop(0, "rgba(245,224,220,.20)");
      glow.addColorStop(0.35, "rgba(249,226,175,.10)");
      glow.addColorStop(1, "rgba(249,226,175,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.fillRect(moonX - moonR * 9, moonY - moonR * 9, moonR * 18, moonR * 18);

      ctx.globalAlpha = 0.92;
      ctx.fillStyle = C.rosewater;
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR, 0, TAU);
      ctx.fill();

      /* 三片横向拉长的高空薄云：只加层次，不压暗天空 */
      var clouds = [
        { y: 0.16, a: 0.08, w: 0.72, o: 0.02, s: 0.010, c: "rgba(180,190,254," },
        { y: 0.26, a: 0.06, w: 0.55, o: 0.55, s: 0.014, c: "rgba(137,220,235," },
        { y: 0.36, a: 0.05, w: 0.66, o: 0.30, s: 0.008, c: "rgba(137,180,250," }
      ];
      clouds.forEach(function (cloud) {
        var drift = ((time * cloud.s + cloud.o) % 1.4) - 0.2;
        var cx = drift * width;
        var cw = cloud.w * width;
        var grad = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
        grad.addColorStop(0, "rgba(205,214,244,0)");
        grad.addColorStop(0.5, cloud.c + cloud.a + ")");
        grad.addColorStop(1, "rgba(205,214,244,0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cloud.y * horizon, cw / 2, Math.max(4, horizon * 0.03), 0, 0, TAU);
        ctx.fill();
      });
      ctx.restore();
    }

    /* 海鸟：三只各自循环飞过，翅膀是两段贝塞尔弧 */
    function drawBirds() {
      for (var i = 0; i < 3; i += 1) {
        var cycle = 44 + i * 7;
        var p = ((time + i * 13) % cycle) / cycle;
        if (p > 0.42) continue;
        var t = p / 0.42;
        var dir = i % 2 === 0 ? 1 : -1;
        var x = dir > 0 ? -0.06 * width + t * width * 1.12 : width * 1.06 - t * width * 1.12;
        var y = horizon * (0.24 + i * 0.07) + Math.sin(t * TAU * 1.4 + i) * 12;
        var flap = Math.sin(time * 5.2 + i * 2.1);
        var s = (1.6 + i * 0.35) * scaleFit;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = C.text;
        ctx.lineWidth = 1.15;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x - 5 * s, y + flap * 3.4 * s);
        ctx.quadraticCurveTo(x - 2.4 * s, y - 1.6 * s, x, y);
        ctx.quadraticCurveTo(x + 2.4 * s, y - 1.6 * s, x + 5 * s, y + flap * 3.4 * s);
        ctx.stroke();
        ctx.restore();
      }
    }

    /* ------------------------------ ② 海面底与远处海雾 ------------------------------ */
    function drawSeaBase() {
      var grad = ctx.createLinearGradient(0, horizon, 0, height);
      grad.addColorStop(0, "#2a2a44");
      grad.addColorStop(0.14, "#1d1d31");
      grad.addColorStop(0.46, "#151522");
      grad.addColorStop(1, C.crust);
      ctx.fillStyle = grad;
      ctx.fillRect(0, horizon, width, seaH);

      var lineGrad = ctx.createLinearGradient(0, 0, width, 0);
      lineGrad.addColorStop(0, "rgba(137,180,250,.05)");
      lineGrad.addColorStop(0.5, "rgba(205,214,244,.34)");
      lineGrad.addColorStop(1, "rgba(148,226,213,.08)");
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = lineGrad;
      ctx.fillRect(0, horizon - 1, width, 1.4);
      ctx.restore();

      var fog = ctx.createLinearGradient(0, horizon - 34, 0, horizon + 46);
      fog.addColorStop(0, "rgba(24,24,37,0)");
      fog.addColorStop(0.62, "rgba(137,180,250,.16)");
      fog.addColorStop(1, "rgba(24,24,37,0)");
      ctx.fillStyle = fog;
      ctx.fillRect(0, horizon - 34, width, 80);
    }

    /* 月光碎波：从海平线向下逐段变宽、变散 */
    function drawMoonPath() {
      var cx = width * (width < 720 ? 0.84 : 0.74);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < 32; i += 1) {
        var p = i / 31;
        var y = horizon + 3 + p * p * seaH * 0.82;
        var half = (6 + p * 74) * (0.7 + 0.3 * Math.sin(time * 0.9 + i));
        var shimmer = 0.5 + 0.5 * Math.sin(time * 1.9 + i * 1.31);
        ctx.globalAlpha = (0.16 - p * 0.10) * shimmer;
        ctx.fillStyle = i % 5 === 0 ? C.yellow : C.rosewater;
        ctx.fillRect(cx - half / 2 + Math.sin(time * 0.7 + i * 0.4) * p * 26, y, half, 1.25 + p * 1.1);
      }
      ctx.restore();
    }

    /* 浪脊采样点缓存：填充与描边共用同一组点，正弦只算一遍 */
    var WAVE_STEP = 16;
    var crestBuf = [];

    function buildCrest(band, index) {
      var y = seaY(band.k);
      var phase = index * 1.7;
      crestBuf.length = 0;
      for (var x = -24; x <= width + 24; x += WAVE_STEP) {
        crestBuf.push(x, y + wobble(x, band.len, band.speed, phase, time) * band.amp);
      }
    }

    /* 一道浪：先铺填充，再描浪脊，最近的两道再撒几点碎沫 */
    function drawWave(band, index) {
      buildCrest(band, index);
      var n = crestBuf.length;
      var i;

      ctx.beginPath();
      ctx.moveTo(crestBuf[0], crestBuf[1]);
      for (i = 2; i < n; i += 2) ctx.lineTo(crestBuf[i], crestBuf[i + 1]);
      /* 只铺到"下一道更近的浪"下方一点点就够了：把整片海面重复填七遍纯属浪费，
         软件光栅化时这一项就能吃掉一半帧时间。 */
      var bottom = band.full ? height + 24 : Math.min(height + 24, seaY(band.k) + seaH * 0.30);
      ctx.lineTo(width + 24, bottom);
      ctx.lineTo(-24, bottom);
      ctx.closePath();
      ctx.fillStyle = band.fill;
      ctx.fill();

      ctx.save();
      ctx.strokeStyle = band.edge;
      ctx.lineWidth = band.lw;
      ctx.beginPath();
      ctx.moveTo(crestBuf[0], crestBuf[1]);
      for (i = 2; i < n; i += 2) ctx.lineTo(crestBuf[i], crestBuf[i + 1]);
      ctx.stroke();

      if (index >= 4) {
        ctx.lineCap = "round";
        ctx.strokeStyle = "rgba(205,214,244,.40)";
        ctx.lineWidth = 1.1;
        ctx.globalAlpha = 0.6;
        for (i = 0; i < 7; i += 1) {
          var fx = ((i * 137.5 * 1.7 + time * (10 + i * 3) + index * 91) % (width + 160)) - 80;
          /* 碎沫直接落在缓存的浪脊上，不再重算正弦 */
          var at = Math.min(crestBuf.length / 2 - 1, Math.max(0, Math.round((fx + 24) / WAVE_STEP)));
          ctx.beginPath();
          ctx.moveTo(fx, crestBuf[at * 2 + 1]);
          ctx.lineTo(fx + 7 + (i % 4) * 5, crestBuf[at * 2 + 1]);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function drawFoam() {
      ctx.save();
      ctx.fillStyle = C.text;
      for (var i = 0; i < foam.length; i += 1) {
        var f = foam[i];
        var y = seaY(f.k) + Math.sin(time * f.speed + f.phase) * 3;
        ctx.globalAlpha = f.a * (0.6 + 0.4 * Math.sin(time * f.speed * 1.4 + f.phase));
        ctx.fillRect(((f.x * width + time * (6 + f.speed * 8)) % (width + 60)) - 30, y, f.w, 1);
      }
      ctx.restore();
    }

    /* ------------------------------ 风机 ------------------------------ */
    function drawTurbine(x, yBase, scale, rot, alpha, color, lightPhase) {
      var towerH = 58 * scale;
      var hubY = yBase - towerH;
      var hubR = Math.max(1, 2.3 * scale);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = "round";

      ctx.lineWidth = Math.max(1, 2.5 * scale);
      ctx.beginPath();
      ctx.moveTo(x, yBase);
      ctx.lineTo(x, hubY);
      ctx.stroke();

      if (scale > 0.42) ctx.fillRect(x + hubR, hubY - 1.5 * scale, 6.4 * scale, 3 * scale);

      var radius = 15 * scale;
      for (var i = 0; i < 3; i += 1) {
        var a = rot + (i * TAU) / 3;
        var bx = x + Math.cos(a) * radius;
        var by = hubY + Math.sin(a) * radius;
        if (scale > 0.62) {
          /* 近处用梯形叶片，远处一根线就够 */
          var px = -Math.sin(a);
          var py = Math.cos(a);
          var w1 = 1.15 * scale;
          var w2 = 0.4 * scale;
          ctx.beginPath();
          ctx.moveTo(x + px * w1, hubY + py * w1);
          ctx.lineTo(bx + px * w2, by + py * w2);
          ctx.lineTo(bx - px * w2, by - py * w2);
          ctx.lineTo(x - px * w1, hubY - py * w1);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.lineWidth = Math.max(1, 1.9 * scale);
          ctx.beginPath();
          ctx.moveTo(x, hubY);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }

      ctx.beginPath();
      ctx.arc(x, hubY, hubR, 0, TAU);
      ctx.fill();

      /* 机舱航空警示灯：只给最近一层画，错峰闪烁 */
      if (lightPhase !== undefined) {
        var blink = Math.pow(Math.max(0, Math.sin(time * 1.5 + lightPhase)), 6);
        if (blink > 0.02) {
          ctx.globalAlpha = alpha * (0.35 + blink * 0.65);
          ctx.fillStyle = C.red;
          ctx.beginPath();
          ctx.arc(x + hubR + 6.4 * scale, hubY - 0.6 * scale, Math.max(0.7, 1.1 * scale), 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    /* 航标：两座小浮标随浪起伏，夜里一闪一闪，给海面一点"有人"的痕迹 */
    function drawBuoy(spot) {
      var x = spot.x * width;
      var y = seaY(spot.k) + Math.sin(time * 0.8 + spot.phase) * 2.4;
      var s = spot.s * Math.max(0.72, scaleFit * 0.9);
      var blink = Math.pow(Math.max(0, Math.sin(time * 1.25 + spot.phase)), 4);
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = "#0d0e18";
      ctx.beginPath();
      ctx.moveTo(x - 3.6 * s, y);
      ctx.lineTo(x + 3.6 * s, y);
      ctx.lineTo(x + 2 * s, y + 5 * s);
      ctx.lineTo(x - 2 * s, y + 5 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - 0.8 * s, y - 7 * s, 1.6 * s, 7 * s);

      if (blink > 0.02) {
        ctx.globalAlpha = 0.3 + blink * 0.7;
        ctx.fillStyle = C.yellow;
        ctx.beginPath();
        ctx.arc(x, y - 7.6 * s, Math.max(1, 1.7 * s), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.22 * blink;
        ctx.fillRect(x - 0.7 * s, y - 6 * s, 1.4 * s, 13 * s);
      }
      ctx.restore();
    }

    var BUOYS = [
      { x: 0.17, k: 0.30, phase: 0.0, s: 0.9, after: 1 },
      { x: 0.63, k: 0.52, phase: 2.1, s: 1.15, after: 3 }
    ];

    /* ------------------------------ 运维船 ------------------------------ */
    function drawVessel() {
      var period = 96;
      var p = (time % period) / period;
      var x = -0.12 * width + p * width * 1.24;
      var y = seaY(0.20) + Math.sin(time * 0.9) * 1.6;
      var s = Math.max(0.6, scaleFit * 0.72);
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = "#141522";
      ctx.beginPath();
      ctx.moveTo(x - 16 * s, y);
      ctx.lineTo(x + 18 * s, y);
      ctx.lineTo(x + 13 * s, y + 4.4 * s);
      ctx.lineTo(x - 13 * s, y + 4.4 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - 6 * s, y - 5 * s, 11 * s, 5 * s);

      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = C.text;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 24 * s, y + 3.4 * s);
      ctx.lineTo(x - 46 * s, y + 4.4 * s);
      ctx.moveTo(x + 20 * s, y + 3.4 * s);
      ctx.lineTo(x + 40 * s, y + 4.4 * s);
      ctx.stroke();

      ctx.globalAlpha = 0.5 + (0.5 + 0.5 * Math.sin(time * 2.4)) * 0.4;
      ctx.fillStyle = C.yellow;
      ctx.fillRect(x - 1 * s, y - 8.4 * s, 1.6 * s, 3.4 * s);
      ctx.restore();
    }

    /* ------------------------------ ⑩ 涟漪与奶蛙 ------------------------------ */
    function addRipple(x, y) {
      ripples.push({ x: x, y: y, life: 0 });
      if (ripples.length > 8) ripples.shift();
    }

    function drawRipples(dt) {
      ctx.save();
      ctx.strokeStyle = C.teal;
      ctx.lineWidth = 1.2;
      for (var i = ripples.length - 1; i >= 0; i -= 1) {
        var r = ripples[i];
        r.life += dt * 1.5;
        if (r.life >= 1) { ripples.splice(i, 1); continue; }
        var rx = 10 + r.life * 54;
        ctx.globalAlpha = (1 - r.life) * 0.5;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rx, rx * 0.22, 0, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = (1 - r.life) * 0.28;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, rx * 0.62, rx * 0.16, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* 奶蛙本蛙：圆身子、会眨眼、头顶一滴奶、旁边冒"呱" */
    function drawFrog(x, y, s, blink, bubble, milk) {
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = "#08080e";
      ctx.beginPath();
      ctx.ellipse(x, y + 12 * s, 21 * s, 4.6 * s, 0, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#8fd8b4";
      ctx.beginPath();
      ctx.ellipse(x - 15 * s, y + 7 * s, 7.5 * s, 5 * s, -0.35, 0, TAU);
      ctx.ellipse(x + 15 * s, y + 7 * s, 7.5 * s, 5 * s, 0.35, 0, TAU);
      ctx.fill();

      var body = ctx.createLinearGradient(x, y - 13 * s, x, y + 13 * s);
      body.addColorStop(0, C.green);
      body.addColorStop(0.55, "#8ee0bd");
      body.addColorStop(1, C.teal);
      ctx.globalAlpha = 1;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(x, y, 18 * s, 13.5 * s, 0, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 0.55;
      ctx.fillStyle = C.rosewater;
      ctx.beginPath();
      ctx.ellipse(x, y + 4.6 * s, 11 * s, 7 * s, 0, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 0.45;
      ctx.fillStyle = C.pink;
      ctx.beginPath();
      ctx.arc(x - 11.5 * s, y - 1.4 * s, 2.6 * s, 0, TAU);
      ctx.arc(x + 11.5 * s, y - 1.4 * s, 2.6 * s, 0, TAU);
      ctx.fill();

      var eyes = [[-7 * s, -9.6 * s], [7 * s, -9.6 * s]];
      ctx.globalAlpha = 1;
      eyes.forEach(function (eye) {
        if (blink) {
          ctx.strokeStyle = "#0d1a16";
          ctx.lineWidth = 1.3 * s;
          ctx.beginPath();
          ctx.moveTo(x + eye[0] - 3.6 * s, y + eye[1]);
          ctx.lineTo(x + eye[0] + 3.6 * s, y + eye[1]);
          ctx.stroke();
          return;
        }
        ctx.fillStyle = "#f7fbff";
        ctx.beginPath();
        ctx.arc(x + eye[0], y + eye[1], 4.6 * s, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#0d1a16";
        ctx.beginPath();
        ctx.arc(x + eye[0] + 0.7 * s, y + eye[1] + 0.5 * s, 2.2 * s, 0, TAU);
        ctx.fill();
      });

      ctx.strokeStyle = "#123024";
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.arc(x, y + 1.6 * s, 4.4 * s, 0.22 * Math.PI, 0.78 * Math.PI);
      ctx.stroke();

      if (milk > 0.02) {
        ctx.globalAlpha = milk;
        ctx.fillStyle = "#fdfdff";
        ctx.beginPath();
        ctx.moveTo(x + 20 * s, y - 20 * s);
        ctx.quadraticCurveTo(x + 24.6 * s, y - 26 * s, x + 20 * s, y - 30 * s);
        ctx.quadraticCurveTo(x + 15.4 * s, y - 26 * s, x + 20 * s, y - 20 * s);
        ctx.closePath();
        ctx.fill();
      }

      if (bubble > 0.02) {
        ctx.globalAlpha = bubble;
        var bx = x + 20 * s;
        var by = y - 36 * s;
        ctx.fillStyle = "rgba(30,30,46,.78)";
        ctx.strokeStyle = C.teal;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, 26 * s, 17 * s, 5 * s);
        else ctx.rect(bx, by, 26 * s, 17 * s);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = C.text;
        ctx.font = Math.round(10 * s) + 'px "Microsoft YaHei", "PingFang SC", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("呱", bx + 13 * s, by + 9 * s);
      }
      ctx.restore();
    }

    /* 奶蛙的出现节奏：周期 26 秒，出现在前 13 秒，左右方向轮流 */
    function frogState() {
      /* 减少动态效果时不播放游泳动画，只静静地蹲在海面上（静态画面） */
      if (reduced) {
        return {
          x: width * 0.68,
          y: seaY(0.17),
          s: Math.max(0.72, Math.min(width, 1500) / 1440) * 1.05,
          squash: 1,
          blink: false,
          bubble: 0,
          milk: 0.75
        };
      }
      var cycleIndex = Math.floor(time / FROG_CYCLE);
      var phase = time - cycleIndex * FROG_CYCLE;
      if (phase > FROG_WINDOW) return null;
      var p = phase / FROG_WINDOW;
      var leftToRight = cycleIndex % 2 === 0;
      var s = Math.max(0.72, Math.min(width, 1500) / 1440) * 1.05;
      var hopLift = hop > 0 ? Math.sin(Math.PI * hop) * 30 * s : 0;
      return {
        x: leftToRight ? -0.05 * width + p * width * 1.10 : width * 1.05 - p * width * 1.10,
        y: seaY(0.17) + Math.sin(time * 1.7) * 2.6 - hopLift,
        s: s,
        squash: hop > 0 ? 1 - Math.cos(Math.PI * hop) * 0.12 : 1,
        blink: Math.sin(time * 1.9) > 0.985 || (hop > 0 && hop < 0.2),
        bubble: Math.max(0, Math.sin((p - 0.25) * Math.PI * 2.6)) * 0.9,
        milk: hop > 0 ? 1 : 0.75
      };
    }

    function drawFrogLayer() {
      var frog = frogState();
      if (!frog) return;
      ctx.save();
      ctx.translate(frog.x, frog.y);
      ctx.scale(1, frog.squash);
      ctx.translate(-frog.x, -frog.y);
      drawFrog(frog.x, frog.y, frog.s, frog.blink, frog.bubble, frog.milk);
      ctx.restore();
    }

    /* ------------------------------ 主绘制 ------------------------------ */
    function draw(dt) {
      var i;
      var t;
      ctx.clearRect(0, 0, width, height);
      drawSky();
      drawBirds();
      drawSeaBase();

      for (i = 0; i < fleet.length; i += 1) {
        t = fleet[i];
        if (t.layer !== 0) continue;
        drawTurbine(t.x * (width + 60) - 30, horizon + t.yOff, t.scale * scaleFit,
          t.phase + time * t.speed, t.alpha, LAYER_COLORS[0]);
      }

      drawMoonPath();
      drawWave(WAVES[0], 0);
      drawWave(WAVES[1], 1);
      drawBuoy(BUOYS[0]);

      for (i = 0; i < fleet.length; i += 1) {
        t = fleet[i];
        if (t.layer !== 1) continue;
        drawTurbine(t.x * (width + 60) - 30, horizon + t.yOff, t.scale * scaleFit,
          t.phase + time * t.speed, t.alpha, LAYER_COLORS[1]);
      }
      drawVessel();

      drawWave(WAVES[2], 2);
      drawWave(WAVES[3], 3);
      drawBuoy(BUOYS[1]);
      drawWave(WAVES[4], 4);

      for (i = 0; i < fleet.length; i += 1) {
        t = fleet[i];
        if (t.layer !== 2) continue;
        drawTurbine(t.x * (width + 60) - 30, horizon + t.yOff, t.scale * scaleFit,
          t.phase + time * t.speed, t.alpha, LAYER_COLORS[2], t.light);
      }

      drawWave(WAVES[5], 5);
      drawWave(WAVES[6], 6);
      drawFoam();

      if (hop > 0) {
        hop = Math.max(0, hop - dt * 1.7);
        if (hop === 0 && airborne) {
          airborne = false;
          var resting = frogState();
          if (resting) addRipple(resting.x, resting.y + 5);
        }
      }
      drawFrogLayer();
      drawRipples(dt);
    }

    /* ------------------------------ 循环 ------------------------------ */
    function frame(now) {
      if (!running) return;
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      time += dt;
      draw(dt);
      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      if (reduced || running || !visible) return;
      running = true;
      last = 0;
      rafId = window.requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    /* 点一下序章：奶蛙跳一下；它不在场时就把它叫出来 */
    function poke() {
      if (reduced) return;
      if (!frogState()) time = Math.floor(time / FROG_CYCLE) * FROG_CYCLE + FROG_WINDOW * 0.3;
      hop = 1;
      airborne = true;
      var frog = frogState();
      if (frog) addRipple(frog.x, frog.y + 5);
    }

    resize();
    if (reduced) draw(0);
    else start();

    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(function () {
        resize();
        if (reduced) draw(0);
      });
      ro.observe(canvas);
    } else {
      window.addEventListener("resize", resize);
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            visible = entry.isIntersecting;
            if (visible) start();
            else stop();
          });
        },
        { threshold: 0 }
      );
      io.observe(canvas.parentElement || canvas);
    }

    var stage = canvas.parentElement;
    if (stage) stage.addEventListener("click", poke);

    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      var onChange = function (event) {
        reduced = event.matches;
        if (reduced) {
          stop();
          draw(0);
        } else {
          start();
        }
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    return {
      drawStatic: function () {
        resize();
        draw(0);
      },
      destroy: function () {
        stop();
        if (stage) stage.removeEventListener("click", poke);
      },
      poke: poke,
      get isRunning() {
        return running;
      },
      get turbineCount() {
        return fleet.length;
      },
      /* 图层明细：测试与设计文档都靠它核对"多层"这件事 */
      get detail() {
        return { stars: stars.length, waves: WAVES.length, foam: foam.length, turbines: fleet.length };
      },
      get frogVisible() {
        return !!frogState();
      }
    };
  }

  window.RDScene = {
    create: function (canvas) {
      if (!canvas || !canvas.getContext) return null;
      return createScene(canvas);
    },
    prefersReducedMotion: prefersReduced,
    totalTurbines: TOTAL_TURBINES
  };
})();
