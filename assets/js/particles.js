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

  /* ====================================================
     1. HERO — два потока: пробка vs сквозное проникновение
     ==================================================== */
  var heroCanvas = document.getElementById('heroCanvas');
  if (heroCanvas) initHero(heroCanvas);

  function initHero(canvas) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var col = palette();

    // геометрия сцены вычисляется относительно размеров канваса
    var scene = {};
    function layout() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      scene.crackX = W * 0.5;          // центр трещины
      scene.crackW = Math.max(6, W * 0.012); // ширина канала
      scene.rockTop = H * 0.42;        // верх породного массива
      scene.rockBot = H + 2;
      scene.mouthY = scene.rockTop;    // устье трещины
    }
    layout();

    // частицы
    var big = [];   // обычный цемент — застревают
    var fine = [];  // NanoCem — проходят
    var N_BIG = 0, N_FINE = 0;

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function spawnBig() {
      return {
        x: rnd(scene.crackX - W * 0.28, scene.crackX + W * 0.28),
        y: rnd(-H * 0.3, scene.rockTop - 30),
        r: rnd(9, 13),
        vy: rnd(0.5, 1.1),
        vx: 0,
        stuck: false
      };
    }
    function spawnFine() {
      return {
        x: rnd(scene.crackX - W * 0.30, scene.crackX + W * 0.30),
        y: rnd(-H * 0.4, scene.rockTop - 20),
        r: rnd(1, 2),
        vy: rnd(1.4, 2.4),
        vx: 0,
        through: false,
        targetX: rnd(scene.crackX - scene.crackW * 0.35, scene.crackX + scene.crackW * 0.35),
        depth: rnd(scene.rockTop + 20, scene.rockBot - 10)
      };
    }

    function seed() {
      big = []; fine = [];
      N_BIG = Math.max(10, Math.round(W / 70));
      N_FINE = Math.max(80, Math.round(W / 4));
      for (var i = 0; i < N_BIG; i++) { var b = spawnBig(); big.push(b); }
      for (var j = 0; j < N_FINE; j++) { fine.push(spawnFine()); }
    }
    seed();

    function drawScene() {
      // породный массив
      ctx.fillStyle = col.ink;
      ctx.fillRect(0, 0, W, H);

      // тело породы (чуть светлее, штриховка hairline)
      ctx.save();
      ctx.fillStyle = 'rgba(245,246,243,0.04)';
      ctx.fillRect(0, scene.rockTop, W, H - scene.rockTop);
      // граница породы
      ctx.strokeStyle = 'rgba(138,143,136,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, scene.rockTop); ctx.lineTo(W, scene.rockTop); ctx.stroke();
      ctx.restore();

      // трещина (тёмный канал)
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(scene.crackX - scene.crackW / 2, scene.rockTop, scene.crackW, H - scene.rockTop);
      ctx.strokeStyle = 'rgba(138,143,136,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(scene.crackX - scene.crackW / 2, scene.rockTop, scene.crackW, H - scene.rockTop);
    }

    function step() {
      var mouthLeft = scene.crackX - scene.crackW / 2;
      var mouthRight = scene.crackX + scene.crackW / 2;

      // --- крупные частицы: падают и образуют пробку на устье ---
      var i, b;
      for (i = 0; i < big.length; i++) {
        b = big[i];
        if (!b.stuck) {
          b.y += b.vy;
          // мягкое стягивание к устью
          b.x += (scene.crackX - b.x) * 0.004;
          // достигли устья — застревают (слишком крупные для канала)
          if (b.y + b.r >= scene.mouthY) {
            b.y = scene.mouthY - b.r;
            b.stuck = true;
          }
        }
        // лёгкое толкание соседями, чтобы пробка не накладывалась
        for (var k = 0; k < big.length; k++) {
          if (k === i) continue;
          var o = big[k];
          var dx = b.x - o.x, dy = b.y - o.y;
          var d2 = dx * dx + dy * dy;
          var minD = b.r + o.r;
          if (d2 > 0 && d2 < minD * minD) {
            var d = Math.sqrt(d2);
            var push = (minD - d) / d * 0.5;
            b.x += dx * push; b.y += dy * push;
            if (b.y + b.r > scene.mouthY) b.y = scene.mouthY - b.r;
          }
        }
      }

      // --- мелкие частицы: проходят сквозь трещину ---
      var f;
      for (i = 0; i < fine.length; i++) {
        f = fine[i];
        if (!f.through) {
          f.y += f.vy;
          if (f.y >= scene.rockTop - 4) {
            // воронка ко входу в канал
            f.x += (f.targetX - f.x) * 0.2;
            if (Math.abs(f.x - scene.crackX) < scene.crackW / 2 + 1) {
              f.through = true;
            } else if (f.y > scene.rockTop + 6) {
              // не попала точно — мягко доводим
              f.x += (scene.crackX - f.x) * 0.15;
            }
          }
        } else {
          // внутри канала — спуск в глубину
          f.y += f.vy * 0.9;
          f.x += (f.targetX - f.x) * 0.25;
          if (f.y > f.depth) {
            // осела — респаун сверху для непрерывной циркуляции
            var nf = spawnFine();
            fine[i] = nf;
          }
        }
      }
    }

    function render() {
      drawScene();

      // мелкие частицы (рисуем под крупными)
      ctx.fillStyle = col.accent;
      var f;
      for (var i = 0; i < fine.length; i++) {
        f = fine[i];
        ctx.globalAlpha = f.through ? 0.85 : 0.6;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // крупные частицы (пробка)
      var b;
      for (var j = 0; j < big.length; j++) {
        b = big[j];
        ctx.beginPath();
        ctx.fillStyle = col.muted;
        ctx.globalAlpha = 0.9;
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1; ctx.strokeStyle = col.paper;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    var raf = null;
    function loop() { step(); render(); raf = requestAnimationFrame(loop); }

    function staticFrame() {
      // финальный кадр: пробка на устье + заполненная трещина
      drawScene();
      // заполненная трещина
      ctx.fillStyle = col.accent;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(scene.crackX - scene.crackW / 2, scene.rockTop, scene.crackW, H - scene.rockTop);
      // немного мелких частиц по глубине
      for (var i = 0; i < 60; i++) {
        ctx.beginPath();
        ctx.globalAlpha = rnd(0.4, 0.9);
        var x = scene.crackX + rnd(-scene.crackW / 2, scene.crackW / 2);
        var y = rnd(scene.rockTop, H);
        ctx.arc(x, y, rnd(1, 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // пробка крупных
      ctx.fillStyle = col.muted;
      for (var j = 0; j < big.length; j++) {
        var bx = scene.crackX + rnd(-W * 0.18, W * 0.18);
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(bx, scene.mouthY - rnd(6, 14), rnd(9, 13), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (reduce) {
      staticFrame();
    } else {
      loop();
    }

    // пауза анимации, когда hero вне зоны видимости (экономия)
    var heroSection = document.getElementById('hero');
    if (!reduce && heroSection && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && raf === null) { loop(); }
          else if (!en.isIntersecting && raf !== null) { cancelAnimationFrame(raf); raf = null; }
        });
      }, { threshold: 0 });
      io.observe(heroSection);
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
     Размер частиц уменьшается → поток проходит трещину
     ==================================================== */
  var scaleCanvas = document.getElementById('scaleCanvas');
  var scaleRange = document.getElementById('scaleRange');
  if (scaleCanvas && scaleRange) initScale(scaleCanvas, scaleRange);

  function initScale(canvas, range) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var col = palette();
    var t = parseInt(range.value, 10) / 100; // 0 = крупный, 1 = мелкий
    var parts = [];

    function layout() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    layout();

    var crackW = 10; // фиксированная ширина трещины
    function rockTop() { return H * 0.4; }

    function seed() {
      parts = [];
      var n = 70;
      for (var i = 0; i < n; i++) {
        parts.push({
          x: W * 0.5 + (Math.random() - 0.5) * W * 0.5,
          y: Math.random() * rockTop(),
          vy: 0.6 + Math.random() * 1.4,
          seed: Math.random(),
          through: false,
          tx: W * 0.5 + (Math.random() - 0.5) * crackW * 0.6
        });
      }
    }
    seed();

    function radius() {
      // крупный 11px (пробка) → мелкий 2px (проходит)
      return 11 - t * 9;
    }

    function drawScene() {
      ctx.fillStyle = col.ink; ctx.fillRect(0, 0, W, H);
      var rt = rockTop();
      ctx.fillStyle = 'rgba(245,246,243,0.05)';
      ctx.fillRect(0, rt, W, H - rt);
      ctx.strokeStyle = 'rgba(138,143,136,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, rt); ctx.lineTo(W, rt); ctx.stroke();
      // трещина
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(W / 2 - crackW / 2, rt, crackW, H - rt);
    }

    function step() {
      var r = radius();
      var passes = r <= crackW / 2 + 0.5; // проходит ли частица в канал
      var cx = W / 2, rt = rockTop();
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (!p.through) {
          p.y += p.vy;
          if (p.y >= rt - r) {
            if (passes) {
              p.x += (p.tx - p.x) * 0.2;
              if (Math.abs(p.x - cx) < crackW / 2) p.through = true;
              else p.y = rt - r; // ждёт у устья
            } else {
              // застряли — пробка на устье
              p.y = rt - r;
              p.x += (cx - p.x) * 0.02;
            }
          }
        } else {
          p.y += p.vy;
          p.x += (p.tx - p.x) * 0.3;
          if (p.y > H + r) { p.y = -r; p.through = false; p.x = cx + (Math.random() - 0.5) * W * 0.5; }
        }
      }
    }

    function render() {
      drawScene();
      var r = radius();
      var passes = r <= crackW / 2 + 0.5;
      ctx.fillStyle = passes ? col.accent : col.muted;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        ctx.globalAlpha = p.through ? 0.85 : 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    var raf = null;
    function loop() { step(); render(); raf = requestAnimationFrame(loop); }

    function staticFrame() {
      drawScene();
      var r = radius();
      var passes = r <= crackW / 2 + 0.5;
      var rt = rockTop();
      ctx.fillStyle = passes ? col.accent : col.muted;
      if (passes) {
        ctx.globalAlpha = 0.85;
        ctx.fillRect(W / 2 - crackW / 2, rt, crackW, H - rt);
      } else {
        for (var i = 0; i < 14; i++) {
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(W / 2 + (Math.random() - 0.5) * W * 0.3, rt - r, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    range.addEventListener('input', function () {
      t = parseInt(range.value, 10) / 100;
      if (reduce) staticFrame();
    });

    if (reduce) {
      t = 0.5; staticFrame();
      range.addEventListener('input', function () { t = parseInt(range.value, 10) / 100; staticFrame(); });
    } else {
      loop();
    }

    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(function () { col = palette(); layout(); seed(); if (reduce) staticFrame(); }, 150);
    });
  }

})();
