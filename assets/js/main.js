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
  // Серии: точки нормированы 0..1, добыча (oil) и обводнённость (water)
  var SERIES = {
    '343': { oil: [0.05, 0.55, 0.95, 0.82, 0.78, 0.75], water: [0.30, 0.28, 0.275, 0.32, 0.34, 0.34] },
    '342': { oil: [0.06, 0.04, 0.20, 0.62, 0.80, 0.83], water: [0.92, 0.94, 0.70, 0.40, 0.30, 0.28] },
    '301': { oil: [0.10, 0.50, 0.85, 0.90, 0.88, 0.87], water: [0.40, 0.33, 0.29, 0.277, 0.28, 0.28] },
    '303': { oil: [0.08, 0.06, 0.05, 0.04, 0.03, 0.03], water: [0.92, 0.95, 0.97, 0.99, 0.995, 0.995] }
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

    plot(s.water, muted, true, progress);   // обводнённость
    plot(s.oil, accent, false, progress);   // добыча
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
