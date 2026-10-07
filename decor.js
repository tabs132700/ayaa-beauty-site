(function () {
  var uid = 0;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function grad(id, vb) {
    var v = vb.split(' ').map(Number);
    return '<defs><linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="' + v[0] + '" y1="' + v[1] + '" x2="' + (v[0] + v[2]) + '" y2="' + (v[1] + v[3]) + '">' +
      '<stop offset="0" stop-color="#F6E2A6"/><stop offset=".5" stop-color="#D9B15F"/><stop offset="1" stop-color="#A9772E"/>' +
      '</linearGradient></defs>';
  }
  function blossom(x, y, s, r, d) {
    var p = 'M0 -4C-13 -16 -11 -36 0 -44C11 -36 13 -16 0 -4Z', g = '', i;
    for (i = 0; i < 5; i++) {
      g += '<path class="l dr" pathLength="1" d="' + p + '" transform="rotate(' + i * 72 + ')"/>' +
        '<path class="l dr" pathLength="1" style="opacity:.5" d="M0 -10V-32" transform="rotate(' + i * 72 + ')"/>';
    }
    g += '<circle class="l" r="3.2"/>';
    for (i = 0; i < 5; i++) g += '<circle class="f" fill="url(#G)" r="1.4" cx="0" cy="-11" transform="rotate(' + (i * 72 + 36) + ')"/>';
    var dur = rnd(46, 90).toFixed(0), dir = Math.random() < .5 ? 'normal' : 'reverse';
    return '<g class="pop" style="transition-delay:' + (d || 1.2) + 's"><g transform="translate(' + x + ' ' + y + ') rotate(' + r + ') scale(' + s + ')">' +
      '<g class="spin" style="animation-duration:' + dur + 's;animation-direction:' + dir + '">' + g + '</g></g></g>';
  }
  function leaf(x, y, r, s) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ') scale(' + s + ')">' +
      '<path class="l dr" pathLength="1" d="M0 0C10-9 26-9 34 0C26 9 10 9 0 0Z"/>' +
      '<path class="l dr" pathLength="1" style="opacity:.55" d="M2 0H28"/></g>';
  }
  function spark(x, y, s) {
    return '<path class="f tw" fill="url(#G)" style="animation-delay:-' + rnd(0, 4).toFixed(1) + 's" transform="translate(' + x + ' ' + y + ') scale(' + s + ')" ' +
      'd="M0-10C1-3 3-1 10 0C3 1 1 3 0 10C-1 3-3 1-10 0C-3-1-1-3 0-10Z"/>';
  }
  function wrap(vb, inner) {
    var id = 'gd' + (++uid);
    return '<svg viewBox="' + vb + '" aria-hidden="true" focusable="false" stroke="url(#' + id + ')" style="--sw:' + rnd(7, 12).toFixed(1) + 's;animation-delay:-' + rnd(0, 8).toFixed(1) + 's">' +
      grad(id, vb) + inner.replace(/url\(#G\)/g, 'url(#' + id + ')') + '</svg>';
  }

  var T = {
    branch: function () {
      return wrap('0 0 200 270',
        '<path class="l dr" pathLength="1" d="M22 262C44 196 28 134 84 94S152 46 172 12"/>' +
        leaf(36, 214, -38, 1) + leaf(40, 172, 28, .9) + leaf(58, 134, -60, .85) + leaf(96, 92, 24, .8) +
        leaf(120, 70, -48, .75) + leaf(146, 48, 30, .6) +
        blossom(46, 190, .6, -14, 1.3) + blossom(84, 100, .95, 10, 1.6) + blossom(150, 40, .55, 24, 1.9) +
        '<g class="pop"><circle class="f" fill="url(#G)" cx="172" cy="12" r="3"/></g>' +
        spark(16, 120, .9) + spark(130, 20, .7));
    },
    sprig: function () {
      return wrap('0 0 160 220',
        '<path class="l dr" pathLength="1" d="M30 214C40 160 26 110 70 76S118 36 128 8"/>' +
        leaf(34, 168, -30, .8) + leaf(46, 128, 34, .75) + leaf(76, 84, -50, .7) + leaf(98, 62, 28, .6) +
        blossom(70, 74, .8, 12, 1.4) + blossom(120, 26, .5, -16, 1.8) +
        spark(110, 130, .8) + spark(18, 60, .6));
    },
    corner: function () {
      return wrap('0 0 170 170',
        '<path class="l dr" pathLength="1" d="M170 4C140 8 112 26 104 58C96 90 66 96 58 120C52 140 70 150 82 140C92 132 84 118 74 122"/>' +
        '<path class="l dr" pathLength="1" d="M170 30C150 34 134 46 130 66"/>' +
        leaf(118, 40, 120, .7) + leaf(100, 72, 160, .65) + leaf(66, 112, 100, .6) +
        blossom(104, 58, .62, 20, 1.2) + blossom(150, 22, .42, -10, 1.5) +
        spark(60, 40, .8) + spark(150, 100, .6));
    },
    divider: function () {
      return wrap('0 0 320 40',
        '<path class="l dr" pathLength="1" d="M8 20H126"/><path class="l dr" pathLength="1" d="M194 20H312"/>' +
        blossom(160, 20, .38, 0, .8) + spark(138, 20, .5) + spark(182, 20, .5) +
        '<circle class="f" fill="url(#G)" cx="20" cy="20" r="1.8"/><circle class="f" fill="url(#G)" cx="300" cy="20" r="1.8"/>');
    },
    butterfly: function () {
      var w = '<g class="wing"><path class="l" fill="url(#G)" fill-opacity=".16" d="M30 22C18 2 0 8 3 22C5 32 20 31 30 26Z"/>' +
        '<path class="l" fill="url(#G)" fill-opacity=".16" d="M30 28C20 30 8 40 15 47C21 51 30 41 30 34Z"/>' +
        '<path class="l" style="opacity:.6" d="M28 24C18 14 10 14 8 20"/></g>';
      return wrap('0 0 60 56',
        '<g class="bob">' + w + '<g transform="translate(60 0) scale(-1 1)">' + w + '</g>' +
        '<path class="l" d="M30 16V40"/><path class="l" d="M30 16C28 8 24 5 21 6M30 16C32 8 36 5 39 6"/></g>');
    },
    petal: function () {
      return wrap('0 0 20 28', '<path class="f" fill="url(#G)" fill-opacity=".85" d="M10 2C18 8 18 20 10 26C2 20 2 8 10 2Z"/>');
    }
  };

  var ICONS = {
    lipstick: '<path class="l dr" pathLength="1" d="M16 56H44V90H16Z"/><path class="l dr" pathLength="1" d="M19 56V46H41V56"/>' +
      '<path class="l dr" pathLength="1" d="M22 46V26C22 19 29 13 39 10V46"/><path class="l dr" pathLength="1" style="opacity:.5" d="M16 68H44"/>',
    perfume: '<path class="l dr" pathLength="1" d="M12 42H48V82C48 86 45 88 42 88H18C15 88 12 86 12 82Z"/><path class="l dr" pathLength="1" d="M24 42V33H36V42"/>' +
      '<path class="l dr" pathLength="1" d="M22 33V20H38V33"/><path class="l dr" pathLength="1" d="M38 24H50C55 24 55 31 50 31H44"/>' +
      '<path class="l dr" pathLength="1" d="M30 54L38 64L30 74L22 64Z"/>',
    mirror: '<circle class="l dr" pathLength="1" cx="30" cy="30" r="24"/><circle class="l dr" pathLength="1" cx="30" cy="30" r="19" style="opacity:.55"/>' +
      '<path class="l dr" pathLength="1" d="M27 54V88M33 54V88"/><path class="l dr" pathLength="1" d="M27 88Q30 94 33 88"/>' +
      '<path class="l dr" pathLength="1" style="opacity:.6" d="M18 22C21 17 25 15 30 14"/>',
    dropper: '<path class="l dr" pathLength="1" d="M24 8C24 -1 36 -1 36 8V24H24Z"/><path class="l dr" pathLength="1" d="M19 24H41V31H19Z"/>' +
      '<path class="l dr" pathLength="1" d="M24 31V72C24 80 36 80 36 72V31"/><path class="l dr" pathLength="1" style="opacity:.5" d="M24 56H36"/>' +
      '<path class="l dr" pathLength="1" d="M30 86C26 91 26 95 30 98C34 95 34 91 30 86Z"/>',
    brush: '<path class="l dr" pathLength="1" d="M30 100V48"/><path class="l dr" pathLength="1" d="M25 48H35V36H25Z"/>' +
      '<path class="l dr" pathLength="1" d="M25 36C17 22 27 8 30 2C33 8 43 22 35 36"/><path class="l dr" pathLength="1" style="opacity:.5" d="M30 36V12M26 36C24 26 27 16 30 8M34 36C36 26 33 16 30 8"/>',
    polish: '<rect class="l dr" pathLength="1" x="12" y="52" width="36" height="38" rx="7"/><path class="l dr" pathLength="1" d="M24 52V44H36V52"/>' +
      '<path class="l dr" pathLength="1" d="M22 44V16H38V44"/><path class="l dr" pathLength="1" style="opacity:.5" d="M26 20V40M30 20V40M34 20V40"/>' +
      '<path class="l dr" pathLength="1" style="opacity:.55" d="M20 66H40"/>'
  };
  T.icon = function (k) {
    return wrap('-6 -6 72 112', ICONS[k] + spark(58, 6, .8) + spark(2, 70, .55));
  };

  function add(host, kind, cls, style) {
    var d = document.createElement('div');
    d.className = 'decor ' + cls; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = kind.indexOf('icon:') === 0 ? T.icon(kind.slice(5)) : T[kind]();
    if (style) d.style.cssText = style;
    host.appendChild(d);
    return d;
  }
  function petals(host, n, cls) {
    var d = document.createElement('div');
    d.className = 'decor d-petals ' + cls; d.setAttribute('aria-hidden', 'true');
    var h = '';
    for (var i = 0; i < n; i++) {
      h += '<span class="pt" style="left:' + rnd(2, 96).toFixed(1) + '%;width:' + rnd(9, 17).toFixed(0) +
        'px;--d:' + rnd(15, 28).toFixed(1) + 's;--dl:-' + rnd(0, 26).toFixed(1) + 's;--dx:' + rnd(-70, 70).toFixed(0) +
        'px;--rt:' + rnd(180, 520).toFixed(0) + 'deg">' + T.petal() + '</span>';
    }
    d.innerHTML = h;
    host.appendChild(d);
    return d;
  }
  function prep(el) {
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    if (!el.classList.contains('hero')) el.style.isolation = 'isolate';
  }

  var plan = [
    ['#top', 'branch', 'd-hero-l'], ['#top', 'sprig', 'd-hero-r'], ['#top', 'butterfly', 'd-fly d-fly-1'],
    ['section.sec.shell', 'corner', 'd-corner-tr'], ['section.sec.shell', 'butterfly', 'd-fly d-fly-2'],
    ['#behandelingen', 'corner', 'd-corner-tr'], ['#behandelingen', 'sprig', 'd-side-l'],
    ['#apparatuur', 'corner', 'd-corner-tr'], ['#apparatuur', 'corner', 'd-corner-bl'],
    ['#werkwijze', 'sprig', 'd-side-l'], ['#werkwijze', 'butterfly', 'd-fly d-fly-3'],
    ['#studio', 'sprig', 'd-side-r'], ['#studio', 'branch', 'd-side-l2'],
    ['#afspraak', 'corner', 'd-corner-tr'], ['#afspraak', 'sprig', 'd-side-l'],
    ['#vragen', 'sprig', 'd-side-l'], ['#vragen', 'corner', 'd-corner-tr'],
    ['.cta.sec', 'branch', 'd-cta-l'], ['.cta.sec', 'branch', 'd-cta-r'], ['.cta.sec', 'butterfly', 'd-fly d-fly-1'],
    ['#apparatuur', 'divider', 'd-div'], ['#werkwijze', 'divider', 'd-div'], ['#studio', 'divider', 'd-div'],
    ['#afspraak', 'divider', 'd-div'], ['#vragen', 'divider', 'd-div'],
    ['footer', 'divider', 'd-foot'],
    ['#top', 'icon:lipstick', 'd-icon', 'right:9%;bottom:16%;--r:14deg'], ['#top', 'icon:mirror', 'd-icon', 'left:7%;top:20%;--r:-12deg'],
    ['section.sec.shell', 'icon:brush', 'd-icon', 'left:2%;top:14%;--r:-24deg'],
    ['#behandelingen', 'icon:dropper', 'd-icon', 'right:4%;top:12%;--r:10deg'], ['#behandelingen', 'icon:mirror', 'd-icon', 'left:3%;bottom:10%;--r:-8deg'],
    ['#apparatuur', 'icon:polish', 'd-icon', 'left:3%;top:10%;--r:-10deg'], ['#apparatuur', 'icon:perfume', 'd-icon', 'right:5%;bottom:12%;--r:9deg'],
    ['#werkwijze', 'icon:lipstick', 'd-icon', 'right:4%;top:14%;--r:12deg'],
    ['#studio', 'icon:mirror', 'd-icon', 'left:4%;top:12%;--r:-10deg'], ['#studio', 'icon:dropper', 'd-icon', 'right:3%;bottom:10%;--r:8deg'],
    ['#afspraak', 'icon:brush', 'd-icon', 'right:3%;bottom:12%;--r:-18deg'],
    ['#vragen', 'icon:perfume', 'd-icon', 'right:4%;top:12%;--r:10deg'],
    ['.cta.sec', 'icon:lipstick', 'd-icon', 'left:24%;bottom:16%;--r:-12deg'], ['.cta.sec', 'icon:polish', 'd-icon', 'right:24%;top:14%;--r:12deg'],
    ['.page-view-panel', 'icon:dropper', 'd-icon d-icon-sm', 'right:70px;top:14px;--r:8deg'],
    ['.page-view-panel', 'corner', 'd-pv-br'], ['.page-view-panel', 'sprig', 'd-pv-tl']
  ];
  var made = [];
  plan.forEach(function (p) {
    var host = document.querySelector(p[0]);
    if (!host) return;
    prep(host);
    made.push(add(host, p[1], p[2], p[3]));
  });
  [['#top', 14, 'd-pt-hero'], ['.cta.sec', 10, 'd-pt-cta'], ['#studio', 7, 'd-pt-studio']].forEach(function (p) {
    var host = document.querySelector(p[0]);
    if (host) { prep(host); made.push(petals(host, p[1], p[2])); }
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        e.target.classList.toggle('live', e.isIntersecting);
        if (e.isIntersecting) e.target.classList.add('in');
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    made.forEach(function (d) { io.observe(d); });
  } else made.forEach(function (d) { d.classList.add('in', 'live'); });
})();
