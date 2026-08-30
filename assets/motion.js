/* ==========================================================================
   GIESSE — MOTION
   Condiviso da tutte le pagine. Nessuna dipendenza esterna.
   ========================================================================== */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. ORB DI SFONDO ---------------------------------------- */
  function paintOrbs() {
    var sections = document.querySelectorAll('[data-orbs], [data-orbs-fixed]');
    for (var i = 0; i < sections.length; i++) {
      var s = sections[i];
      if (s.querySelector(':scope > .bg-orbs')) continue;
      s.classList.add('has-orbs');
      var fixed = s.hasAttribute('data-orbs-fixed');
      var layer = document.createElement('div');
      layer.className = fixed ? 'bg-orbs bg-orbs--fixed' : 'bg-orbs';
      layer.setAttribute('aria-hidden', 'true');
      // quali orb: default tutte e quattro, altrimenti data-orbs="1 3"
      var which = (s.getAttribute(fixed ? 'data-orbs-fixed' : 'data-orbs') || '').trim();
      var list = which ? which.split(/\s+/) : ['1', '2', '3', '4'];
      for (var j = 0; j < list.length; j++) {
        var o = document.createElement('span');
        o.className = 'o o' + list[j];
        // sfasa le animazioni così due sezioni vicine non pulsano all'unisono
        o.style.animationDelay = (-(i * 7 + j * 3)) + 's';
        layer.appendChild(o);
      }
      s.insertBefore(layer, s.firstChild);
    }
  }

  /* ---------- 2. REVEAL A SCORRIMENTO ---------------------------------
     Riscritto il 30/08/2026. Due cose non andavano:

     1) la soglia era in PERCENTUALE dell'elemento (threshold 0.14). Su una
        riga di 40px scattava dopo 6px, su un blocco di 900px dopo 126px:
        elementi vicini partivano in momenti scorrelati e il ritmo della
        pagina sembrava casuale. Ora la soglia e' 0 e il punto di innesco lo
        decide il rootMargin: TUTTO parte quando il suo bordo attraversa
        l'88% dell'altezza dello schermo, indipendentemente da quanto e' alto.

     2) scorrendo verso l'alto gli elementi entravano dal bordo superiore ma
        l'animazione li faceva comunque salire da sotto. Qui si guarda da che
        parte e' entrato l'elemento e si specchia la posa di partenza. */
  function setupReveals() {
    var els = document.querySelectorAll('.m-up, .m-scale, .m-left, .m-right, .m-mask, .m-title, .m-soft');
    if (!els.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      for (var k = 0; k < els.length; k++) els[k].classList.add('is-in');
      return;
    }

    function rivela(el, dallAlto) {
      if (dallAlto) {
        el.classList.add('m-dalto');
        // Serve un ricalcolo forzato: senza, il browser vede aggiungere
        // .m-dalto e .is-in nello stesso frame, fonde i due stili e la posa
        // specchiata non viene mai disegnata (quindi niente animazione).
        void el.offsetWidth;
      }
      el.classList.add('is-in');
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        // bottom <= altezza dell'elemento + un filo => e' entrato dall'alto
        var dallAlto = e.boundingClientRect.top < 0;
        rivela(e.target, dallAlto);
        io.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });

    for (var i = 0; i < els.length; i++) io.observe(els[i]);
  }

  /* Nei blocchi di testo lungo ogni paragrafo entra da solo mentre si scorre.
     Fatto via JS per non dover sporcare l'HTML degli articoli riga per riga. */
  // Rete di sicurezza: qualunque tabella non ancora avvolta viene resa scorrevole
  function wrapTables() {
    var tables = document.querySelectorAll('.prose table, .article-body table');
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      if (t.parentNode && t.parentNode.classList.contains('table-scroll')) continue;
      var w = document.createElement('div');
      w.className = 'table-scroll';
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    }
  }

  function markProse() {
    var blocks = document.querySelectorAll('[data-prose]');
    for (var i = 0; i < blocks.length; i++) {
      var kids = blocks[i].children;
      for (var j = 0; j < kids.length; j++) {
        var tag = kids[j].tagName;
        if (tag === 'H2' || tag === 'H3') {
          kids[j].classList.add('m-title');
        } else if (tag === 'P' || tag === 'UL' || tag === 'OL' ||
                   tag === 'BLOCKQUOTE' || tag === 'TABLE' || tag === 'HR') {
          kids[j].classList.add('m-soft');
        }
      }
    }
  }

  /* Applica lo stagger dentro i gruppi marcati data-stagger */
  function setupStagger() {
    var groups = document.querySelectorAll('[data-stagger]');
    for (var i = 0; i < groups.length; i++) {
      var kids = groups[i].children;
      for (var j = 0; j < kids.length; j++) {
        if (!kids[j].style.getPropertyValue('--i')) {
          kids[j].style.setProperty('--i', String(j));
        }
      }
    }
  }

  /* ---------- 3. NUMERI CHE SALGONO DA ZERO --------------------------- */
  // Riconosce "+5.000", "€3,78", "+€200k", "100%", "559"
  function parseNumber(txt) {
    var m = /^(\D*?)([\d.,]+)(\D*)$/.exec(txt.trim());
    if (!m) return null;
    var prefix = m[1], core = m[2], suffix = m[3];
    var decimals = 0, value;
    // il punto e' sempre separatore di migliaia, la virgola sempre decimale (formato IT)
    var grouped = core.indexOf('.') !== -1;
    if (core.indexOf(',') !== -1) {
      var parts = core.split(',');
      decimals = parts[1] ? parts[1].length : 0;
      value = parseFloat(parts[0].replace(/\./g, '') + '.' + (parts[1] || '0'));
    } else {
      value = parseFloat(core.replace(/\./g, ''));
    }
    if (isNaN(value)) return null;
    return { prefix: prefix, suffix: suffix, value: value, decimals: decimals, grouped: grouped };
  }

  // Formattazione italiana fatta a mano: toLocaleString('it-IT') NON raggruppa
  // i numeri di 4 cifre (minimumGroupingDigits = 2), quindi 5000 usciva "5000"
  // invece di "5.000". Qui rispettiamo esattamente il formato del testo originale.
  function group(intStr) {
    return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function fmt(n, decimals, grouped) {
    var neg = n < 0;
    n = Math.abs(n);
    var fixed = decimals ? n.toFixed(decimals) : String(Math.round(n));
    var parts = fixed.split('.');
    var ip = grouped ? group(parts[0]) : parts[0];
    return (neg ? '-' : '') + ip + (parts[1] ? ',' + parts[1] : '');
  }

  function countUp(el, spec) {
    var dur = 1600 + Math.min(900, spec.value / 12);
    var start = null;
    el.classList.add('counting');
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      // easeOutExpo: parte veloce e si posa
      var e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      el.textContent = spec.prefix + fmt(spec.value * e, spec.decimals, spec.grouped) + spec.suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = spec.prefix + fmt(spec.value, spec.decimals, spec.grouped) + spec.suffix;
    }
    requestAnimationFrame(step);
  }

  function setupCounters() {
    var sel = '[data-count], .metric-value, .bento-stat-value, .stat-card .num';
    var els = document.querySelectorAll(sel);
    if (!els.length) return;

    var specs = [];
    for (var i = 0; i < els.length; i++) {
      var spec = parseNumber(els[i].textContent);
      if (!spec) continue;
      els[i].setAttribute('data-final', els[i].textContent.trim());
      specs.push([els[i], spec]);
    }
    if (reduce || !('IntersectionObserver' in window)) return;

    // Blocca la larghezza prima di azzerare, così il layout non salta
    specs.forEach(function (pair) {
      var el = pair[0], spec = pair[1];
      el.style.minWidth = el.getBoundingClientRect().width + 'px';
      el.textContent = spec.prefix + fmt(0, spec.decimals, spec.grouped) + spec.suffix;
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        for (var i = 0; i < specs.length; i++) {
          if (specs[i][0] === e.target) { countUp(e.target, specs[i][1]); break; }
        }
      });
    }, { threshold: 0.5 });
    specs.forEach(function (pair) { io.observe(pair[0]); });
  }

  /* ---------- 4. PARALLASSE + BARRA DI AVANZAMENTO -------------------- */
  function setupScroll() {
    var bar = null;
    if (!document.querySelector('.scroll-progress')) {
      bar = document.createElement('div');
      bar.className = 'scroll-progress';
      bar.setAttribute('aria-hidden', 'true');
      document.body.appendChild(bar);
    } else {
      bar = document.querySelector('.scroll-progress');
    }
    var par = document.querySelectorAll('.m-par');
    var ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var doc = document.documentElement;
        var max = (doc.scrollHeight - window.innerHeight) || 1;
        bar.style.setProperty('--p', Math.min(1, Math.max(0, window.scrollY / max)));

        if (!reduce) {
          var vh = window.innerHeight;
          for (var i = 0; i < par.length; i++) {
            var r = par[i].getBoundingClientRect();
            if (r.bottom < -200 || r.top > vh + 200) continue;
            var speed = parseFloat(par[i].getAttribute('data-par')) || 0.12;
            // 0 al centro dello schermo, cresce allontanandosi
            var offset = (r.top + r.height / 2 - vh / 2) * -speed;
            par[i].style.setProperty('--py', offset.toFixed(1) + 'px');
          }
        }
        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 5. BOTTONI MAGNETICI ------------------------------------ */
  function setupMagnetic() {
    if (reduce) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var sel = '.btn-cta, .btn-nav, .hero-cta, .footer-cta-btn, .footer-mega-cta, .service-toggle';
    var btns = document.querySelectorAll(sel);
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        var strength = 0.22, max = 10;
        b.addEventListener('mousemove', function (ev) {
          var r = b.getBoundingClientRect();
          var dx = (ev.clientX - (r.left + r.width / 2)) * strength;
          var dy = (ev.clientY - (r.top + r.height / 2)) * strength;
          b.style.setProperty('--mx', Math.max(-max, Math.min(max, dx)).toFixed(1) + 'px');
          b.style.setProperty('--my', Math.max(-max, Math.min(max, dy)).toFixed(1) + 'px');
        });
        b.addEventListener('mouseleave', function () {
          b.style.setProperty('--mx', '0px');
          b.style.setProperty('--my', '0px');
        });
      })(btns[i]);
    }
  }

  /* ---------- 6. SPOTLIGHT SULLE CARD --------------------------------- */
  function setupSpotlight() {
    if (reduce) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var cards = document.querySelectorAll('.cat-card, .team-card, .article-card, .metric, .stat-card');
    for (var i = 0; i < cards.length; i++) {
      (function (c) {
        c.addEventListener('mousemove', function (ev) {
          var r = c.getBoundingClientRect();
          c.style.setProperty('--sx', (((ev.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
          c.style.setProperty('--sy', (((ev.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
        });
      })(cards[i]);
    }
  }


  /* ------------------------------------------------------------------
     MENU MOBILE (28/08/2026)
     Sotto i 900px .nav-menu era semplicemente display:none, senza NIENTE
     al suo posto: da telefono non si poteva raggiungere Servizi, Team,
     Portfolio o Blog da nessuna pagina. Per un sito che prende traffico
     da Instagram era il buco piu grave della versione mobile.

     Il pannello viene costruito da qui, non nel markup, cosi tutte e 15
     le pagine lo ottengono senza doverle toccare una per una: le voci
     sono clonate dalla .nav-menu gia presente in ognuna, quindi restano
     giuste anche per le pagine in sottocartella (i ../ sono gia nei link).
     ------------------------------------------------------------------ */
  function setupMenuMobile() {
    var nav = document.querySelector('.nav');
    var menu = nav && nav.querySelector('.nav-menu');
    if (!nav || !menu || nav.querySelector('.nav-burger')) return;

    var bottone = document.createElement('button');
    bottone.className = 'nav-burger';
    bottone.type = 'button';
    bottone.setAttribute('aria-label', 'Apri il menu');
    bottone.setAttribute('aria-expanded', 'false');
    bottone.innerHTML = '<span></span><span></span>';

    var pannello = document.createElement('div');
    pannello.className = 'nav-panel';
    pannello.hidden = true;

    var lista = document.createElement('nav');
    lista.className = 'nav-panel-links';
    lista.setAttribute('aria-label', 'Menu principale');
    Array.prototype.forEach.call(menu.querySelectorAll('a'), function (a, i) {
      var c = a.cloneNode(true);
      c.style.setProperty('--i', i);
      lista.appendChild(c);
    });

    // La CTA viene clonata dalla nav: cosi il link resta corretto ovunque.
    var cta = nav.querySelector('.btn-nav');
    if (cta) {
      var cc = cta.cloneNode(true);
      cc.className = 'nav-panel-cta';
      cc.style.setProperty('--i', lista.children.length);
      lista.appendChild(cc);
    }
    pannello.appendChild(lista);

    var nascosti = [];
    function apri() {
      pannello.hidden = false;
      // forza un reflow: senza, la transizione non parte perche l'elemento
      // passa da hidden a visibile nello stesso frame
      void pannello.offsetWidth;
      document.body.classList.add('menu-aperto');
      bottone.classList.add('is-open');
      bottone.setAttribute('aria-expanded', 'true');
      bottone.setAttribute('aria-label', 'Chiudi il menu');
      pannello.classList.add('is-open');
      // il resto della pagina sparisce per i lettori di schermo
      nascosti = [];
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el !== pannello && el !== nav && !el.hasAttribute('aria-hidden')) {
          el.setAttribute('aria-hidden', 'true');
          nascosti.push(el);
        }
      });
    }
    function chiudi() {
      document.body.classList.remove('menu-aperto');
      bottone.classList.remove('is-open');
      bottone.setAttribute('aria-expanded', 'false');
      bottone.setAttribute('aria-label', 'Apri il menu');
      pannello.classList.remove('is-open');
      nascosti.forEach(function (el) { el.removeAttribute('aria-hidden'); });
      nascosti = [];
      var fine = function () { if (!pannello.classList.contains('is-open')) pannello.hidden = true; };
      pannello.addEventListener('transitionend', fine, { once: true });
      setTimeout(fine, 400); // rete di sicurezza se transitionend non arriva
    }
    bottone.addEventListener('click', function () {
      pannello.classList.contains('is-open') ? chiudi() : apri();
    });
    lista.addEventListener('click', function (e) { if (e.target.closest('a')) chiudi(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && pannello.classList.contains('is-open')) { chiudi(); bottone.focus(); }
    });
    // se si torna a schermo largo con il menu aperto, va richiuso
    window.matchMedia('(min-width: 901px)').addEventListener('change', function (e) {
      if (e.matches && pannello.classList.contains('is-open')) chiudi();
    });

    (nav.querySelector('.nav-right') || nav.querySelector('.nav-inner')).appendChild(bottone);
    document.body.appendChild(pannello);
  }

  /* ---------- 7. ANCORE CHE ATTERRANO SUL TITOLO ----------------------
     scroll-padding-top era fisso a 100px, ma la nav e' alta 72px su telefono
     e 88px da desktop, e le sezioni hanno padding-top diversi fra loro: il
     risultato era che a volte il titolo restava mezzo sotto la barra.
     Qui la posizione la si calcola: si cerca il primo titolo o occhiello
     della sezione e lo si porta appena sotto la nav, con 26px d'aria. */
  function setupAncore() {
    var TITOLI = '.services-title, .team-title, .portfolio-title, .zone-titolo,' +
                 ' .form-section-title, .rec-titolo, h1, h2, .zone-eyebrow, .rec-eyebrow';

    function altezzaNav() {
      var n = document.querySelector('.nav');
      if (!n) return 0;
      var h = n.getBoundingClientRect().height;
      // se la nav e' trasparente e alta poco (in cima alla pagina) vale
      // comunque il suo ingombro da "scrolled"
      return Math.max(h, 64);
    }

    function bersaglio(id) {
      var sez = document.getElementById(id);
      if (!sez) return null;
      // il titolo va cercato dentro la sezione; se non c'e', si usa la sezione
      var t = sez.matches(TITOLI) ? sez : sez.querySelector(TITOLI);
      return t || sez;
    }

    var ARIA = 26;   // respiro fra la barra e il titolo

    // getBoundingClientRect() risente delle trasformazioni: i titoli sono
    // dentro .m-par (parallasse) e partono con translateY dal reveal, quindi
    // misurarli li' dava un bersaglio che si spostava mentre ci si arrivava —
    // ed e' esattamente il motivo per cui il titolo finiva mezzo sotto la nav.
    // La catena degli offsetTop invece e' la posizione di IMPAGINAZIONE, che
    // le trasformazioni non toccano.
    function cimaImpaginata(el) {
      var y = 0;
      while (el) { y += el.offsetTop; el = el.offsetParent; }
      return y;
    }

    function vaiA(id, spingi) {
      var t = bersaglio(id);
      if (!t) return false;
      var y = cimaImpaginata(t) - altezzaNav() - ARIA;
      y = Math.max(0, Math.round(y));
      window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
      if (spingi && history.replaceState) history.replaceState(null, '', '#' + id);

      // Rifinitura: a scorrimento finito la parallasse ha spostato il titolo di
      // qualche pixel. Se lo scarto e' visibile lo si chiude di colpo, quando
      // ormai la pagina e' ferma e non si nota.
      if (!reduce) {
        var fermo = 0, ultimo = -1;
        var vigila = setInterval(function () {
          if (Math.abs(window.pageYOffset - ultimo) < 1) fermo++; else fermo = 0;
          ultimo = window.pageYOffset;
          if (fermo < 3) return;
          clearInterval(vigila);
          var scarto = t.getBoundingClientRect().top - altezzaNav() - ARIA;
          if (Math.abs(scarto) > 8) window.scrollBy({ top: Math.round(scarto), behavior: 'auto' });
        }, 90);
        setTimeout(function () { clearInterval(vigila); }, 3000);
      }
      return true;
    }

    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      if (!id || id === 'top') return;
      if (vaiA(id, true)) e.preventDefault();
    });

    // Arrivo da un link esterno tipo giesseagency.com/#form: il browser ha
    // gia' saltato con la sua regola, si ricorregge dopo il primo disegno.
    if (location.hash.length > 1) {
      var id = location.hash.slice(1);
      window.addEventListener('load', function () {
        setTimeout(function () { vaiA(id, false); }, 60);
      });
    }
  }

  // marcatore di versione: serve a capire al volo se il browser sta girando
  // questo file o una copia vecchia in cache
  window.GiesseMotion = { versione: 2 };

  /* ---------- 8. LENTE SULLE GRAFICHE ---------------------------------
     Le grafiche del portfolio vanno guardate intere: nella griglia stanno a
     340px di lato e il testo dentro non si legge. Ogni card marcata
     data-lente="percorso.jpg" si apre a schermo pieno.
     Il pannello viene costruito una volta sola e solo se la pagina ha almeno
     una card: le altre 16 pagine non pagano niente. */
  function setupLente() {
    // [data-lente] = immagine, [data-lente-video] = clip che parte COL SUONO.
    var apri = document.querySelectorAll('[data-lente], [data-lente-video]');
    if (!apri.length) return;

    var lente = document.createElement('div');
    lente.className = 'lente';
    lente.setAttribute('role', 'dialog');
    lente.setAttribute('aria-modal', 'true');
    lente.setAttribute('aria-label', 'Grafica a schermo intero');
    lente.innerHTML =
      '<button type="button" class="lente-chiudi" aria-label="Chiudi">' +
        '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">' +
        '<path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
      '</button>' +
      '<img alt="">' +
      '<video class="lente-video" playsinline controls preload="none"></video>' +
      '<p class="lente-didascalia"></p>';
    document.body.appendChild(lente);

    var img = lente.querySelector('img');
    var vid = lente.querySelector('.lente-video');
    var did = lente.querySelector('.lente-didascalia');
    var chiudiBtn = lente.querySelector('.lente-chiudi');
    var tornaA = null;

    function mostra(el) {
      var sorgenteVideo = el.getAttribute('data-lente-video');
      did.textContent = el.getAttribute('data-lente-testo') || '';
      tornaA = el;

      if (sorgenteVideo) {
        img.hidden = true;
        vid.hidden = false;
        vid.poster = el.getAttribute('data-lente-poster') || '';
        vid.src = sorgenteVideo;
        // NIENTE muted: il clic sulla card e' il gesto che serve al browser
        // per concedere l'audio. Se play() venisse rifiutato lo stesso,
        // restano i controlli: il video e' li, fermo, e si fa partire a mano.
        vid.muted = false;
        vid.volume = 1;
        var p = vid.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        vid.hidden = true;
        img.hidden = false;
        img.src = el.getAttribute('data-lente');
        img.alt = el.getAttribute('data-lente-alt') || '';
      }

      lente.classList.add('is-aperta');
      document.body.style.overflow = 'hidden';
      chiudiBtn.focus();
    }
    function chiudi() {
      lente.classList.remove('is-aperta');
      document.body.style.overflow = '';
      // Il video va fermato SUBITO: staccare solo la sorgente lo lascerebbe
      // suonare per un attimo dietro alla dissolvenza.
      if (!vid.hidden) { vid.pause(); vid.removeAttribute('src'); vid.load(); }
      // la sorgente dell'immagine si stacca dopo la dissolvenza, non durante
      setTimeout(function () { if (!lente.classList.contains('is-aperta')) img.removeAttribute('src'); }, 350);
      if (tornaA) { tornaA.focus(); tornaA = null; }
    }

    for (var i = 0; i < apri.length; i++) {
      (function (el) {
        el.addEventListener('click', function () { mostra(el); });
      })(apri[i]);
    }
    chiudiBtn.addEventListener('click', chiudi);
    lente.addEventListener('click', function (e) { if (e.target === lente) chiudi(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lente.classList.contains('is-aperta')) chiudi();
    });
  }

  function init() {
    paintOrbs();
    wrapTables();
    markProse();
    setupStagger();
    setupReveals();
    setupCounters();
    setupScroll();
    setupMagnetic();
    setupSpotlight();
    setupMenuMobile();
    setupAncore();
    setupLente();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
