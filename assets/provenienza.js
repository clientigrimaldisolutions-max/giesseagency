/* ==========================================================================
   GIESSE — DA DOVE ARRIVA CHI SCRIVE
   Creato il 30/08/2026.

   IL PROBLEMA
   Analytics dice quante visite arrivano da ricerca organica e quante dalle
   campagne. Non dice se QUEL lead, quello con nome e telefono, e' arrivato
   pagando o gratis. E' la domanda che conta: senza la risposta non si sa
   quanto costa davvero un cliente ne' se la SEO stia rendendo.

   COSA FA
   Al primo arrivo legge come sei entrato e lo mette da parte. Quando poi si
   compila il modulo, la provenienza viaggia insieme al nome e finisce sul
   foglio Google in chiaro: "pagato — google / cpc", "organico — google".

   PERCHE' AL PRIMO ARRIVO
   La gente arriva da un annuncio, gira, se ne va, torna il giorno dopo
   digitando il nome e SOLO ALLORA compila. Se si guardasse il referrer al
   momento dell'invio, quel lead risulterebbe "diretto" e la campagna che
   l'ha davvero portato non prenderebbe il merito. Si tiene quindi il PRIMO
   contatto (per 90 giorni) e anche l'ultimo, cosi' si vedono tutti e due.

   NIENTE COOKIE, NIENTE CONSENSO
   Sta tutto in localStorage e non esce dal browser finche' la persona non
   preme "invia" di sua volonta'. Non e' profilazione: e' il modulo che porta
   con se' da dove arriva chi lo compila, esattamente come porta la citta'.
   Per questo funziona anche se i cookie vengono rifiutati.
   ========================================================================== */
