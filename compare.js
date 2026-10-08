(function () {
  var T = {
    nl: { before: 'Voor', after: 'Na', aria: 'Vergelijk voor en na', ph: '[VOEG VOOR/NA-FOTO TOE]',
      illustration: 'Illustratie - resultaten verschillen per persoon.',
      consent: 'Foto’s gedeeld met schriftelijke toestemming van de cliënt. Resultaten verschillen per persoon.' },
    ar: { before: 'قبل', after: 'بعد', aria: 'قارن قبل وبعد',
      ph: '[أضف صورة قبل/بعد]',
      illustration: 'رسم توضيحي - تختلف النتائج من شخص لآخر.',
      consent: 'صور مشاركة بموافقة خطية من العميلة. تختلف النتائج من شخص لآخر.' },
    tr: { before: 'Önce', after: 'Sonra', aria: 'Önce ve sonrayı karşılaştır', ph: '[ÖNCE/SONRA GÖRSELİ EKLEYİN]',
      illustration: 'Çizimdir - sonuçlar kişiden kişiye değişir.',
      consent: 'Fotoğraflar, müşterinin yazılı onayıyla paylaşılmıştır. Sonuçlar kişiden kişiye değişir.' },
    en: { before: 'Before', after: 'After', aria: 'Compare before and after', ph: '[ADD BEFORE/AFTER IMAGE]',
      illustration: 'Illustration - results vary from person to person.',
      consent: 'Photos shared with the client’s written consent. Results vary from person to person.' }
  };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var figs = [];

  function lang() {
    var l = (document.documentElement.lang || 'nl').slice(0, 2).toLowerCase();
    return T[l] ? l : 'nl';
  }
  function pick(o, l) { return typeof o === 'string' ? o : (o && (o[l] || o.en || o.nl)) || ''; }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function build(p) {
    var fig = el('figure', 'cmp-fig'), frame = el('div', 'cmp');
    var w = p.w || 1254, h = p.h || 1254;
    frame.style.aspectRatio = w + ' / ' + h;
    fig._p = p;

    if (!p.beforeSrc || !p.afterSrc) {
      frame.className += ' cmp-ph';
      var ph = el('span'); ph.setAttribute('data-k', 'ph'); frame.appendChild(ph);
    } else {
      var b = el('img'), a = el('img', 'cmp-after');
      [b, a].forEach(function (i) { i.width = w; i.height = h; i.loading = 'lazy'; i.decoding = 'async'; });
      b.src = p.beforeSrc; a.src = p.afterSrc;
      var lb = el('span', 'cmp-label cmp-label-before'), la = el('span', 'cmp-label cmp-label-after');
      lb.setAttribute('data-k', 'before'); la.setAttribute('data-k', 'after');
      lb.setAttribute('aria-hidden', 'true'); la.setAttribute('aria-hidden', 'true');
      var r = el('input', 'cmp-range');
      r.type = 'range'; r.min = 0; r.max = 100; r.step = 1; r.value = 50;
      var hd = el('div', 'cmp-handle'); hd.setAttribute('aria-hidden', 'true');
      function set(v) { frame.style.setProperty('--p', v + '%'); r.setAttribute('aria-valuetext', v + '%'); }
      r.addEventListener('input', function () { fig._touched = true; set(+r.value); });
      fig._set = function (v) { r.value = v; set(v); };
      [b, a, lb, la, r, hd].forEach(function (n) { frame.appendChild(n); });
      set(50);
      intro(fig);
    }
    var cap = el('figcaption', 'cmp-cap');
    fig.appendChild(frame); fig.appendChild(cap);
    figs.push(fig); applyLang(fig);
    return fig;
  }

  function applyLang(fig) {
    var l = lang(), t = T[l], p = fig._p;
    fig.querySelectorAll('[data-k]').forEach(function (n) { n.textContent = t[n.getAttribute('data-k')]; });
    var imgs = fig.querySelectorAll('img');
    if (imgs.length) {
      imgs[0].alt = pick(p.altBefore, l); imgs[1].alt = pick(p.altAfter, l);
      fig.querySelector('.cmp-range').setAttribute('aria-label', t.aria);
    }
    var c = p.caption;
    fig.querySelector('.cmp-cap').textContent = (c === 'illustration' || c === 'consent') ? t[c] : pick(c, l);
  }

  function intro(fig) {
    if (reduce || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      var t0 = performance.now();
      (function step(t) {
        if (fig._touched) return;
        var k = Math.min((t - t0) / 1400, 1);
        fig._set(Math.round(50 - 18 * Math.sin(k * Math.PI)));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }, { threshold: 0.6 });
    io.observe(fig);
  }

  function mount(host, id) {
    (window.COMPARE_PAIRS || []).filter(function (p) { return p.treatmentId === id; })
      .forEach(function (p) { host.appendChild(build(p)); });
  }

  new MutationObserver(function () { figs.forEach(applyLang); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  window.Compare = {
    mount: mount,
    mountAll: function (root) {
      (root || document).querySelectorAll('[data-compare]:not([data-cmp-done])').forEach(function (h) {
        h.setAttribute('data-cmp-done', ''); mount(h, h.getAttribute('data-compare'));
      });
    }
  };
  if (document.readyState !== 'loading') window.Compare.mountAll();
  else document.addEventListener('DOMContentLoaded', function () { window.Compare.mountAll(); });
})();
