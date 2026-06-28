/* ===========================================================
   calculator.js — ориентировочный расход NanoCem UT-9
   Упрощённая прикидочная модель (помечена как ориентировочная).
   =========================================================== */
(function () {
  'use strict';

  var vol = document.getElementById('calcVolume');
  var wt = document.getElementById('calcWT');
  var wtVal = document.getElementById('calcWTval');
  var outMass = document.getElementById('outMass');
  var outTons = document.getElementById('outTons');
  var outBags = document.getElementById('outBags');
  var outBigbags = document.getElementById('outBigbags');

  if (!vol || !wt) return;

  // Плотность сухого продукта, г/см³ = т/м³
  var RHO_DRY = 2.95;

  function fmt(n, dec) {
    var s = (dec === 0 ? Math.round(n) : n.toFixed(dec));
    // разделитель тысяч пробелом + запятая для дробной части
    var parts = String(s).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join(',');
  }

  function calc() {
    var V = parseFloat(vol.value);       // объём заполнения, м³ (готовый камень/полость)
    var w = parseFloat(wt.value);        // В/Т
    wtVal.textContent = w.toFixed(2).replace('.', ',');

    if (!isFinite(V) || V <= 0) {
      outMass.textContent = '— кг';
      outTons.textContent = '— т';
      outBags.textContent = '—';
      outBigbags.textContent = '—';
      return;
    }

    // Упрощённая прикидочная модель:
    // Объём суспензии ≈ объём заполнения V.
    // Из 1 кг сухой смеси объём твёрдой фазы = 1/RHO_DRY (л), объём воды = w (л).
    // Объём суспензии на 1 кг сухого = (1/RHO_DRY + w) литров.
    // Масса сухого = V(м³)*1000(л) / (1/RHO_DRY + w).
    var litresPerKg = (1 / RHO_DRY) + w;
    var massKg = (V * 1000) / litresPerKg;
    var tons = massKg / 1000;

    var bags = Math.ceil(massKg / 25);
    var bigbags = Math.ceil(massKg / 1000);

    outMass.textContent = fmt(massKg, 0) + ' кг';
    outTons.textContent = fmt(tons, 2) + ' т';
    outBags.textContent = fmt(bags, 0) + ' шт';
    outBigbags.textContent = fmt(bigbags, 0) + ' шт';
  }

  vol.addEventListener('input', calc);
  wt.addEventListener('input', calc);
  calc();
})();
