/* =========================================================
   Abierto Works Bridal — main.js
   ・トップ：巨大な英字が1文字ずつ立ち上がる／背景の形がゆっくり形を変え、スクロールで動く／光の粒
   ・悩みが1行ずつ灯る、コンセプトの文字が順に灯る
   ・サポートのカードが重なっていく、線画が描かれる
   ・プロセスの縦線を光が流れ、通った項目が灯る
   ・コースの価格がカウントアップ、流れ（Flow）はPCで横スクロール
   CDN（GSAP）が読めなくても、内容はすべて表示される。
   ?capture=1 … ヘッドレス撮影用（動きを止めて全部表示）  ?at=1200 … その位置までスクロールして表示
   ========================================================= */
(function () {
  'use strict';

  /* ---- LINE の予約ページ。URL（https://lin.ee/… など）が決まったら、ここに入れるだけでよい ---- */
  var LINE_URL = 'https://lin.ee/n0TwxITO';

  var root = document.documentElement;
  var params = new URLSearchParams(location.search);
  var CAPTURE = params.has('capture');
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STILL = CAPTURE || REDUCE;
  // スマホ・タブレット（指で操作する端末か、幅900px以下）は、重い演出を減らす
  var MOBILE = window.matchMedia('(max-width: 900px), (hover: none) and (pointer: coarse)').matches;
  if (MOBILE) root.classList.add('is-mobile');
  var hasGSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // 確認用（?debug）：エラーと描画の回数を記録する
  if (params.has('debug')) {
    window.__eqlog = { errors: [], fc: 0, t: 0 };
    window.addEventListener('error', function (e) { window.__eqlog.errors.push(e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
    (function c(now) { window.__eqlog.fc++; window.__eqlog.t = Math.round(now || 0); requestAnimationFrame(c); })();
  }

  /* ---------- LINE ボタン ---------- */
  if (LINE_URL) {
    $$('[data-line]').forEach(function (a) {
      a.setAttribute('href', LINE_URL);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
  }

  /* ---------- 見出しの行（<br> の区切り）を <span class="ln"> で包み、行の途中で折り返さないようにする ---------- */
  function wrapLines(el) {
    var nodes = Array.prototype.slice.call(el.childNodes);
    var line = null;
    nodes.forEach(function (n) {
      if (n.nodeName === 'BR' && !(n.classList && n.classList.contains('pc'))) { line = null; return; }
      if (!line) { line = document.createElement('span'); line.className = 'ln'; el.insertBefore(line, n); }
      line.appendChild(n);
    });
  }

  /* ---------- 文字を1文字ずつ <span class="ch"> に分ける（<br> や <em> はそのまま残す） ---------- */
  function splitChars(el) {
    var out = [];
    if (!el) return out;
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ''));
    if (el.classList.contains('kin') || el.classList.contains('statement')) wrapLines(el);
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          Array.from(n.textContent).forEach(function (c) {
            if (c === '\n' || (/^\s+$/.test(n.textContent))) return;
            var s = document.createElement('span');
            s.className = 'ch'; s.textContent = c;
            s.setAttribute('aria-hidden', 'true');
            frag.appendChild(s); out.push(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') {
          walk(n);
        }
      });
    })(el);
    return out;
  }

  /* =========================================================
     スクロールに合わせて動くもの（GSAPなしでも動く）
     ========================================================= */
  var heroBg = $('.hero-bg');
  var hero = $('.hero');
  var worries = $$('.worry');
  var statement = $('.statement');
  var statementChars = STILL ? [] : splitChars(statement);
  var concept = $('.concept');
  var cards = $$('.scard');
  var draws = $$('svg.draw');
  var timeline = $('.timeline');
  var tlItems = $$('.tl');
  var header = $('#siteHeader');
  var sticky = $('.sticky-cta');
  var contact = $('#contact');
  var lastY = window.scrollY;
  var lastLit = -1, lastHp = -1;
  var isWide = function () { return window.innerWidth > 900; };
  var stickTops = [];
  function measureSticky() { stickTops = cards.map(function (c) { return parseFloat(getComputedStyle(c).top) || 0; }); }
  measureSticky();

  /* スクロール時の処理は「1コマに1回」だけ、先に位置を全部読んでから、まとめて書き換える
     （読む→書く→読む…を繰り返すと、スマホでは毎回ページ全体の計算がやり直しになり、カクつく） */
  function update() {
    var y = window.scrollY || window.pageYOffset;
    var vh = window.innerHeight;

    // ---- 読む ----
    var heroBottom = hero.getBoundingClientRect().bottom;
    var contactTop = contact.getBoundingClientRect().top;
    var worryTops = STILL ? [] : worries.map(function (w) { return w.getBoundingClientRect().top; });
    var sr = (!STILL && statementChars.length) ? statement.getBoundingClientRect() : null;
    var cardTops = (!STILL && isWide()) ? cards.map(function (c) { return c.getBoundingClientRect().top; }) : null;
    var tr = (!STILL && timeline) ? timeline.getBoundingClientRect() : null;
    var tlTops = tr ? tlItems.map(function (li) { return li.getBoundingClientRect().top; }) : [];

    // ---- 書く ----
    // ヘッダー：トップを過ぎたら地をつけ、下へ進む間は隠す
    header.classList.toggle('is-solid', y > 40);
    if (y > lastY + 4 && y > vh * 0.9) header.classList.add('is-hidden');
    else if (y < lastY - 4 || y < vh * 0.9) header.classList.remove('is-hidden');
    lastY = y;
    // スマホの固定ボタン：トップを過ぎてから、最後のお問い合わせの手前まで
    if (sticky) sticky.classList.toggle('is-shown', heroBottom < vh * 0.3 && contactTop >= vh * 0.9);

    if (STILL) return;

    // トップの背景の形：スクロールで回り、広がる（PCだけ。トップが見えている間だけ）
    if (isWide() && y < vh * 1.3) {
      var hp = Math.round(clamp(y / (vh * 1.1), 0, 1) * 200) / 200;
      if (hp !== lastHp) { heroBg.style.setProperty('--hp', hp); lastHp = hp; }
    }
    // 悩み：画面の少し上まで来た行から順に灯る
    worries.forEach(function (w, i) { w.classList.toggle('is-lit', worryTops[i] < vh * 0.66); });
    // コンセプト：文字が1文字ずつ灯る（灯る数が変わったときだけ書き換える）
    if (sr) {
      var p = clamp((vh * 0.8 - sr.top) / (vh * 0.5 + sr.height * 0.6), 0, 1);
      var n = Math.round(p * statementChars.length);
      if (n !== lastLit) {
        for (var i = 0; i < statementChars.length; i++) statementChars[i].classList.toggle('is-on', i < n);
        lastLit = n;
      }
    }
    // サポートのカード：次のカードが重なってくるほど、奥へ沈む（PCのみ）
    if (cardTops) {
      for (var c = 0; c < cards.length - 1; c++) {
        var dist = cardTops[c + 1] - stickTops[c + 1];
        cards[c].style.setProperty('--cover', clamp(1 - dist / (vh * 0.75), 0, 1).toFixed(2));
      }
    }
    // プロセス：光が縦線を流れ、通過した項目が灯る
    if (tr) {
      var line = vh * 0.58;
      timeline.style.setProperty('--tp', clamp((line - tr.top) / tr.height, 0, 1).toFixed(3));
      tlItems.forEach(function (li, k) { li.classList.toggle('is-lit', tlTops[k] + 20 < line); });
    }
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; update(); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measureSticky(); onScroll(); });

  if (STILL) {
    worries.forEach(function (w) { w.classList.add('is-lit'); });
    tlItems.forEach(function (li) { li.classList.add('is-lit'); });
    if (timeline) timeline.style.setProperty('--tp', 1);
  }

  /* ---------- 画面に入ったら表示 ---------- */
  var reveals = $$('.reveal, .compare__row');
  if (STILL || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        // 比較表は行ごとに少しずつ遅らせる
        var delay = el.classList.contains('compare__row') ? $$('.compare__row').indexOf(el) * 140 : 0;
        setTimeout(function () { el.classList.add('is-in'); }, delay);
        rio.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    reveals.forEach(function (el) { rio.observe(el); });
  }

  /* ---------- 画面の外にあるセクションの動き（CSSアニメーション）は止める（電池と重さのため） ---------- */
  if ('IntersectionObserver' in window && !STILL) {
    var offIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        e.target.classList.toggle('is-off', !e.isIntersecting);
        if (e.target === hero && heroBg) heroBg.classList.toggle('is-off', !e.isIntersecting);
      });
    }, { rootMargin: '10% 0px' });
    $$('main > section').forEach(function (s) { offIO.observe(s); });
  }

  /* ---------- 価格のカウントアップ ---------- */
  var nums = $$('[data-count]');
  function fmt(v) { return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  if (!STILL && 'IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        var el = e.target, to = +el.getAttribute('data-count'), t0 = performance.now(), dur = 1600;
        (function tick(now) {
          var k = clamp((now - t0) / dur, 0, 1);
          el.textContent = fmt(to * (0.55 + 0.45 * ease(k)));   // 半分ほどから数え上げる（0からだと長すぎる）
          if (k < 1) requestAnimationFrame(tick); else el.textContent = fmt(to);
        })(t0);
      });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { cio.observe(n); });
  }

  /* ---------- FAQ：1つ開いたら、ほかは閉じる ---------- */
  $$('.qa').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      $$('.qa').forEach(function (o) { if (o !== d) o.open = false; });
    });
  });

  /* ---------- ページ内リンク：クリックしたときだけ、なめらかに移動する ---------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (ev) {
      var id = a.getAttribute('href');
      var target = id === '#top' ? null : $(id);
      if (id !== '#top' && !target) return;
      ev.preventDefault();
      var top = target ? target.getBoundingClientRect().top + window.scrollY - (id === '#contact' ? 0 : 40) : 0;
      window.scrollTo({ top: top, behavior: REDUCE ? 'auto' : 'smooth' });
    });
  });

  /* =========================================================
     トップの光の粒（シャンパンゴールドのボケ）
     ========================================================= */
  (function sparkle() {
    var cv = $('#sparkle');
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var w = 0, h = 0, pts = [], running = false, mx = 0, my = 0, tx = 0, ty = 0;
    // 光の粒は、あらかじめ1枚の絵にしておき、毎回はそれを置くだけにする（軽くするため）
    function sprite(col) {
      var s = document.createElement('canvas'); s.width = s.height = 64;
      var g = s.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, 'rgba(' + col + ',.8)'); rg.addColorStop(0.25, 'rgba(' + col + ',.3)'); rg.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
      return s;
    }
    var SPR = { gold: sprite('214,176,112'), rose: sprite('226,150,170') };
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(clamp((w * h) / 26000, 18, 60));
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 2.6 + 0.6, z: Math.random(),
          vy: -(Math.random() * 0.18 + 0.05), ph: Math.random() * Math.PI * 2, rose: Math.random() < 0.3 });
      }
    }
    function draw(t, move) {
      ctx.clearRect(0, 0, w, h);
      mx += (tx - mx) * 0.04; my += (ty - my) * 0.04;
      pts.forEach(function (p) {
        if (move) { p.y += p.vy; if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; } }
        var tw = 0.55 + 0.45 * Math.sin(t * 0.0016 + p.ph);
        var x = p.x + mx * p.z * 40, y = p.y + my * p.z * 30, r = p.r * 5;
        ctx.globalAlpha = tw;
        ctx.drawImage(p.rose ? SPR.rose : SPR.gold, x - r, y - r, r * 2, r * 2);
      });
      ctx.globalAlpha = 1;
    }
    function loop(t) { if (!running) return; draw(t, true); requestAnimationFrame(loop); }
    resize();
    window.addEventListener('resize', function () { resize(); if (!running) draw(0, false); });
    if (STILL || MOBILE) { draw(0, false); return; }   // スマホは止まった光の粒（軽さ優先）
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX / window.innerWidth - 0.5; ty = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
    new IntersectionObserver(function (en) {
      var was = running; running = en[0].isIntersecting;
      if (running && !was) requestAnimationFrame(loop);
    }).observe(cv);
  })();

  /* =========================================================
     GSAP の演出
     ========================================================= */
  if (hasGSAP && !STILL) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    // トップ：英字が1文字ずつ立ち上がり、コピーが続く
    var w1 = splitChars($('.hero__word--1'));
    var w2 = splitChars($('.hero__word--2'));
    var h1 = splitChars($('.hero__title'));
    gsap.timeline({ delay: 0.15 })
      .fromTo('.hero__kicker span', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.08 }, 0)
      .fromTo(w1, { yPercent: 105, opacity: 0, rotate: 6 }, { yPercent: 0, opacity: 1, rotate: 0, duration: 1.4, ease: 'expo.out', stagger: 0.05, clearProps: 'transform' }, 0.1)
      .fromTo(w2, { yPercent: 105, opacity: 0, rotate: 6 }, { yPercent: 0, opacity: 1, rotate: 0, duration: 1.4, ease: 'expo.out', stagger: 0.05, clearProps: 'transform' }, 0.32)
      .fromTo(h1, { yPercent: 80, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.022, clearProps: 'transform' }, 0.75)
      .fromTo('.hero__lead, .hero__cta', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: 0.1, clearProps: 'transform' }, 1.25)
      .fromTo('.hero__vertical', { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'expo.out' }, 0.9);

    // スクロールすると英字が左右に離れていく（PCのみ）
    var heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    if (!MOBILE) {
      gsap.fromTo('.hero__word--1', { x: 0 }, { x: -160, ease: 'none', scrollTrigger: heroST });
      gsap.fromTo('.hero__word--2', { x: 0 }, { x: 140, ease: 'none', scrollTrigger: heroST });
      gsap.fromTo('.hero__vertical', { yPercent: 0 }, { yPercent: -30, ease: 'none', scrollTrigger: heroST });
    }

    // 見出し：PCは1文字ずつ、スマホは1行ずつ立ち上がる（スマホは文字ごとの立体の動きが重いため）
    $$('main .kin').forEach(function (el) {
      if (el.closest('.hero')) return;
      if (MOBILE) {
        wrapLines(el);
        gsap.fromTo(el.querySelectorAll('.ln'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.12, clearProps: 'transform',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
        return;
      }
      var chars = splitChars(el);
      // 立体（rotateX）にすると1文字ずつが別の層になり、ページ全体が重くなるので平面の動きにする。終わったら動きの指定を消す
      gsap.fromTo(chars, { yPercent: 70, opacity: 0 }, {
        yPercent: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.022, clearProps: 'transform',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true }
      });
    });

    // 巨大な英字：横から滑り込む（PCのみ）
    if (!MOBILE) $$('.mega').forEach(function (el) {
      gsap.fromTo(el, { xPercent: 14 }, { xPercent: -4, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // 英字ラベル：ふわっと現れる（字間の動きは文字の組み直しが毎回起きて重いので使わない）
    $$('.eyebrow').forEach(function (el) {
      if (el.closest('.hero')) return;
      gsap.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', clearProps: 'transform',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });

    // トップの絵：アーチの中から、ゆっくりせり上がる
    gsap.fromTo('.hero__visual', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'expo.out', delay: 0.35, clearProps: 'clipPath' });
    gsap.fromTo('.hero__visual img', { scale: 1.25 }, { scale: 1, duration: 2.4, ease: 'expo.out', delay: 0.35, clearProps: 'transform' });
    // （トップの絵のスクロール連動は、常に重ね描きが発生して重くなるため外した）

    // 絵：幕が開くように現れ、スクロールでゆっくり動く
    $$('.scard__art, .photo').forEach(function (el) {
      gsap.fromTo(el, { clipPath: 'inset(16% 10% 16% 10% round 22px)' }, { clipPath: 'inset(0% 0% 0% 0% round 22px)', duration: 1.6, ease: 'expo.out',
        clearProps: 'clipPath', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    if (!MOBILE) $$('.scard__photo img, .photo:not(.photo--soft) img').forEach(function (img) {
      gsap.fromTo(img, { scale: 1.18 }, { scale: 1, ease: 'none',
        scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    // 周回図：中心から広がって現れる
    gsap.fromTo('.orbit', { scale: 0.82, opacity: 0, rotate: -20 }, { scale: 1, opacity: 1, rotate: 0, duration: 1.8, ease: 'expo.out', clearProps: 'transform',
      scrollTrigger: { trigger: '.orbit', start: 'top 80%', once: true } });

    // 広報力 × 対人力：左右から寄ってくる
    var pairTL = gsap.timeline({ scrollTrigger: { trigger: '.pair', start: 'top 78%', once: true } });
    pairTL.fromTo('.pair__card:first-child', { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 1.4, ease: 'expo.out', clearProps: 'transform' }, 0)
          .fromTo('.pair__card:last-child', { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 1.4, ease: 'expo.out', clearProps: 'transform' }, 0)
          .fromTo('.pair__mid span', { scale: 0, opacity: 0 }, { scale: 1, opacity: 0.8, duration: 1, ease: 'back.out(2)' }, 0.5);

    // コース：順に立ち上がる
    gsap.fromTo('.cc', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.12, clearProps: 'transform',
      scrollTrigger: { trigger: '.courses', start: 'top 82%', once: true } });

    // CTA の大きな「30分」
    gsap.fromTo('.cta__big > *', { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.08,
      scrollTrigger: { trigger: '.cta__big', start: 'top 85%', once: true } });
    gsap.fromTo('.cta__btns .btn', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.1, clearProps: 'transform',
      scrollTrigger: { trigger: '.cta__btns', start: 'top 90%', once: true } });

    // 流れ（Flow）：PCでは縦スクロールに合わせて横へ流れる。スマホは順に立ち上がる
    var mm = gsap.matchMedia();
    mm.add('(min-width: 901px)', function () {
      var pin = $('.flow__pin');
      var track = $('.flow__track');
      var line = $('.flow__line');
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth + 40); };
      var tween = gsap.fromTo(track, { x: 0 }, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: {
          trigger: pin, start: 'top top', end: function () { return '+=' + dist(); },
          pin: true, scrub: true, invalidateOnRefresh: true,
          onUpdate: function (self) { line.style.setProperty('--fp', self.progress.toFixed(4)); }
        }
      });
      return function () { if (tween.scrollTrigger) tween.scrollTrigger.kill(); tween.kill(); gsap.set(track, { clearProps: 'transform' }); };
    });
    mm.add('(max-width: 900px)', function () {
      $$('.fstep').forEach(function (el) {
        gsap.fromTo(el, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', clearProps: 'transform',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
      });
    });

    // 画像・文字の読み込みで高さが変わったら、位置を測り直す
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }

  // 確認用：?at=1200 で、その位置までスクロールした状態を表示する
  var AT = parseInt(params.get('at') || '', 10);
  if (!isNaN(AT)) window.addEventListener('load', function () { setTimeout(function () { window.scrollTo(0, AT); onScroll(); }, 300); });

  onScroll();
})();