(function () {
  'use strict';

  var CHIAVE = 'giesse-provenienza';
  var GIORNI = 90;

  /* I motori di ricerca: se il referrer e' uno di questi ed e' una visita
     non marcata da campagna, allora e' ricerca organica. */
  var MOTORI = /google\.|bing\.|duckduckgo\.|ecosia\.|yahoo\.|yandex\.|search\.brave|qwant\./i;
  var SOCIAL = /facebook\.|instagram\.|fb\.com|l\.facebook|lm\.facebook|tiktok\.|linkedin\.|t\.co|twitter\.|x\.com|pinterest\.|youtube\./i;

  function parametri() {
    try { return new URLSearchParams(location.search); }
    catch (e) { return { get: function () { return null; } }; }
  }

  function leggiOra() {
    var q = parametri();
    var utmSorgente = q.get('utm_source') || '';
    var utmMezzo = (q.get('utm_medium') || '').toLowerCase();
    var campagna = q.get('utm_campaign') || '';
    var termine = q.get('utm_term') || '';
    // Le etichette che Google e Meta attaccano da soli ai clic sugli annunci.
    var gclid = q.get('gclid') || q.get('gbraid') || q.get('wbraid') || '';
    var fbclid = q.get('fbclid') || '';
    var ttclid = q.get('ttclid') || '';
    var rif = document.referrer || '';
    var dominio = '';
    try { dominio = rif ? new URL(rif).hostname.replace(/^www\./, '') : ''; } catch (e) {}

    var canale, sorgente, mezzo;

    if (gclid) {
      canale = 'pagato'; sorgente = utmSorgente || 'google'; mezzo = utmMezzo || 'cpc';
    } else if (fbclid) {
      canale = 'pagato'; sorgente = utmSorgente || 'meta'; mezzo = utmMezzo || 'paid-social';
    } else if (ttclid) {
      canale = 'pagato'; sorgente = utmSorgente || 'tiktok'; mezzo = utmMezzo || 'paid-social';
    } else if (/cpc|ppc|paid|ads|cpm|cpv/.test(utmMezzo)) {
      canale = 'pagato'; sorgente = utmSorgente || dominio || 'sconosciuta'; mezzo = utmMezzo;
    } else if (utmMezzo) {
      // utm messo a mano senza indicazione di pagamento: bio Instagram,
      // newsletter, QR su un volantino. Non e' pagato ne' organico da motore.
      canale = 'campagna-non-pagata'; sorgente = utmSorgente || dominio || 'sconosciuta'; mezzo = utmMezzo;
    } else if (MOTORI.test(dominio)) {
      canale = 'organico'; sorgente = dominio; mezzo = 'organic';
    } else if (SOCIAL.test(dominio)) {
      canale = 'social'; sorgente = dominio; mezzo = 'social';
    } else if (dominio && dominio !== location.hostname.replace(/^www\./, '')) {
      canale = 'referral'; sorgente = dominio; mezzo = 'referral';
    } else if (!dominio) {
      // Nessun referrer: link scritto a mano, segnalibro, o app che non lo
      // passa (WhatsApp e Instagram spesso non lo passano).
      canale = 'diretto'; sorgente = 'diretto'; mezzo = 'none';
    } else {
      // Navigazione DENTRO il sito: non e' un nuovo arrivo, non tocca niente.
      // Il confronto e' con location.hostname, non con una stringa scritta a
      // mano: se no in locale (localhost) ogni clic risultava un referral e
      // sovrascriveva la provenienza vera.
      return null;
    }

    return {
      canale: canale, sorgente: sorgente, mezzo: mezzo,
      campagna: campagna, termine: termine,
      pagina: location.pathname,
      quando: new Date().toISOString()
    };
  }

  function leggiMemoria() {
    try {
      var m = JSON.parse(localStorage.getItem(CHIAVE) || 'null');
      if (!m || !m.primo) return null;
      var eta = (Date.now() - new Date(m.primo.quando).getTime()) / 86400000;
      if (eta > GIORNI) return null;      // scaduto: si riparte
      return m;
    } catch (e) { return null; }
  }

  function salva(m) {
    try { localStorage.setItem(CHIAVE, JSON.stringify(m)); } catch (e) {}
  }

  var ora = leggiOra();
  var memoria = leggiMemoria();

  if (ora) {
    if (!memoria) {
      memoria = { primo: ora, ultimo: ora };
      salva(memoria);
    } else if (ora.canale !== 'diretto') {
      // Si aggiorna l'ultimo contatto SOLO se dice qualcosa. Un ritorno
      // diretto (segnalierlo, link scritto a mano, WhatsApp che non passa il
      // referrer) non deve cancellare la campagna che aveva portato quella
      // persona: altrimenti ogni lead che torna il giorno dopo risulta
      // "diretto" e la pubblicita' non prende mai il merito.
      memoria.ultimo = ora;
      salva(memoria);
    }
  }

  function riga(p) {
    if (!p) return '';
    var t = p.canale + ' — ' + p.sorgente;
    if (p.mezzo && p.mezzo !== p.canale) t += ' / ' + p.mezzo;
    if (p.campagna) t += ' / ' + p.campagna;
    return t;
  }

  window.GiesseProvenienza = {
    stato: function () { return memoria; },
    /* Quello che finisce nel modulo. Due colonne, non una: se il primo e
       l'ultimo contatto non coincidono, si vede che la campagna ha portato
       la persona e la ricerca l'ha riportata (o viceversa). */
    perModulo: function () {
      if (!memoria) return { provenienza: 'diretto — diretto', provenienza_primo_contatto: '', pagina_ingresso: location.pathname };
      var out = {
        provenienza: riga(memoria.ultimo),
        pagina_ingresso: memoria.primo.pagina || ''
      };
      out.provenienza_primo_contatto =
        riga(memoria.primo) === riga(memoria.ultimo) ? '' : riga(memoria.primo);
      return out;
    },
    /* Per gli eventi di Analytics: canale in una parola sola. */
    canale: function () { return memoria ? memoria.ultimo.canale : 'diretto'; },
    azzera: function () { try { localStorage.removeItem(CHIAVE); } catch (e) {} }
  };
})();
