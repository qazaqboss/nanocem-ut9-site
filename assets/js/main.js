/* ===========================================================
   main.js — навигация, скролл-ревилы, аккордеон решений,
   графики кейсов и счётчики
   =========================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Навигация: фон при скролле ---------- */
  var nav = document.getElementById('nav');
  function onScroll() {
    if (window.scrollY > 40) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Бургер-меню ---------- */
  var burger = document.getElementById('burger');
  var navLinks = document.getElementById('navLinks');
  function closeMenu() {
    burger.classList.remove('open');
    navLinks.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  }
  burger.addEventListener('click', function () {
    var open = burger.classList.toggle('open');
    navLinks.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
  });
  navLinks.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') closeMenu();
  });

  /* ---------- Активный пункт навигации ---------- */
  var sections = ['product', 'solutions', 'specs', 'cases', 'contacts']
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  var navAnchors = Array.prototype.slice.call(navLinks.querySelectorAll('a'));

  var spy = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var id = en.target.id;
      navAnchors.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + id);
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(function (s) { spy.observe(s); });

  /* ---------- Скролл-ревилы ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if (reduce) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revObs = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          obs.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    reveals.forEach(function (el) { revObs.observe(el); });
  }

  /* ---------- Аккордеон решений ---------- */
  var sols = document.querySelectorAll('[data-sol]');
  sols.forEach(function (sol) {
    var head = sol.querySelector('.sol__head');
    head.addEventListener('click', function () {
      var willOpen = !sol.classList.contains('open');
      // одиночное раскрытие
      sols.forEach(function (other) {
        if (other !== sol) {
          other.classList.remove('open');
          other.querySelector('.sol__head').setAttribute('aria-expanded', 'false');
        }
      });
      sol.classList.toggle('open', willOpen);
      head.setAttribute('aria-expanded', String(willOpen));
    });
  });
  // первое решение раскрыто по умолчанию
  if (sols[0]) {
    sols[0].classList.add('open');
    sols[0].querySelector('.sol__head').setAttribute('aria-expanded', 'true');
  }

  /* ---------- Счётчики чисел ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = parseInt(el.getAttribute('data-dec') || '0', 10);
    if (reduce) { el.textContent = format(target, dec); return; }
    var dur = 1100, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(target * eased, dec);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = format(target, dec);
    }
    requestAnimationFrame(step);
  }
  function format(n, dec) {
    return n.toFixed(dec).replace('.', ',');
  }

  /* ---------- Графики кейсов (Canvas) ---------- */
  // Среднемесячные показатели за 01.2026–07.2026 по рабочим суткам.
  // oil — дебит нефти, т/сут; water — обводнённость, %; null — ремонт/простой.
  var MONTHS = ['01', '02', '03', '04', '05', '06', '07'];
  var SERIES = {
    'X-1': { oilMax: 18,
      oil:   [16.22, 11.99, 0.16, 0.58, null, 11.81, 10.41],
      water: [41.4,  49.4,  34.2, 94.8, null, 38.2,  36.8] },
    'X-2': { oilMax: 12,
      oil:   [3.26, 3.87, 2.50, 1.98, 1.20, 8.08, 9.76],
      water: [75.6, 73.4, 79.3, 84.6, 88.4, 30.7, 30.1] },
    'X-3': { oilMax: 18,
      oil:   [2.71, 8.76, 14.89, 14.72, 14.22, 14.00, 13.70],
      water: [85.2, 54.0, 32.4,  37.5,  36.0,  34.4,  35.8] },
    'X-4': { oilMax: 4,
      oil:   [0.41, 0.18, 0.12, null, null, 2.64, 2.33],
      water: [95.6, 97.8, 98.4, null, null, 33.0, 21.8] }
  };

  function drawCase(canvas, key, progress) {
    var s = SERIES[key];
    if (!s) return;
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var w = rect.width, h = rect.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var padL = 6, padR = 6, padT = 12, padB = 22;
    var gw = w - padL - padR, gh = h - padT - padB;
    var n = MONTHS.length;

    var css = getComputedStyle(document.documentElement);
    var accent = css.getPropertyValue('--accent').trim() || '#6E7F6A';
    var muted = css.getPropertyValue('--muted').trim() || '#8A8F88';
    var line = css.getPropertyValue('--line').trim() || '#D6D9D3';

    // сетка
    ctx.strokeStyle = line; ctx.lineWidth = 1;
    for (var g = 0; g <= 2; g++) {
      var gy = padT + gh * (g / 2);
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
    }

    function px(i) { return padL + gw * (i / (n - 1)); }
    function py(v) { return padT + gh * (1 - v); }

    // подписи месяцев
    ctx.fillStyle = muted;
    ctx.font = '9px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var m = 0; m < n; m++) ctx.fillText(MONTHS[m], px(m), padT + gh + 7);

    // линия с разрывами на месяцах ремонта/простоя
    function plot(arr, color, dashed, prog) {
      var lastIdx = (n - 1) * prog;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.setLineDash(dashed ? [3, 4] : []);

      for (var i = 1; i < n; i++) {
        if (i - 1 > lastIdx) break;
        var a = arr[i - 1], b = arr[i];
        if (a === null || b === null) continue;      // разрыв — месяц без работы
        var frac = Math.min(1, lastIdx - (i - 1));
        if (frac <= 0) continue;
        var x0 = px(i - 1), y0 = py(a), x1 = px(i), y1 = py(b);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac);
        ctx.stroke();
      }

      // одиночные точки (месяц окружён разрывами) — чтобы не терялись
      ctx.setLineDash([]);
      for (var j = 0; j < n; j++) {
        if (arr[j] === null || j > lastIdx) continue;
        var prevNull = (j === 0) || arr[j - 1] === null;
        var nextNull = (j === n - 1) || arr[j + 1] === null;
        if (prevNull && nextNull) {
          ctx.beginPath(); ctx.arc(px(j), py(arr[j]), 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // нормализация: нефть по oilMax, обводнённость по 100%; null сохраняем
    function norm(arr, max) {
      return arr.map(function (v) {
        return v === null ? null : Math.max(0, Math.min(1, v / max));
      });
    }

    plot(norm(s.water, 100), muted, true, progress);  // обводнённость, %
    plot(norm(s.oil, s.oilMax), accent, false, progress); // дебит нефти, т/сут
  }

  function animateCase(canvas, key) {
    if (reduce) { drawCase(canvas, key, 1); return; }
    var dur = 1300, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      drawCase(canvas, key, 1 - Math.pow(1 - p, 2));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var caseObs = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var caseEl = en.target;
      var canvas = caseEl.querySelector('.caseCanvas');
      if (canvas) animateCase(canvas, canvas.getAttribute('data-series'));
      caseEl.querySelectorAll('.num').forEach(animateCount);
      obs.unobserve(caseEl);
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('[data-case]').forEach(function (c) { caseObs.observe(c); });

  // счётчики вне карточек кейсов (сводка по фонду)
  var numObs = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.querySelectorAll('.num').forEach(animateCount);
      obs.unobserve(en.target);
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('.summary').forEach(function (el) { numObs.observe(el); });

  // перерисовка графиков при ресайзе (статичный финальный кадр)
  var rT;
  window.addEventListener('resize', function () {
    clearTimeout(rT);
    rT = setTimeout(function () {
      document.querySelectorAll('.caseCanvas').forEach(function (c) {
        drawCase(c, c.getAttribute('data-series'), 1);
      });
    }, 150);
  });

})();
