/* 序章海浪与风机场景：纯 canvas 绘制，不依赖任何外部资源。
 * 200 台风机剪影分三层景深，叶片持续转动；尊重 prefers-reduced-motion。
 */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var TOTAL_TURBINES = 200;
  /* 三层景深的风机剪影颜色：越远越淡，融进深蓝夜色 */
  var LAYER_COLORS = ["#123f78", "#0a2650", "#040f28"];

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

  function buildFleet() {
    var rand = makeRandom(20211009);
    var layers = [
      { count: 90, scale: 0.27, alpha: 0.4, yOff: 4, speed: 0.22 },
      { count: 65, scale: 0.45, alpha: 0.55, yOff: 13, speed: 0.3 },
      { count: 45, scale: 0.8, alpha: 0.72, yOff: 24, speed: 0.38 }
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
          layer: li
        });
      }
    });
    return fleet;
  }

  function createScene(canvas) {
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;

    var fleet = buildFleet();
    var width = 0;
    var height = 0;
    var dpr = 1;
    var horizon = 0;
    var running = false;
    var visible = true;
    var rafId = 0;
    var last = 0;
    var time = 0;
    var reduced = prefersReduced();

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
      if (reduced) draw(0);
    }

    function turbine(x, yBase, scale, rot, alpha, color) {
      var towerH = 58 * scale;
      var hubY = yBase - towerH;
      var radius = 15 * scale;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1, 2.4 * scale);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, yBase);
      ctx.lineTo(x, hubY);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, 2 * scale);
      for (var i = 0; i < 3; i += 1) {
        var a = rot + (i * TAU) / 3;
        ctx.beginPath();
        ctx.moveTo(x, hubY);
        ctx.lineTo(x + Math.cos(a) * radius, hubY + Math.sin(a) * radius);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, hubY, Math.max(1, 2.2 * scale), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawSea() {
      var seaGrad = ctx.createLinearGradient(0, horizon, 0, height);
      seaGrad.addColorStop(0, "#0e2f61");
      seaGrad.addColorStop(0.35, "#0a2150");
      seaGrad.addColorStop(1, "#061535");
      ctx.fillStyle = seaGrad;
      ctx.fillRect(0, horizon, width, height - horizon);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < 5; i += 1) {
        var p = i / 4;
        var y = horizon + 6 + p * p * (height - horizon) * 0.9;
        var amp = 2 + p * 9;
        var speed = 0.5 + p * 0.5;
        ctx.beginPath();
        for (var x = -20; x <= width + 20; x += 12) {
          var wy = y + Math.sin((x / (90 - p * 40)) + time * speed + i) * amp;
          if (x === -20) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.strokeStyle = "rgba(147,186,245," + (0.04 + p * 0.09) + ")";
        ctx.lineWidth = 1 + p;
        ctx.stroke();
      }
      ctx.restore();

      var glow = ctx.createLinearGradient(0, horizon - 60, 0, horizon + 70);
      glow.addColorStop(0, "rgba(6,21,48,0)");
      glow.addColorStop(0.5, "rgba(255,215,0,.16)");
      glow.addColorStop(1, "rgba(6,21,48,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, horizon - 60, width, 130);
    }

    function drawStreaks() {
      ctx.save();
      ctx.strokeStyle = "rgba(255,215,0,.08)";
      ctx.lineWidth = 1;
      for (var i = 0; i < 16; i += 1) {
        var seedY = ((i * 97) % 100) / 100;
        var y = horizon - 140 + seedY * (horizon * 0.85);
        var len = 40 + ((i * 37) % 90);
        var drift = ((time * (14 + (i % 5) * 6) + i * 120) % (width + 260)) - 130;
        ctx.beginPath();
        ctx.moveTo(drift, y);
        ctx.lineTo(drift + len, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function draw(dt) {
      ctx.clearRect(0, 0, width, height);
      drawSea();
      drawStreaks();
      for (var i = 0; i < fleet.length; i += 1) {
        var t = fleet[i];
        turbine(
          t.x * (width + 60) - 30,
          horizon + t.yOff,
          t.scale * (0.75 + Math.min(width, 1600) / 1600),
          t.phase + time * t.speed,
          t.alpha,
          LAYER_COLORS[t.layer]
        );
      }
    }

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
      destroy: stop,
      get isRunning() {
        return running;
      },
      get turbineCount() {
        return fleet.length;
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
