/* ─────────────────────────────────────────────────────────────────────────
   hunicornia.es · marcador de lectura
   ─────────────────────────────────────────────────────────────────────────

   Qué hace
   --------
   Recuerda por dónde iba quien lee y, al volver a la misma página, la deja
   donde lo dejó. Guarda además en qué capítulo estaba, para que la portada
   pueda decir «Tinddaya · Capítulo 2 — 34 %».

   Cómo se instala
   ---------------
   Se suelta este archivo en la raíz del repositorio. Todas las páginas lo
   llaman igual:

       <script src="/lector-progreso.js" defer></script>

   Contrato con las páginas de lectura
   -----------------------------------
   Hacen falta DOS cosas. Sin la primera, el guion no hace absolutamente
   nada, que es lo que queremos en la portada y en cualquier otra página.

       1) El texto va marcado:

              <main class="lector-contenido" data-lectura> … </main>

       2) El <body> declara la obra:

              <body data-obra="Tinddaya">

          Y, si la página es un capítulo suelto, también:

              <body data-obra="7 máscaras" data-capitulo="La partida">

   El capítulo, cuando hay varios en la misma página
   -------------------------------------------------
   Si dentro del texto hay <h2 class="cap-h2">, el guion mira cuál es el
   último que ha quedado por encima de la pantalla y guarda ese. Así, en
   Tinddaya o en Chelo, que van de una pieza, la portada dice el capítulo
   exacto sin que haya que declarar nada.

   Si un <h2> lleva un antetítulo —<span class="cap-num">Capítulo 1</span>—
   se guardan los dos: «Capítulo 1 · La Emperatriz…».

   Dónde guarda
   ------------
   En localStorage, bajo la clave "hunicornia:progreso", como un objeto
   { "/tinddaya/": { url, obra, capitulo, titulo, pct, ts } }.
   Es del navegador de quien lee: no sale de su dispositivo, no viaja a
   ningún servidor y nadie más lo ve.

   Si el navegador tiene el almacenamiento bloqueado —modo privado, ajustes
   restrictivos— el guion no hace nada y la página se lee igual.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var CLAVE     = 'hunicornia:progreso';
  var MAXIMO    = 12;   // cuántas lecturas se recuerdan
  var TERMINADA = 97;   // a partir de este % se considera leída y se olvida
  var MINIMA    = 3;    // por debajo de esto no merece la pena recordar nada

  /* ── ¿estamos en una página de lectura? ─────────────────────────────
     Solo si hay un elemento marcado a mano con data-lectura. Nada de
     adivinar por <article> o <main>: la portada tiene artículos de sobra
     y el guion creería que es un capítulo.                              */

  var articulo = document.querySelector('[data-lectura]');
  if (!articulo) return;

  /* ── almacenamiento, siempre a prueba de fallos ────────────────────── */

  function leer() {
    try {
      var crudo = window.localStorage.getItem(CLAVE);
      var datos = crudo ? JSON.parse(crudo) : {};
      return (datos && typeof datos === 'object') ? datos : {};
    } catch (e) {
      return null;              // null = no hay almacenamiento disponible
    }
  }

  function escribir(datos) {
    try {
      var claves = Object.keys(datos);
      if (claves.length > MAXIMO) {
        claves.sort(function (a, b) { return (datos[b].ts || 0) - (datos[a].ts || 0); })
              .slice(MAXIMO)
              .forEach(function (k) { delete datos[k]; });
      }
      window.localStorage.setItem(CLAVE, JSON.stringify(datos));
    } catch (e) { /* sin almacenamiento: se sigue leyendo igual */ }
  }

  if (leer() === null) return;

  var ruta = window.location.pathname;

  /* ── nombres ───────────────────────────────────────────────────────── */

  function obra() {
    return document.body.getAttribute('data-obra') ||
           (document.title || ruta).split('—')[0].split('|')[0].trim();
  }

  var titulos = Array.prototype.slice.call(articulo.querySelectorAll('h2.cap-h2'));

  function texto(h2) {
    var ante = h2.querySelector('.cap-num');
    if (!ante) return (h2.textContent || '').trim();
    var num  = (ante.textContent || '').trim();
    var resto = '';
    Array.prototype.forEach.call(h2.childNodes, function (nodo) {
      if (nodo !== ante) resto += nodo.textContent || '';
    });
    resto = resto.trim();
    return resto ? num + ' · ' + resto : num;
  }

  /* Capítulo en curso: el último encabezado que ya ha pasado por arriba de
     la pantalla. Si aún no ha pasado ninguno, el primero. Si la página no
     tiene encabezados —capítulo suelto—, lo que declare el <body>.        */

  function capitulo() {
    if (!titulos.length) return document.body.getAttribute('data-capitulo') || '';
    var visto = titulos[0], limite = window.innerHeight * 0.4, i;
    for (i = 0; i < titulos.length; i++) {
      if (titulos[i].getBoundingClientRect().top <= limite) visto = titulos[i];
      else break;
    }
    return texto(visto);
  }

  /* ── medidas ───────────────────────────────────────────────────────
     El desplazamiento se mide sobre el documento entero, no sobre el
     padre posicionado: offsetTop miente en cuanto el texto vive dentro
     de un contenedor con position distinto de static.                  */

  function arriba() {
    return articulo.getBoundingClientRect().top + window.scrollY;
  }

  function porcentaje() {
    var alto    = articulo.offsetHeight;
    var ventana = window.innerHeight;
    if (alto <= ventana) return 100;               // cabe entero en pantalla
    var leido = (window.scrollY + ventana) - arriba();
    return Math.max(0, Math.min(100, Math.round((leido / alto) * 100)));
  }

  function guardar() {
    var datos = leer();
    if (datos === null) return;
    var pct = porcentaje();

    if (pct >= TERMINADA) {                        // leída: deja de aparecer
      delete datos[ruta];
    } else if (pct >= MINIMA) {
      var cap = capitulo();
      datos[ruta] = {
        url:      ruta,
        obra:     obra(),
        capitulo: cap,
        titulo:   cap ? obra() + ' · ' + cap : obra(),   // compatibilidad
        pct:      pct,
        ts:       Date.now()
      };
    } else {
      return;
    }
    escribir(datos);
  }

  /* ── volver donde lo dejaste ───────────────────────────────────────── */

  function restaurar() {
    var datos = leer();
    if (!datos || !datos[ruta]) return;
    var pct = datos[ruta].pct;
    if (!(pct > MINIMA && pct < TERMINADA)) return;

    var destino = arriba() + (articulo.offsetHeight * pct / 100) - window.innerHeight;
    window.scrollTo({ top: Math.max(0, destino), behavior: 'auto' });
  }

  // Se restaura cuando las imágenes ya han fijado la altura del texto; si no,
  // el cálculo se hace sobre una página que todavía está creciendo.
  if (document.readyState === 'complete') restaurar();
  else window.addEventListener('load', restaurar);

  /* ── cuándo se guarda ──────────────────────────────────────────────── */

  var esperando = false;
  window.addEventListener('scroll', function () {
    if (esperando) return;
    esperando = true;
    window.setTimeout(function () { esperando = false; guardar(); }, 800);
  }, { passive: true });

  // Al cerrar, al cambiar de pestaña y al salir de la página, por si el
  // último tramo leído no llegó a guardarse.
  window.addEventListener('pagehide', guardar);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') guardar();
  });
})();
