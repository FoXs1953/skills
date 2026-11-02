// =====================================================================
// ШАБЛОН main.js — стартовая точка для любого видео.
// Время каждого события берётся из cues.json (fit_vo.py): текст и действие
// появляются ровно тогда, когда голос их произносит.
// build() один раз заполняет SVG; render(t) рисует кадр в момент t (секунды).
// =====================================================================

// Начала фраз из таблицы fit_vo.py (секунды видео) — замените своими.
const C = {
  hook1: 0.10, hook2: 1.20,
  ex: 3.60, exCount: 4.30, exPill: 5.40,
  cta: 8.40, ctaCard: 9.60,
  end: 12.0
};

// Удары для тряски камеры: [время, амплитуда px]. 6–10 — обычный акцент, 14–22 — большой.
const IMP = [[C.hook1, 16], [C.hook2, 8], [C.ex, 6], [C.exCount, 8], [C.cta, 12]];

function build() {
  // Персонаж-маскот из lib.js (замените на нужного героя или нарисуйте нового в том же стиле)
  $('EX-svg').innerHTML = `${bud('exb')}
    ${[0, 1, 2, 3].map(k => star('EX-st' + k, k % 2 ? '#FFC23D' : '#FF6F91')).join('')}`;
  buildWords();                       // в конце build(): размечает все [data-t]
}

function rHK(t) {
  if (!scene('HK', t, 0, C.ex, 'cut', 'zoom')) return;
  slam($('HK-1'), t, C.hook1, 1e9, { sc: 2.0, d: .32, st: .12 });
  slam($('HK-2'), t, C.hook2, 1e9, { st: .08, sc: 1.4 });
  $('HK-glow').style.opacity = (.35 + .65 * Math.max(bell(t, C.hook1, C.hook1 + .1, C.hook1 + .9), bell(t, C.hook2, C.hook2 + .1, C.hook2 + .9) * .7)).toFixed(3);
}

function rEX(t) {
  if (!sc('EX', t, C.ex, C.cta, 'whip', 'zoom')) return;   // sc = scene + медленный наезд камеры
  pop($('EX-chip'), t, C.ex + .07, 1e9, { dy: 24 });
  slam($('EX-h'), t, C.ex + .15, 1e9, { sc: 1.6 });
  pop($('EX-card'), t, C.exCount - .2, 1e9, { dy: 60, s0: .8 });
  $('EX-cnt').textContent = Math.round(100 * P(t, C.exCount, .8, Ease.outCubic));
  pop($('EX-pill'), t, C.exPill, 1e9, { dx: -40, dy: 0 });
  const bp = P(t, C.ex + .2, .5, Ease.spring), happy = t > C.exPill;
  budSet('exb', { x: 1500, y: 860 + (1 - bp) * 400, s: 1.3, sy: 1 + .02 * Math.sin(t * 3),
    mouth: happy ? 'H' : 'S', lid: 1 - blink(t, 1), aL: happy ? 120 : 10 * Math.sin(t * 2), aR: happy ? 120 : 10 * Math.sin(t * 2 + 1) });
  for (let k = 0; k < 4; k++) {
    const ts = C.exPill + k * .08, s = bell(t, ts, ts + .18, ts + .6), an = k * 1.6 + .4;
    S($('EX-st' + k), { x: 1500 + Math.cos(an) * 260, y: 700 + Math.sin(an) * 160, s: Math.max(.001, s), r: t * 100, o: s > 0 ? 1 : 0 });
  }
}

function rCT(t) {
  if (!scene('CT', t, C.cta, 1e9, 'zoom', 'none')) return;
  slam($('CT-t'), t, C.cta + .1, 1e9, { st: .15, sc: 1.8 });
  const c = $('CT-card'), cp = P(t, C.ctaCard, .3, Ease.outBack);
  c.style.opacity = clamp((t - C.ctaCard) / .15).toFixed(3);
  c.style.transform = `scale(${lerp(.9, 1, cp).toFixed(3)})`; c.style.transformOrigin = '50% 50%';
}

function render(t) {
  shakeCam(t, IMP);
  $('flash').style.opacity = flashAt(t, [[C.ex, .4], [C.cta, .6]]).toFixed(3);
  rHK(t); rEX(t); rCT(t);
  badgeAnim('BADGE', t, .6);                                  // убрать, если видео не серия
  speedo(t, 100 * P(t, C.exCount, .8, Ease.outCubic), 100, { show: t > C.ex && t < C.cta, warn: 80 }); // прибор-HUD, если нужен
}

build(); window.render = render; window.__ready = true; render(0);
