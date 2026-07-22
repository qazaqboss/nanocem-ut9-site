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
  // Фактические замеры: oil — дебит нефти, т/сут; water — обводнённость, %
  // oilMax задаёт верх шкалы по нефти для конкретной скважины.
  var SERIES = {
    'X-1': { oilMax: 16,
      oil:   [2.73, 11.11, 14.16, 15.18, 10.25, 9.85, 10.67, 11.12],
      water: [86.0, 43.0,  28.0,  24.8,  32.2,  38.4, 37.7,  37.0] },
    'X-2': { oilMax: 12,
      oil:   [5.71, 7.73, 8.32, 8.19, 8.32, 8.97, 9.41, 10.34, 10.68],
      water: [54.3, 27.5, 30.0, 29.0, 28.4, 28.7, 31.0, 30.8,  29.8] },
    'X-3': { oilMax: 16,
      oil:   [14.36, 14.32, 13.94, 13.67, 13.29, 13.63, 13.76, 13.54, 13.86, 13.66],
      water: [34.8,  36.0,  34.1,  34.0,  33.6,  32.5,  36.5,  36.5,  35.8,  35.4] },
    'X-4': { oilMax: 4,
      oil:   [2.64, 2.20, 1.96, 2.39, 2.52, 2.52, 2.40, 1.91, 2.27],
      water: [33.0, 28.0, 30.0, 22.0, 20.0, 19.9, 19.4, 19.1, 18.7] },
    'X-5': { oilMax: 4,
      oil:   [2.58, 2.98, 1.86, 2.01, 2.20, 2.23],
      water: [87.0, 85.0, 91.0, 91.0, 90.5, 90.5] },
    'X-6': { oilMax: 3,
      oil:   [1.77, 1.28, 1.42, 1.95, 1.19, 0.74, 0.89, 0.44],
      water: [25.0, 23.0, 26.0, 25.6, 24.3, 23.0, 22.0, 22.0] }
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

    var padL = 6, padR = 6, padT = 12, padB = 16;
    var gw = w - padL - padR, gh = h - padT - padB;

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

    function plot(arr, color, dashed, prog) {
      var n = arr.length;
      var lastIdx = (n - 1) * prog;
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (dashed) ctx.setLineDash([3, 4]); else ctx.setLineDash([]);
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        if (i > lastIdx) {
          // частичный последний сегмент
          var frac = lastIdx - (i - 1);
          if (frac <= 0) break;
          var px0 = padL + gw * ((i - 1) / (n - 1));
          var py0 = padT + gh * (1 - arr[i - 1]);
          var px1 = padL + gw * (i / (n - 1));
          var py1 = padT + gh * (1 - arr[i]);
          ctx.lineTo(px0 + (px1 - px0) * frac, py0 + (py1 - py0) * frac);
          break;
        }
        var x = padL + gw * (i / (n - 1));
        var y = padT + gh * (1 - arr[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // нормализация в 0..1: нефть по oilMax, обводнённость по 100%
    var oilN = s.oil.map(function (v) { return Math.max(0, Math.min(1, v / s.oilMax)); });
    var waterN = s.water.map(function (v) { return Math.max(0, Math.min(1, v / 100)); });

    plot(waterN, muted, true, progress);   // обводнённость, %
    plot(oilN, accent, false, progress);   // дебит нефти, т/сут
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
