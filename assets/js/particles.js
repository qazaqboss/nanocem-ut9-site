/* ===========================================================
   particles.js — сигнатура: проникновение частиц сквозь трещину
   + слайдер масштаба частиц (§5.3)
   Чистый Canvas, без библиотек.
   =========================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function palette() {
    var css = getComputedStyle(document.documentElement);
    return {
      accent: css.getPropertyValue('--accent').trim() || '#6E7F6A',
      muted: css.getPropertyValue('--muted').trim() || '#8A8F88',
      paper: css.getPropertyValue('--paper').trim() || '#F5F6F3',
      ink: css.getPropertyValue('--ink').trim() || '#1A1C1A',
      line: css.getPropertyValue('--line').trim() || '#D6D9D3'
    };
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }

  // подгонка канваса под контейнер с учётом devicePixelRatio
  function fit(canvas, ctx) {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }

  // высота, на которой частица ложится поверх уже застрявших — пробка растёт куполом
  function restY(p, list, floorY) {
    var y = floorY - p.r;
    for (var i = 0; i < list.length; i++) {
      var q = list[i];
      if (q === p) continue;
      var dx = p.x - q.x, minD = p.r + q.r;
      if (Math.abs(dx) >= minD) continue;
      var top = q.y - Math.sqrt(minD * minD - dx * dx);
      if (top < y) y = top;
    }
    return y;
  }

  // мягкое расталкивание пробки, чтобы частицы не схлопывались в одну точку
  function separate(list, floorY) {
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      for (var k = i + 1; k < list.length; k++) {
        var b = list[k];
        var dx = a.x - b.x, dy = a.y - b.y;
        var minD = a.r + b.r;
        var d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) continue;
        var d = Math.sqrt(d2) || 0.001;
        // если центры совпали — расходимся по горизонтали
        if (d < 0.05) { dx = (Math.random() - 0.5) || 0.5; dy = -0.5; d = 1; }
        var push = (minD - d) / d * 0.4;
        a.x += dx * push; a.y += dy * push;
        b.x -= dx * push; b.y -= dy * push;
      }
      if (a.y + a.r > floorY) a.y = floorY - a.r;
    }
  }

  /* ====================================================
     1. HERO — два потока: пробка vs сквозное проникновение
     ==================================================== */
  var heroCanvas = document.getElementById('heroCanvas');
  if (heroCanvas) initHero(heroCanvas);

  function initHero(canvas) {
    var ctx = canvas.getContext('2d');
    var col = palette();
    var W = 0, H = 0;

    var S = {};        // геометрия сцены
    var grain = [];    // статичная фактура породы
    var coarse = [];   // обычный цемент — застревает на устье
    var fine = [];     // NanoCem UT-9 — проходит в глубину
    var t0 = 0;        // старт анимации

    function layout() {
      var size = fit(canvas, ctx);
      W = size.w; H = size.h;

      // на широких экранах сцена уходит вправо, чтобы не спорить с заголовком
      var wide = W >= 900;
      S.boxX = wide ? W * 0.54 : 0;
      S.boxW = wide ? W * 0.46 : W;
      S.cx = S.boxX + S.boxW * (wide ? 0.44 : 0.5);
      S.rockTop = Math.round(H * (wide ? 0.40 : 0.46));
      // канал заведомо уже крупной фракции (Ø 18–26 px) и шире ультратонкой
      S.chW = clamp(S.boxW * 0.035, 10, 18);
      S.depth = H - S.rockTop;

      grain = [];
      var n = Math.round(S.boxW * S.depth / 950);
      for (var i = 0; i < n; i++) {
        var gx = rnd(S.boxX, S.boxX + S.boxW);
        if (Math.abs(gx - S.cx) < S.chW / 2 + 2) continue; // не сорим в канале
        grain.push({ x: gx, y: rnd(S.rockTop + 2, H), r: rnd(0.3, 1.3), a: rnd(0.02, 0.07) });
      }
    }

    function spawnCoarse() {
      return {
        x: rnd(S.cx - S.boxW * 0.16, S.cx + S.boxW * 0.16),
        y: rnd(-240, S.rockTop - 80),
        r: rnd(9, 13),
        vy: rnd(0.9, 1.8),
        stuck: false
      };
    }

    function spawnFine(above) {
      return {
        x: rnd(S.cx - S.boxW * 0.16, S.cx + S.boxW * 0.16),
        y: above ? rnd(-S.rockTop, S.rockTop - 10) : rnd(-120, -8),
        r: rnd(1, 2),
        vy: rnd(1.5, 2.6),
        tx: S.cx + rnd(-S.chW * 0.34, S.chW * 0.34),
        inside: false
      };
    }

    function seed() {
      coarse = []; fine = [];
      var nc = clamp(Math.round(S.boxW / 42), 9, 16);
      var nf = clamp(Math.round(S.boxW / 3), 90, 260);
      for (var i = 0; i < nc; i++) coarse.push(spawnCoarse(false));
      for (var j = 0; j < nf; j++) fine.push(spawnFine(true));
    }

    layout(); seed();

    // доля заполнения трещины экраном: растёт после короткой задержки
    var FILL_MAX = 0.72;
    function fillLevel(now) {
      if (reduce) return FILL_MAX;
      return FILL_MAX * easeOut(clamp((now - t0 - 900) / 4600, 0, 1));
    }

    function step() {
      var i, p;

      // --- крупные частицы: сходятся к устью и образуют пробку ---
      var plug = coarse.filter(function (c) { return c.stuck; });
      for (i = 0; i < coarse.length; i++) {
        p = coarse[i];
        if (p.stuck) {
          // осадка пробки: частица опускается, если под ней освободилось место
          var down = restY(p, plug, S.rockTop);
          if (p.y < down - 0.3) p.y = Math.min(down, p.y + 0.7);
          continue;
        }
        p.y += p.vy;
        p.x += (S.cx - p.x) * 0.022;
        var rest = restY(p, plug, S.rockTop);
        if (p.y >= rest) { p.y = rest; p.stuck = true; }
      }
      separate(plug, S.rockTop);

      // --- мелкие частицы: воронка в канал и спуск на всю глубину ---
      for (i = 0; i < fine.length; i++) {
        p = fine[i];
        p.y += p.vy * (p.inside ? 0.85 : 1);
        if (!p.inside) {
          var d = S.rockTop - p.y;
          if (d < 90) {
            // чем ближе устье, тем сильнее стягивание к каналу
            p.x += (p.tx - p.x) * clamp((90 - d) / 90, 0, 1) * 0.16;
          }
          if (p.y >= S.rockTop) { p.inside = true; p.x = p.tx; }
        } else {
          p.x += (p.tx - p.x) * 0.25;
        }
        if (p.y - p.r > H) fine[i] = spawnFine(false);
      }
    }

    function render(now) {
      var intro = reduce ? 1 : easeOut(clamp((now - t0) / 1200, 0, 1));
      var lift = (1 - intro) * 36;
      var fill = fillLevel(now);

      ctx.clearRect(0, 0, W, H);

      // тело породы — мягкий уход в тень слева, чтобы не было резкой границы
      var bg = ctx.createLinearGradient(S.boxX, 0, S.boxX + S.boxW * 0.55, 0);
      bg.addColorStop(0, 'rgba(245,246,243,0)');
      bg.addColorStop(1, 'rgba(245,246,243,0.05)');
      ctx.fillStyle = bg;
      ctx.fillRect(S.boxX, S.rockTop, S.boxW, S.depth);

      // фактура породы
      ctx.fillStyle = col.paper;
      for (var g = 0; g < grain.length; g++) {
        var q = grain[g];
        ctx.globalAlpha = q.a * intro;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // кровля пласта
      var lineFrom = S.boxX - W * 0.22;
      var lg = ctx.createLinearGradient(lineFrom, 0, S.boxX + S.boxW * 0.3, 0);
      lg.addColorStop(0, 'rgba(138,143,136,0)');
      lg.addColorStop(1, 'rgba(138,143,136,' + (0.55 * intro).toFixed(3) + ')');
      ctx.strokeStyle = lg; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lineFrom, S.rockTop + 0.5); ctx.lineTo(W, S.rockTop + 0.5);
      ctx.stroke();

      // канал фильтрации
      var chL = S.cx - S.chW / 2;
      ctx.globalAlpha = intro;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(chL, S.rockTop, S.chW, S.depth);

      // экран NanoCem — заполнение канала снизу вверх
      if (fill > 0) {
        var fh = S.depth * fill;
        ctx.fillStyle = col.accent;
        ctx.globalAlpha = 0.5 * intro;
        ctx.fillRect(chL + 1, H - fh, S.chW - 2, fh);
        ctx.globalAlpha = intro;
      }

      // стенки канала
      ctx.strokeStyle = 'rgba(138,143,136,0.4)';
      ctx.beginPath();
      ctx.moveTo(chL + 0.5, S.rockTop); ctx.lineTo(chL + 0.5, H);
      ctx.moveTo(chL + S.chW - 0.5, S.rockTop); ctx.lineTo(chL + S.chW - 0.5, H);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // мелкие частицы
      var i, p;
      ctx.fillStyle = col.accent;
      for (i = 0; i < fine.length; i++) {
        p = fine[i];
        ctx.globalAlpha = (p.inside ? 0.9 : 0.55) * intro;
        ctx.beginPath(); ctx.arc(p.x, p.y - lift, p.r, 0, Math.PI * 2); ctx.fill();
      }

      // крупные частицы — пробка на устье
      for (i = 0; i < coarse.length; i++) {
        p = coarse[i];
        ctx.globalAlpha = 0.92 * intro * p.fade;
        ctx.fillStyle = col.muted;
        ctx.beginPath(); ctx.arc(p.x, p.y - lift, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.45 * intro * p.fade;
        ctx.lineWidth = 1; ctx.strokeStyle = col.paper;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function staticFrame() {
      // финальный кадр: пробка на устье + заполненный экран в трещине
      var guard = 0;
      while (coarse.some(function (c) { return !c.stuck; }) && guard++ < 4000) step();
      for (var i = 0; i < fine.length; i++) {
        var p = fine[i];
        p.inside = true; p.x = p.tx;
        p.y = rnd(S.rockTop + 4, H - 4);
      }
      render(t0);
    }

    var raf = null;
    function loop(now) {
      if (!t0) t0 = now;
      step();
      render(now);
      raf = requestAnimationFrame(loop);
    }

    if (reduce) {
      t0 = 0; staticFrame();
    } else {
      raf = requestAnimationFrame(loop);
    }

    // пауза, когда hero вне зоны видимости
    var heroSection = document.getElementById('hero');
    if (!reduce && heroSection && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && raf === null) raf = requestAnimationFrame(loop);
          else if (!en.isIntersecting && raf !== null) { cancelAnimationFrame(raf); raf = null; }
        });
      }, { threshold: 0 }).observe(heroSection);
    }

    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(function () {
        col = palette();
        layout(); seed();
        if (reduce) staticFrame();
      }, 150);
    });
  }

  /* ====================================================
     2. СЛАЙДЕР МАСШТАБА (§5.3)
     Размер частиц уменьшается → поток начинает проходить трещину
     ==================================================== */
  var scaleCanvas = document.getElementById('scaleCanvas');
  var scaleRange = document.getElementById('scaleRange');
  if (scaleCanvas && scaleRange) initScale(scaleCanvas, scaleRange);

  function initScale(canvas, range) {
    var ctx = canvas.getContext('2d');
    var col = palette();
    var W = 0, H = 0;
    var t = clamp(parseInt(range.value, 10) / 100, 0, 1); // 0 — крупный помол, 1 — UT-9
    var S = {};
    var parts = [];
    var fill = 0;
    var labelL = document.getElementById('scaleLabelL');
    var labelR = document.getElementById('scaleLabelR');

    function layout() {
      var size = fit(canvas, ctx);
      W = size.w; H = size.h;
      S.cx = W * 0.5;
      S.chW = clamp(W * 0.026, 11, 15);
      S.rockTop = Math.round(H * 0.30);
      S.depth = H - S.rockTop;
      // порог прохода в канал; шкала помола подобрана так, чтобы фракция
      // начинала проходить примерно на середине ползунка
      S.thr = S.chW / 2 - 0.8;
      S.rMax = S.thr * 1.57;
      S.rMin = S.thr * 0.43;
    }

    // радиус частицы при текущем помоле; jitter даёт разброс фракции
    function radius(p) { return (S.rMax - t * (S.rMax - S.rMin)) * p.j; }
    function passes(p) { return radius(p) <= S.thr; }

    function spawn(above) {
      return {
        x: rnd(S.cx - W * 0.2, S.cx + W * 0.2),
        y: above ? rnd(-S.rockTop, S.rockTop - 6) : rnd(-70, -6),
        vy: rnd(0.8, 1.7),
        j: rnd(0.84, 1.16),
        r: 0,
        tx: S.cx + rnd(-S.chW * 0.3, S.chW * 0.3),
        stuck: false,
        inside: false
      };
    }

    function seed() {
      parts = [];
      var n = clamp(Math.round(W / 9), 40, 90);
      for (var i = 0; i < n; i++) parts.push(spawn(true));
    }

    layout(); seed();

    function passFraction() {
      var k = 0;
      for (var i = 0; i < parts.length; i++) if (passes(parts[i])) k++;
      return parts.length ? k / parts.length : 0;
    }

    function step() {
      var i, p, r;
      var plug = parts.filter(function (q) { return q.stuck; });
      plug.forEach(function (q) { q.r = radius(q); });

      for (i = 0; i < parts.length; i++) {
        p = parts[i]; r = radius(p); p.r = r;

        if (p.stuck) {
          // осадка пробки, когда фракция мельчает и соседи уходят в канал
          var down = restY(p, plug, S.rockTop);
          if (p.y < down - 0.3) p.y = Math.min(down, p.y + 0.7);
          continue;
        }

        if (p.inside) {
          p.y += p.vy * 0.85;
          p.x += (p.tx - p.x) * 0.28;
          if (p.y - r > H) parts[i] = spawn(false);
          continue;
        }

        p.y += p.vy;
        var d = S.rockTop - p.y;
        if (d < 70) p.x += (p.tx - p.x) * clamp((70 - d) / 70, 0, 1) * 0.18;

        if (passes(p)) {
          if (p.y + r >= S.rockTop) { p.inside = true; p.x = p.tx; p.y = S.rockTop + r; }
        } else {
          // слишком крупная — ложится в пробку поверх уже осевших
          var rest = restY(p, plug, S.rockTop);
          if (p.y >= rest) { p.y = rest; p.stuck = true; }
        }
      }

      separate(plug, S.rockTop);

      // экран растёт ровно настолько, насколько фракция проходит в канал
      var target = 0.92 * passFraction();
      fill += (target - fill) * 0.05;
    }

    function drawScene(intro) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = col.ink; ctx.fillRect(0, 0, W, H);

      // тело породы
      ctx.fillStyle = 'rgba(245,246,243,0.05)';
      ctx.fillRect(0, S.rockTop, W, S.depth);
      ctx.strokeStyle = 'rgba(138,143,136,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, S.rockTop + 0.5); ctx.lineTo(W, S.rockTop + 0.5);
      ctx.stroke();

      var chL = S.cx - S.chW / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(chL, S.rockTop, S.chW, S.depth);

      if (fill > 0.005) {
        var fh = S.depth * fill;
        ctx.fillStyle = col.accent;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(chL + 1, H - fh, S.chW - 2, fh);
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = 'rgba(138,143,136,0.4)';
      ctx.beginPath();
      ctx.moveTo(chL + 0.5, S.rockTop); ctx.lineTo(chL + 0.5, H);
      ctx.moveTo(chL + S.chW - 0.5, S.rockTop); ctx.lineTo(chL + S.chW - 0.5, H);
      ctx.stroke();
    }

    function render() {
      drawScene();
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], r = radius(p);
        var through = passes(p);
        ctx.fillStyle = through ? col.accent : col.muted;
        ctx.globalAlpha = p.inside ? 0.9 : 0.8;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        if (!through) {
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 1; ctx.strokeStyle = col.paper; ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    function updateLabels() {
      if (!labelL || !labelR) return;
      var f = passFraction();
      labelL.classList.toggle('dim', f > 0.6);
      labelR.classList.toggle('dim', f < 0.4);
    }

    function settle(frames) {
      for (var i = 0; i < frames; i++) step();
      fill = 0.92 * passFraction();
    }

    function staticFrame() {
      settle(600);
      render();
      updateLabels();
    }

    var raf = null;
    function loop() { step(); render(); raf = requestAnimationFrame(loop); }

    range.addEventListener('input', function () {
      t = clamp(parseInt(range.value, 10) / 100, 0, 1);
      // частицы, переставшие помещаться в канал, возвращаются к устью
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (p.stuck && passes(p)) { p.stuck = false; }
        else if (p.inside && !passes(p)) { parts[i] = spawn(true); }
      }
      updateLabels();
      if (reduce) staticFrame();
    });

    updateLabels();
    if (reduce) staticFrame();
    else {
      // сцена стартует уже «живой», а не с пустого кадра
      settle(90);
      raf = requestAnimationFrame(loop);
    }

    // считаем только когда демо на экране
    if (!reduce && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && raf === null) raf = requestAnimationFrame(loop);
          else if (!en.isIntersecting && raf !== null) { cancelAnimationFrame(raf); raf = null; }
        });
      }, { threshold: 0 }).observe(canvas);
    }

    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(function () {
        col = palette(); layout(); seed();
        if (reduce) staticFrame(); else settle(60);
      }, 150);
    });
  }

})();
