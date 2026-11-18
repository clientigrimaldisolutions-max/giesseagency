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

  /* ------------------------------------------------- traffico interno ---
     Il 79% degli eventi di GA4 lo generavamo NOI navigando il sito: 55
     sessioni "Direct" con 79 eventi ciascuna, contro le 13 di chi arriva da
     Google. Ogni media era calcolata su quel rumore.

     GA4 permette di escludere per INDIRIZZO IP, ma l'IP di casa e dell'ufficio
     cambia e va aggiornato a mano: la prima volta che cambia si ricomincia a
     sporcare i dati senza accorgersene. Qui si usa un interruttore nel
     browser, che non scade e viaggia col dispositivo.

     COME SI ACCENDE, una volta per ogni dispositivo e ogni browser:
         https://www.giesseagency.com/?interno=1
     Per spegnerlo (es. su un computer prestato):
         https://www.giesseagency.com/?interno=0
     Per sapere com'e' messo: GiesseConsenso.interno() in console.

     Da acceso: a GA4 si manda traffic_type 'internal' — il filtro dati di GA4
     scarta quelle righe — e Clarity NON parte proprio, perche' li' non esiste
     un equivalente del filtro e le registrazioni nostre coprirebbero quelle
     dei visitatori veri. */
  var CHIAVE_INTERNO = 'giesse-interno';

  function eInterno() {
    try {
      /* IL POSTO DECIDE DA SOLO (18/11/2026)
         Su localhost, 127.0.0.1, un nome .local/.test o un file aperto da
         disco non esiste un visitatore vero: quelle sono sempre prove nostre.
         Prima bisognava ricordarsi ?interno=1 e nessuno se lo ricordava:
         in tre giorni Clarity aveva raccolto 13 visualizzazioni nostre
         mescolate a quelle dei visitatori. Una regola che dipende dalla
         memoria di chi prova non e' una regola. */
      var casa = location.hostname;
      if (location.protocol === 'file:' ||
          casa === 'localhost' || casa === '127.0.0.1' ||
          casa === '::1' || casa === '[::1]' ||
          /\.(local|test|localhost)$/.test(casa)) return true;

      var q = new URLSearchParams(location.search);
      if (q.has('interno')) {
        var acceso = q.get('interno') !== '0';
        if (acceso) localStorage.setItem(CHIAVE_INTERNO, '1');
        else localStorage.removeItem(CHIAVE_INTERNO);
      }
      return localStorage.getItem(CHIAVE_INTERNO) === '1';
    } catch (e) {
      // modalita' anonima o storage bloccato: si tratta come visitatore vero
      return false;
    }
  }

  // -------------------------------------------------------------- tracker ---
  var avviati = { statistiche: false, marketing: false };

  /* CLARITY, e perche' questo e' l'unico tracker che si carica prima della
     scelta. Clarity ha una modalita' prevista da Microsoft: con il consenso
     NEGATO il tag si carica lo stesso ma non scrive nessun cookie, ne' di
     prima ne' di terza parte, e non cuce insieme le visite. Serve perche'
     altrimenti vediamo solo chi accetta: il 17/11/2026 erano 5 persone su
     443, e la sola che ha attraversato tutto il questionario non era fra
     quelle cinque. Senza registrazione non si capisce DOVE si e' bloccata.
     Di suo Clarity maschera il contenuto dei campi di testo, quindi quello
     che si scrive nel modulo non finisce comunque nei video.
     NOTA: Microsoft impone il segnale di consenso in UE, UK e Svizzera dal
     31 ottobre 2025. Questo e' il modo previsto, non un aggiramento. */
  function caricaClarity() {
    if (!CLARITY || eInterno() || window.clarity) return;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY);
    // Si parte SEMPRE da negato. Se poi arriva il consenso, applica() alza
    // l'interruttore; se arriva il rifiuto, Clarity cancella da solo i cookie
    // che aveva messo e riparte senza.
    clarityConsenso('denied', 'denied');
  }

  /* L'unico posto da cui si parla del consenso a Clarity. La funzione stub
     messa dal caricatore accoda le chiamate fatte prima che lo script arrivi,
     quindi non serve aspettare. */
  function clarityConsenso(analitici, pubblicita) {
    if (typeof window.clarity !== 'function') return;
    try {
      window.clarity('consentv2', {
        analytics_Storage: analitici,
        ad_Storage: pubblicita
      });
    } catch (e) {}
  }

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
    var interno = eInterno();
    window.gtag('config', GA4, interno
      ? { anonymize_ip: true, traffic_type: 'internal' }
      : { anonymize_ip: true });

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
    // Clarity prima di tutto: sta gia' girando senza cookie, qui si limita a
    // sapere com'e' andata la scelta. Vale in entrambi i versi, perche' da
    // "Gestisci i cookie" un consenso si puo' anche revocare.
    clarityConsenso(g.statistiche ? 'granted' : 'denied',
                    g.marketing ? 'granted' : 'denied');
    if (g.statistiche) avviaStatistiche();
    if (g.marketing) avviaMarketing();
  }

  // ---------------------------------------------------------------- banner ---
  var nodo = null;

  /* IL BANNER NON DEVE MAI COPRIRE QUELLO CHE SI TOCCA.
     Scoperto il 17/11/2026, ed e' costato contatti veri: il banner e' fixed
     in fondo e su un telefono e' alto 299px su 812, cioe' si prende il 37%
     dello schermo. Finche' il visitatore non sceglie resta li', e con
     pointer-events attivi INTERCETTA i tocchi: nella schermata dei contatti
     i campi "Numero di cellulare" ed "Email" finivano sotto di lui e non si
     potevano toccare. Verificato con elementFromPoint: su quei campi
     l'elemento in cima era .ck-banner, non l'input. Chi non aveva ancora
     scelto sui cookie non riusciva a candidarsi, e non poteva nemmeno
     capire perche'.
     La cura: finche' il banner e' aperto la pagina si allunga in fondo di
     quanto e' alto lui. Cosi' nessun contenuto gli finisce sotto e tutto
     resta raggiungibile scorrendo. Va ricalcolato anche quando si apre
     "Scegli quali", perche' il banner diventa piu' alto. */
  function riservaSpazio() {
    if (!nodo) return;
    var r = nodo.getBoundingClientRect();
    var staccoDalFondo = parseFloat(getComputedStyle(nodo).bottom) || 0;
    document.body.style.paddingBottom = Math.ceil(r.height + staccoDalFondo + 16) + 'px';
  }

  function liberaSpazio() {
    document.body.style.paddingBottom = '';
  }

  window.addEventListener('resize', function () { if (nodo) riservaSpazio(); });

  function chiudi() {
    if (!nodo) return;
    liberaSpazio();
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
    // IL TESTO, e perche' questo invece del precedente.
    // Prima diceva: "Ne usiamo alcuni per capire come viene usato il sito e
    // per misurare le nostre campagne". Vero, ma raccontato dal nostro lato:
    // chi legge sente "vogliono misurarmi" e il riflesso e' Rifiuta. Qui si
    // dice la stessa identica cosa dal lato suo e in concreto — quale
    // annuncio l'ha portato, e a cosa ci serve — senza promettere niente che
    // non facciamo. Chi arriva su questa landing fa impresa: il problema del
    // budget buttato in annunci che non funzionano lo conosce di persona.
    // Due versioni dello stesso messaggio, perche' questo file lo carica TUTTO
    // il sito. Chi arriva da un annuncio (ha utm, fbclid o gclid nell'URL) si
    // sente dire la cosa concreta e vera per lui: quale annuncio l'ha portato.
    // Chi arriva dal blog o da Google si sentirebbe raccontare un annuncio che
    // non esiste, e una frase che non torna fa esattamente il danno che
    // vogliamo evitare: insospettisce. A quello si dice la stessa cosa nella
    // forma giusta per lui.
    var daAnnuncio = /[?&](utm_source|utm_campaign|fbclid|gclid)=/.test(location.search);
    var spiegazione = daAnnuncio
      ? 'Questi cookie ci dicono quale annuncio ti ha portato qui, cos\u00ec spegniamo quelli che non funzionano. '
      : 'Questi cookie ci dicono quali pagine servono davvero e da dove arrivano le persone, cos\u00ec smettiamo di spendere su quello che non funziona. ';

    nodo.innerHTML =
      '<p class="ck-titolo">Ci aiuta a non sprecare budget</p>' +
      '<p class="ck-testo">' + spiegazione +
        '\u00c8 la stessa cosa che facciamo per i nostri clienti. ' +
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
    requestAnimationFrame(function () { nodo.classList.add('is-in'); riservaSpazio(); });

    var dettaglio = nodo.querySelector('.ck-dettaglio');
    var scegli = nodo.querySelector('.ck-scegli');

    scegli.addEventListener('click', function () {
      var aperto = dettaglio.classList.toggle('is-aperto');
      scegli.setAttribute('aria-expanded', String(aperto));
      riservaSpazio();
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
    /* NESSUN COOKIE prima della scelta, e questo non e' cambiato.
       Quello che e' cambiato il 17/11/2026 e' che Clarity ora si carica
       subito in modalita' negata: non scrive cookie, non salva niente sul
       dispositivo, non riconosce chi torna. GA4, il Pixel e Google Ads invece
       restano fermi finche' il visitatore non ha deciso.
       ATTENZIONE: la cookie policy e la privacy policy devono dirlo. Se
       dicono ancora "nessuno strumento di analisi prima del consenso", vanno
       aggiornate, altrimenti la pagina e il testo non coincidono piu'. */
    caricaClarity();
    if (g) { applica(g); return avviaAscoltoApri(); }

    /* QUANDO COMPARE, e perche' non piu' subito.
       Il banner arrivava nello stesso istante del caricamento: la persona non
       ha ancora letto una riga, non sa dove e', e la risposta piu' rapida per
       togliersi di mezzo una finestra che non capisce e' Rifiuta. Con qualche
       secondo davanti, la pagina ha gia' detto chi siamo e la scelta si fa
       sapendo a chi la si sta dando.
       Legalmente non cambia niente, ed e' il motivo per cui si puo' fare:
       prima della scelta non parte NESSUN tracker, ne' adesso ne' prima.
       Sei secondi: sotto non si legge niente, sopra si rischia che la persona
       abbia gia' cominciato il percorso e il banner le arrivi addosso mentre
       compila. La coda degli eventi della landing aspetta tre minuti, quindi
       questo ritardo non fa perdere nemmeno un evento di chi poi accetta. */
    var apparso = false;
    function mostraIlBanner() {
      if (apparso) return;
      apparso = true;
      costruisci(null);
    }
    setTimeout(mostraIlBanner, 6000);
    avviaAscoltoApri();
  }

  /* "Gestisci i cookie" nel footer deve funzionare sempre: sia per chi ha gia'
     scelto, sia per chi non ha ancora scelto e vuole decidere subito senza
     aspettare i sei secondi. */
  function avviaAscoltoApri() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-consenso="apri"]');
      if (t) { e.preventDefault(); costruisci(leggi()); }
    });
  }

  window.GiesseConsenso = {
    interno: eInterno,
    conversioneAds: conversioneAds,
    apri: function () { costruisci(leggi()); },
    stato: leggi,
    revoca: function () { try { localStorage.removeItem(CHIAVE); } catch (e) {} location.reload(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();
})();
