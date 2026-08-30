/* ==========================================================================
   GIESSE — CONSENSO COOKIE
   Unico punto da cui partono GA4 e Meta Pixel.

   PRIMA: entrambi erano incollati nel <head> di tutte e 15 le pagine e
   partivano al caricamento, senza chiedere niente.
   ORA: nessun tracker parte finche' il visitatore non ha scelto. Le pagine
   non devono piu contenere gli snippet: se ne trovi uno, va tolto, altrimenti
   quel tracker sfugge al consenso.

   Il resto del sito chiama gtag()/fbq() sempre dentro un controllo
   `typeof ... !== 'undefined'`, quindi senza consenso gli eventi vengono
   semplicemente saltati: non serve toccare quel codice.

   Per riaprire le preferenze da qualsiasi punto del sito:
     <button data-consenso="apri">Gestisci i cookie</button>
   oppure da console/altro script: window.GiesseConsenso.apri()
   ========================================================================== */
(function () {
  'use strict';

  // ---- identificativi degli strumenti -------------------------------------
  var GA4   = 'G-D3D6DHEYZY';          // Google Analytics 4
  var PIXEL = '1436951801354839';      // Meta Pixel

  // Microsoft Clarity — registrazioni di sessione e mappe di calore.
  //   Dove si prende: clarity.microsoft.com > il tuo progetto > Settings >
  //   Overview: e' il codice corto tipo 'abcd1234ef'.
  //   Vuoto = spento.
  var CLARITY = 'ya2gxqyclb';

  // Google Ads — tag di conversione. Due pezzi:
  //   ADS_ID: in Google Ads > Strumenti > Tag Google. Formato 'AW-123456789'.
  //   ADS_CONVERSIONE: l'etichetta della singola azione di conversione,
  //     in Obiettivi > Conversioni > (la tua azione) > Tag > "Etichetta
  //     conversione". Formato 'AW-123456789/AbC-D_efGh12_34'.
  //   Vuoti = spenti.
  var ADS_ID = 'AW-18417425641';
  var ADS_CONVERSIONE = 'AW-18417425641/lmMxCP2MmuocEOm5js5E';
  // Valore attribuito a ogni lead. E' quello impostato in Google Ads: serve
  // solo a dare un peso alle conversioni, non e' un incasso reale. Se un
  // domani si stima quanto vale davvero un contatto, va cambiato QUI e anche
  // nell'azione di conversione dentro Google Ads, altrimenti i due numeri
  // raccontano cose diverse.
  var ADS_VALORE = 1.0;
  var ADS_VALUTA = 'EUR';

  var CHIAVE = 'giesse-consenso';
  // Alzare la versione invalida le scelte gia' salvate e ripropone il banner.
  // Va fatto se si aggiungono strumenti nuovi: il vecchio consenso non li copre.
  var VERSIONE = 1;

  // --------------------------------------------------------------- memoria ---
  function leggi() {
    try {
      var g = JSON.parse(localStorage.getItem(CHIAVE) || 'null');
      if (!g || g.versione !== VERSIONE) return null;
      return g;
    } catch (e) { return null; }
  }
  function salva(statistiche, marketing) {
    var g = {
      versione: VERSIONE,
      statistiche: !!statistiche,
      marketing: !!marketing,
      data: new Date().toISOString()
    };
    try { localStorage.setItem(CHIAVE, JSON.stringify(g)); } catch (e) {}
    return g;
  }

  // -------------------------------------------------------------- tracker ---
  var avviati = { statistiche: false, marketing: false };

  function avviaStatistiche() {
    if (avviati.statistiche) return;
    avviati.statistiche = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4;
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', GA4, { anonymize_ip: true });

    // Microsoft Clarity: registra la sessione, quindi sta fra le statistiche
    // e non parte senza consenso. Di suo maschera gia' il contenuto dei campi
    // di testo, quindi quello che si scrive nel modulo non finisce nei video.
    if (CLARITY) {
      (function (c, l, a, r, i, t, y) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
        t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
      })(window, document, 'clarity', 'script', CLARITY);
    }
  }

  function avviaMarketing() {
    if (avviati.marketing) return;
    avviati.marketing = true;
    /* snippet ufficiale Meta, invariato */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', PIXEL);
    window.fbq('track', 'PageView');

    // Google Ads: e' pubblicitario, quindi sta col marketing e non con le
    // statistiche. Usa la stessa libreria gtag.js di GA4: se il visitatore ha
    // accettato solo il marketing, la libreria va caricata comunque qui.
    if (ADS_ID) {
      if (typeof window.gtag !== 'function') {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        var g = document.createElement('script');
        g.async = true;
        g.src = 'https://www.googletagmanager.com/gtag/js?id=' + ADS_ID;
        document.head.appendChild(g);
        window.gtag('js', new Date());
      }
      window.gtag('config', ADS_ID);
    }
  }

  /* Conversione Google Ads. La chiama il modulo dopo un invio riuscito.
     Se il visitatore non ha dato il consenso marketing, non fa nulla. */
  function conversioneAds() {
    if (!ADS_CONVERSIONE || typeof window.gtag !== 'function') return;
    var g = leggi();
    if (!g || !g.marketing) return;
    window.gtag('event', 'conversion', {
      send_to: ADS_CONVERSIONE,
      value: ADS_VALORE,
      currency: ADS_VALUTA
    });
    return true;
  }

  function applica(g) {
    if (!g) return;
    if (g.statistiche) avviaStatistiche();
    if (g.marketing) avviaMarketing();
  }

  // ---------------------------------------------------------------- banner ---
  var nodo = null;

  function chiudi() {
    if (!nodo) return;
    nodo.classList.remove('is-in');
    var via = function () { if (nodo && nodo.parentNode) nodo.parentNode.removeChild(nodo); nodo = null; };
    nodo.addEventListener('transitionend', via, { once: true });
    setTimeout(via, 500); // rete di sicurezza se transitionend non arriva
  }

  function decide(statistiche, marketing) {
    applica(salva(statistiche, marketing));
    chiudi();
  }

  function costruisci(scelta) {
    if (nodo) return;
    var g = scelta || { statistiche: true, marketing: true };

    nodo = document.createElement('div');
    nodo.className = 'ck-banner';
    nodo.setAttribute('role', 'dialog');
    nodo.setAttribute('aria-label', 'Preferenze cookie');
    nodo.setAttribute('aria-live', 'polite');

    // percorso corretto anche dalle sottocartelle (blog/, portfolio/)
    var su = /\/(blog|portfolio)\//.test(location.pathname) ? '../' : '';

    // Testo ridotto all'osso. Il banner precedente aveva 42 parole: piu' testo
    // c'e', piu' la gente lo ignora o cerca la via d'uscita invece di leggerlo.
    // Qui si dice cosa serve e basta, e la decisione arriva in due secondi.
    //
    // "Accetta" e "Rifiuta" hanno lo STESSO peso visivo e la stessa dimensione:
    // e' un requisito, non una gentilezza. Nascondere il rifiuto dietro un link
    // grigio e' il classico schema che il Garante sanziona, e trasformerebbe
    // un banner regolare in un problema.
    nodo.innerHTML =
      '<p class="ck-titolo">Cookie</p>' +
      '<p class="ck-testo">Ne usiamo alcuni per capire come viene usato il sito e per misurare le nostre campagne. ' +
        '<a href="' + su + 'cookie.html">Dettagli</a></p>' +
      '<div class="ck-dettaglio">' +
        '<div class="ck-voce">' +
          '<div class="ck-corpo"><h4>Tecnici</h4><p>Fanno funzionare il sito. Sempre attivi.</p></div>' +
          '<label class="ck-switch"><input type="checkbox" checked disabled aria-label="Cookie tecnici, sempre attivi"><span></span></label>' +
        '</div>' +
        '<div class="ck-voce">' +
          '<div class="ck-corpo"><h4>Statistiche</h4><p>Quante persone visitano il sito e quali pagine leggono, in forma aggregata.</p></div>' +
          '<label class="ck-switch"><input type="checkbox" id="ck-stat"' + (g.statistiche ? ' checked' : '') + ' aria-label="Cookie di statistica"><span></span></label>' +
        '</div>' +
        '<div class="ck-voce">' +
          '<div class="ck-corpo"><h4>Marketing</h4><p>Misurano i risultati delle campagne su Facebook e Instagram.</p></div>' +
          '<label class="ck-switch"><input type="checkbox" id="ck-mkt"' + (g.marketing ? ' checked' : '') + ' aria-label="Cookie di marketing"><span></span></label>' +
        '</div>' +
      '</div>' +
      '<div class="ck-azioni">' +
        '<button type="button" class="ck-btn ck-accetta">Accetta</button>' +
        '<button type="button" class="ck-btn ck-rifiuta">Rifiuta</button>' +
      '</div>' +
      '<button type="button" class="ck-scegli" aria-expanded="false">Scegli quali</button>';

    document.body.appendChild(nodo);
    requestAnimationFrame(function () { nodo.classList.add('is-in'); });

    var dettaglio = nodo.querySelector('.ck-dettaglio');
    var scegli = nodo.querySelector('.ck-scegli');

    scegli.addEventListener('click', function () {
      var aperto = dettaglio.classList.toggle('is-aperto');
      scegli.setAttribute('aria-expanded', String(aperto));
      // Aperto il pannello, il link diventa il tasto per confermare:
      // altrimenti si spuntano le caselle e non si capisce come salvare.
      scegli.textContent = aperto ? 'Salva le mie scelte' : 'Scegli quali';
      scegli.classList.toggle('is-salva', aperto);
      if (!aperto) {
        decide(nodo.querySelector('#ck-stat').checked, nodo.querySelector('#ck-mkt').checked);
      }
    });
    nodo.querySelector('.ck-accetta').addEventListener('click', function () { decide(true, true); });
    nodo.querySelector('.ck-rifiuta').addEventListener('click', function () { decide(false, false); });
  }

  // ------------------------------------------------------------------ avvio ---
  function avvia() {
    var g = leggi();
    // NIENTE tracciamento prima della scelta. Statistiche e marketing partono
    // solo dopo che il visitatore ha deciso: e' quello che dicono la cookie
    // policy e la privacy policy del sito, e devono continuare a coincidere.
    if (g) applica(g);
    else costruisci(null);
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-consenso="apri"]');
      if (t) { e.preventDefault(); costruisci(leggi()); }
    });
  }

  window.GiesseConsenso = {
    conversioneAds: conversioneAds,
    apri: function () { costruisci(leggi()); },
    stato: leggi,
    revoca: function () { try { localStorage.removeItem(CHIAVE); } catch (e) {} location.reload(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();
})();
