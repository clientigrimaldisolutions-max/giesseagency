/* ==========================================================================
   MODULO DELLA LANDING MARKETING FOTOVOLTAICO
   Creato il 25/10/2026.

   PERCHE' UN MODULO SUO E NON QUELLO DELLA HOME
   Chiesto da Gaetano: "modulo unico solo per marketing fotovoltaico".
   Il modulo della home chiede nome, citta' e fascia di budget generica.
   Qui servono le SEI domande che qualificano un installatore, le stesse
   del modulo Meta della campagna "GIESSE | Fotovoltaico B2B | Acquisizione":
   impianti al mese, impianti in piu', budget, team commerciale, zone,
   capacita' di gestire volume.
   Chi arriva dall'annuncio e chi arriva dalla ricerca rispondono alle stesse
   domande e finiscono nella stessa tabella: sono confrontabili.

   DOVE FINISCONO I DATI
   Foglio "GIESSE | Marketing Fotovoltaico", lo stesso in cui Meta riversa i
   contatti della campagna. Il ricevitore sta in
   google-apps-script-fotovoltaico.js, nella cartella del progetto, con le
   istruzioni per il deployment.
   ========================================================================== */
(function () {
  'use strict';

  /* Deployment attivo dal 25/10/2026, versione 1, sul foglio
     "GIESSE | Marketing Fotovoltaico". Il codice lato Google sta in
     google-apps-script-fotovoltaico.js, nella cartella del progetto.
     SE SI RIFA' IL DEPLOYMENT L'URL CAMBIA e va aggiornato QUI, altrimenti
     il modulo smette di scrivere senza dare nessun segnale al visitatore. */
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbzZsjkLjwCjSCDaDs9u8oF_86Y-t-JX_MjmQJAXyIKyyoaIepwaNG6aMzmsKW1nwPQu/exec';

  var form = document.getElementById('fvForm');
  if (!form) return;

  var passi    = Array.prototype.slice.call(form.querySelectorAll('.fv-passo'));
  var tacche   = Array.prototype.slice.call(form.querySelectorAll('.fv-barra i'));
  var corrente = 1;
  var CHIAVE   = 'giesse-fv-bozza';

  function endpointPronto() {
    return /^https:\/\/script\.google\.com\/macros\/s\/[^\/]+\/exec$/.test(ENDPOINT);
  }

  var visti = {};   /* ogni schermata si conta una volta sola per visita */

  /* ------------------------------------------------- INQUADRA LA SCHEDA ---
     Prima scorrevo mettendo la scheda a 110px dall'alto e basta. Risultato:
     se la schermata e' alta (quella dei contatti ha sei campi) il fondo
     finiva fuori schermo, e chi arrivava da un bottone trovava il modulo
     tagliato. Ora si guarda quanto spazio c'e' davvero:
       - se la scheda ci sta sotto la barra -> la si CENTRA in quello spazio
       - se non ci sta -> in cima, appena sotto la barra, cosi' almeno si
         comincia dall'inizio invece che da meta' campo
     La barra e' fissa e alta 81px: senza tenerne conto il titolo della
     schermata ci finisce sotto. */
  /* La posizione di IMPAGINAZIONE, che le trasformazioni non toccano.
     `getBoundingClientRect()` invece le include: la scheda ha `.m-up` e
     prima del reveal e' spostata di alcune decine di pixel, quindi al
     momento del clic misurarla li' dava un bersaglio falso e si finiva
     oltre, con la cima del modulo sopra il bordo dello schermo.
     E' la stessa trappola gia' annotata in claude.md per setupAncore. */
  function cimaImpaginata(el) {
    var y = 0;
    for (var n = el; n; n = n.offsetParent) y += n.offsetTop;
    return y;
  }

  function bersaglio(el) {
    var BARRA = 96;                                 /* 81 della nav + aria */
    var spazio = window.innerHeight - BARRA - 16;    /* 16 di respiro sotto */
    var alta = el.offsetHeight;
    var y = cimaImpaginata(el) - BARRA;
    /* ci sta tutta -> la centro nello spazio sotto la barra.
       non ci sta -> in cima, cosi' si comincia dall'inizio e non da meta'. */
    if (alta < spazio) y -= (spazio - alta) / 2;
    return Math.max(0, Math.round(y));
  }

  function inquadra(el) {
    if (!el) return;
    var y = bersaglio(el);
    window.scrollTo({ top: y, behavior: 'smooth' });

    /* RETE DI SICUREZZA, non e' ridondanza.
       Lo scorrimento morbido gira su requestAnimationFrame, e nei pannelli
       di anteprima (o in una scheda in secondo piano) la pagina risulta
       "hidden": rAF non gira e lo scorrimento resta fermo o a meta' strada.
       Stessa trappola della hero e delle frecce della home.
       Si aspetta che la pagina sia FERMA, poi si rimisura: a quel punto il
       reveal e' finito e getBoundingClientRect() dice la verita'. */
    var fermo = 0, ultimo = -1;
    var vigila = setInterval(function () {
      if (Math.abs(window.pageYOffset - ultimo) < 1) fermo++; else fermo = 0;
      ultimo = window.pageYOffset;
      if (fermo < 3) return;
      clearInterval(vigila);
      var r = el.getBoundingClientRect();
      var BARRA = 96;
      var spazio = window.innerHeight - BARRA - 16;
      var voluto = r.height < spazio ? BARRA + (spazio - r.height) / 2 : BARRA;
      var scarto = r.top - voluto;
      if (Math.abs(scarto) <= 8) return;
      /* `instant` obbligatorio: brand.css ha `html{scroll-behavior:smooth}`,
         quindi un normale scrollBy diventerebbe un'altra animazione e si
         pianterebbe come la prima. */
      try { window.scrollBy({ top: Math.round(scarto), behavior: 'instant' }); }
      catch (err) { window.scrollBy(0, Math.round(scarto)); }
    }, 90);
    setTimeout(function () { clearInterval(vigila); }, 3000);
  }

  /* I bottoni lungo la pagina devono inquadrare la SCHEDA, non la sezione.
     ATTENZIONE, QUI C'E' UNA COLLISIONE: `setupAncore()` di motion.js
     intercetta TUTTI i link `a[href^="#"]` con un listener su document in
     fase di BUBBLING, porta l'H2 della sezione a 26px sotto la barra, e in
     piu' tiene un setInterval che a scorrimento fermo ricorregge la
     posizione. Quella correzione arriva per ultima e vinceva sempre: il
     modulo restava tagliato a meta'.
     Rimedio: questo listener sta in fase di CATTURA e ferma la propagazione,
     cosi' motion.js non vede mai il click su #candidati. Tutti gli altri
     ancoraggi del sito continuano a funzionare come prima. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#candidati"]');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    if (history.replaceState) history.replaceState(null, '', '#candidati');
    inquadra(document.querySelector('.fv-card'));
  }, true);

  function mostra(n) {
    corrente = n;

    /* DOVE SI PERDONO LE PERSONE.
       Senza questo, di un modulo a sette schermate si sa solo quanti lo
       finiscono: non su quale domanda si fermano. Un evento per schermata,
       una volta sola, e in Analytics si legge l'imbuto per davvero. */
    if (!visti[n]) {
      visti[n] = true;
      var nome = n === 1 ? 'contatti' : (n === 8 ? 'inviato' : 'domanda_' + (n - 1));
      if (typeof gtag !== 'undefined') {
        gtag('event', 'fv_passo', { passo: n, nome_passo: nome });
      }
      if (typeof fbq !== 'undefined' && n === 2) fbq('track', 'InitiateCheckout', { content_name: 'Marketing Fotovoltaico' });
    }
    passi.forEach(function (p) { p.classList.toggle('is-active', Number(p.dataset.passo) === n); });
    tacche.forEach(function (t, i) { t.classList.toggle('is-on', i < n); });
    /* un giro di eventi: la schermata nuova deve essere gia' visibile,
       altrimenti si misura l'altezza di quella vecchia */
    setTimeout(function () { inquadra(document.querySelector('.fv-card')); }, 0);
  }

  function avviso(n, testo) {
    var p = form.querySelector('[data-errore="' + n + '"]');
    if (!p) return;
    p.textContent = testo || '';
    p.hidden = !testo;
  }

  /* ---------------------------------------------- controlli sui campi ---
     Un contatto con il telefono sbagliato e' un contatto perso: il costo per
     contatto resta, la telefonata non parte. Meglio fermarlo qui che
     scoprirlo quando un commerciale chiama un numero inesistente. */

  function telefonoValido(v) {
    var n = String(v).replace(/[\s().\-]/g, '').replace(/^\+39/, '').replace(/^0039/, '');
    /* fissi e mobili italiani: 9 o 10 cifre. Non si pretende il prefisso. */
    return /^[0-9]{9,11}$/.test(n);
  }

  function emailValida(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
  }

  /* Refusi tipici nei domini: chi scrive gmial.com non riceve la mail e si
     perde il contatto. Si suggerisce, non si corregge da soli. */
  var REFUSI = {
    'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.it': 'gmail.com',
    'gnail.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmaill.com': 'gmail.com',
    'hotmai.it': 'hotmail.it', 'hotmial.it': 'hotmail.it', 'libwero.it': 'libero.it',
    'libeo.it': 'libero.it', 'liberio.it': 'libero.it', 'tiscali.com': 'tiscali.it',
    'yaoo.it': 'yahoo.it', 'outlok.it': 'outlook.it', 'pec.it': 'pec.it'
  };
  function correzioneEmail(v) {
    var m = String(v).trim().toLowerCase().match(/@(.+)$/);
    if (!m) return null;
    var giusto = REFUSI[m[1]];
    return giusto ? String(v).trim().replace(/@.+$/, '@' + giusto) : null;
  }

  function segna(campo, ok) {
    campo.style.borderColor = ok ? '' : '#FF3B3B';
  }

  function valido(n) {
    var passo = form.querySelector('.fv-passo[data-passo="' + n + '"]');
    var mancanti = [];
    var messaggio = '';

    Array.prototype.slice.call(passo.querySelectorAll('fieldset[data-obbligatorio]')).forEach(function (g) {
      if (!g.querySelector('input:checked')) mancanti.push(g);
    });

    Array.prototype.slice.call(passo.querySelectorAll('input[required]')).forEach(function (c) {
      if (c.type === 'radio') return;
      var v = String(c.value).trim();
      var ok = c.type === 'checkbox' ? c.checked : v !== '';

      if (ok && c.type === 'email') {
        ok = emailValida(v);
        if (!ok) messaggio = 'Controlla l\u2019email: manca qualcosa.';
      }
      if (ok && c.type === 'tel') {
        ok = telefonoValido(v);
        if (!ok) messaggio = 'Il telefono non torna: servono almeno 9 cifre, senza lettere.';
      }
      segna(c, ok);
      if (!ok) mancanti.push(c);
    });

    if (mancanti.length) {
      if (!messaggio) {
        messaggio = mancanti.length === 1 ? 'Manca una risposta.'
                                         : 'Mancano ' + mancanti.length + ' risposte.';
      }
      avviso(n, messaggio);
      if (mancanti[0].focus) mancanti[0].focus();
      return false;
    }

    /* l'email passa il controllo ma il dominio sa di refuso: si chiede conferma */
    var email = passo.querySelector('input[type="email"]');
    if (email && email.value) {
      var suggerita = correzioneEmail(email.value);
      if (suggerita && suggerita !== email.dataset.confermata) {
        avviso(n, 'Intendevi ' + suggerita + '? Correggila, oppure premi di nuovo Avanti per tenere quella che hai scritto.');
        email.dataset.confermata = suggerita;
        return false;
      }
    }

    avviso(n, '');
    return true;
  }

  form.addEventListener('click', function (e) {
    if (e.target.closest('[data-avanti]'))  { if (valido(corrente)) { salva(); mostra(corrente + 1); } return; }
    if (e.target.closest('[data-indietro]')) { mostra(corrente - 1); return; }

    /* L'AVANZAMENTO AUTOMATICO STA QUI, SUL CLICK, NON SUL `change`.
       Due motivi, tutti e due trovati provando il modulo davvero:
       1. da TASTIERA le frecce scorrono le risposte e ognuna genera un
          `change`: legato a quello, la schermata avanzava mentre la persona
          stava ancora scegliendo, e sull'ultima domanda INVIAVA alla prima
          freccia. Il click invece lo fa solo chi tocca o clicca davvero.
       2. ritoccare una risposta gia' scelta NON genera `change`, quindi
          chi tornava su una bozza restava bloccato.
       Per chi usa la tastiera resta il bottone "Avanti" visibile su ogni
       schermata: sceglie con le frecce e conferma con Invio. */
    var pillola = e.target.closest('.fv-scelta');
    if (pillola) {
      var r = pillola.querySelector('input[type="radio"]');
      /* il browser applica la selezione dopo il click sul label: si aspetta
         un giro di eventi prima di leggere lo stato */
      setTimeout(function () { if (r && r.checked) avanzaDa(r); }, 0);
    }
  });

  /* AVANZAMENTO AUTOMATICO
     Una schermata, una decisione: appena si tocca la risposta si va avanti,
     senza cercare il bottone. Il ritardo di 260ms non e' decorativo: serve a
     far VEDERE che la scelta e' stata presa (la pillola si accende), se no
     sembra che la pagina sia saltata da sola.
     Sull'ultima domanda (data-invia) non si avanza: si invia. Il consenso
     privacy sta nella prima schermata, quindi a quel punto e' gia' dato. */
  var inCorso = false;   /* niente doppio salto se arrivano change e click insieme */

  function avanzaDa(radio) {
    if (inCorso) return;
    var gruppo = radio.closest('[data-auto]');
    if (!gruppo) return;

    var passo = radio.closest('.fv-passo');
    if (!passo || Number(passo.dataset.passo) !== corrente) return;
    /* se la schermata avesse piu' gruppi, si avanza solo quando sono tutti pieni */
    var gruppi = Array.prototype.slice.call(passo.querySelectorAll('[data-obbligatorio]'));
    if (gruppi.some(function (g) { return !g.querySelector('input:checked'); })) return;

    inCorso = true;
    salva();
    setTimeout(function () { inCorso = false; mostra(corrente + 1); }, 260);
  }

  /* L'ULTIMA DOMANDA NON INVIA DA SOLA, di proposito.
     Le altre cinque avanzano al tocco: una schermata, una decisione. Ma
     l'ultimo passo deve essere premuto, perche' il bottone dice
     "Prenota la call" e serve a far capire che il passo successivo e' una
     telefonata. Con l'invio automatico quel bottone non lo leggerebbe
     nessuno: si tocca il budget e ci si ritrova sulla schermata di
     ringraziamento senza aver capito cosa succede adesso. */



  /* ------------------------------------------------------------ bozza --- */
  /* Si cancella SOLO a invio riuscito: se la rete cade, quello che la
     persona ha scritto resta nel suo browser e il contatto non si perde. */
  /* La bozza tiene SOLO i campi scritti a mano. Le sei risposte NON si
     salvano: ripristinarle lasciava il modulo in uno stato ambiguo (sei
     domande gia' risposte da riattraversare) e, visto che l'ultima risposta
     fa partire l'invio, bastava ritoccarla per spedire senza volerlo.
     Quello che vale la pena non perdere e' cio' che la persona ha DIGITATO. */
  var CAMPI_BOZZA = ['nome', 'azienda', 'email', 'telefono', 'citta', 'provincia'];

  function salva() {
    try {
      var d = {};
      CAMPI_BOZZA.forEach(function (k) {
        var el = form.querySelector('[name="' + k + '"]');
        if (el && el.value) d[k] = el.value;
      });
      localStorage.setItem(CHIAVE, JSON.stringify(d));
    } catch (err) {}
  }
  (function recupera() {
    try {
      var d = JSON.parse(localStorage.getItem(CHIAVE) || '{}');
      CAMPI_BOZZA.forEach(function (k) {
        var el = form.querySelector('[name="' + k + '"]');
        if (el && d[k]) el.value = d[k];
      });
    } catch (err) {}
  })();
  form.addEventListener('input',  salva);
  form.addEventListener('change', salva);

  /* Invio nei campi di testo = Avanti. Senza questo, chi compila da tastiera
     arriva in fondo e deve staccare le mani per cercare il bottone.
     NB: `submit` va impedito, o il modulo parte dalla prima schermata con le
     sei domande vuote. */
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var campo = e.target;
    if (!campo || campo.tagName !== 'INPUT' || campo.type === 'checkbox' || campo.type === 'radio') return;
    if (corrente === 7) return;   /* li' c'e' il submit vero */
    e.preventDefault();
    if (valido(corrente)) { salva(); mostra(corrente + 1); }
  });

  /* La provincia e' una sigla: si normalizza mentre si scrive, cosi' sul
     foglio non arrivano "bo", "Bo " e "BOLOGNA" sulla stessa colonna. */
  var prov = form.querySelector('[name="provincia"]');
  if (prov) {
    prov.setAttribute('maxlength', '2');
    prov.addEventListener('input', function () {
      var v = prov.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
      if (v !== prov.value) prov.value = v;
    });
  }

  /* Il fuoco sul primo campo SOLO da computer con mouse: da telefono
     aprirebbe la tastiera e coprirebbe mezzo modulo appena arrivati.
     E' la stessa regola gia' applicata al modulo della home. */
  if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var primaVolta = false;
    var card = document.querySelector('.fv-card');
    if (card && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (voci, obs) {
        voci.forEach(function (v) {
          if (v.isIntersecting && !primaVolta) {
            primaVolta = true;
            var primo = form.querySelector('.fv-passo.is-active input[type="text"]');
            if (primo) primo.focus({ preventScroll: true });
            obs.disconnect();
          }
        });
      }, { threshold: 0.35 }).observe(card);
    }
  }

  /* ------------------------------------------------------------ invio --- */
  function invia() {
    if (!endpointPronto()) {
      return Promise.reject(new Error('endpoint non configurato'));
    }
    /* URLSearchParams e NESSUN header personalizzato: cosi' resta una
       richiesta "semplice" e il browser non manda il preflight OPTIONS,
       che le web app di Apps Script non sanno gestire. */
    var corpo = new URLSearchParams();
    new FormData(form).forEach(function (v, k) { corpo.append(k, v); });
    corpo.append('platform', 'sito');
    corpo.append('form_name', 'Landing marketing-fotovoltaico');
    if (window.GiesseProvenienza) {
      var p = window.GiesseProvenienza.perModulo();
      Object.keys(p).forEach(function (k) { if (p[k]) corpo.append(k, p[k]); });
    }

    return fetch(ENDPOINT, { method: 'POST', body: corpo })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.result === 'error') throw new Error(d.message || 'errore lato Google');
        return d;
      })
      .catch(function () {
        /* Apps Script risponde con un redirect che a volte il browser non
           lascia leggere: si riprova alla cieca, la riga arriva lo stesso. */
        return fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', body: corpo })
          .then(function () { return { result: 'inviato-senza-conferma' }; });
      });
  }

  function waUrl(d) {
    return 'https://wa.me/393273939836?text=' + encodeURIComponent(
      'Ciao Giesse, sono ' + ((d.nome || '').trim() || 'un installatore') +
      ' di ' + ((d.azienda || '').trim() || 'un\'azienda fotovoltaica') +
      '. Installiamo ' + (d.impianti_mese || '?') + ' impianti al mese' +
      (d.provincia ? ' in provincia di ' + d.provincia : '') + '.');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!valido(7) || !valido(1)) return;

    var d = {};
    new FormData(form).forEach(function (v, k) { d[k] = v; });

    /* niente doppio invio: un secondo tocco mentre la rete lavora
       scriverebbe due righe sul foglio */
    var bottoni = form.querySelectorAll('.fv-passo[data-passo="7"] button');
    Array.prototype.slice.call(bottoni).forEach(function (b) { b.disabled = true; });

    invia()
      .then(function (esito) {
        console.log('[fotovoltaico] inviato:', esito);
        try { localStorage.removeItem(CHIAVE); } catch (err) {}
      })
      .catch(function (err) {
        console.error('[fotovoltaico] INVIO FALLITO:', err.message,
          '\nLa bozza resta nel browser. Se leggi "endpoint non configurato",' +
          ' manca l\'URL del deployment in ENDPOINT dentro assets/fotovoltaico-form.js.');

        /* Se l'invio non riesce il contatto NON va perso: si dice alla persona
           che qualcosa non ha funzionato e le si da' una strada che funziona
           sempre. Meglio un messaggio onesto che un "grazie" falso. */
        var grazie = form.querySelector('.fv-passo[data-passo="8"] .fv-grazie');
        if (grazie) {
          grazie.innerHTML =
            '<h3>Qualcosa non ha funzionato</h3>' +
            '<p>Non siamo riusciti a registrare la richiesta. I dati che hai scritto sono salvi nel tuo browser: se ricarichi la pagina li ritrovi.</p>' +
            '<p>Per non farti perdere tempo, scrivici direttamente: <a href="' + waUrl(d) + '" target="_blank" rel="noopener">apri WhatsApp</a>, oppure chiama il <a href="tel:+393273939836">327 393 9836</a>.</p>';
        }
      });

    /* Il ringraziamento non aspetta la rete. */
    if (typeof fbq !== 'undefined') {
      fbq('track', 'Lead', {
        content_name: 'Marketing Fotovoltaico',
        content_category: d.impianti_mese || '',
        value: 0, currency: 'EUR', budget_tier: d.budget || ''
      });
    }
    if (window.GiesseConsenso && window.GiesseConsenso.conversioneAds) {
      window.GiesseConsenso.conversioneAds();
    }
    if (typeof gtag !== 'undefined') {
      gtag('event', 'generate_lead', {
        currency: 'EUR', value: 0,
        servizio: 'Marketing Fotovoltaico',
        budget_tier: d.budget || '',
        impianti_mese: d.impianti_mese || ''
      });
    }

    var azienda = (d.azienda || '').trim() || 'la tua azienda';
    form.querySelectorAll('[data-riempi="azienda"]').forEach(function (el) { el.textContent = azienda; });

    var wa = form.querySelector('[data-wa]');
    if (wa) wa.href = waUrl(d);

    mostra(8);
  });
})();
