/* VIP Royale · muestra navegable del front (sólo front).
   Sin servidor y sin pedidos de red: todo vive en memoria con datos de ejemplo.
   La plata se maneja en centavos enteros y hay un solo saldo para todas las pantallas. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------ */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  var quieto = function () { return RM.matches; };
  var esPC = function () { return window.matchMedia('(min-width: 1024px)').matches; };
  var miles = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
  var pl = function (n, uno, varios) { return miles(n) + ' ' + (n === 1 ? uno : varios); };
  var timers = [];
  var luego = function (fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; };
  var cada = function (fn, ms) { var t = setInterval(fn, ms); timers.push(t); return t; };
  var limpiar = function () { timers.forEach(function (t) { clearTimeout(t); clearInterval(t); }); timers = []; };
  var guardar = function (k, v) { try { localStorage.setItem('viproyale_' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  var leer = function (k, d) { try { var v = localStorage.getItem('viproyale_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  /* Dentro del visor (celular.html pide ?visor=1) el que se desplaza es el body, no la raíz: así el marco recorta bien las
     esquinas redondeadas. En la plataforma real no cambia nada. */
  var EN_VISOR = /(?:^|[?&])visor=1(?:&|$)/.test(location.search);
  if (EN_VISOR) document.documentElement.classList.add('en-visor');
  var desplazador = function () { return EN_VISOR ? document.body : (document.scrollingElement || document.documentElement); };
  var irA = function (y) { desplazador().scrollTo(0, y); };
  var sesion = function (k, v) { try { if (v === undefined) return sessionStorage.getItem('viproyale_' + k); sessionStorage.setItem('viproyale_' + k, v); } catch (e) { return null; } return null; };

  /* ------------------------------------------------------------------
     Plata (R-001, R-002, R-005, R-023, R-305, R-358)
     ------------------------------------------------------------------ */
  var FEE_BPS = 500;
  var MIN_AP = 10000;      // $100
  var MAX_AP = 500000;     // $5.000
  var MIN_CARGA = 200000;  // $2.000
  var MIN_RETIRO = 200000; // $2.000
  function plata(c) {
    var neg = c < 0; c = Math.abs(Math.round(c));
    var p = Math.floor(c / 100), cs = c % 100;
    return (neg ? '−' : '') + '$' + miles(p) + (cs ? ',' + String(cs).padStart(2, '0') : '');
  }
  var sinSigno = function (c) { return plata(c).replace(/^−?\$/, ''); };
  var pozo = function (ap) { return ap * 2; };
  var comision = function (ap) { return Math.floor(pozo(ap) * FEE_BPS / 10000); };
  var premio = function (ap) { return pozo(ap) - comision(ap); };

  /* Lee un monto escrito a mano. La coma es decimal; el punto es de miles solo si le siguen 3 dígitos.
     "25,00" es $25 (nunca $2.500), "1.000" es $1.000, "25.5" es $25,50 y "1.0000" no se acepta. */
  function leerMonto(txt) {
    var t = String(txt || '').trim().replace(/^\$\s*/, '').replace(/\s+/g, '');
    if (!t) return { vacio: true };
    if (!/^[\d.,]+$/.test(t)) return { error: 'Escribí solo números' };
    var comas = (t.match(/,/g) || []).length;
    if (comas > 1) return { error: 'Usá la coma solo para los centavos' };
    var partes = t.split(','), ent = partes[0], dec = partes[1];
    if (dec !== undefined && !/^\d{1,2}$/.test(dec)) return { error: 'Los centavos van con una o dos cifras' };
    if (ent.indexOf('.') >= 0) {
      if (/^\d{1,3}(\.\d{3})+$/.test(ent)) ent = ent.replace(/\./g, '');
      else if (dec === undefined && /^\d+\.\d{1,2}$/.test(ent)) { var p = ent.split('.'); ent = p[0]; dec = p[1]; }
      else return { error: 'Revisá el monto: el punto separa miles (1.000)' };
    }
    if (!/^\d*$/.test(ent)) return { error: 'Revisá el monto' };
    if (ent === '') ent = '0';
    if (ent.length > 9) return { error: 'Ese monto es demasiado grande' };
    var c = parseInt(ent, 10) * 100 + (dec ? parseInt((dec + '0').slice(0, 2), 10) : 0);
    return { c: c };
  }
  function errorApuesta(r) {
    if (r.vacio) return 'Elegí o escribí un monto';
    if (r.error) return r.error;
    if (r.c % 100) return 'La apuesta va en pesos enteros, sin centavos';
    if (r.c < MIN_AP) return 'El mínimo es $100';
    if (r.c > MAX_AP) return 'El máximo por mesa es $5.000';
    if (r.c > S.disp) return 'Saldo insuficiente. Cargá plata primero.';
    return '';
  }

  /* ------------------------------------------------------------------
     Íconos de línea propios (sin emojis en la interfaz)
     ------------------------------------------------------------------ */
  var SV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var ORO_EST = ' fill="#F2CF55" stroke="#F2CF55" stroke-width=".6"';
  var I = {
    inicio: '<path class="tr" d="M3.5 10.6 12 3.8l8.5 6.8V20a1 1 0 0 1-1 1h-4.6v-5.6H9.1V21H4.5a1 1 0 0 1-1-1z"/><path d="M12 7.4l.95 1.9 2.1.3-1.5 1.5.35 2.1L12 12.2l-1.9 1 .35-2.1-1.5-1.5 2.1-.3z"' + ORO_EST + '/>',
    chat: '<path class="tr" d="M4.2 4.5h15.6a1.7 1.7 0 0 1 1.7 1.7v9.1a1.7 1.7 0 0 1-1.7 1.7H11l-4.8 3.6v-3.6h-2a1.7 1.7 0 0 1-1.7-1.7V6.2a1.7 1.7 0 0 1 1.7-1.7z"/><circle cx="8" cy="10.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="10.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="16" cy="10.8" r="1.1" fill="currentColor" stroke="none"/>',
    ranking: '<path class="tr" d="M8.6 21v-9.5h6.8V21M2.6 21v-6h6M15.4 21v-7.6h6V21M1.8 21h20.4"/><path d="M12 2.8l.9 1.8 2 .3-1.45 1.4.35 2L12 7.35l-1.8.95.35-2L9.1 4.9l2-.3z"' + ORO_EST + '/>',
    perfil: '<circle class="tr" cx="11" cy="8.2" r="4.2"/><path class="tr" d="M3 21c.7-4.3 3.9-6.9 8-6.9s7.3 2.6 8 6.9"/><path d="M18.6 2.6l.75 1.5 1.65.25-1.2 1.15.3 1.65-1.5-.8-1.5.8.3-1.65-1.2-1.15 1.65-.25z"' + ORO_EST + '/>',
    campana: '<path d="M6 16.4V11a6 6 0 0 1 12 0v5.4l1.7 2.1H4.3z"/><path d="M10 21a2.2 2.2 0 0 0 4 0"/>',
    depositar: '<path d="M3.5 12.5v6.2a1.8 1.8 0 0 0 1.8 1.8h13.4a1.8 1.8 0 0 0 1.8-1.8v-6.2"/><path d="M12 3.5v10.2M7.8 9.6l4.2 4.2 4.2-4.2"/>',
    retirar: '<path d="M3.5 12.5v6.2a1.8 1.8 0 0 0 1.8 1.8h13.4a1.8 1.8 0 0 0 1.8-1.8v-6.2"/><path d="M12 14.2V4M7.8 8.2 12 4l4.2 4.2"/>',
    volver: '<path d="M19.5 12h-15M10.5 5.5 4 12l6.5 6.5" stroke-width="2.2"/>',
    sonido: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/>',
    mudo: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    paleta: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.9-.9 1.6-2-.4-1.4.5-2.5 1.9-2.5h1.7a3.3 3.3 0 0 0 3.3-3.3C20.5 7.2 16.7 3.5 12 3.5z"/><circle cx="7.8" cy="11" r="1.2" fill="currentColor" stroke="none"/><circle cx="10.5" cy="7.6" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.8" cy="7.8" r="1.2" fill="currentColor" stroke="none"/>',
    enviar: '<path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z"/>',
    cerrar: '<path d="M6 6l12 12M18 6 6 18" stroke-width="2.4"/>',
    mas: '<path d="M12 5v14M5 12h14" stroke-width="2.6"/>',
    copiar: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    compartir: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="2.6"/>',
    reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    candado: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    lapiz: '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M13.5 7l3 3"/>',
    pincel: '<path d="M20 4c-3.5 1.5-7.3 5-9.2 7.6l1.6 1.6C15 11.3 18.5 7.5 20 4z"/><path d="M10.8 11.6c-2 0-3.3 1.4-3.3 3.2 0 1.3-.9 2.4-3 2.7 1.1 1.6 3 2.5 4.8 2.5 2.7 0 4.1-2.1 3.1-6.8"/>',
    historial: '<path d="M7 3.5h8l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M14.5 3.5V8H19M9 12h6M9 15.5h6"/>',
    logros: '<circle cx="12" cy="14.5" r="5.5"/><path d="M8.5 10 6.5 3.5h3.2L12 8.5l2.3-5h3.2L15.5 10"/><path d="M12 12.2l.75 1.5 1.65.25-1.2 1.15.3 1.65-1.5-.8-1.5.8.3-1.65-1.2-1.15 1.65-.25z"/>',
    temas: '<rect x="3" y="5.5" width="18" height="13" rx="6.5"/><rect x="6.8" y="8.8" width="10.4" height="6.4" rx="3.2"/>',
    referidos: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.8 20c.6-3.6 3-5.6 6.2-5.6s5.6 2 6.2 5.6"/><path d="M15.5 5.2a3.3 3.3 0 0 1 0 6.6M17.6 14.6c2 .6 3.3 2.4 3.6 5.4"/>',
    limites: '<path d="M12 3.2 19.5 6v5.6c0 4.6-3.1 7.9-7.5 9.2-4.4-1.3-7.5-4.6-7.5-9.2V6z"/><path d="M10 9.5v5M14 9.5v5"/>',
    ayuda: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
    salir: '<path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14"/><path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5"/>',
    senal: '<path d="M5 19v-2M9.5 19v-5M14 19v-8M18.5 19V6" stroke-width="2.3"/>',
    trofeo: '<path d="M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5c0 2.6 1.3 4.2 3.4 4.4M16.5 6h3c0 2.6-1.3 4.2-3.4 4.4M12 13v3.5M8.5 20h7l-.8-3.5H9.3z"/>',
    flecha: '<path d="M9 5.5 15.5 12 9 18.5" stroke-width="2.2"/>',
    ir: '<path d="M4.5 12h15M13.5 5.5 20 12l-6.5 6.5" stroke-width="2.2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    alerta: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.2"/><circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none"/>',
    rayo: '<path d="M13.5 2.8 5 13.5h6l-1.5 7.7L18 10.5h-6z"/>',
    llama: '<path d="M12 2.8c.6 3.6 5.2 5.4 5.2 10.4a5.2 5.2 0 0 1-10.4 0c0-2.4 1.3-3.8 2.5-5 .2 1.8.8 2.8 1.9 3.3-.5-3.5-.1-6 .8-8.7z" fill="currentColor" stroke="none"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
    subir: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.5 3.8 3.8 0 0 1-.4 7.5"/><path d="M12 20v-8M8.8 15 12 11.8 15.2 15"/>',
    juego: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="16" cy="11.5" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="13.8" r="1" fill="currentColor" stroke="none"/>',
    soporte: '<path d="M4 13.5V12a8 8 0 0 1 16 0v1.5"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.3-1.6 2-4 2h-2"/>',
    devolucion: '<path d="M4 9h11a5 5 0 0 1 0 10H8"/><path d="M8 5 4 9l4 4"/>',
    ganancia: '<path d="M4 17l5.5-5.5 4 4L20 9"/><path d="M15 9h5v5"/>',
    perdida: '<path d="M4 7l5.5 5.5 4-4L20 15"/><path d="M15 15h5v-5"/>',
    usuario: '<circle cx="12" cy="8.2" r="4.2"/><path d="M4 21c.7-4.3 3.9-6.9 8-6.9s7.3 2.6 8 6.9"/>',
    escudo: '<path d="M12 3.2 19.5 6v5.6c0 4.6-3.1 7.9-7.5 9.2-4.4-1.3-7.5-4.6-7.5-9.2V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    pausa: '<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>'
  };
  var ic = function (n, cls) { return '<span class="ic' + (cls ? ' ' + cls : '') + '">' + SV + I[n] + '</svg></span>'; };

  /* Emblema propio de VIP Royale: una V facetada de dos brazos que se encuentran abajo (VIP y VS),
     con un destello dorado en el hueco. Sin corona, sin escudo y sin la tipografía del juego. */
  var EM = '<g class="ch-a"><path d="M3 3h6.5L28 28.9V38z" fill="url(#g-v1)"/><path d="M9.5 3H16l12 16.8v9.1z" fill="url(#g-v2)"/><path d="M3 3h13l12 16.8V38z" fill="none" stroke="#1B0A4A" stroke-width="1.1" stroke-linejoin="round"/><path d="M4.8 4.3 26.6 34.6" stroke="#fff" stroke-opacity=".6" stroke-width=".9" stroke-linecap="round"/></g>' +
    '<g class="ch-r"><path d="M53 3h-6.5L28 28.9V38z" fill="url(#g-v3)"/><path d="M46.5 3H40L28 19.8v9.1z" fill="url(#g-v4)"/><path d="M53 3H40L28 19.8V38z" fill="none" stroke="#1B0A4A" stroke-width="1.1" stroke-linejoin="round"/><path d="M41.2 4.3 28.6 21.8" stroke="#fff" stroke-opacity=".45" stroke-width=".8" stroke-linecap="round"/></g>' +
    '<g class="esp"><path d="M28 1.2l1.5 6.6 5 1.5-5 1.5-1.5 6.6-1.5-6.6-5-1.5 5-1.5z" fill="url(#g-oro)" stroke="#7A5608" stroke-width=".6" stroke-linejoin="round"/><circle cx="28" cy="9.3" r="1.3" fill="#fff"/></g>';
  var V_CONTORNO = 'M3 3h13l12 16.8L40 3h13L28 38z';
  var emblema = function (cls) { return '<svg class="' + (cls || 'logo-em') + '" viewBox="0 0 56 40" aria-hidden="true">' + EM + '</svg>'; };
  /* El del ingreso lleva además el destello que lo recorre cada 6 segundos, recortado a la forma de la V */
  var emblemaGrande = function () { return '<svg class="logo-em" viewBox="0 0 56 40" aria-hidden="true"><defs><clipPath id="clip-v"><path d="' + V_CONTORNO + '"/></clipPath><linearGradient id="g-barre" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>' + EM + '<g clip-path="url(#clip-v)"><rect class="barre" x="-20" y="-4" width="14" height="48" fill="url(#g-barre)" transform="skewX(-20)"/></g></svg>'; };
  var marca = function () { return '<span class="logo-txt" aria-hidden="true"><b>VIP</b><i>ROYALE</i></span>'; };
  var logo = function () { return '<a class="logo" href="#inicio" aria-label="VIP Royale, ir al inicio">' + emblema() + marca() + '</a>'; };
  var CHISPA = '<svg class="chispa" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="url(#g-chispa)"/><path d="M50 6l5 39 39 5-39 5-5 39-5-39-39-5 39-5z" fill="#FFF6C4"/></svg>';
  var CHISPA_VS = '<svg class="vs-luz" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="url(#g-chispa)" opacity=".55"/><path d="M50 2l4 42 44 6-44 6-4 42-4-42-44-6 44-6z" fill="#FFF6C4" opacity=".55"/></svg>';
  /* Símbolo de la mesa: las dos medias fichas (vos cian, rival rojo) que se abren y se cierran, con un destello dorado */
  var SIMBOLO = '<img class="sa" src="assets/media-cian.webp" alt="" width="284" height="480" decoding="async"><svg class="esp" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5l1.4 6.9 6.9 1.6-6.9 1.6L10 18.5l-1.4-6.9L1.7 10l6.9-1.6z" fill="#FFF3B8"/></svg><img class="sr" src="assets/media-roja.webp" alt="" width="284" height="480" decoding="async">';
  var simbolo = function () { return '<span class="simbolo" aria-hidden="true">' + SIMBOLO + '</span>'; };

  /* Avatares: 12 medallas redondas propias, con aro dorado y el dibujo centrado */
  var ORO = ' fill="url(#g-oro)" stroke="#8A6410" stroke-width=".8" stroke-linejoin="round"';
  var MED = [
    ['VIP', '<g transform="translate(10.6 14.2) scale(.48)">' + EM + '</g>'],
    ['Rayo', '<path d="M27.5 9 15.5 26h7.5l-3 13 13-18.5h-7.5z"' + ORO + '/>'],
    ['Estrella', '<path d="M24 10.5l4 8.2 9 1.3-6.5 6.3 1.5 9-8-4.2-8 4.2 1.5-9-6.5-6.3 9-1.3z"' + ORO + '/>'],
    ['Llama', '<path d="M24 9.5c1.2 4.8 9 7.4 9 15.3a9 9 0 0 1-18 0c0-4 2.2-6.4 4.3-8.4.3 3 1.4 4.8 3.3 5.6-.9-5.6-.3-8.8 1.4-12.5z" fill="url(#g-llama)" stroke="#8A1A10" stroke-width=".8"/><path d="M24 26c.8 2 3.5 3 3.5 6a3.5 3.5 0 0 1-7 0c0-1.6.8-2.6 1.6-3.3.2 1 .6 1.6 1.2 1.9-.3-2 0-3.3.7-4.6z" fill="#FFF0B0"/>'],
    ['Copa', '<path d="M16.5 12.5h15v5.5c0 5-3.2 8.3-7.5 8.3s-7.5-3.3-7.5-8.3z"' + ORO + '/><rect x="16.6" y="16.2" width="14.8" height="3" fill="#8850EB"/><path d="M16.6 14.5h-3.1c0 4 1.8 6.4 4.4 6.9M31.4 14.5h3.1c0 4-1.8 6.4-4.4 6.9" fill="none" stroke="#F2CF55" stroke-width="1.6"/><rect x="22.6" y="26" width="2.8" height="5" fill="#E2B33A"/><rect x="18" y="31" width="12" height="4" rx="1"' + ORO + '/>'],
    ['Diana', '<circle cx="24" cy="24" r="12.5" fill="#F0344A"/><circle cx="24" cy="24" r="9" fill="#F7F5FB"/><circle cx="24" cy="24" r="5.6" fill="#F0344A"/><circle cx="24" cy="24" r="2.2" fill="#F7F5FB"/><path d="M24 24 35.5 12.5" stroke="#F2CF55" stroke-width="2" stroke-linecap="round"/><path d="M35.5 12.5l-.8-3.6M35.5 12.5l3.6.8" stroke="#F2CF55" stroke-width="1.8" stroke-linecap="round"/>'],
    ['Cometa', '<path d="M12 36 26 22" stroke="#AE8EFF" stroke-width="3.2" stroke-linecap="round" opacity=".6"/><path d="M15.5 37.8 27.6 25.7" stroke="#D8CEFF" stroke-width="1.6" stroke-linecap="round" opacity=".75"/><path d="M10.2 32.4 22.3 20.3" stroke="#D8CEFF" stroke-width="1.6" stroke-linecap="round" opacity=".6"/><circle cx="29.5" cy="18.5" r="7"' + ORO + '/><circle cx="27.4" cy="16.4" r="2" fill="#FFF6C4"/>'],
    ['Reloj', '<path d="M16 11h16M16 37h16" stroke="#F2CF55" stroke-width="2.6" stroke-linecap="round"/><path d="M18 12c0 6 5 8.5 5 12s-5 6-5 12h12c0-6-5-8.5-5-12s5-6 5-12z" fill="rgba(206, 183, 255,.16)" stroke="#E8E3F3" stroke-width="1.2"/><path d="M20.2 15.6h7.6c-.7 2.6-3.8 4-3.8 6.2 0-2.2-3.1-3.6-3.8-6.2z" fill="#AE8EFF"/><path d="M19.6 35.5c.6-3.6 4.4-4.8 4.4-7.5 0 2.7 3.8 3.9 4.4 7.5z" fill="#AE8EFF"/>'],
    ['Gema', '<path d="M14.5 19.5 19.5 13h9l5 6.5L24 35z" fill="url(#g-gema)" stroke="#420C8F" stroke-width=".8" stroke-linejoin="round"/><path d="M14.5 19.5h19M19.5 13l-1.6 6.5L24 35l6.1-15.5L28.5 13M24 13l-6.1 6.5M24 13l6.1 6.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".8"/>'],
    ['Avance', '<path d="M15 36l9-8.5 9 8.5" fill="none" stroke="#AE8EFF" stroke-opacity=".55" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 28.5l9-8.5 9 8.5" fill="none" stroke="#AE8EFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 21l9-8.5 9 8.5" fill="none" stroke="#F2CF55" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>'],
    ['Luna', '<path d="M29.5 11.5a12.5 12.5 0 1 0 7 21.5 10 10 0 1 1-7-21.5z"' + ORO + '/><circle cx="33" cy="16" r="1.2" fill="#FFF6C4"/><circle cx="36.5" cy="22" r=".9" fill="#FFF6C4"/>'],
    ['Bandera', '<path d="M17 37V11" stroke="#E8E3F3" stroke-width="2" stroke-linecap="round"/><path d="M18 12c4-2 8 2 14 0v12c-6 2-10-2-14 0z" fill="#F0344A" stroke="#8A1020" stroke-width=".7"/><path d="M18 18c4-2 8 2 14 0v6c-6 2-10-2-14 0z" fill="#9B71F9"/><circle cx="17" cy="10.5" r="1.7" fill="#F2CF55"/>']
  ];
  /* Colores de las iniciales: todos dejan la letra blanca con contraste de texto grande (3:1 o más) */
  var INI_COL = ['#0E8FC4', '#7A3AF0', '#D8303F', '#A8770F', '#1F8F55', '#C2349F', '#C8630F', '#5E5A88'];
  function medalla(i, cls) {
    return '<span class="av' + (cls ? ' ' + cls : '') + '"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="url(#g-med)"/><circle cx="24" cy="24" r="22.3" fill="none" stroke="#E8C44A" stroke-width="1.8"/><path d="M9 15a17 17 0 0 1 30 0" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.4"/>' + MED[i % MED.length][1] + '</svg></span>';
  }
  function inicial(letra, col, cls) {
    var k = Math.max(0, INI_COL.indexOf(col));
    return '<span class="av ini' + (cls ? ' ' + cls : '') + '"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="url(#g-ini-' + k + ')"/><circle cx="24" cy="24" r="22.3" fill="none" stroke="#E8C44A" stroke-width="1.8"/><circle cx="24" cy="24" r="18.8" fill="none" stroke="#fff" stroke-opacity=".34" stroke-width="1"/><path d="M9 15a17 17 0 0 1 30 0" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.4"/><text class="ini-l" x="24" y="31.6" text-anchor="middle">' + esc(letra) + '</text></svg></span>';
  }
  /* Un degradé por color de inicial (claro arriba, el color al medio y oscuro abajo), definido una sola vez */
  function degradesIniciales() {
    var defs = document.querySelector('svg defs'); if (!defs) return;
    var mezcla = function (a, b, t) { var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), c = [16, 8, 0].map(function (s) { var p = (x >> s) & 255, q = (y >> s) & 255; return Math.round(p + (q - p) * t); }); return '#' + c.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); };
    defs.insertAdjacentHTML('beforeend', INI_COL.map(function (c, k) { return '<radialGradient id="g-ini-' + k + '" cx="50%" cy="30%" r="74%"><stop offset="0" stop-color="' + mezcla(c, '#FFFFFF', .55) + '"/><stop offset=".5" stop-color="' + c + '"/><stop offset="1" stop-color="' + mezcla(c, '#0E0628', .72) + '"/></radialGradient>'; }).join(''));
  }
  function miAvatar(cls) { return S.avatar.tipo === 'ini' ? inicial(S.usuario.charAt(0).toUpperCase(), INI_COL[S.avatar.i], cls) : medalla(S.avatar.i, cls); }

  /* ------------------------------------------------------------------
     Datos de ejemplo (apodos, tags y montos inventados)
     ------------------------------------------------------------------ */
  /* La arena sale de los trofeos con la escala de 500 por arena (Arena 15 desde 5.000). En la app real viene de la API:
     Supercell renumeró arenas en 2025, así que estos números son de ejemplo y hay que confirmarlos en el juego. */
  var arenaDe = function (tr) { return 'Arena ' + (15 + Math.floor((tr - 5000) / 500)); };
  var J = [
    { n: 'Kraken_77', t: '#9QJRUV2C', tr: 7420, m: 6 },
    { n: 'LaTormenta', t: '#2YLGP8C0', tr: 6910, m: 1 },
    { n: 'ZurdoFino', t: '#P0LYQ2R8', tr: 7105, m: 9 },
    { n: 'mate_y_rayo', t: '#C8RJ29QV', tr: 5980, m: 3 },
    { n: 'Pato_Veloz', t: '#UV82LYQ0', tr: 6450, m: 10 },
    { n: 'nocturna_9', t: '#Q2G0PRJ8', tr: 7790, m: 7 },
    { n: 'Lobo_Sur', t: '#8CQ0UYLR', tr: 6620, m: 11 },
    { n: 'Vikinga22', t: '#RJ9P2V8C', tr: 7230, m: 4 },
    { n: 'flaco.rapido', t: '#0YLQ8GUP', tr: 5410, m: 2 },
    { n: 'Rulo_Max', t: '#G2PJ0QYC', tr: 6080, m: 8 },
    { n: 'chispa.ar', t: '#LQ8R2YV9', tr: 6995, m: 5 },
    { n: 'TanoGol', t: '#V2UC8P0J', tr: 5720, m: 0 },
    { n: 'Halcon_Azul', t: '#PJ8Y2QC0', tr: 6310, m: 9 },
    { n: 'Tigre.lento', t: '#Y0C2RLQ8', tr: 5560, m: 11 },
    { n: 'Nube_Roja', t: '#J2QUV8PY', tr: 6780, m: 3 }
  ];
  J.forEach(function (j) { j.ar = arenaDe(j.tr); });
  var MESAS = [
    { id: 1, c: 0, monto: 100000 },
    { id: 8, c: 12, monto: 100000 },
    { id: 2, c: 3, monto: 50000 },
    { id: 3, c: 2, monto: 250000 },
    { id: 4, c: 5, monto: 500000 },
    { id: 5, c: 8, monto: 100000 },
    { id: 6, c: 10, monto: 180000 },
    { id: 7, c: 9, monto: 250000 }
  ];
  var EN_JUEGO = [{ a: 6, b: 7, monto: 250000 }, { a: 1, b: 11, monto: 100000 }];

  var S = {
    usuario: 'tu_usuario', mail: 'tu@email.com', tag: '#8LQYV02G', trofeos: 6830, arena: arenaDe(6830), clan: 'Los del Sur',
    avatar: leer('avatar', { tipo: 'ini', i: 0 }),
    fondoPerfil: leer('fondoPerfil', 'violeta'),
    fondoChat: leer('fondoChat', 'destellos'),
    sala: leer('sala', 'violeta'), amigosHechos: {}, pasosAbiertos: false,
    /* Un solo libro: disponible $12.000; en juego, el duelo con Vikinga22 que está en revisión ($1.000, R-394);
       resultado de hoy neto: perdiste $2.500 con Pato_Veloz y ganaste $900 netos con ZurdoFino = −$1.600 */
    disp: 1200000, cDuelo: 0, cTorneo: 0, cRevision: 100000, resHoy: -160000, duelosHoy: 2,
    fase: 'ninguna', apuesta: 100000, rival: J[14], miMesa: null, cancelPedido: false,
    filtro: 'todas', demo: 0, sonido: true, panel: null, panelTab: 'todo',
    rk: { per: 'semanal', mod: 'todos' }, histFiltro: 'todos', torneoTab: 'abiertos',
    vinc: { paso: 1, valor: '', error: '' },
    ingreso: 'entrar', pts: 214, puesto: 87,
    inscripto: {}
  };
  var CORONAS = { ganaste: [3, 1], perdiste: [1, 3], empate: [1, 1] };
  var RES = ['ganaste', 'perdiste', 'empate'];

  /* Historial: la hora es la del cierre del duelo (la misma que la del cobro en Billetera y en Notificaciones) */
  var HIST = [
    { r: 'g', j: 2, ap: 100000, c: [3, 0], f: 'Hoy 14:18' },
    { r: 'p', j: 4, ap: 250000, c: [1, 2], f: 'Hoy 12:55' },
    { r: 'g', j: 9, ap: 100000, c: [2, 1], f: 'Ayer 22:15' },
    { r: 'e', j: 3, ap: 50000, c: [1, 1], f: 'Ayer 21:40' },
    { r: 'g', j: 1, ap: 250000, c: [3, 2], f: 'Ayer 19:05' },
    { r: 'rev', j: 7, ap: 100000, c: null, f: 'Ayer 17:30', st: 'En revisión' },
    { r: 'p', j: 5, ap: 100000, c: [0, 1], f: '10/11 23:12' },
    { r: 'g', j: 10, ap: 50000, c: [1, 0], f: '10/11 22:01' },
    { r: 'dev', j: 6, ap: 100000, c: null, f: '10/11 21:44', st: 'Devuelto por tiempo' },
    { r: 'g', j: 8, ap: 100000, c: [2, 0], f: '09/11 21:17' },
    { r: 'p', j: 11, ap: 250000, c: [1, 3], f: '09/11 20:02' },
    { r: 'g', j: 0, ap: 100000, c: [3, 1], f: '08/11 22:48' }
  ];
  /* Movimientos: la apuesta sale del disponible una sola vez (custodia, −). Al cerrarse, esa misma fila cambia de estado:
     Ganada (y aparece el cobro +), Perdida (no resta otra vez) o Devuelta (y aparece la devolución +). */
  var MOVS = [
    { t: 'ganancia', txt: 'Ganaste el duelo', det: 'vs ZurdoFino · Hoy 14:18', v: 190000, st: 'Acreditado' },
    { t: 'custodia', det: 'vs ZurdoFino · Hoy 14:10', v: 100000, est: 'ganada' },
    { t: 'custodia', det: 'vs Pato_Veloz · Hoy 12:42', v: 250000, est: 'perdida' },
    { t: 'deposito', txt: 'Depósito', det: 'Hoy 11:05', v: 500000, st: 'Acreditado' },
    { t: 'deposito', txt: 'Depósito', det: 'Ayer 23:40', v: 300000, st: 'Pendiente de validación', pend: true },
    { t: 'ganancia', txt: 'Ganaste el duelo', det: 'vs Rulo_Max · Ayer 22:15', v: 190000, st: 'Acreditado' },
    { t: 'custodia', det: 'vs Rulo_Max · Ayer 22:03', v: 100000, est: 'ganada' },
    { t: 'devolucion', txt: 'Empate: apuesta devuelta', det: 'vs mate_y_rayo · Ayer 21:40', v: 50000, st: 'Devuelta' },
    { t: 'custodia', det: 'vs mate_y_rayo · Ayer 21:27', v: 50000, est: 'devuelta' },
    { t: 'ganancia', txt: 'Ganaste el duelo', det: 'vs LaTormenta · Ayer 19:05', v: 475000, st: 'Acreditado' },
    { t: 'custodia', det: 'vs LaTormenta · Ayer 18:51', v: 250000, est: 'ganada' },
    { t: 'retiro', txt: 'Retiro', det: 'Ayer 18:02 · a tu.alias.ejemplo', v: -300000, st: 'Retiro pagado' },
    { t: 'custodia', det: 'vs Vikinga22 · Ayer 17:30', v: 100000, est: 'revision' },
    { t: 'deposito', txt: 'Depósito', det: 'Ayer 16:40 · El comprobante no coincide con el monto', v: 250000, st: 'Rechazado', mal: true }
  ];
  var NOTIS = [
    { ic: 'trofeo', t: 'Ganaste el duelo contra ZurdoFino', p: 'Cobraste $1.900 (apostaste $1.000). Ya está en tu billetera.', f: 'Hoy 14:18', nueva: true },
    { ic: 'juego', t: 'ZurdoFino se unió a tu mesa', p: 'Mesa de $1.000. Pasá a la sala para jugar.', f: 'Hoy 14:10', nueva: true },
    { ic: 'depositar', t: 'Carga acreditada', p: 'Sumamos $5.000 a tu disponible.', f: 'Hoy 11:05' },
    { ic: 'retirar', t: 'Retiro pagado', p: 'Te transferimos $3.000 a tu cuenta.', f: 'Ayer 18:02' },
    { ic: 'reloj', t: 'Tu duelo con Vikinga22 está en revisión', p: 'Los dos historiales no coinciden. Tus $1.000 siguen en custodia hasta que lo resolvamos (hasta 72 h).', f: 'Ayer 17:30' },
    { ic: 'alerta', t: 'Carga rechazada', p: 'El comprobante de $2.500 no coincide con el monto. No se acreditó nada.', f: 'Ayer 16:40' },
    { ic: 'ranking', t: 'El ranking semanal cierra el domingo', p: 'Estás en el puesto 87. Cada victoria verificada suma 10 puntos y cada duelo jugado, 1.', f: 'Ayer 12:00' },
    { ic: 'devolucion', t: 'Te devolvimos una apuesta', p: 'El duelo contra Lobo_Sur venció sin partida. Devolución completa, sin cargo.', f: '10/11 21:44' }
  ];
  var TORNEOS = [
    { id: 1, n: 'Copa de los jueves', cupo: 8, insc: 100000, anot: 5, rep: 'todo', cierra: 'Cierra hoy a las 21:00', ventana: 'Rondas de 30 min' },
    { id: 2, n: 'Llave rápida', cupo: 4, insc: 50000, anot: 3, rep: 'todo', cierra: 'Cierra en 40 min', ventana: 'Rondas de 30 min' },
    { id: 3, n: 'Gran llave del finde', cupo: 16, insc: 250000, anot: 9, rep: '7030', cierra: 'Cierra el sábado a las 18:00', ventana: 'Rondas de 2 h' }
  ];
  var CHAT_G = [
    { j: 1, m: '¿Alguien para $1.000?', h: '15:22' },
    { j: 1, m: 'Abrí mesa, entren', h: '15:23' },
    { j: 3, m: 'Buena partida recién', h: '15:29' },
    { j: 2, m: 'Me uno a la de $2.500', h: '15:30' },
    { j: 7, m: '¿Revancha?', h: '15:31' },
    { j: 5, m: 'Dale, armo la mesa', h: '15:40' },
    { j: 9, m: '¿A qué hora cierra el ranking?', h: '16:02' },
    { j: 4, m: 'Domingo 23:59', h: '16:03' }
  ];
  var FRASES = ['¡Buena suerte!', 'Te mandé la amistosa', 'Aceptá la batalla', 'Dame un minuto', 'Buena partida', '¿Revancha?'];
  var RESP = ['Dale nomás', 'Ya te la acepto', 'Suerte', 'Voy', 'Buena'];

  var FONDOS_CHAT = [['destellos', 'Destellos'], ['trama', 'Trama'], ['pano', 'Paño'], ['oro', 'Oro'], ['choque', 'Choque'], ['noche', 'Noche'], ['neon', 'Neón']];
  var FONDOS_PERFIL = [['violeta', 'Violeta'], ['platino', 'Platino'], ['noche', 'Noche'], ['oro', 'Oro'], ['choque', 'Choque'], ['rayos', 'Rayos'], ['neon', 'Neón']];
  /* Choque (rojo arriba, verde agua abajo y la costura al medio) se sacó: era lo más parecido a la arena con su río */
  var SALAS = [['violeta', 'Violeta'], ['platino', 'Platino'], ['noche', 'Noche'], ['oro', 'Oro'], ['neon', 'Neón']];
  if (!SALAS.some(function (t) { return t[0] === S.sala; })) S.sala = 'violeta';

  /* ------------------------------------------------------------------
     Movimientos de plata (un solo saldo para toda la app)
     ------------------------------------------------------------------ */
  function mov(m) { MOVS.unshift(m); return m; }
  function noti(icono, t, p) { NOTIS.unshift({ ic: icono, t: t, p: p, f: hora(), nueva: true }); var cab = document.getElementById('cab'); if (cab && cab.innerHTML) pintarCab(); }
  /* Ya son amigos si jugaron un duelo antes (R-080) o si tocaste «Ya lo agregué» en esta sala */
  function sonAmigos(r) { return !!S.amigosHechos[r.n] || HIST.some(function (h) { return J[h.j] === r; }); }
  function hora() { var d = new Date(); return 'Hoy ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  /* La apuesta sale del disponible una sola vez: una fila de custodia (−) que después cambia de estado */
  function congelar(ap, det) {
    S.disp -= ap; S.cDuelo += ap; S.apuesta = ap;
    S.movDuelo = mov({ t: 'custodia', det: det || hora(), v: ap, est: 'juego' });
  }
  function devolver(motivo) {
    var ap = S.cDuelo; if (!ap) return;
    S.disp += ap; S.cDuelo = 0;
    if (S.movDuelo) S.movDuelo.est = 'devuelta';
    mov({ t: 'devolucion', txt: motivo || 'Devolución', det: hora(), v: ap, st: 'Devuelta' });
    noti('devolucion', 'Te devolvimos ' + plata(ap), (motivo || 'Devolución') + '. Devolución completa, sin cargo.');
    S.movDuelo = null;
  }
  /* origen: 'mesa' (alguien se unió a tu mesa), 'unirse', 'revancha' o 'ejemplo' (la sala abierta directo, para el visor).
     El reloj arranca en 60:00 cuando se empareja de verdad; sólo el ejemplo arranca con un minuto y medio jugado. */
  function nuevoDuelo(rival, ap, origen) {
    S.rival = rival || J[0]; S.apuesta = ap || S.apuesta; S.cancelPedido = false;
    if (S.cDuelo === 0) {
      if (S.disp < S.apuesta) return false;
      congelar(S.apuesta, 'vs ' + S.rival.n + ' · ' + hora());
    } else if (S.movDuelo) {
      S.movDuelo.det = 'vs ' + S.rival.n + ' · ' + hora();
    }
    S.fase = 'duelo'; S.miMesa = null; S.inicioDuelo = Date.now() - (origen === 'ejemplo' ? 80000 : 0);
    S.amistad = sonAmigos(S.rival); S.pasosAbiertos = false; S.vsVisto = false;
    S.log = [
      { k: 'p', t: 'Emparejados · ' + S.rival.n + ' se unió' },
      { k: 'l', q: 'Vos', t: 'Apuesta de ' + plata(S.apuesta) + ' en custodia' },
      { k: 'l', q: S.rival.n, t: 'Apuesta de ' + plata(S.apuesta) + ' en custodia' },
      { k: 'p', t: S.amistad ? 'Ustedes ya son amigos en Clash Royale' : 'Falta que se agreguen como amigos' }
    ];
    S.chat = [{ yo: false, m: '¡Buena suerte!' }];
    var r = S.rival.n, m = plata(S.apuesta);
    if (origen === 'mesa') noti('juego', r + ' se unió a tu mesa', 'Mesa de ' + m + '. Pasá a la sala para jugar.');
    else if (origen === 'unirse') noti('juego', 'Te uniste a la mesa de ' + r, 'Apuesta de ' + m + ' en custodia. Pasá a la sala para jugar.');
    else if (origen === 'revancha') noti('juego', r + ' aceptó la revancha', 'Mesa de ' + m + '. Pasá a la sala para jugar.');
    else noti('juego', 'Duelo armado con ' + r, 'Mesa de ' + m + '. Tu apuesta está en custodia.');
    return true;
  }
  function resolver(res) {
    var ap = S.cDuelo; if (!ap) return;
    S.cDuelo = 0; S.duelosHoy += 1; S.pts += res === 'ganaste' ? 10 : 1;
    var c = CORONAS[res], fila = S.movDuelo;
    if (res === 'ganaste') { S.disp += premio(ap); S.resHoy += premio(ap) - ap; if (fila) fila.est = 'ganada'; mov({ t: 'ganancia', txt: 'Ganaste el duelo', det: 'vs ' + S.rival.n + ' · ' + hora(), v: premio(ap), st: 'Acreditado' }); noti('trofeo', 'Ganaste el duelo contra ' + S.rival.n, 'Cobraste ' + plata(premio(ap)) + ' (apostaste ' + plata(ap) + '). Ya está en tu billetera.'); }
    else if (res === 'empate') { S.disp += ap; if (fila) fila.est = 'devuelta'; mov({ t: 'devolucion', txt: 'Empate: apuesta devuelta', det: 'vs ' + S.rival.n + ' · ' + hora(), v: ap, st: 'Devuelta' }); noti('devolucion', 'Empate contra ' + S.rival.n, 'Te devolvimos tu apuesta completa de ' + plata(ap) + ', sin comisión.'); }
    else { S.resHoy -= ap; if (fila) fila.est = 'perdida'; noti('juego', 'Perdiste el duelo contra ' + S.rival.n, 'Apostaste ' + plata(ap) + '. El ganador lo decidió la API oficial.'); }
    S.movDuelo = null;
    HIST.unshift({ r: res === 'ganaste' ? 'g' : res === 'perdiste' ? 'p' : 'e', j: J.indexOf(S.rival) >= 0 ? J.indexOf(S.rival) : 0, ap: ap, c: c, f: hora() });
  }
  /* Lleva el estado a la pantalla pedida por los caminos válidos, sin saltarse la custodia */
  function asegurar(t) {
    if (t === 'duelo' || t === 'verificando') {
      if (S.fase === 'esperando') { nuevoDuelo(S.rival, S.apuesta, 'ejemplo'); }
      else if (S.fase !== 'duelo' && S.fase !== 'verificando') { if (!nuevoDuelo(S.rival, S.apuesta, 'ejemplo')) return false; }
      S.fase = t;
    } else if (RES.indexOf(t) >= 0) {
      if (S.fase === t) return true;
      if (S.fase === 'esperando') nuevoDuelo(S.rival, S.apuesta, 'ejemplo');
      else if (S.fase !== 'duelo' && S.fase !== 'verificando') { if (!nuevoDuelo(S.rival, S.apuesta, 'ejemplo')) return false; }
      resolver(t); S.fase = t;
    }
    return true;
  }
  var enDuelo = function () { return S.fase === 'duelo' || S.fase === 'verificando'; };

  /* ------------------------------------------------------------------
     Shell: cabecera, barra lateral y barra inferior
     ------------------------------------------------------------------ */
  var TABS = [['inicio', 'Inicio', 'inicio'], ['chat', 'Chat', 'chat'], ['jugar', 'Jugar', null], ['ranking', 'Ranking', 'ranking'], ['perfil', 'Perfil', 'perfil']];
  var TAB_DE = { inicio: 'inicio', billetera: 'inicio', notificaciones: 'inicio', chat: 'chat', jugar: 'jugar', mesas: 'jugar', crear: 'jugar', torneos: 'jugar', ranking: 'ranking', perfil: 'perfil', historial: 'perfil', vincular: 'perfil' };
  function armarShell() {
    $('#barra').innerHTML = TABS.map(function (t) {
      return '<a href="#' + t[0] + '" data-tab="' + t[0] + '"' + (t[0] === 'jugar' ? ' class="jugar"' : '') + '>' + (t[2] ? ic(t[2]) : emblema('jugar-em')) + '<span>' + t[1] + '</span></a>';
    }).join('') + '<span class="luz" aria-hidden="true"></span>';
    $('#lateral').innerHTML = logo() + '<nav aria-label="Secciones">' + TABS.map(function (t) {
      return '<a href="#' + t[0] + '" data-tab="' + t[0] + '">' + (t[2] ? ic(t[2]) : emblema('jugar-em')) + '<span>' + t[1] + '</span></a>';
    }).join('') + '</nav><a class="soporte" href="#perfil" data-acc="ayuda">' + ic('soporte') + '<div><b>Soporte</b><small>Te respondemos por chat</small></div></a><p class="legal"><span class="mas18" aria-label="Solo mayores de 18">+18</span> Jugá con responsabilidad.<br>VIP Royale no está afiliado a Supercell ni a Clash Royale.</p>';
  }
  function pintarCab() {
    var nuevas = NOTIS.some(function (n) { return n.nueva; });
    $('#cab').innerHTML = logo() +
      '<a class="pill" href="#billetera" aria-label="Billetera: disponible ' + plata(S.disp) + '">' + miAvatar() + '<span class="pill-user">' + esc(S.usuario) + '</span><span class="pill-sep"></span><span class="pill-saldo num">' + plata(S.disp) + '</span></a>' +
      '<a class="campana" href="#notificaciones" aria-label="Notificaciones' + (nuevas ? ', hay nuevas' : '') + '">' + ic('campana') + (nuevas ? '<b></b>' : '') + '</a>';
  }
  function marcarTab(tab) {
    $$('[data-tab]').forEach(function (a) {
      var on = a.dataset.tab === tab;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var i = TABS.findIndex(function (t) { return t[0] === tab; });
    var luz = $('.barra .luz');
    if (luz) { luz.style.opacity = i < 0 ? '0' : '1'; luz.style.transform = 'translateX(' + Math.max(0, i) * 100 + '%)'; }
  }
  function pie() {
    return '<footer class="pie"><span class="mas18" aria-label="Solo mayores de 18">+18</span><div><p><b>Jugá con responsabilidad.</b> Si sentís que perdés el control, pausá tu cuenta desde Perfil.</p><p>VIP Royale no está afiliado a Supercell ni a Clash Royale. Clash Royale es una marca de Supercell.</p></div></footer>';
  }

  /* ------------------------------------------------------------------
     Piezas
     ------------------------------------------------------------------ */
  function montos(ap) {
    return '<div class="montos"><span class="monto"><small>Apuesta</small><b class="num">' + plata(ap) + '</b></span><span class="monto premio"><small>Premio</small><b class="num">' + plata(premio(ap)) + '</b></span></div>';
  }
  function tarjetaMesa(m) {
    var j = J[m.c];
    return '<article class="mesa"><div class="mesa-izq"><div class="mesa-quien">' + medalla(j.m) + '<b>' + esc(j.n) + '</b></div>' + simbolo() +
      '<div class="mesa-info"><b class="tipo">1v1 · Amistosa</b><div class="mesa-meta"><span class="estado libre">Libre</span><span class="cupo">' + ic('usuario') + '1/2</span></div></div><div class="mesa-clash">' + esc(j.ar) + ' · ' + miles(j.tr) + ' trofeos</div></div>' +
      '<div class="mesa-der">' + montos(m.monto) + '<button class="btn btn-oro unirse" data-acc="unirse" data-id="' + m.id + '" aria-label="Unirse a la mesa de ' + esc(j.n) + ' por ' + plata(m.monto) + '">Unirse</button></div></article>';
  }
  function tarjetaEnJuego(e) {
    var a = J[e.a], b = J[e.b];
    return '<article class="mesa"><div class="mesa-izq"><div class="mesa-quien">' + medalla(a.m) + '<b>' + esc(a.n) + ' <span style="color:var(--tx-3);font-weight:600">vs</span> ' + esc(b.n) + '</b></div>' + simbolo() +
      '<div class="mesa-info"><b class="tipo">1v1 · Amistosa</b><div class="mesa-meta"><span class="estado enjuego">En juego</span><span class="cupo">' + ic('usuario') + '2/2</span></div></div></div>' +
      '<div class="mesa-der">' + montos(e.monto) + '</div></article>';
  }
  function miMesaCard() {
    var m = S.miMesa; if (!m) return '';
    return '<article class="mesa mia" aria-label="Tu mesa"><div class="mesa-izq"><div class="mesa-quien">' + miAvatar() + '<b>' + (m.revancha ? 'Revancha a ' + esc(S.rival.n) : 'Tu mesa' + (m.privada ? ' privada' : '')) + '</b></div>' + simbolo() +
      '<div class="mesa-info"><b class="tipo">1v1 · Amistosa</b><div class="mesa-meta"><span class="estado esperando">Esperando</span><span class="cupo">' + ic('usuario') + '1/2</span></div></div><div class="mesa-clash cuenta-reg num" data-cuenta="' + m.vence + '">--:--</div></div>' +
      '<div class="mesa-der">' + montos(m.monto) + '</div>' +
      '<div style="grid-column:1/-1;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><span class="custodia-txt">' + ic('candado') + ' Tu apuesta de ' + plata(m.monto) + ' está en custodia</span>' +
      (m.privada ? '<button class="btn btn-linea" style="min-height:44px;font-size:13px;padding:0 14px" data-acc="ver-link">' + ic('link') + 'Enlace</button>' : '') +
      '<button class="btn btn-rojo" style="min-height:44px;font-size:13px;padding:0 14px;letter-spacing:.08em" data-acc="cancelar-mesa">Cancelar mesa</button></div></article>';
  }
  function cursoCard() {
    if (enDuelo()) return '<a class="duelo-curso" href="#' + S.fase + '">' + simbolo() + '<div><b>Tu duelo con ' + esc(S.rival.n) + ' sigue en curso</b><small>' + plata(S.apuesta) + ' en custodia · Volvé a la sala para terminarlo</small></div><span class="btn btn-violeta">Volver</span></a>';
    if (S.fase === 'esperando' && S.miMesa) return '<a class="duelo-curso" href="#mesas">' + simbolo() + '<div><b>' + (S.miMesa.revancha ? 'Esperando que acepte la revancha' : 'Tu mesa espera rival') + '</b><small>' + plata(S.miMesa.monto) + ' en custodia · Te avisamos cuando alguien se una</small></div><span class="btn btn-violeta">Ver</span></a>';
    return '';
  }
  function tileDuelo(ancho) {
    var arte = '<span class="arte" aria-hidden="true"><span class="flota"><img class="ficha az" src="assets/media-cian.webp" alt="" width="284" height="480" decoding="async">' + CHISPA + '<img class="ficha rj" src="assets/media-roja.webp" alt="" width="284" height="480" decoding="async"></span></span>';
    if (ancho) return '<a class="juego ancho" href="#mesas" aria-label="Duelo 1v1: amistosa 1v1 por monto"><span class="textura"></span>' + arte + '<div class="txt"><h3>Duelo 1v1</h3><p class="modos">De $100 a $5.000</p><p class="desc">Elegí un monto, jugá la amistosa y la API decide quién gana.</p><span class="ir">' + ic('ir') + '</span></div></a>';
    return '<a class="juego" href="#mesas" aria-label="Duelo 1v1, amistosa por monto, en línea"><span class="textura"></span><span class="etq hot">' + ic('llama') + 'MÁS JUGADO</span><h3>Duelo 1v1</h3><p class="sub">Amistosa · por monto</p><p class="vivo"><span class="puntos"><i></i><i></i><i></i></span>En línea</p>' + arte + '</a>';
  }
  var LLAVE = '<svg class="llave-arte" viewBox="0 0 100 60" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h10v10h10M2 26h10V16M2 34h10v10h10M2 54h10V44M22 16v14h8M22 44V30"/><path d="M98 6H88v10H78M98 26H88V16M98 34H88v10H78M98 54H88V44M78 16v14h-8M78 44V30"/></svg>';
  function tileTorneos(ancho) {
    var arte = '<span class="arte" aria-hidden="true"><span class="flota">' + LLAVE + '<img class="copa-arte" src="assets/copa.webp" alt="" width="440" height="543" decoding="async"></span></span>';
    var abiertos = TORNEOS.length;
    if (ancho) return '<a class="juego ancho b" href="#torneos" aria-label="Torneos de 4, 8 o 16 jugadores"><span class="textura"></span>' + arte + '<div class="txt"><h3>Torneos</h3><p class="modos">4, 8 o 16 jugadores</p><p class="desc">Cada cruce es una amistosa verificada. El que gana avanza solo.</p><span class="ir">' + ic('ir') + '</span></div></a>';
    return '<a class="juego b" href="#torneos" aria-label="Torneos, nuevo, ' + pl(abiertos, 'abierto', 'abiertos') + '"><span class="textura"></span><span class="etq nuevo">NUEVO</span><h3>Torneos</h3><p class="sub">Llaves de 4, 8 y 16</p><p class="vivo"><span class="puntos celeste"><i></i><i></i></span>' + pl(abiertos, 'abierto', 'abiertos') + '</p>' + arte + '</a>';
  }
  /* Un solo saldo: en juego = duelo o mesa + inscripciones + duelo en revisión. Resultado de hoy = neto de los duelos cerrados hoy */
  var enJuegoTotal = function () { return S.cDuelo + S.cTorneo + S.cRevision; };
  function resultadoHoy() {
    var v = S.resHoy, cls = v > 0 ? 'verde' : v < 0 ? 'rojo' : '';
    return '<b class="num ' + cls + '">' + (v > 0 ? '+' : '') + plata(v) + '</b>';
  }
  function billeteraCard() {
    return '<section class="tarjeta billetera a-bill" aria-label="Mi billetera"><div class="bill-cab"><h3>Mi billetera</h3><span class="en-vivo">En tiempo real</span></div>' +
      '<div class="saldo-grande"><span>$</span><b class="num">' + sinSigno(S.disp) + '</b><small>Disponible</small></div>' +
      '<div class="datos"><div class="dato"><small>En juego</small><b class="num">' + plata(enJuegoTotal()) + '</b></div><div class="dato"><small>Resultado de hoy</small>' + resultadoHoy() + '</div><div class="dato"><small>Duelos hoy</small><b class="num">' + S.duelosHoy + '</b></div></div>' +
      '<div class="bill-acc"><button class="btn btn-violeta" data-acc="depositar">' + ic('depositar') + 'Depositar</button><button class="btn btn-linea" data-acc="retirar">' + ic('retirar') + 'Retirar</button></div></section>';
  }

  /* ------------------------------------------------------------------
     Pantallas del lobby
     ------------------------------------------------------------------ */
  function vInicio() {
    var activas = EN_JUEGO.map(tarjetaEnJuego).join('') + MESAS.slice(0, 2).map(tarjetaMesa).join('');
    return cursoCard() +
      '<div class="inicio-grilla">' +
      '<section class="banner a-banner" aria-labelledby="t-banner"><div><span class="banner-et">' + ic('link') + esc(S.tag) + ' · ' + miles(S.trofeos) + ' trofeos</span><h2 id="t-banner">Retá a un amigo a una amistosa 1v1</h2><p>Elegí el monto, jugá en Clash Royale y la API oficial decide quién gana.</p><a class="btn btn-violeta" href="#mesas">Jugar ahora</a></div><div class="banner-arte duelo" aria-hidden="true"><img class="m-a" src="assets/media-cian.webp" alt="" width="284" height="480" decoding="async"><img class="m-b" src="assets/media-roja.webp" alt="" width="284" height="480" decoding="async"><b>VS</b></div></section>' +
      '<div class="promos a-promos"><a class="promo" href="#torneos"><div><h3>Copa de los jueves</h3><p>Llave de 8 · cierra hoy a las 21:00</p><span class="btn btn-linea">Ver torneos</span></div><img src="assets/copa.webp" alt="" width="440" height="543" decoding="async"></a>' +
      '<a class="promo oro" href="#ranking"><div><h3>Ranking semanal</h3><p>Cierra el domingo a las 23:59</p><span class="btn btn-linea">Ver ranking</span></div><img src="assets/medalla.webp" alt="" width="420" height="655" decoding="async"></a></div>' +
      '<section class="a-juegos" aria-labelledby="t-juegos"><h2 class="sec" id="t-juegos">Juegos disponibles</h2><div class="juegos" style="margin-top:14px">' + tileDuelo() + tileTorneos() + '</div></section>' +
      billeteraCard() +
      '<section class="a-mesas" aria-labelledby="t-mesas"><h2 class="sec con-cuenta" id="t-mesas">Mesas activas · Duelo 1v1<small><a href="#mesas" style="color:var(--acento);text-decoration:none">Ver todas</a></small></h2><div class="mesas-lista" style="margin-top:14px">' + activas + '</div></section>' +
      '</div>' + pie();
  }
  function vJugar() {
    return '<div><h1 class="titulo-pant">Elegí cómo jugar</h1><p class="bajada">Elegí un modo para buscar un duelo</p></div>' +
      '<div class="jugar-grilla" style="display:grid;gap:14px">' + tileDuelo(true) + tileTorneos(true) + '</div>' +
      '<div class="nota-conexion">' + ic('senal') + '<p>Jugá con una conexión estable. Si se corta durante la amistosa, <b>vale lo que registre el historial oficial</b>. Desde que se arma el duelo tenés <b>60 minutos</b> para jugarlo.</p></div>' + pie();
  }
  var CHIPS = [['todas', 'Todas'], ['50000', '$500'], ['100000', '$1.000'], ['250000', '$2.500'], ['500000', '$5.000'], ['otros', 'Otros montos']];
  function mesasFiltradas() {
    return MESAS.filter(function (m) {
      if (S.filtro === 'todas') return true;
      if (S.filtro === 'otros') return [50000, 100000, 250000, 500000].indexOf(m.monto) < 0;
      return m.monto === Number(S.filtro);
    });
  }
  function vMesas() {
    var lista = mesasFiltradas();
    var n = lista.length;
    var vacio = '';
    if (!n) {
      var mt = S.filtro === 'otros' || S.filtro === 'todas' ? null : Number(S.filtro);
      vacio = '<div class="vacio"><b>' + (mt ? 'Sin mesas de ' + plata(mt) + ' — creá la primera' : 'No hay mesas abiertas en este momento.') + '</b>' + (mt ? 'Si nadie se une en 15 minutos, te devolvemos la apuesta completa.' : 'Creá la tuya y esperá un rival.') + '<div style="margin-top:14px"><button class="btn btn-violeta" data-acc="crear"' + (mt ? ' data-monto="' + mt + '"' : '') + '>' + ic('mas') + 'Crear mesa' + (mt ? ' por ' + plata(mt) : '') + '</button></div></div>';
    }
    return '<div class="mesas-cab"><div><h1>Duelo 1v1</h1><p>' + pl(123, 'jugador', 'jugadores') + ' en línea</p></div><button class="btn btn-violeta" data-acc="crear">' + ic('mas') + 'Crear mesa</button></div>' +
      '<div class="chips" role="group" aria-label="Filtrar por monto">' + CHIPS.map(function (c) { return '<button class="chip' + (S.filtro === c[0] ? ' on' : '') + (c[0] === '500000' ? ' oro' : '') + '" data-acc="filtro" data-v="' + c[0] + '" aria-pressed="' + (S.filtro === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      (S.miMesa ? '<h2 class="sec">Tu mesa</h2>' + miMesaCard() : '') +
      '<h2 class="sec con-cuenta">Mesas disponibles<small>' + pl(n, 'mesa', 'mesas') + '</small></h2>' +
      (n ? '<div class="mesas-lista dos">' + lista.map(tarjetaMesa).join('') + '</div>' : vacio) +
      '<p class="rk-nota">Antes de unirte ves la arena y los trofeos de tu rival. Si nadie se une en 15 minutos, la mesa se cierra y te devolvemos la apuesta completa.</p>' + pie();
  }

  /* Ranking: datos por período y modalidad */
  var RK = {
    semanal: { todos: [486, 452, 431, 398, 377, 352, 340, 318, 301, 287, 270, 256, 241, 230, 221], duelos: [470, 441, 420, 389, 366, 344, 331, 309, 296, 280, 264, 250, 236, 224, 215], torneos: [96, 88, 80, 72, 66, 60, 54, 50, 46, 42, 38, 34, 30, 28, 26] },
    mensual: { todos: [1904, 1822, 1760, 1691, 1610, 1544, 1490, 1433, 1380, 1322, 1270, 1219, 1180, 1144, 1102], duelos: [1850, 1771, 1702, 1640, 1566, 1500, 1448, 1390, 1341, 1288, 1236, 1190, 1150, 1112, 1080], torneos: [390, 362, 340, 318, 296, 280, 262, 248, 234, 220, 206, 192, 180, 170, 160] }
  };
  var RK_REC = { semanal: [2000000, 1000000, 500000, 200000, 200000, 100000, 100000, 50000, 50000, 50000], mensual: [6000000, 3000000, 1500000, 600000, 600000, 300000, 300000, 150000, 150000, 150000] };
  var RK_ORDEN = [5, 2, 7, 0, 1, 10, 9, 4, 6, 3, 8, 11, 12, 13, 14];
  function vRanking() {
    var per = S.rk.per, mod = S.rk.mod, pts = RK[per][mod], rec = RK_REC[per];
    var rec1 = function (i) { return mod === 'torneos' ? 0 : rec[i] || 0; };
    var vic = function (p) { return Math.floor(p / 11); };
    var pod = function (pos, i) {
      var j = J[RK_ORDEN[i]];
      return '<div class="pod p' + pos + '">' + (pos === 1 ? '<span class="estrella">' + SV + '<path d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="#F2CF55" stroke="#F2CF55"/></svg></span>' : '') + '<span class="pos">' + pos + '°</span>' + medalla(j.m) + '<span class="nom">' + esc(j.n) + '</span><span class="rec">' + vic(pts[i]) + 'V · ' + Math.floor(vic(pts[i]) * .7) + 'D</span><span class="pts num" data-n="' + pts[i] + '">' + miles(pts[i]) + '</span><span class="pts-l">PUNTOS</span>' + (rec1(i) ? '<span class="rec-pr"><small>Recompensa</small><b class="num">' + plata(rec1(i)) + '</b></span>' : '') + '</div>';
    };
    var mio = S.pts + (mod === 'torneos' ? -190 : 0);
    var filas = pts.slice(3).map(function (p, k) {
      var i = k + 3, j = J[RK_ORDEN[i]];
      return '<div class="tf" style="animation-delay:' + (k * 75) + 'ms"><span class="n">' + (i + 1) + '</span>' + medalla(j.m) + '<span class="q"><b>' + esc(j.n) + '</b><small>' + vic(p) + 'V · ' + Math.floor(vic(p) * .8) + 'D</small></span><span class="s"><b class="num" data-n="' + p + '">' + miles(p) + '</b><small>PTS</small>' + (rec1(i) ? '<br><span class="fila-pr num" title="Recompensa en saldo promocional">' + plata(rec1(i)) + '</span>' : '') + '</span></div>';
    }).join('');
    return '<div class="rk-cab"><h1 class="titulo-pant oro">Ranking VIP</h1><span class="temporada">' + (per === 'semanal' ? 'Semana actual' : 'Mes actual') + '</span></div>' +
      '<div class="rk-grilla" id="rk"><div class="col">' +
      '<div class="segm" role="group" aria-label="Período"><button data-acc="rk-per" data-v="semanal" class="' + (per === 'semanal' ? 'on' : '') + '" aria-pressed="' + (per === 'semanal') + '">Semanal</button><button data-acc="rk-per" data-v="mensual" class="' + (per === 'mensual' ? 'on' : '') + '" aria-pressed="' + (per === 'mensual') + '">Mensual</button></div>' +
      '<div class="modalidad" role="group" aria-label="Modalidad">' + [['todos', 'Todos'], ['duelos', 'Duelos'], ['torneos', 'Torneos']].map(function (m) { return '<button data-acc="rk-mod" data-v="' + m[0] + '" class="' + (mod === m[0] ? 'on' : '') + '" aria-pressed="' + (mod === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>' +
      (mod === 'torneos' ? '' : '<p class="podio-tit">Recompensas de la ' + (per === 'semanal' ? 'semana' : 'mes') + ' · saldo promocional</p>') + '<div class="podio" id="podio">' + pod(2, 1) + pod(1, 0) + pod(3, 2) + '</div>' +
      '<div class="tu-puesto"><div class="tp"><small>TU PUESTO</small><b>' + S.puesto + '°</b></div><div class="tq"><b>' + esc(S.usuario) + '</b><small>Puesto ' + S.puesto + ' de 1.240 · te faltan ' + miles(pts[9] - mio) + ' pts para el top 10</small></div><div class="tr"><b class="num" data-n="' + mio + '">' + miles(mio) + '</b><small>PTS</small></div></div>' +
      '</div><div class="col"><h2 class="sec-centro">Tabla de posiciones</h2><div class="tabla">' + filas + '</div>' +
      '<p class="rk-nota">' + (per === 'semanal' ? 'La semana cierra el domingo a las 23:59.' : 'El mes cierra el último día a las 23:59.') + ' Suman los duelos verificados por la API: 10 puntos por victoria y 1 por cada duelo jugado (perdido o empatado). ' + (mod === 'torneos' ? 'La tabla de torneos no tiene recompensas.' : 'Las recompensas se acreditan como saldo promocional: se usa para jugar y no se retira.') + '</p></div></div>' + pie();
  }
  function animarRanking() {
    var rk = $('#rk'); if (!rk || quieto()) return;
    rk.classList.add('rk-oculto');
    var nums = $$('[data-n]', rk).slice(0, 4 + 12);
    var t0 = performance.now();
    nums.forEach(function (el, k) {
      var fin = Number(el.dataset.n), dur = k < 3 ? 1500 + k * 150 : 950, demora = k < 4 ? 0 : (k - 4) * 75;
      el.textContent = '0';
      var paso = function (t) {
        var x = Math.min(1, Math.max(0, (t - t0 - demora) / dur));
        var e = 1 - Math.pow(1 - x, 3);
        el.textContent = miles(Math.round(fin * e));
        if (x < 1 && document.body.contains(el)) requestAnimationFrame(paso);
        else if (x >= 1) { el.textContent = miles(fin); el.classList.add('pulso'); }
      };
      requestAnimationFrame(paso);
    });
    var pods = $$('.pod', rk);
    var chips = cada(function () {
      pods.forEach(function (p) {
        var s = document.createElement('i');
        s.className = 'suma';
        s.textContent = '+' + (8 + Math.floor(Math.random() * 30));
        s.style.left = (25 + Math.random() * 50) + '%';
        p.appendChild(s);
        setTimeout(function () { s.remove(); }, 900);
      });
    }, 210);
    luego(function () { clearInterval(chips); rk.classList.remove('rk-oculto'); chispas($('.pod.p1', rk)); }, 1800);
  }
  /* Chispas doradas: van debajo del cartel de saldo de prueba, nunca lo tapan */
  function chispas(origen, cantidad, capa) {
    if (!origen || quieto()) return;
    var cv = document.createElement('canvas'); cv.className = 'chispas' + (capa ? ' detras' : '');
    var base = capa ? capa.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    (capa || document.body).insertBefore(cv, capa ? capa.firstChild : null);
    var dpr = Math.min(2, window.devicePixelRatio || 1), W = base.width, H = base.height;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; var g = cv.getContext('2d'); g.scale(dpr, dpr);
    var r = origen.getBoundingClientRect(), cx = r.left + r.width / 2 - base.left, cy = r.top + r.height * .3 - base.top;
    var ps = []; for (var i = 0; i < (cantidad || 70); i++) { var a = capa ? -Math.PI * (.08 + Math.random() * .84) : Math.random() * Math.PI * 2, v = 2 + Math.random() * 6; ps.push({ x: cx, y: cy, vx: Math.cos(a) * v * (capa ? 1.3 : 1), vy: Math.sin(a) * v - (capa ? 1 : 3), s: 1.5 + Math.random() * 3, c: Math.random() > .5 ? '#FFF0A8' : '#F2CF55' }); }
    var t0 = performance.now();
    (function cuadro(t) {
      var dt = (t - t0) / 1000; g.clearRect(0, 0, W, H);
      ps.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.vy += .18; g.globalAlpha = Math.max(0, 1 - dt / 1.3); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s, 0, 7); g.fill(); });
      if (dt < 1.3) requestAnimationFrame(cuadro); else cv.remove();
    })(t0);
  }

  function vChat() {
    var msjs = CHAT_G.map(function (c) {
      if (c.yo) return '<div class="msj mio"><div class="col"><div class="globo">' + esc(c.m) + '<time>' + c.h + '</time></div></div></div>';
      var j = J[c.j];
      return '<div class="msj">' + medalla(j.m) + '<div class="col"><span class="quien">' + esc(j.n) + '</span><div class="globo">' + esc(c.m) + '<time>' + c.h + '</time></div></div></div>';
    }).join('');
    return '<div class="chat-cab"><span class="bola">' + ic('chat') + '</span><div><h1>Chat global</h1><p>' + pl(123, 'jugador', 'jugadores') + ' en línea</p></div></div>' +
      '<div class="chat-cuerpo fondo-' + S.fondoChat + '" id="chat-cuerpo" aria-live="polite">' + msjs + '</div>' +
      '<div class="chat-pie"><div class="chat-herr"><span>Sin acoso, spam, publicidad ni datos de contacto o de pago.</span><button class="btn-fondo" data-acc="fondo-chat">' + ic('pincel') + 'Fondo</button></div>' +
      '<form class="escribir" data-form="chat-global" autocomplete="off"><div class="campo-msj"><label class="vh" for="chat-in">Mensaje</label><input class="input" id="chat-in" maxlength="80" placeholder="Escribí un mensaje..." data-in="contar" data-cont="chat-cont"><span class="cont" id="chat-cont">0/80</span></div><button class="env" aria-label="Enviar" disabled>' + ic('enviar') + '</button></form></div>';
  }
  function fondoClase(id) { return 'fondo-' + id; }
  function vPerfil() {
    var gan = HIST.filter(function (h) { return h.r === 'g'; }).length, res = HIST.filter(function (h) { return 'gpe'.indexOf(h.r) >= 0 && h.r.length === 1; }).length;
    var claro = S.fondoPerfil === 'platino';
    return '<div class="perfil-grilla"><div class="col">' +
      '<section class="perfil-tarj ' + fondoClase(S.fondoPerfil) + (claro ? ' claro' : '') + '" aria-label="Tu perfil"><button class="btn-fondo" data-acc="fondo-perfil">' + ic('pincel') + 'Fondo</button>' +
      '<div class="perfil-av">' + miAvatar() + '<button class="lapiz" data-acc="avatares" aria-label="Cambiar foto de perfil">' + ic('lapiz') + '</button></div>' +
      '<h1>' + esc(S.usuario) + '</h1><p class="mail">' + esc(S.mail) + '</p><span class="puntos-et">' + ic('logros') + 'PUESTO ' + S.puesto + ' · ' + miles(S.pts) + ' PTS</span></section>' +
      '<h2 class="sec">Estadísticas</h2><div class="stats"><div class="stat"><b class="num">' + HIST.length + '</b><small>Duelos</small></div><div class="stat"><b class="verde num">' + Math.round(gan / Math.max(1, res) * 100) + '%</b><small>Victorias</small></div><div class="stat"><b class="num">' + miles(S.trofeos) + '</b><small>Trofeos</small></div></div>' +
      '<a class="clash-tarj" href="#perfil" data-acc="cuenta-clash"><span class="fi">' + ic('link') + '</span><div><b>Cuenta de Clash vinculada</b><small>' + esc(S.tag) + ' · ' + miles(S.trofeos) + ' trofeos · ' + esc(S.arena) + '</small></div><span class="ok">' + ic('check') + 'Verificada</span></a>' +
      '</div><div class="col"><h2 class="sec">Cuenta</h2><div class="lista">' +
      fila('historial', 'Historial', 'Ver duelos jugados', '#historial') +
      fila('logros', 'Logros', '5 de 12 conseguidos', null, 'logros') +
      fila('temas', 'Temas de sala', 'Violeta · Choque · Noche · Oro · Neón', null, 'temas-sala') +
      fila('campana', 'Notificaciones', 'Elegí qué avisos recibir', '#notificaciones') +
      fila('referidos', 'Referidos', 'Invitá amigos con tu enlace', null, 'referidos') +
      fila('limites', 'Límites y pausas', 'Topes de carga y apuesta, pausas', null, 'limites') +
      fila('ayuda', 'Ayuda', 'Preguntas frecuentes y soporte', null, 'ayuda') +
      fila('salir', 'Cerrar sesión', 'Salís de esta cuenta en este dispositivo', '#ingreso', null, 'peligro') +
      '</div></div></div>' + pie();
  }
  function fila(icono, t, s, href, acc, cls) {
    var attr = href ? 'href="' + href + '"' : 'href="#perfil" data-acc="' + acc + '"';
    return '<a class="fila' + (cls ? ' ' + cls : '') + '" ' + attr + '><span class="fi">' + ic(icono) + '</span><span class="ft"><b>' + t + '</b><small>' + s + '</small></span>' + ic('flecha', 'fc') + '</a>';
  }
  /* Cada movimiento con su ícono, su signo y su estado (R-110, R-112). La custodia es la apuesta que salió del disponible. */
  var CUST = { juego: ['En juego', 'st-pend', 'retenido', 'candado'], revision: ['En revisión', 'st-pend', 'retenido', 'candado'], ganada: ['Ganada', 'st-ok', 'neutro', 'candado'], perdida: ['Perdida', 'st-mal', 'menos', 'perdida'], devuelta: ['Devuelta', 'st-info', 'neutro', 'candado'] };
  var MOV_IC = { ganancia: ['ganancia', 'mas'], deposito: ['depositar', 'mas'], retiro: ['retirar', 'menos'], devolucion: ['devolucion', 'mas'] };
  function movFila(m) {
    var icono, colorIc, val, cls, st, stCls, txt = m.txt, extra = '';
    if (m.t === 'custodia') {
      var c = CUST[m.est] || CUST.juego, abierta = m.est === 'juego' || m.est === 'revision';
      txt = (m.torneo ? 'Inscripción' : 'Apuesta') + (abierta ? ' en custodia' : '');
      icono = c[3]; colorIc = c[2]; val = plata(-m.v); cls = c[2]; st = c[0]; stCls = c[1];
    } else {
      var d = MOV_IC[m.t]; icono = d[0]; colorIc = d[1]; st = m.st;
      if (m.mal) { val = '<s>' + plata(m.v) + '</s>'; cls = 'apagado'; stCls = 'st-mal'; colorIc = 'apagado'; }
      else if (m.pend) { val = plata(m.v); cls = 'apagado'; stCls = 'st-pend'; colorIc = 'apagado'; extra = '<span class="vh"> sin acreditar</span>'; }
      else { val = (m.v >= 0 ? '+' : '') + plata(m.v); cls = d[1]; stCls = m.t === 'retiro' && /solicitado/i.test(st) ? 'st-pend' : 'st-ok'; }
    }
    return '<div class="mov"><span class="mi ' + colorIc + '">' + ic(icono) + '</span><div class="mt"><b>' + esc(txt) + '</b><small>' + esc(m.det) + '</small></div><div class="mv"><b class="' + cls + '">' + val + extra + '</b><small class="' + stCls + '">' + esc(st) + '</small></div></div>';
  }
  function vBilletera() {
    var bloqueo = S.cDuelo > 0 || S.fase === 'esperando';
    return '<div><h1 class="titulo-pant">Billetera</h1><p class="bajada">Tu plata en VIP Royale, en tiempo real</p></div>' +
      '<div class="dos-col"><div class="col"><section class="tarjeta billetera" aria-label="Saldo"><div class="bill-cab"><h3>Disponible</h3><span class="en-vivo">En tiempo real</span></div>' +
      '<div class="saldo-grande"><span>$</span><b class="num">' + sinSigno(S.disp) + '</b><small>para jugar o retirar</small></div>' +
      '<div class="datos"><div class="dato"><small>En juego</small><b class="num">' + plata(enJuegoTotal()) + '</b></div><div class="dato"><small>Resultado de hoy</small>' + resultadoHoy() + '</div></div>' +
      '<div class="bill-acc"><button class="btn btn-violeta" data-acc="depositar">' + ic('depositar') + 'Depositar</button><button class="btn btn-linea" data-acc="retirar">' + ic('retirar') + 'Retirar</button></div></section>' +
      (bloqueo ? '<div class="nota clara">' + ic('candado') + '<span>Tenés ' + plata(S.cDuelo) + ' en tu duelo o tu mesa. Terminá o cancelá tus duelos activos antes de retirar.</span></div>' : '') +
      (S.cRevision ? '<div class="nota clara">' + ic('reloj') + '<span>' + plata(S.cRevision) + ' en revisión: tu duelo con Vikinga22. Sigue en custodia hasta que lo resolvamos (hasta 72 h) y no te traba la cuenta.</span></div>' : '') +
      '<div class="nota">' + ic('escudo') + '<span>Cargás por transferencia bancaria y retirás a una cuenta a tu nombre. Mínimo de carga y de retiro: $2.000. Resultado de hoy es lo que ganaste menos lo que perdiste en los duelos que se cerraron hoy.</span></div></div>' +
      '<div class="col"><h2 class="sec">Movimientos</h2><div class="lista">' + MOVS.slice(0, 14).map(movFila).join('') + '</div></div></div>' + pie();
  }
  function vNotis() {
    var prefs = [['Duelos y resultados', 'Se unieron a tu mesa, resultado, revancha', true, true], ['Billetera', 'Carga acreditada o rechazada, retiro pagado', true, true], ['Ranking y torneos', 'Cierre de semana, ronda por vencer', true, false], ['Recordatorio diario', 'Un aviso por día como máximo', false, false]];
    return '<div class="rk-cab"><div><h1 class="titulo-pant">Notificaciones</h1><p class="bajada">Avisos de tus duelos y tu billetera</p></div>' + (NOTIS.some(function (n) { return n.nueva; }) ? '<button class="atajo" data-acc="leidas">Marcar leídas</button>' : '') + '</div>' +
      '<div class="dos-col"><div class="col"><div class="lista">' + NOTIS.map(function (n) {
        return '<div class="noti"><span class="mi">' + ic(n.ic) + '</span><div><b>' + esc(n.t) + '</b><p>' + esc(n.p) + '</p><time>' + n.f + '</time></div>' + (n.nueva ? '<span class="nueva" aria-label="Nueva"></span>' : '<span></span>') + '</div>';
      }).join('') + '</div></div>' +
      '<div class="col"><h2 class="sec">Qué avisos querés recibir</h2><div class="lista">' + prefs.map(function (p, i) {
        return '<label class="pref" for="pref-' + i + '"><span><b>' + p[0] + '</b><small>' + p[1] + (p[3] ? ' · recomendado' : '') + '</small></span><input class="interruptor" type="checkbox" id="pref-' + i + '"' + (p[2] ? ' checked' : '') + '></label>';
      }).join('') + '</div><p class="rk-nota">Nunca mandamos datos personales en un aviso. Si pausás tu cuenta, dejan de llegar los avisos que no sean de tu plata.</p></div></div>' + pie();
  }
  function vHistorial() {
    var f = S.histFiltro;
    var lista = HIST.filter(function (h) { return f === 'todos' || (f === 'g' && h.r === 'g') || (f === 'p' && h.r === 'p') || (f === 'e' && h.r === 'e') || (f === 'otros' && h.r.length > 1); });
    var etq = { g: ['g', 'G', 'Ganaste'], p: ['p', 'P', 'Perdiste'], e: ['e', 'E', 'Empate'], dev: ['e', '—', 'Devuelto'], rev: ['r', '…', 'En revisión'] };
    return '<div><h1 class="titulo-pant">Historial</h1><p class="bajada">' + pl(HIST.length, 'duelo', 'duelos') + ' · El resultado sale del historial oficial</p></div>' +
      '<div class="chips" role="group" aria-label="Filtrar">' + [['todos', 'Todos'], ['g', 'Ganados'], ['p', 'Perdidos'], ['e', 'Empates'], ['otros', 'Devueltos y en revisión']].map(function (c) { return '<button class="chip' + (f === c[0] ? ' on' : '') + '" data-acc="hist-f" data-v="' + c[0] + '" aria-pressed="' + (f === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      '<div class="lista">' + (lista.length ? lista.map(function (h) {
        var e = etq[h.r], j = J[h.j], val, sub;
        /* Todas las filas en neto: lo que ganaste o perdiste en ese duelo. El cobro y la apuesta van como dato chico. */
        var dos = function (a, b) { return '<span>' + a + '</span>' + (b ? ' · <span>' + b + '</span>' : ''); };
        if (h.r === 'g') { val = '<b class="mas">+' + plata(premio(h.ap) - h.ap) + '</b>'; sub = dos('Cobraste ' + plata(premio(h.ap)), 'apostaste ' + plata(h.ap)); }
        else if (h.r === 'p') { val = '<b class="menos">' + plata(-h.ap) + '</b>'; sub = dos('Apostaste ' + plata(h.ap)); }
        else if (h.r === 'e') { val = '<b>' + plata(0) + '</b>'; sub = dos('Te devolvimos ' + plata(h.ap), 'sin comisión'); }
        else if (h.r === 'dev') { val = '<b>' + plata(0) + '</b>'; sub = dos('Venció sin partida', 'te devolvimos ' + plata(h.ap)); }
        else { val = '<b class="retenido">' + plata(h.ap) + '</b>'; sub = dos('En custodia', 'hasta 72 h'); }
        return '<button class="hist" data-acc="hist-ver" data-i="' + HIST.indexOf(h) + '" aria-label="' + e[2] + ' contra ' + esc(j.n) + ', ' + h.f + '"><span class="res ' + e[0] + '">' + (h.c ? h.c[0] + '-' + h.c[1] : e[1]) + '<small>' + (h.c ? 'CORONAS' : '') + '</small></span><span class="ht"><b>' + e[2] + ' vs ' + esc(j.n) + '</b><small>' + sub + '</small></span><span class="hv">' + val + '<small>' + h.f + '</small></span></button>';
      }).join('') : '<div class="vacio"><b>Sin duelos en este filtro</b>Probá con otro.</div>') + '</div>' +
      '<p class="rk-nota">Si hubo un problema con un duelo, tocalo: tenés 48 horas para reclamar.</p>' + pie();
  }
  function lugares(t) { var n = t.cupo - t.anot - (S.inscripto[t.id] ? 1 : 0); return n; }
  function pozoTorneo(t) { var b = t.cupo * t.insc; return b - Math.floor(b * FEE_BPS / 10000); }
  function vTorneos() {
    var tab = S.torneoTab;
    var abiertos = TORNEOS.map(function (t) {
      var lib = lugares(t), ins = S.inscripto[t.id];
      return '<article class="torneo"><div class="torneo-top"><img src="assets/copa.webp" alt="" width="440" height="543" decoding="async"><div><h3>' + esc(t.n) + '</h3><p>' + t.cierra + ' · ' + t.ventana + '</p></div></div>' +
        '<div class="cupos" aria-hidden="true">' + Array.from({ length: t.cupo }, function (_, i) { return '<i class="' + (i < t.cupo - lib ? 'lleno' : '') + '"></i>'; }).join('') + '</div>' +
        '<div class="torneo-datos"><div><small>Inscripción</small><b class="num">' + plata(t.insc) + '</b></div><div><small>Cupo</small><b>' + t.cupo + '</b></div><div><small>Pozo</small><b class="oro num">' + plata(pozoTorneo(t)) + '</b></div></div>' +
        '<div class="torneo-pie"><span>' + (lib ? pl(lib, 'lugar libre', 'lugares libres') : 'Completo') + ' · ' + (t.rep === 'todo' ? 'El campeón se lleva todo' : '70% y 30%') + '</span>' + (ins ? '<button class="btn btn-rojo" style="min-height:44px;font-size:13px;letter-spacing:.08em;padding:0 14px" data-acc="baja-torneo" data-id="' + t.id + '">Darme de baja</button>' : '<button class="btn btn-oro" style="min-height:46px;font-size:13.5px;padding:0 16px" data-acc="inscribirme" data-id="' + t.id + '"' + (lib ? '' : ' disabled') + '>Inscribirme</button>') + '</div></article>';
    }).join('');
    var cruce = function (a, ca, b, cb, yo) {
      var ga = ca > cb, gb = cb > ca;
      return '<div class="cruce"><div class="' + (ga ? 'gana' : '') + (yo === 'a' ? ' yo' : '') + '"><span>' + a + '</span><b>' + (ca == null ? '' : ca) + '</b></div><div class="' + (gb ? 'gana' : '') + (yo === 'b' ? ' yo' : '') + '"><span>' + b + '</span><b>' + (cb == null ? '' : cb) + '</b></div></div>';
    };
    var enJuego = '<article class="torneo"><div class="torneo-top"><img src="assets/copa.webp" alt="" width="440" height="543"><div><h3>Copa del martes</h3><p>Semifinal en juego · Ronda hasta las 21:30</p></div></div>' +
      '<div class="torneo-datos"><div><small>Inscripción</small><b class="num">' + plata(100000) + '</b></div><div><small>Cupo</small><b>8</b></div><div><small>Pozo</small><b class="oro num">' + plata(760000) + '</b></div></div></article>' +
      '<h2 class="sec">Tu llave</h2><div class="llave"><div class="ronda"><h4>Cuartos</h4>' + cruce(esc(S.usuario), 3, 'Rulo_Max', 1, 'a') + cruce('Lobo_Sur', 2, 'TanoGol', 0) + cruce('chispa.ar', 1, 'Vikinga22', 2) + cruce('ZurdoFino', 3, 'flaco.rapido', 2) + '</div>' +
      '<div class="ronda"><h4>Semis</h4>' + cruce(esc(S.usuario), null, 'Lobo_Sur', null, 'a') + cruce('Vikinga22', null, 'ZurdoFino', null) + '</div><div class="ronda"><h4>Final</h4>' + cruce('—', null, '—', null) + '</div></div>' +
      '<div class="nota">' + ic('reloj') + '<span>Cuando estés por jugar tu cruce, tocá «Estoy listo». Si tu rival no aparece y vos sí, avanzás sin jugar.</span></div>' +
      '<a class="btn btn-violeta btn-ancho" href="#duelo">Ir a mi cruce</a>';
    var terminados = '<div class="lista">' + [['Copa del lunes', 'Campeón: nocturna_9', '4 jugadores · 3 cruces verificados'], ['Llave rápida', 'Campeón: ZurdoFino', '4 jugadores · 3 cruces verificados'], ['Copa del domingo', 'Campeón: Vikinga22', '8 jugadores · 7 cruces verificados']].map(function (x) { return '<div class="mov"><span class="mi">' + ic('trofeo') + '</span><div class="mt"><b>' + x[0] + '</b><small>' + x[1] + ' · ' + x[2] + '</small></div><div class="mv"><small class="st-info">Terminado</small></div></div>'; }).join('') + '</div>';
    return '<div class="mesas-cab"><div><h1>Torneos</h1><p>' + pl(TORNEOS.length, 'torneo abierto', 'torneos abiertos') + '</p></div><button class="btn btn-violeta" data-acc="crear-torneo">' + ic('mas') + 'Crear torneo</button></div>' +
      '<div class="chips" role="group" aria-label="Estado">' + [['abiertos', 'Abiertos'], ['juego', 'En juego'], ['terminados', 'Terminados']].map(function (c) { return '<button class="chip' + (tab === c[0] ? ' on' : '') + '" data-acc="torneo-tab" data-v="' + c[0] + '" aria-pressed="' + (tab === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      (tab === 'abiertos' ? '<div class="mesas-lista dos">' + abiertos + '</div><p class="rk-nota">La inscripción queda en custodia. Podés darte de baja mientras no esté completo y te devolvemos todo. Si no se llena a tiempo, se cancela sin cargo.</p>' : tab === 'juego' ? enJuego : terminados) + pie();
  }
  function normalizarTag(txt) {
    var t = String(txt || '').trim(), m = t.match(/[?&]tag=([#%0-9A-Za-z]+)/);
    if (m) t = decodeURIComponent(m[1]);
    else if (/^https?:/i.test(t)) return '';
    t = t.toUpperCase().replace(/O/g, '0').replace(/^#/, '');
    if (!/^[0289PYLQGRJCUV]{3,14}$/.test(t)) return '';
    return '#' + t;
  }
  function vVincular() {
    var v = S.vinc;
    var pasos = '<div class="vinc-pasos" aria-label="Paso ' + v.paso + ' de 3">' + [['Pegá tu link', 1], ['Verificá que sos vos', 2], ['Listo', 3]].map(function (p) { return '<div class="vp ' + (v.paso === p[1] ? 'on' : v.paso > p[1] ? 'ok' : '') + '"><i>' + (v.paso > p[1] ? SV + I.check + '</svg>' : p[1]) + '</i>' + p[0] + '</div>'; }).join('') + '</div>';
    var cuerpo;
    if (v.paso === 1) {
      cuerpo = '<section class="tarjeta" style="padding:18px 16px"><h2 class="sec" style="margin-bottom:14px">Cómo sacar tu enlace</h2><div class="pasos-n"><div class="paso-n"><span>Abrí Clash Royale y tocá <b>Social</b>.</span></div><div class="paso-n"><span>Tocá <b>«+ Añadir amigos»</b>.</span></div><div class="paso-n"><span>Tocá <b>«Enviar enlace»</b>.</span></div><div class="paso-n"><span>Copiá el enlace y pegalo acá abajo.</span></div></div></section>' +
        '<form class="tarjeta" style="padding:18px 16px;display:grid;gap:14px" data-form="vincular" novalidate><div class="campo"><label for="v-link">Tu enlace de invitación o tu #tag</label><input class="input' + (v.error ? ' mal' : '') + '" id="v-link" value="' + esc(v.valor) + '" placeholder="Pegá el enlace o escribí tu #tag" autocomplete="off" autocapitalize="characters" spellcheck="false">' + (v.error ? '<span class="error" role="alert">' + v.error + '</span>' : '<span class="ayuda">Solo guardamos tu tag. Un tag se vincula a una sola cuenta.</span>') + '</div>' +
        '<button type="button" class="atajo" style="justify-self:start" data-acc="ejemplo-link">Usar un enlace de ejemplo</button><button class="btn btn-violeta btn-ancho">Buscar mi cuenta</button></form>';
    } else if (v.paso === 2) {
      cuerpo = '<section class="sos-vos"><span style="display:inline-block">' + miAvatar() + '</span><h2>' + esc(S.usuario) + '</h2><p class="tag">' + esc(S.tag) + '</p><div class="tres"><div><small>Trofeos</small><b class="num">' + miles(S.trofeos) + '</b></div><div><small>Arena</small><b>' + esc(S.arena) + '</b></div><div><small>Clan</small><b>' + esc(S.clan) + '</b></div></div><p class="preg">¿Sos vos?</p><div class="acc"><button class="btn btn-violeta" data-acc="vinc-si">Sí, soy yo</button><button class="btn btn-neutro" data-acc="vinc-no">No, corregir el link</button></div></section>';
    } else {
      cuerpo = '<section class="sos-vos"><span style="display:inline-grid;place-items:center;width:76px;height:76px;border-radius:50%;background:var(--verde-velo);box-shadow:inset 0 0 0 2px var(--verde);color:var(--verde);font-size:34px">' + ic('check') + '</span><h2>Listo</h2><p class="tag">Tu cuenta de Clash quedó vinculada: ' + esc(S.tag) + '</p><p style="margin-top:14px;font-size:14.5px;color:#EBDCFF">Antes de tu primera carga te pedimos una prueba rápida: jugar una batalla con una carta que te indiquemos, para confirmar que la cuenta es tuya.</p><div class="acc"><a class="btn btn-violeta" href="#inicio">Ir al inicio</a></div></section>';
    }
    return '<div><h1 class="titulo-pant">Vinculá tu Clash</h1><p class="bajada">Así sabemos qué historial leer en cada duelo</p></div>' + pasos + '<div class="dos-col" style="display:grid;gap:16px">' + cuerpo + '</div>' + pie();
  }
  /* Objetos propios que caen despacio detrás del formulario: las medias fichas de los dos lados, la V y destellos dorados.
     Caen sólo por los márgenes (nada tapa el logo, la bajada, el formulario ni el pie): 10 en celular y 14 en computadora.
     [x en celular, x en computadora, duración, demora, tipo, escala] */
  var CAEN = [[1, 6, 19, -2, 'c', 1], [93, 90, 23, -11, 'r', 1], [3, 20, 21, -6, 'e', .9], [94, 76, 26, -16, 'v', 1], [0, 12, 20, -9, 'r', .9], [95, 94, 24, -4, 'c', .9], [2, 28, 22, -14, 'v', .9], [92, 70, 25, -19, 'e', 1], [1, 3, 27, -13, 'e', .8], [94, 84, 18, -7, 'r', .85], [0, 24, 24, -21, 'c', .85], [0, 9, 22, -17, 'v', .8], [0, 79, 28, -1, 'c', .9], [0, 92, 20, -24, 'e', .8]];
  function caen() {
    return '<div class="cae" aria-hidden="true">' + CAEN.map(function (c) {
      var t = c[4], obj = t === 'e' ? '<svg viewBox="0 0 20 20"><path d="M10 1l1.6 7.4L19 10l-7.4 1.6L10 19l-1.6-7.4L1 10l7.4-1.6z" fill="url(#g-oro)"/></svg>' :
        t === 'v' ? emblema('') : '<img src="assets/media-' + (t === 'c' ? 'cian' : 'roja') + '.webp" alt="" width="284" height="480">';
      return '<i class="t-' + t + '" style="--x:' + c[0] + '%;--xp:' + c[1] + '%;--d:' + c[2] + 's;--del:' + c[3] + 's;--s:' + c[5] + '"><span>' + obj + '</span></i>';
    }).join('') + '</div>';
  }
  function vIngreso() {
    var forzar = /(?:^|[?&])intro=1(?:&|$)/.test(location.search) && !vIngreso.vista;
    var verIntro = !quieto() && (forzar || !sesion('intro'));
    vIngreso.vista = true;
    var crear = S.ingreso === 'crear';
    var form = crear ?
      '<form data-form="registro" novalidate>' +
      campo('r-user', 'Nombre de usuario', 'text', 'De 3 a 20 letras, números o guion bajo', 'username') +
      campo('r-mail', 'Email', 'email', '', 'email') +
      campo('r-pass', 'Contraseña', 'password', '8 caracteres o más', 'new-password') +
      campo('r-nac', 'Fecha de nacimiento', 'date', 'Tenés que ser mayor de 18', 'bday') +
      '<label class="check"><input type="checkbox" id="r-18"><span>Tengo 18 años o más y acepto los Términos y la Política de privacidad.</span></label><span class="error" id="r-err" role="alert"></span>' +
      '<button class="btn btn-violeta btn-ancho">Crear cuenta</button></form>' :
      '<form data-form="ingreso" novalidate>' + campo('i-mail', 'Email', 'email', '', 'email') + campo('i-pass', 'Contraseña', 'password', '', 'current-password') +
      '<a class="olvide" href="#ingreso" data-acc="olvide">Olvidé mi contraseña</a><span class="error" id="i-err" role="alert"></span><button class="btn btn-violeta btn-ancho">Ingresar</button></form>';
    return '<div class="ingreso' + (verIntro ? ' en-intro' : ' sin-intro') + '">' + (quieto() ? '' : caen()) +
      '<div class="ing-logo" id="ing-logo">' + emblemaGrande() + marca() + '<span class="vh">VIP Royale</span></div>' +
      '<p class="ing-bajada form-entra">Amistosas 1v1 de Clash Royale por monto. El ganador lo decide la API.</p>' +
      '<div class="ing-form form-entra"><div class="segm violeta" role="group" aria-label="Elegí"><button data-acc="ing-modo" data-v="entrar" class="' + (crear ? '' : 'on') + '" aria-pressed="' + !crear + '">Ingresar</button><button data-acc="ing-modo" data-v="crear" class="' + (crear ? 'on' : '') + '" aria-pressed="' + crear + '">Crear cuenta</button></div>' + form + '</div>' +
      '<div class="ing-pie form-entra">' + pie() + '</div></div>' +
      (verIntro ? '<div class="intro" data-acc="saltar-intro" aria-hidden="true"><span class="luz-intro"></span><img class="ficha-i a" src="assets/media-cian.webp" alt="" width="284" height="480"><img class="ficha-i b" src="assets/media-roja.webp" alt="" width="284" height="480"><span class="flash"></span><small>Tocá para saltear</small></div>' : '');
  }
  function campo(id, label, tipo, ayuda, ac) {
    return '<div class="campo"><label for="' + id + '">' + label + '</label><input class="input" id="' + id + '" type="' + tipo + '" autocomplete="' + ac + '"' + (tipo === 'email' ? ' inputmode="email"' : '') + '>' + (ayuda ? '<span class="ayuda">' + ayuda + '</span>' : '') + '</div>';
  }

  /* ------------------------------------------------------------------
     Sala del duelo (equivalente a la mesa de juego de la plataforma de referencia)
     ------------------------------------------------------------------ */
  function jugador(j, yo, estado) {
    var cara = '<div class="cara">' + (yo ? miAvatar() : medalla(j.m)) + '<span class="aro"></span><span class="rol">' + (yo ? 'Vos' : 'Rival') + '</span></div>';
    var info = '<div class="nom">' + esc(yo ? S.usuario : j.n) + '</div><div class="met"><span>' + esc(yo ? S.tag : j.t) + '</span> · <span>' + esc(yo ? S.arena : j.ar) + '</span> · <span>' + miles(yo ? S.trofeos : j.tr) + ' trofeos</span></div>';
    var est = estado ? '<span class="lado-est ' + estado + '" data-lado="' + (yo ? 'yo' : 'rival') + '">' + (estado === 'leido' ? ic('check') + 'Historial leído' : ic('reloj') + 'Leyendo historial…') + '</span>' : '';
    return yo ? '<div class="jugador yo">' + est + info + cara + '</div>' : '<div class="jugador rival">' + cara + info + est + '</div>';
  }
  function vSala(modo) {
    var r = S.rival, ap = S.apuesta, c = CORONAS[modo];
    /* Marcador de coronas en números grandes y blancos; el color del lado va en la palabra y en una raya fina debajo */
    var marc = '<div class="marcador" aria-label="Coronas: vos ' + (c ? c[0] : 'sin jugar') + ', rival ' + (c ? c[1] : 'sin jugar') + '"><span class="lado v">VOS</span><span class="cor v' + (c ? '' : ' sin') + '">' + (c ? c[0] : '0') + '</span><span class="que">' + (c ? 'FINAL' : '1V1') + '</span><span class="cor r' + (c ? '' : ' sin') + '">' + (c ? c[1] : '0') + '</span><span class="lado r">RIVAL</span></div>';
    var centro, pasos = '', botonera;
    if (modo === 'verificando') {
      centro = '<div class="centro verif"><div class="radar">' + emblema('') + '</div><h3>Verificando</h3><p>Consultando el historial oficial de Clash Royale. <span class="api">El ganador lo decide la API, no nosotros.</span></p></div>';
      botonera = '<div class="botonera dos"><a class="btn btn-neutro" href="#inicio">Volver al inicio</a><button class="btn btn-oro-linea" disabled>Buscando la partida</button></div>';
    } else {
      centro = '<div class="centro"><div class="vs' + (S.vsVisto ? '' : ' golpe') + '">' + CHISPA_VS + '<b>VS</b></div><div class="pozo"><small>POZO</small><b class="num">' + plata(pozo(ap)) + '</b><p>Si ganás cobrás ' + plata(premio(ap)) + ' · comisión 5%</p></div></div>';
      /* (el rótulo POZO va en una pastilla oscura: sobre el brillo dorado del VS no llegaba a AA) */
      if (modo === 'duelo') pasos = pasosSala(r);
      botonera = '<div class="botonera"><button class="btn ' + (modo === 'duelo' && !S.amistad ? 'btn-linea' : 'btn-violeta') + '" data-acc="abrir-clash" aria-label="Abrir Clash Royale y jugar la amistosa"><span class="b-larga">Abrir Clash Royale</span><span class="b-corta">Abrir Clash</span><small>y jugar la amistosa</small></button><button class="btn btn-oro-linea" data-acc="ya-jugamos" aria-label="Ya jugamos, ver resultado">Ya jugamos<small>ver resultado</small></button><button class="btn btn-neutro" data-acc="pedir-cancelar"' + (S.cancelPedido ? ' disabled' : '') + '>' + (S.cancelPedido ? 'Pedido' : 'Cancelar') + '</button></div>';
    }
    var est = modo === 'verificando';
    var resto = Math.max(0, 3600000 - (Date.now() - (S.inicioDuelo || Date.now())));
    return '<div class="sala' + (RES.indexOf(modo) >= 0 ? ' desenfoca' : '') + '" id="sala">' +
      '<div class="sala-top"><a class="icono" href="#inicio" aria-label="Volver al inicio">' + ic('volver') + '</a><button class="icono info" data-acc="info-sala" aria-label="Cómo se juega">INFO</button>' + marc +
      '<button class="icono" data-acc="sonido" aria-label="' + (S.sonido ? 'Silenciar' : 'Activar sonido') + '">' + ic(S.sonido ? 'sonido' : 'mudo') + '</button><button class="icono" data-acc="chat-sala" aria-label="Chat de la sala" aria-expanded="' + (S.panel ? 'true' : 'false') + '">' + ic('chat') + '<span class="punto" hidden></span></button></div>' +
      '<div class="reloj" aria-label="Tiempo para jugar"><small>Vence en</small><b class="num" id="reloj-txt">' + mmss(resto) + '</b><i style="--resta:' + (resto / 36000) + '%"></i></div>' +
      '<button class="icono paleta" data-acc="temas-sala" aria-label="Cambiar el tema de la sala">' + ic('paleta') + '</button>' +
      '<div class="sala-zona' + (pasos ? '' : ' sin-pasos') + '"><div class="mesa-duelo"><span class="filete"></span><div class="pano"><span class="lado-luz r" aria-hidden="true"></span><span class="lado-luz v" aria-hidden="true"></span><span class="costura"></span><div class="pano-in' + (pasos ? (S.amistad ? '' : ' mano-alta') : ' sin-mano') + '">' +
      jugador(r, false, est ? 'leyendo' : '') + centro + jugador(null, true, est ? 'leyendo' : '') +
      '</div></div></div>' + pasos + '</div>' + botonera + (RES.indexOf(modo) >= 0 ? cajaResultado(modo) : '') + '</div>';
  }
  /* Los pasos de la sala. Sin amistad (R-081): el paso 1 abierto con «Abrir link de invitación» y «Ya lo agregué».
     Con amistad (R-080): el paso 1 tildado y el 2 abierto. En teléfonos bajos se pliegan a una línea que se abre al tocarla. */
  function pasosSala(r) {
    var n = esc(r.n), ok = S.amistad;
    var p1 = ok ? '<div class="paso ok"><i>' + ic('check') + '</i><div><b>Ustedes ya son amigos en Clash Royale</b><br><a href="#duelo" data-acc="agregar">¿No te aparece en amigos? Agregalo acá</a></div></div>' :
      '<div class="paso act"><i>1</i><div class="paso-txt"><p><b>Primero agregá a ' + n + ' como amigo en Clash Royale.</b> La amistad es obligatoria para poder jugar la amistosa.</p><div class="paso-acc"><button class="btn btn-violeta" data-acc="invitacion" aria-label="Abrir link de invitación de ' + n + '">Abrir link de invitación</button><button class="btn btn-linea" data-acc="ya-agregue">Ya lo agregué</button></div></div></div>';
    var p2 = ok ? '<div class="paso act"><i>2</i><div>Jugá una <b>batalla amistosa 1v1</b> contra ' + n + '.<span class="rojo">No uses un torneo ni el campo de entrenamiento</span></div></div>' :
      '<div class="paso pend"><i>2</i><div>Después, la batalla amistosa 1v1 contra ' + n + '.</div></div>';
    var resumen = ok ? '<b>Paso 2 de 2</b> · Jugá una amistosa 1v1' : '<b>Paso 1 de 2</b> · Agregá a ' + n + ' como amigo';
    return '<div class="pasos' + (S.pasosAbiertos ? ' abierto' : '') + (ok ? '' : ' falta') + '" id="pasos"><button class="pasos-resumen" data-acc="pasos" aria-expanded="' + S.pasosAbiertos + '" aria-controls="pasos-det"><i>' + (ok ? '2' : '1') + '</i><span>' + resumen + '</span>' + ic('flecha', 'pasos-fl') + '</button><div class="pasos-det" id="pasos-det">' + p1 + p2 + '</div></div>';
  }
  function mmss(ms) { var s = Math.ceil(ms / 1000), m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  var corLabel = function (n) { return n === 1 ? 'CORONA' : 'CORONAS'; };
  function cajaResultado(modo) {
    var ap = S.apuesta, c = CORONAS[modo], r = S.rival;
    var lado = function (yo) {
      var gana = modo === 'ganaste' ? yo : modo === 'perdiste' ? !yo : false;
      return '<div class="lad ' + (gana ? 'gana' : modo === 'empate' ? 'igual' : '') + '">' + (yo ? miAvatar('vos-aro') : medalla(r.m, 'rival-aro')) + '<span class="q">' + esc(yo ? 'Vos' : r.n) + '</span><span class="coronas num" data-v="' + (yo ? c[0] : c[1]) + '">' + (yo ? c[0] : c[1]) + '</span><span class="cl">' + corLabel(yo ? c[0] : c[1]) + '</span></div>';
    };
    var titulo, ficha, texto, extra = '';
    if (modo === 'ganaste') {
      titulo = '<img src="assets/copa.webp" alt="" width="440" height="543" style="width:74px;margin:-62px auto 4px;filter:drop-shadow(0 8px 12px rgba(0,0,0,.6))"><h2>¡Ganaste!</h2>';
      ficha = '<span class="ficha-res num">+' + plata(premio(ap)) + ' para vos</span>';
      texto = '<p>Ya lo tenés en tu billetera.</p>';
      extra = '<div class="desglose"><div><span>Apuesta</span><b class="num">' + plata(ap) + '</b></div><div><span>Pozo</span><b class="num">' + plata(pozo(ap)) + '</b></div><div><span>Comisión (5%)</span><b class="num">' + plata(-comision(ap)) + '</b></div><div class="cobra"><span>Cobraste (95% del pozo)</span><b class="num">' + plata(premio(ap)) + '</b></div></div>';
    } else if (modo === 'perdiste') {
      titulo = '<h2 class="blanco">Perdiste</h2>';
      ficha = '<span class="ficha-res menos num">' + plata(-ap) + '</span>';
      texto = '<p>El ganador lo decidió la API oficial. Revancha cuando quieras.</p>';
    } else {
      titulo = '<h2 class="blanco">Empate</h2>';
      ficha = '<span class="ficha-res devuelta num">Te devolvimos ' + plata(ap) + '</span>';
      texto = '<p>Empate — te devolvimos tu apuesta completa. <em>Sin comisión.</em></p>';
    }
    return '<div class="caja-capa' + (modo === 'ganaste' ? ' con-copa' : '') + '"><section class="caja" role="dialog" aria-modal="false" aria-labelledby="res-tit" id="caja-res"><div id="res-tit">' + titulo + '</div>' +
      '<div class="lados">' + lado(true) + lado(false) + '</div><div class="caja-pie">' + ficha + '<span class="marc">Vos ' + c[0] + ' a ' + c[1] + ' Rival</span></div>' + extra + texto +
      '<div class="acc"><button class="btn btn-violeta" data-acc="revancha">Revancha</button><a class="btn btn-linea" href="#historial">Ver historial</a></div><a class="volver" href="#inicio">Volver al inicio</a></section></div>';
  }
  function cajaConfirmar() {
    var s = $('#sala'); if (!s || $('#caja-cancelar')) return;
    s.classList.add('desenfoca');
    var capa = document.createElement('div');
    capa.className = 'caja-capa'; capa.id = 'caja-cancelar'; capa.dataset.acc = 'seguir-duelo';
    capa.innerHTML = '<section class="caja" role="alertdialog" aria-modal="true" aria-labelledby="cc-t" aria-describedby="cc-d" data-acc="nada"><h2 id="cc-t">¿Pedís cancelar?</h2><p id="cc-d">Solo se devuelve si <em>los dos</em> lo piden y no jugaron. Antes de devolver revisamos el historial una vez más.</p><div class="dos"><button class="btn btn-oro" data-acc="seguir-duelo">Seguir</button><button class="btn btn-rojo" data-acc="confirmar-cancelar">Pedir cancelar</button></div></section>';
    s.appendChild(capa);
    $('.btn-oro', capa).focus();
  }
  function cerrarCaja() { var c = $('#caja-cancelar'); if (c) c.remove(); var s = $('#sala'); if (s && RES.indexOf(ruta) < 0) s.classList.remove('desenfoca'); }

  /* Chat de la sala: Todo (estados del duelo, solo para leer), Chat (80 caracteres) y Frases */
  function pintarPanel() {
    var s = $('#sala'); if (!s) return;
    var p = $('#panel-chat');
    if (!S.panel) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('section'); p.className = 'panel-chat'; p.id = 'panel-chat'; p.setAttribute('aria-label', 'Chat de la sala'); s.appendChild(p); }
    var tab = S.panelTab, cuerpo;
    if (tab === 'todo') cuerpo = '<div class="log">' + (S.log || []).map(function (l) { return l.k === 'p' ? '<span class="past">' + esc(l.t) + '</span>' : '<p><span>' + esc(l.q) + '</span><em>' + esc(l.t) + '</em></p>'; }).join('') + '</div>';
    else if (tab === 'chat') cuerpo = '<div class="pmsj">' + (S.chat || []).map(function (m) { return '<div class="pm' + (m.yo ? ' yo' : '') + '"><small>' + (m.yo ? 'Vos' : esc(S.rival.n)) + '</small>' + esc(m.m) + '</div>'; }).join('') + '</div>';
    else cuerpo = '<div class="frases">' + FRASES.map(function (f) { return '<button data-acc="frase" data-v="' + esc(f) + '">' + esc(f) + '</button>'; }).join('') + '</div>';
    p.innerHTML = '<div class="panel-tabs" role="tablist">' + [['todo', 'Todo'], ['chat', 'Chat'], ['frases', 'Frases']].map(function (t) { return '<button role="tab" aria-selected="' + (tab === t[0]) + '" class="' + (tab === t[0] ? 'on' : '') + '" data-acc="panel-tab" data-v="' + t[0] + '">' + t[1] + (t[0] === 'chat' && S.chatNuevo && tab !== 'chat' ? '<span class="punto"></span>' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="panel-cuerpo" id="panel-cuerpo">' + cuerpo + '</div>' +
      (tab === 'chat' ? '<p class="panel-aviso">Este chat queda registrado y lo puede ver moderación. No pases datos de contacto ni de pago.</p><form class="panel-escribir" data-form="chat-sala" autocomplete="off"><label class="vh" for="sala-in">Mensaje</label><input class="input" id="sala-in" maxlength="80" placeholder="Escribí un mensaje" data-in="contar" data-cont="sala-cont"><button class="env" aria-label="Enviar">' + ic('enviar') + '</button><span class="cont" id="sala-cont">0/80</span></form>' : '');
    var pc = $('#panel-cuerpo'); pc.scrollTop = pc.scrollHeight;
    var dot = $('.sala-top [data-acc="chat-sala"] .punto'); if (dot) dot.hidden = !S.chatNuevo;
  }
  /* Globito del mensaje: sale al costado de la medalla, del lado opuesto a la etiqueta, sin tapar el nombre ni el tag.
     Va en la sala (no dentro del paño) para que el óvalo no lo recorte. */
  function burbuja(yo, txt) {
    var sala = $('#sala'), cara = $(yo ? '.jugador.yo .cara' : '.jugador.rival .cara'); if (!sala || !cara) return;
    var rs = sala.getBoundingClientRect(), rc = cara.getBoundingClientRect();
    var b = document.createElement('span'); b.className = 'burbuja costado'; b.textContent = txt;
    b.style.right = (rs.right - rc.left + 12) + 'px'; b.style.top = (rc.top - rs.top + rc.height / 2) + 'px';
    sala.appendChild(b); setTimeout(function () { b.remove(); }, 3300);
  }
  function decirEnSala(txt) {
    S.chat.push({ yo: true, m: txt }); burbuja(true, txt); pintarPanel();
    luego(function () {
      var r = RESP[Math.floor(Math.random() * RESP.length)];
      S.chat.push({ yo: false, m: r }); burbuja(false, r);
      if (S.panelTab !== 'chat' || !S.panel) S.chatNuevo = true;
      pintarPanel();
      var dot = $('.sala-top [data-acc="chat-sala"] .punto'); if (dot) dot.hidden = !S.chatNuevo;
    }, 2400);
  }

  /* ------------------------------------------------------------------
     Hojas que suben
     ------------------------------------------------------------------ */
  var hojaAct = null, focoPrevio = null;
  function hoja(o) {
    var capa = $('#capa');
    focoPrevio = document.activeElement;
    capa.innerHTML = '<div class="velo" data-acc="cerrar-hoja"></div><section class="hoja" role="dialog" aria-modal="true" aria-labelledby="h-tit" id="hoja-' + o.id + '"><div class="hoja-cab"><div><h2 id="h-tit">' + o.titulo + '</h2>' + (o.bajada ? '<p>' + o.bajada + '</p>' : '') + '</div><button class="cerrar" data-acc="cerrar-hoja" aria-label="Cerrar">' + ic('cerrar') + '</button></div><div class="hoja-cuerpo" id="hoja-cuerpo">' + o.cuerpo + '</div>' + (o.pie ? '<div class="hoja-pie" id="hoja-pie">' + o.pie + '</div>' : '') + '</section>';
    capa.hidden = false; hojaAct = o;
    document.documentElement.style.overflow = 'hidden'; if (EN_VISOR) document.body.style.overflow = 'hidden';
    if (o.alAbrir) o.alAbrir($('.hoja', capa));
    var f = $('.hoja .cerrar', capa); if (f) f.focus({ preventScroll: true });
  }
  function cerrarHoja(sinVolver) {
    var capa = $('#capa'); if (capa.hidden) return;
    var o = hojaAct; capa.hidden = true; capa.innerHTML = ''; hojaAct = null;
    document.documentElement.style.overflow = ''; if (EN_VISOR) document.body.style.overflow = '';
    if (o && o.alCerrar && !sinVolver) o.alCerrar();
    if (focoPrevio && document.body.contains(focoPrevio)) focoPrevio.focus({ preventScroll: true });
  }
  function actualizarHoja(cuerpo, pie) { var c = $('#hoja-cuerpo'), p = $('#hoja-pie'); if (c && cuerpo != null) c.innerHTML = cuerpo; if (p && pie != null) p.innerHTML = pie; }

  function desglose(ap, extra) {
    return '<div class="desglose" aria-live="polite"><div><span>Tu apuesta</span><b class="num">' + plata(ap) + '</b></div><div><span>Pozo (las dos apuestas)</span><b class="num">' + plata(pozo(ap)) + '</b></div><div class="cobra"><span>Si ganás cobrás (95%)</span><b class="num">' + plata(premio(ap)) + '</b></div><div><span>Comisión (5%)</span><b class="num">' + plata(comision(ap)) + '</b></div>' + (extra || '') + '</div>';
  }
  /* Crear mesa: tres rápidas y otro monto, abierta o privada, desglose en vivo */
  function hojaCrear(montoIni) {
    var st = { monto: montoIni || 100000, otro: '', privada: false };
    var rapidas = [100000, 250000, 500000];
    if (rapidas.indexOf(st.monto) < 0) { st.otro = sinSigno(st.monto); }
    function cuerpo() {
      var r = st.otro ? leerMonto(st.otro) : { c: st.monto }, err = errorApuesta(r), ap = err ? 0 : r.c;
      return '<div class="campo"><span class="rot">Monto</span><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + rapidas.map(function (m) { return '<button class="chip' + (!st.otro && st.monto === m ? ' on' : '') + '" style="min-height:52px;font:800 19px/1 var(--f-titulo)" data-acc="crear-rapida" data-v="' + m + '" aria-pressed="' + (!st.otro && st.monto === m) + '">' + plata(m) + '</button>'; }).join('') + '</div></div>' +
        '<div class="campo"><label for="otro">Otro monto</label><div class="monto-input"><span>$</span><input class="input' + (st.otro && err ? ' mal' : '') + '" id="otro" inputmode="decimal" placeholder="Entre 100 y 5.000" value="' + esc(st.otro) + '" data-in="crear-otro" autocomplete="off"></div><span class="' + (st.otro && err ? 'error' : 'ayuda') + '" id="otro-msg" role="' + (st.otro && err ? 'alert' : 'note') + '">' + (st.otro && err ? err : 'Pesos enteros. Ejemplo: 1.500') + '</span></div>' +
        '<div class="campo"><span class="rot">Quién puede unirse</span><div class="segm violeta" role="group"><button data-acc="crear-tipo" data-v="0" class="' + (st.privada ? '' : 'on') + '" aria-pressed="' + !st.privada + '">Abierta a todos</button><button data-acc="crear-tipo" data-v="1" class="' + (st.privada ? 'on' : '') + '" aria-pressed="' + st.privada + '">Privada</button></div><span class="ayuda">' + (st.privada ? 'Privada — solo con invitación. No aparece en la lista: compartís un enlace.' : 'Aparece en la lista para todos los jugadores.') + '</span></div>' +
        '<div id="crear-desglose">' + (ap ? desglose(ap) : '<div class="nota roja">' + ic('alerta') + '<span>' + (err || 'Elegí un monto') + '</span></div>') + '</div>' +
        '<div class="nota">' + ic('devolucion') + '<span>Empate o si nadie se une a tiempo, te devolvemos tu apuesta completa. Sin cargo.</span></div>';
    }
    function pieH() {
      var r = st.otro ? leerMonto(st.otro) : { c: st.monto }, err = errorApuesta(r);
      return '<button class="btn btn-violeta" data-acc="crear-ok"' + (err ? ' disabled aria-disabled="true"' : '') + '>' + (err ? 'Crear mesa' : 'Crear mesa por ' + plata(r.c)) + '</button><p class="nota-pie">Tu disponible: ' + plata(S.disp) + '</p>';
    }
    if (S.fase === 'esperando' || enDuelo()) {
      hoja({ id: 'crear', titulo: 'Crear mesa', bajada: 'Una mesa abierta y un duelo por vez', cuerpo: '<div class="nota clara">' + ic('alerta') + '<span>' + (enDuelo() ? 'Terminá tu duelo en curso antes de empezar otro.' : 'Ya tenés una mesa abierta. Para crear otra, primero cancelá la anterior: te devolvemos la apuesta al instante.') + '</span></div>', pie: enDuelo() ? '<a class="btn btn-violeta" href="#duelo">Volver a la sala</a>' : '<button class="btn btn-rojo" data-acc="cancelar-mesa">Cancelar mi mesa</button>', alCerrar: volverDeCrear });
      return;
    }
    hoja({ id: 'crear', titulo: 'Crear mesa', bajada: 'Elegí cuánto apostás. Tu rival pone lo mismo.', cuerpo: cuerpo(), pie: pieH(), alCerrar: volverDeCrear });
    hojaCrear.st = st; hojaCrear.cuerpo = cuerpo; hojaCrear.pie = pieH;
  }
  function volverDeCrear() { if (ruta === 'crear') location.replace('#mesas'); }
  function refrescarCrear(enfocarOtro) {
    var st = hojaCrear.st; if (!st) return;
    var otro = $('#otro'), pos = otro ? otro.selectionStart : 0;
    actualizarHoja(hojaCrear.cuerpo(), hojaCrear.pie());
    if (enfocarOtro) { var o = $('#otro'); o.focus(); try { o.setSelectionRange(pos, pos); } catch (e) { /* nada */ } }
  }
  function crearOk() {
    var st = hojaCrear.st, r = st.otro ? leerMonto(st.otro) : { c: st.monto };
    if (errorApuesta(r)) return;
    congelar(r.c, 'Mesa ' + (st.privada ? 'privada ' : '') + 'creada · ' + hora());
    S.fase = 'esperando';
    S.miMesa = { monto: r.c, privada: st.privada, vence: Date.now() + (st.privada ? 24 * 3600000 : 15 * 60000), link: 'viproyale.test/m/' + 'K7Q2XP' };
    if (st.privada) { hojaLink(true); }
    else { cerrarHoja(true); aviso('Mesa creada · esperando rival'); if (ruta !== 'mesas') location.hash = '#mesas'; else render(); simularRival(); }
    pintarCab();
  }
  function hojaLink(nueva) {
    var m = S.miMesa; if (!m) return;
    hoja({ id: 'link', titulo: nueva ? 'Mesa privada creada' : 'Enlace de tu mesa', bajada: 'Mandale este enlace a tu amigo. Toca, ve el monto y se une.',
      cuerpo: '<div class="desglose"><div><span>Apuesta</span><b class="num">' + plata(m.monto) + '</b></div><div class="cobra"><span>Si ganás cobrás (95%)</span><b class="num">' + plata(premio(m.monto)) + '</b></div></div>' +
        '<div class="campo"><label for="link-m">Enlace de invitación</label><input class="input" id="link-m" readonly value="https://' + m.link + '"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button class="btn btn-linea" data-acc="copiar-link">' + ic('copiar') + 'Copiar</button><button class="btn btn-violeta" data-acc="compartir-link">' + ic('compartir') + 'Compartir</button></div>' +
        '<div class="nota clara">' + ic('candado') + '<span>Tu apuesta de ' + plata(m.monto) + ' está en custodia. El enlace vence en 24 h y podés cancelar la mesa cuando quieras.</span></div>',
      alCerrar: function () { if (ruta === 'crear') location.replace('#mesas'); else render(); } });
  }
  /* El rival de ejemplo se une a los 9 s. Usa su propio temporizador (no el de la pantalla), porque crear la mesa
     cambia de pantalla y cada cambio limpia los temporizadores de la vista. Si la mesa se cancela o cambia, no pasa nada. */
  var timerRival = null;
  function simularRival() {
    clearTimeout(timerRival);
    var mesa = S.miMesa; if (!mesa || mesa.privada) return;
    timerRival = setTimeout(function () {
      timerRival = null;
      if (S.fase !== 'esperando' || S.miMesa !== mesa) return;
      var rv = mesa.revancha ? S.rival : J[14];
      nuevoDuelo(rv, mesa.monto, mesa.revancha ? 'revancha' : 'mesa');
      if (location.hash === '#duelo') render(); else location.hash = '#duelo';
      /* En la sala el aviso va arriba, debajo del marcador: nunca encima de los pasos ni de la botonera */
      setTimeout(function () { aviso(mesa.revancha ? rv.n + ' aceptó la revancha' : '¡Emparejados! A jugar la amistosa'); }, 80);
    }, 9000);
  }
  /* Unirse: arena y trofeos del rival antes de unirse, desglose y confirmación */
  function hojaUnirse(id) {
    var m = MESAS.filter(function (x) { return x.id === id; })[0]; if (!m) return;
    var j = J[m.c], err = '';
    if (enDuelo()) err = 'Terminá tu duelo en curso antes de empezar otro.';
    else if (m.monto > S.disp + (S.fase === 'esperando' && S.miMesa ? S.miMesa.monto : 0)) err = 'Saldo insuficiente para unirte a esta mesa.';
    var cancela = S.fase === 'esperando' && S.miMesa;
    hoja({ id: 'unirse', titulo: 'Unirse a la mesa', bajada: 'Mirá contra quién jugás antes de confirmar',
      cuerpo: '<div style="display:flex;align-items:center;gap:14px;padding:14px;border-radius:14px;background:rgba(240,52,74,.08);box-shadow:inset 0 0 0 1px rgba(255,77,94,.35)">' + medalla(j.m) + '<div><b style="font-size:18px">' + esc(j.n) + '</b><div style="margin-top:3px;font-size:14px;color:var(--tx-2)">' + esc(j.t) + ' · ' + esc(j.ar) + ' · ' + miles(j.tr) + ' trofeos</div></div></div>' +
        desglose(m.monto) +
        (cancela ? '<div class="nota clara">' + ic('alerta') + '<span>Unirte cancela tu mesa abierta y te devolvemos su apuesta de ' + plata(S.miMesa.monto) + ' en la misma operación.</span></div>' : '') +
        '<div class="nota">' + ic('devolucion') + '<span>Empate o si no juegan a tiempo, te devolvemos tu apuesta completa. Sin cargo.</span></div>' +
        '<div class="nota">' + ic('alerta') + '<span>En la amistosa se igualan los niveles, pero no las cartas desbloqueadas.</span></div>' +
        (err ? '<div class="nota roja" role="alert">' + ic('alerta') + '<span>' + err + '</span></div>' : ''),
      pie: '<button class="btn btn-oro brilla" data-acc="unirse-ok" data-id="' + id + '"' + (err ? ' disabled aria-disabled="true"' : '') + '>Unirse por ' + plata(m.monto) + '</button><p class="nota-pie">Tu disponible: ' + plata(S.disp) + '</p>' });
  }
  function unirseOk(id) {
    var m = MESAS.filter(function (x) { return x.id === id; })[0]; if (!m) return;
    if (S.fase === 'esperando' && S.miMesa) { devolver('Mesa cancelada al unirte a otra'); S.miMesa = null; S.fase = 'ninguna'; }
    if (m.monto > S.disp || enDuelo()) return;
    cerrarHoja(true);
    S.cDuelo = 0; congelar(m.monto, 'vs ' + J[m.c].n + ' · ' + hora());
    nuevoDuelo(J[m.c], m.monto, 'unirse');
    location.hash = '#duelo';
    setTimeout(function () { aviso('¡Emparejados! A jugar la amistosa'); }, 80);
  }
  /* Depositar: modo prueba, sin datos bancarios reales */
  function hojaDepositar() {
    var st = { sim: false, monto: '', comp: null, enviado: false };
    function cuerpo() {
      if (st.enviado) return '<div class="sos-vos" style="padding:22px 16px"><span style="display:inline-grid;place-items:center;width:64px;height:64px;border-radius:50%;background:rgba(172,149,250,.12);box-shadow:inset 0 0 0 2px var(--acento);color:var(--acento);font-size:30px">' + ic('reloj') + '</span><h2 style="font-size:25px">Carga enviada · esperando validación del operador</h2><p class="tag" style="color:#EBDCFF">Te avisamos apenas se acredite. Queda en Movimientos como «Pendiente de validación».</p></div>';
      var r = leerMonto(st.monto), err = st.monto ? (r.error || (r.c < MIN_CARGA ? 'La carga mínima es $2.000' : '')) : '';
      return '<div class="nota roja">' + ic('alerta') + '<span>Antes de cargar: en la amistosa se igualan los niveles pero no las cartas desbloqueadas, y los términos de Supercell prohíben apostar y pueden sancionar tu cuenta de Clash.</span></div>' +
        '<div class="pasos-n">' +
        '<div class="paso-n"><div><b>Transferí a esta cuenta</b><div class="prueba-banco" style="margin-top:10px"><b>Modo prueba</b><p>En la muestra no mostramos ningún dato bancario. Simulá la transferencia para seguir.</p>' + (st.sim ? '<span class="estado libre" style="margin-top:12px;height:34px;text-transform:none;letter-spacing:0;font-size:14px">Transferencia simulada</span>' : '<button class="btn btn-linea" data-acc="dep-sim">Simular transferencia</button>') + '</div></div></div>' +
        '<div class="paso-n"><div class="campo"><label for="dep-monto">¿Cuánto cargaste?</label><div class="monto-input"><span>$</span><input class="input' + (err ? ' mal' : '') + '" id="dep-monto" inputmode="decimal" value="' + esc(st.monto) + '" placeholder="Desde 2.000" data-in="dep-monto" autocomplete="off"></div><span class="' + (err ? 'error' : 'ayuda') + '" id="dep-msg">' + (err || 'Tiene que coincidir con lo que transferiste.') + '</span></div></div>' +
        '<div class="paso-n"><div class="campo"><span class="rot">Subí el comprobante</span><label class="subir' + (st.comp ? ' listo' : '') + '" for="dep-file">' + ic(st.comp ? 'check' : 'subir') + '<span>' + (st.comp ? esc(st.comp) : 'Elegí una foto o captura') + '</span><small>JPG, PNG o WebP, hasta 8 MB</small></label><input class="vh" type="file" id="dep-file" accept="image/jpeg,image/png,image/webp" data-in="dep-file"><span class="error" id="dep-file-err"></span></div></div>' +
        '</div>';
    }
    function pieH() {
      if (st.enviado) return '<button class="btn btn-violeta" data-acc="cerrar-hoja">Listo</button>';
      var r = leerMonto(st.monto), ok = st.sim && st.comp && !r.vacio && !r.error && r.c >= MIN_CARGA;
      return '<button class="btn btn-violeta" data-acc="dep-ok"' + (ok ? '' : ' disabled aria-disabled="true"') + '>' + (ok ? 'Enviar carga de ' + plata(r.c) : 'Enviar carga') + '</button><p class="nota-pie">El saldo se acredita cuando un operador valida la transferencia.</p>';
    }
    hoja({ id: 'depositar', titulo: 'Depositar', bajada: 'Tres pasos: transferís, decís cuánto y subís el comprobante', cuerpo: cuerpo(), pie: pieH(), alCerrar: function () { if (ruta === 'billetera' || ruta === 'inicio') render(); } });
    hojaDepositar.st = st; hojaDepositar.cuerpo = cuerpo; hojaDepositar.pie = pieH;
  }
  /* Retirar: cuenta a tu nombre, disponible visible, Retirar todo y confirmación */
  function hojaRetirar() {
    var st = { monto: '', listo: false };
    var bloqueo = S.cDuelo > 0 || S.fase === 'esperando';
    function cuerpo() {
      if (st.listo) return '<div class="sos-vos" style="padding:22px 16px"><span style="display:inline-grid;place-items:center;width:64px;height:64px;border-radius:50%;background:rgba(172,149,250,.12);box-shadow:inset 0 0 0 2px var(--acento);color:var(--acento);font-size:30px">' + ic('reloj') + '</span><h2 style="font-size:26px">Retiro solicitado</h2><p class="tag" style="color:#EBDCFF">Se procesa dentro de las 24 h hábiles. El monto ya quedó retenido.</p></div>';
      var r = leerMonto(st.monto), err = '';
      if (st.monto) err = r.error || (r.c < MIN_RETIRO ? 'El retiro mínimo es $2.000' : r.c > S.disp ? 'Tu disponible es ' + plata(S.disp) : '');
      var ok = !bloqueo && st.monto && !err;
      return (bloqueo ? '<div class="nota roja" role="alert">' + ic('alerta') + '<span>Terminá o cancelá tus duelos activos antes de retirar.</span></div>' : '') +
        '<section class="tarjeta" style="padding:6px 16px"><div class="dato-fila"><span>Alias</span><b>tu.alias.ejemplo</b></div><div class="dato-fila"><span>Titular</span><b>Tu nombre (ejemplo)</b></div><div class="dato-fila"><span>CUIT</span><b>20-00000000-0</b></div></section>' +
        '<p class="ayuda" style="font-size:13.5px;color:var(--tx-3)">Tu cuenta para cobrar tiene que estar a tu nombre — el mismo que usás para cargar. Para cambiarla, escribinos a Soporte.</p>' +
        '<div class="campo"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><label for="ret-monto">¿Cuánto retirás?</label><button class="atajo" data-acc="ret-todo"' + (bloqueo ? ' disabled' : '') + '>Retirar todo</button></div><div class="monto-input"><span>$</span><input class="input' + (err ? ' mal' : '') + '" id="ret-monto" inputmode="decimal" value="' + esc(st.monto) + '" placeholder="Desde 2.000" data-in="ret-monto" autocomplete="off"' + (bloqueo ? ' disabled' : '') + '></div><span class="' + (err ? 'error' : 'ayuda') + '">' + (err || 'Disponible: ' + plata(S.disp)) + '</span></div>' +
        (ok ? '<div class="desglose"><div><span>Retirás</span><b class="num">' + plata(r.c) + '</b></div><div><span>Destino</span><b style="font:700 15px var(--f-texto)">tu.alias.ejemplo</b></div><div><span>Te queda disponible</span><b class="num">' + plata(S.disp - r.c) + '</b></div></div><p class="ayuda" style="font-size:13.5px;color:var(--tx-2)">Se procesa dentro de las 24 h hábiles.</p>' : '');
    }
    function pieH() {
      if (st.listo) return '<button class="btn btn-violeta" data-acc="cerrar-hoja">Listo</button>';
      var r = leerMonto(st.monto), ok = !bloqueo && st.monto && !r.error && r.c >= MIN_RETIRO && r.c <= S.disp;
      return '<button class="btn btn-violeta" data-acc="ret-ok"' + (ok ? '' : ' disabled aria-disabled="true"') + '>' + (ok ? 'Retirar ' + plata(r.c) : 'Retirar') + '</button>';
    }
    hoja({ id: 'retirar', titulo: 'Retirar', bajada: 'A una cuenta bancaria a tu nombre', cuerpo: cuerpo(), pie: pieH(), alCerrar: function () { if (ruta === 'billetera' || ruta === 'inicio') render(); } });
    hojaRetirar.st = st; hojaRetirar.cuerpo = cuerpo; hojaRetirar.pie = pieH;
  }
  /* Grillas: fondos, avatares y temas (todo libre, sin candados) */
  function hojaFondos(tipo) {
    var lista = tipo === 'chat' ? FONDOS_CHAT : FONDOS_PERFIL, actual = tipo === 'chat' ? S.fondoChat : S.fondoPerfil;
    hoja({ id: 'fondos', titulo: tipo === 'chat' ? 'Fondo del chat' : 'Fondo de tu perfil', bajada: 'Elegí el que más te guste',
      cuerpo: '<div class="grilla">' + lista.map(function (f) { return '<button class="opcion' + (actual === f[0] ? ' on' : '') + '" data-acc="elegir-fondo" data-tipo="' + tipo + '" data-v="' + f[0] + '" aria-pressed="' + (actual === f[0]) + '"><i class="fondo-' + f[0] + '"></i><b>' + f[1] + '</b><small>' + (actual === f[0] ? 'En uso' : 'Elegir') + '</small></button>'; }).join('') + '</div>' });
  }
  function hojaAvatares(tab) {
    tab = tab || (S.avatar.tipo === 'ini' ? 'ini' : 'med');
    var grilla = tab === 'med' ? MED.map(function (m, i) { var on = S.avatar.tipo === 'med' && S.avatar.i === i; return '<button class="opcion medalla' + (on ? ' on' : '') + '" data-acc="elegir-av" data-tipo="med" data-v="' + i + '" aria-pressed="' + on + '">' + medalla(i) + '<small>' + m[0] + '</small></button>'; }).join('') :
      INI_COL.map(function (c, i) { var on = S.avatar.tipo === 'ini' && S.avatar.i === i; return '<button class="opcion medalla' + (on ? ' on' : '') + '" data-acc="elegir-av" data-tipo="ini" data-v="' + i + '" aria-pressed="' + on + '" aria-label="Inicial en color ' + (i + 1) + '">' + inicial(S.usuario.charAt(0).toUpperCase(), c) + '<small>Color ' + (i + 1) + '</small></button>'; }).join('');
    hoja({ id: 'avatares', titulo: 'Foto de perfil', bajada: 'Una medalla o tu inicial',
      cuerpo: '<div class="segm violeta" role="group"><button data-acc="av-tab" data-v="med" class="' + (tab === 'med' ? 'on' : '') + '" aria-pressed="' + (tab === 'med') + '">Medallas</button><button data-acc="av-tab" data-v="ini" class="' + (tab === 'ini' ? 'on' : '') + '" aria-pressed="' + (tab === 'ini') + '">Iniciales</button></div><div class="grilla">' + grilla + '</div><button class="btn btn-neutro btn-ancho" style="text-transform:none;letter-spacing:.02em" data-acc="elegir-av" data-tipo="ini" data-v="0">Volver al avatar original</button>' });
  }
  function hojaTemas() {
    hoja({ id: 'temas', titulo: 'Temas de sala', bajada: 'Elegí cómo se ve tu sala',
      cuerpo: '<div class="carrusel" tabindex="0" aria-label="Temas, deslizá para ver más">' + SALAS.map(function (t) { var on = S.sala === t[0]; return '<button class="opcion' + (on ? ' on' : '') + '" data-acc="elegir-sala" data-v="' + t[0] + '" aria-pressed="' + on + '"><span class="mini-sala" data-sala="' + t[0] + '"><span class="mesa-duelo"><span class="filete"></span><span class="pano" style="display:block"><span class="lado-luz r"></span><span class="lado-luz v"></span><span class="costura"></span></span></span><span class="pto a"></span><span class="pto b"></span></span><b>' + t[1] + '</b><small>' + (on ? 'En uso' : 'Elegir') + '</small></button>'; }).join('') + '</div>' +
        '<div class="riel" aria-hidden="true"><i></i></div><p class="rk-nota">Deslizá para ver los cinco. Todos los temas están libres y el cambio se ve al instante, también en medio de un duelo. Cambia el material de la sala, nunca los lados: el rival siempre en rojo y vos en cian.</p>',
      /* Barra dorada propia (no la del navegador, que en el teléfono no se ve): sigue al desplazamiento */
      alAbrir: function (h) {
        var c = $('.carrusel', h), riel = $('.riel i', h); if (!c) return;
        var mover = function () { var max = c.scrollWidth - c.clientWidth, ancho = c.clientWidth / c.scrollWidth; riel.style.width = (ancho * 100) + '%'; riel.style.transform = 'translateX(' + (max > 0 ? c.scrollLeft / max * (1 / ancho - 1) * 100 : 0) + '%)'; };
        c.addEventListener('scroll', mover, { passive: true }); mover();
        c.addEventListener('wheel', function (e) { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { c.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
      } });
  }
  function hojaInfoSala() {
    hoja({ id: 'info', titulo: 'Cómo se juega', bajada: 'Duelo 1v1 por ' + plata(S.apuesta),
      cuerpo: '<div class="pasos-n">' + (S.amistad ? '<div class="paso-n hecho"><span><b>Ya son amigos en Clash Royale</b> con ' + esc(S.rival.n) + '. Si no te aparece, agregalo de nuevo con su link de invitación.</span></div>' : '<div class="paso-n"><span>Primero agregate como amigo de <b>' + esc(S.rival.n) + '</b> en Clash Royale. La amistad es obligatoria para poder jugar la amistosa.<button class="btn btn-violeta btn-ancho" style="margin-top:10px;text-transform:none;letter-spacing:.02em;font-size:15.5px" data-acc="invitacion">Abrir link de invitación de ' + esc(S.rival.n) + '</button></span></div>') + '<div class="paso-n"><span>Jugá una <b>batalla amistosa 1v1</b>. No uses un torneo ni el campo de entrenamiento.</span></div><div class="paso-n"><span>Tocá <b>«Ya jugamos»</b>. Leemos el historial de los dos y tiene que coincidir.</span></div><div class="paso-n"><span>Gana quien hizo más coronas. Coronas iguales es empate y te devolvemos tu apuesta completa.</span></div></div>' +
        desglose(S.apuesta) + '<div class="nota clara">' + ic('reloj') + '<span>Tienen 60 minutos para jugar. Si no aparece ninguna partida, te devolvemos la apuesta sin cargo.</span></div><p class="rk-nota">El ganador lo decide la API, no nosotros.</p><p class="legal-sala"><span class="mas18" aria-label="Solo mayores de 18">+18</span>Jugá con responsabilidad. VIP Royale no está afiliado a Supercell ni a Clash Royale.</p>' });
  }
  function hojaSimple(id, titulo, bajada, cuerpo) { hoja({ id: id, titulo: titulo, bajada: bajada, cuerpo: cuerpo }); }
  function hojaHistorial(i) {
    var h = HIST[i]; if (!h) return; var j = J[h.j];
    var res = { g: 'Ganaste', p: 'Perdiste', e: 'Empate', dev: 'Devuelto por tiempo', rev: 'En revisión' }[h.r];
    var filas = '<div><span>Rival</span><b style="font:700 15px var(--f-texto)">' + esc(j.n) + ' · ' + esc(j.t) + '</b></div><div><span>Fecha</span><b style="font:700 15px var(--f-texto)">' + h.f + '</b></div>' + (h.c ? '<div><span>Coronas</span><b>' + h.c[0] + ' - ' + h.c[1] + '</b></div>' : '') + '<div><span>Apuesta</span><b class="num">' + plata(h.ap) + '</b></div><div><span>Pozo</span><b class="num">' + plata(pozo(h.ap)) + '</b></div>' +
      (h.r === 'g' ? '<div><span>Comisión (5%)</span><b class="num">' + plata(comision(h.ap)) + '</b></div><div class="cobra"><span>Cobraste</span><b class="num">' + plata(premio(h.ap)) + '</b></div><div><span>Resultado neto</span><b class="num mas">+' + plata(premio(h.ap) - h.ap) + '</b></div>' : h.r === 'p' ? '<div><span>Resultado neto</span><b class="num menos">' + plata(-h.ap) + '</b></div>' : h.r === 'rev' ? '<div><span>En custodia</span><b class="num">' + plata(h.ap) + '</b></div>' : '<div><span>Devuelto</span><b class="num">' + plata(h.ap) + '</b></div><div><span>Resultado neto</span><b class="num">' + plata(0) + '</b></div>');
    hoja({ id: 'hist', titulo: res + ' vs ' + esc(j.n), bajada: h.r === 'rev' ? 'Un operador revisa la evidencia. Tu apuesta sigue en custodia.' : 'Resultado leído en los dos historiales oficiales',
      cuerpo: '<div class="desglose">' + filas + '</div><div class="nota">' + ic('escudo') + '<span>Guardamos la evidencia de los dos lados. Ningún resultado se edita: si hay que corregir algo, se hace con un movimiento nuevo.</span></div>' +
        '<form class="tarjeta" style="padding:16px;display:grid;gap:12px" data-form="reclamo"><b style="font-size:16px">¿Hubo un problema con este duelo?</b><div class="campo"><label for="rec-mot">Motivo</label><select class="input" id="rec-mot"><option>No jugamos esa partida</option><option>El resultado no coincide</option><option>Jugamos y no aparece</option><option>Otro</option></select></div><div class="campo"><label for="rec-txt">Contanos qué pasó</label><textarea class="input" id="rec-txt" rows="3" maxlength="300" style="padding:12px 14px;min-height:88px"></textarea></div><button class="btn btn-linea">Enviar reclamo</button><span class="ayuda" style="font-size:13px;color:var(--tx-3)">Tenés 48 horas desde el cierre. Uno por duelo.</span></form>' });
  }
  function hojaRevancha() {
    var ap = S.apuesta, err = '';
    if (ap > S.disp) err = 'Saldo insuficiente para la revancha. Cargá plata primero.';
    hoja({ id: 'revancha', titulo: 'Revancha', bajada: 'Contra ' + esc(S.rival.n) + ', por el mismo monto',
      cuerpo: desglose(ap) + '<div class="nota">' + ic('reloj') + '<span>La invitación vence en 2 minutos. Si no acepta, te devolvemos la apuesta completa.</span></div>' + (err ? '<div class="nota roja" role="alert">' + ic('alerta') + '<span>' + err + '</span></div>' : ''),
      pie: '<button class="btn btn-violeta" data-acc="revancha-ok"' + (err ? ' disabled aria-disabled="true"' : '') + '>Invitar por ' + plata(ap) + '</button><p class="nota-pie">Tu disponible: ' + plata(S.disp) + '</p>' });
  }
  function hojaInscribir(id) {
    var t = TORNEOS.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    var pz = pozoTorneo(t), fin = Math.floor(pz * 30 / 100), err = t.insc > S.disp ? 'Saldo insuficiente. Cargá plata primero.' : '';
    hoja({ id: 'insc', titulo: esc(t.n), bajada: t.cierra + ' · ' + t.ventana,
      cuerpo: '<div class="desglose"><div><span>Inscripción</span><b class="num">' + plata(t.insc) + '</b></div><div><span>Cupo</span><b>' + t.cupo + '</b></div><div><span>Pozo (inscripciones menos 5%)</span><b class="num">' + plata(pz) + '</b></div>' + (t.rep === 'todo' ? '<div class="cobra"><span>El campeón se lleva</span><b class="num">' + plata(pz) + '</b></div>' : '<div class="cobra"><span>Campeón (70%)</span><b class="num">' + plata(pz - fin) + '</b></div><div><span>Finalista (30%)</span><b class="num">' + plata(fin) + '</b></div>') + '</div>' +
        '<div class="nota">' + ic('candado') + '<span>La inscripción queda en custodia. Podés darte de baja mientras no esté completo y te devolvemos todo.</span></div>' +
        '<div class="nota clara">' + ic('reloj') + '<span>Regla de walkover: si en tu cruce solo uno toca «Estoy listo», ese avanza sin jugar. Si ninguno juega, quedan afuera los dos.</span></div>' + (err ? '<div class="nota roja" role="alert">' + ic('alerta') + '<span>' + err + '</span></div>' : ''),
      pie: '<button class="btn btn-oro brilla" data-acc="insc-ok" data-id="' + id + '"' + (err ? ' disabled aria-disabled="true"' : '') + '>Inscribirme por ' + plata(t.insc) + '</button><p class="nota-pie">Tu disponible: ' + plata(S.disp) + '</p>' });
  }
  function hojaCrearTorneo() {
    var st = { cupo: 8, insc: 100000, rep: 'todo' };
    function cuerpo() {
      var b = st.cupo * st.insc, pz = b - Math.floor(b * FEE_BPS / 10000);
      return '<div class="campo"><span class="rot">Cupo</span><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + [4, 8, 16].map(function (c) { return '<button class="chip' + (st.cupo === c ? ' on' : '') + '" data-acc="ct-cupo" data-v="' + c + '" aria-pressed="' + (st.cupo === c) + '">' + c + ' jugadores</button>'; }).join('') + '</div></div>' +
        '<div class="campo"><span class="rot">Inscripción</span><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + [50000, 100000, 250000].map(function (c) { return '<button class="chip' + (st.insc === c ? ' on' : '') + '" data-acc="ct-insc" data-v="' + c + '" aria-pressed="' + (st.insc === c) + '">' + plata(c) + '</button>'; }).join('') + '</div></div>' +
        '<div class="campo"><span class="rot">Reparto</span><div class="segm violeta" role="group"><button data-acc="ct-rep" data-v="todo" class="' + (st.rep === 'todo' ? 'on' : '') + '">El campeón se lleva todo</button><button data-acc="ct-rep" data-v="7030" class="' + (st.rep === '7030' ? 'on' : '') + '">70% y 30%</button></div></div>' +
        '<div class="desglose"><div><span>Pozo si se llena</span><b class="num">' + plata(pz) + '</b></div><div><span>Comisión (5%)</span><b class="num">' + plata(b - pz) + '</b></div></div><div class="nota">' + ic('usuario') + '<span>Vos jugás como uno más, sin ventaja. Al crear el torneo quedás inscripto y pagás tu inscripción.</span></div>';
    }
    function pieH() { return '<button class="btn btn-violeta" data-acc="ct-ok"' + (st.insc > S.disp ? ' disabled' : '') + '>Crear torneo por ' + plata(st.insc) + '</button><p class="nota-pie">Tu disponible: ' + plata(S.disp) + '</p>'; }
    hoja({ id: 'ctorneo', titulo: 'Crear torneo', bajada: 'Cada cruce es una amistosa 1v1 verificada', cuerpo: cuerpo(), pie: pieH() });
    hojaCrearTorneo.st = st; hojaCrearTorneo.cuerpo = cuerpo; hojaCrearTorneo.pie = pieH;
  }

  /* ------------------------------------------------------------------
     Aviso flotante
     ------------------------------------------------------------------ */
  function aviso(txt) {
    var c = $('#avisos'); c.innerHTML = '';
    var a = document.createElement('div'); a.className = 'aviso'; a.innerHTML = ic('check'); a.appendChild(document.createTextNode(txt));
    c.appendChild(a); setTimeout(function () { if (a.parentNode) a.remove(); }, 3200);
  }

  /* ------------------------------------------------------------------
     Router por hash
     ------------------------------------------------------------------ */
  var VISTAS = { inicio: vInicio, jugar: vJugar, mesas: vMesas, crear: vMesas, ranking: vRanking, chat: vChat, perfil: vPerfil, billetera: vBilletera, notificaciones: vNotis, historial: vHistorial, torneos: vTorneos, vincular: vVincular, ingreso: vIngreso };
  var SALA = ['duelo', 'verificando', 'ganaste', 'perdiste', 'empate'];
  var ruta = '';
  function render() {
    var h = (location.hash || '#inicio').slice(1).split('?')[0];
    if (!VISTAS[h] && SALA.indexOf(h) < 0) h = 'inicio';
    var cambio = h !== ruta;
    ruta = h; limpiar();
    if (cambio) { cerrarHoja(true); S.panel = null; }
    var vista = $('#vista');
    document.body.classList.toggle('en-sala', SALA.indexOf(h) >= 0);
    document.body.classList.toggle('sin-shell', h === 'ingreso');
    document.body.dataset.sala = S.sala;
    vista.classList.toggle('pant-chat', h === 'chat');
    if (SALA.indexOf(h) >= 0) {
      if (!asegurar(h)) { location.replace('#billetera'); aviso('Saldo insuficiente. Cargá plata primero.'); return; }
      vista.innerHTML = vSala(h);
      montarSala(h);
    } else {
      vista.innerHTML = VISTAS[h]();
      pintarCab(); marcarTab(TAB_DE[h]);
    }
    if (cambio) { irA(0); }
    document.title = 'VIP Royale · ' + ({ inicio: 'Inicio', jugar: 'Jugar', mesas: 'Mesas', crear: 'Crear mesa', duelo: 'Sala del duelo', verificando: 'Verificando', ganaste: 'Ganaste', perdiste: 'Perdiste', empate: 'Empate', ranking: 'Ranking', chat: 'Chat', perfil: 'Perfil', billetera: 'Billetera', notificaciones: 'Notificaciones', vincular: 'Vincular cuenta', torneos: 'Torneos', historial: 'Historial', ingreso: 'Ingreso' }[h]);
    if (h === 'crear') hojaCrear();
    if (h === 'ranking' && cambio) animarRanking();
    if (h === 'mesas' || h === 'crear' || h === 'inicio') relojMesa();
    if (h === 'chat') { var cc = $('#chat-cuerpo'); if (cc) cc.scrollTop = cc.scrollHeight; }
    if (h === 'ingreso') montarIngreso();
    if (cambio && SALA.indexOf(h) < 0) { var v = $('#vista'); if (v) v.focus({ preventScroll: true }); }
  }
  function relojMesa() {
    var tick = function () { $$('[data-cuenta]').forEach(function (el) { var r = Math.max(0, Number(el.dataset.cuenta) - Date.now()); el.textContent = 'Vence en ' + (r >= 3600000 ? Math.floor(r / 3600000) + ' h ' + String(Math.floor(r % 3600000 / 60000)).padStart(2, '0') + ' min' : mmss(r)); }); };
    tick(); cada(tick, 1000);
  }
  /* El espacio de abajo del paño se mide con la tarjeta de pasos real (cambia con el estado, el ancho y el alto):
     así la cara de tu lado siempre queda por encima, con 8 px de aire además del aro. Abierta a pedido en un teléfono bajo,
     la tarjeta se apoya encima a propósito y no empuja nada. */
  function ajustarMano() {
    var pi = $('.pano-in'), p = $('#pasos'), pn = $('.pano'), z = $('.sala-zona'); if (!pi || !p || !pn || S.pasosAbiertos) return;
    /* En la computadora la tarjeta va debajo del óvalo: crece el espacio de abajo y la tarjeta sólo pisa el borde de la baranda */
    if (esPC()) { z.style.paddingBottom = Math.max(76, p.offsetHeight + 6) + 'px'; pi.style.removeProperty('--mano-h'); return; }
    z.style.paddingBottom = '';
    var falta = Math.ceil(pn.getBoundingClientRect().bottom - p.getBoundingClientRect().top + 14);
    pi.style.setProperty('--mano-h', Math.max(22, falta) + 'px');
  }
  window.addEventListener('resize', function () { if (ruta === 'duelo') ajustarMano(); });
  function montarSala(h) {
    if (h === 'duelo' || h === 'verificando') {
      var tick = function () { var r = Math.max(0, 3600000 - (Date.now() - S.inicioDuelo)); var t = $('#reloj-txt'); if (t) t.textContent = mmss(r); var b = $('.reloj i'); if (b) b.style.setProperty('--resta', (r / 36000) + '%'); };
      cada(tick, 1000);
    }
    if (h === 'duelo') { ajustarMano(); if (document.fonts) document.fonts.ready.then(ajustarMano); S.vsVisto = true; if (S.chat && S.chat.length === 1 && !S.saludo) { S.saludo = true; luego(function () { if (!S.sinSaludo) burbuja(false, S.chat[0].m); }, 900); } }
    if (h === 'verificando') {
      luego(function () { var e = $('[data-lado="rival"]'); if (e) { e.className = 'lado-est leido'; e.innerHTML = ic('check') + 'Historial leído'; } S.log.push({ k: 'l', q: S.rival.n, t: 'Historial leído' }); }, 900);
      luego(function () { var e = $('[data-lado="yo"]'); if (e) { e.className = 'lado-est leido'; e.innerHTML = ic('check') + 'Historial leído'; } S.log.push({ k: 'l', q: 'Vos', t: 'Historial leído' }); }, 2600);
      luego(function () { var res = RES[S.demo % 3]; S.demo++; location.hash = '#' + res; }, 3700);
    }
    if (RES.indexOf(h) >= 0) {
      var caja = $('#caja-res');
      if (h === 'ganaste') luego(function () { var copa = $('img', caja); chispas(copa || caja, 90, $('.caja-capa')); }, 380);
      /* Las coronas cuentan desde cero y la etiqueta acompaña a cada número (0 CORONAS, 1 CORONA, 2 CORONAS) */
      if (!quieto()) $$('.coronas', caja).forEach(function (el) { var fin = Number(el.dataset.v), k = 0, cl = el.nextElementSibling; var pon = function (n) { el.textContent = String(n); if (cl) cl.textContent = corLabel(n); }; pon(0); if (!fin) return; var t = cada(function () { k++; pon(Math.min(fin, k)); if (k >= fin) clearInterval(t); }, 220); });
    }
    if (S.panel) pintarPanel();
  }
  /* Llegada de unos 2,6 s: se enciende la luz, las dos fichas chocan en el centro, sale el destello y aparece la V con su halo;
     después el logo (el mismo elemento, no una copia) viaja a su lugar en el ingreso y recién ahí entran la bajada y el formulario. */
  function montarIngreso() {
    var intro = $('.intro'), ing = $('.ingreso'), lg = $('#ing-logo');
    /* Lo que cae se apaga antes del pie legal, así nunca pasa por encima del +18 ni de la no afiliación */
    var pieIng = $('.ing-pie'); if (ing && pieIng) ing.style.setProperty('--pie-y', pieIng.offsetTop + 'px');
    if (!intro || !ing || !lg) return;
    sesion('intro', '1');
    /* La V nace donde chocan las fichas: el centro del emblema va al 47 % de la pantalla */
    var em = $('.logo-em', lg).getBoundingClientRect(), ov = intro.getBoundingClientRect(), r = lg.getBoundingClientRect();
    var cx = em.left + em.width / 2, cy = em.top + em.height / 2;
    lg.style.transformOrigin = (cx - r.left) + 'px ' + (cy - r.top) + 'px';
    var dx = innerWidth / 2 - cx, dy = ov.top + ov.height * .47 - cy;
    lg.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(1.3)';
    luego(function () { lg.style.transition = 'transform .52s cubic-bezier(.65, 0, .25, 1)'; lg.style.transform = ''; }, 1720);
    luego(terminarIntro, 2300);
  }
  function terminarIntro() {
    var intro = $('.intro'); if (intro) intro.remove();
    var lg = $('#ing-logo'); if (lg) { lg.style.transition = ''; lg.style.transform = ''; lg.style.transformOrigin = ''; }
    if (esPC()) { var m = $('#i-mail') || $('#r-user'); if (m) m.focus({ preventScroll: true }); }
  }

  /* ------------------------------------------------------------------
     Acciones
     ------------------------------------------------------------------ */
  var ACC = {
    'cerrar-hoja': function () { cerrarHoja(); },
    nada: function () { },
    depositar: function () { hojaDepositar(); },
    retirar: function () { hojaRetirar(); },
    crear: function (el) { var m = el.dataset.monto ? Number(el.dataset.monto) : null; if (ruta === 'mesas' && !m) { history.replaceState(null, '', '#crear'); ruta = 'crear'; document.title = 'VIP Royale · Crear mesa'; } hojaCrear(m); },
    'crear-rapida': function (el) { var st = hojaCrear.st; st.monto = Number(el.dataset.v); st.otro = ''; refrescarCrear(); },
    'crear-tipo': function (el) { hojaCrear.st.privada = el.dataset.v === '1'; refrescarCrear(); },
    'crear-ok': function () { crearOk(); },
    'cancelar-mesa': function () {
      if (!S.miMesa) { cerrarHoja(true); return; }
      devolver('Mesa cancelada'); S.miMesa = null; S.fase = 'ninguna'; cerrarHoja(true);
      aviso('Mesa cancelada · te devolvimos la apuesta'); render();
    },
    'ver-link': function () { hojaLink(false); },
    'copiar-link': function () { var i = $('#link-m'); if (i) { i.select(); try { navigator.clipboard.writeText(i.value).catch(function () { }); } catch (e) { /* sin portapapeles */ } } aviso('¡Copiado!'); },
    'compartir-link': function () { var i = $('#link-m'); if (navigator.share && i) navigator.share({ title: 'VIP Royale', text: 'Te invito a un duelo 1v1', url: i.value }).catch(function () { }); else aviso('¡Copiado!'); },
    unirse: function (el) { hojaUnirse(Number(el.dataset.id)); },
    'unirse-ok': function (el) { unirseOk(Number(el.dataset.id)); },
    filtro: function (el) { S.filtro = el.dataset.v; render(); },
    'rk-per': function (el) { S.rk.per = el.dataset.v; render(); animarRanking(); },
    'rk-mod': function (el) { S.rk.mod = el.dataset.v; render(); animarRanking(); },
    'hist-f': function (el) { S.histFiltro = el.dataset.v; render(); },
    'hist-ver': function (el) { hojaHistorial(Number(el.dataset.i)); },
    'torneo-tab': function (el) { S.torneoTab = el.dataset.v; render(); },
    inscribirme: function (el) { hojaInscribir(Number(el.dataset.id)); },
    'insc-ok': function (el) {
      var t = TORNEOS.filter(function (x) { return x.id === Number(el.dataset.id); })[0]; if (!t || t.insc > S.disp) return;
      S.disp -= t.insc; S.cTorneo += t.insc; S.inscripto[t.id] = mov({ t: 'custodia', torneo: true, det: t.n + ' · ' + hora(), v: t.insc, est: 'juego' });
      noti('trofeo', 'Te inscribiste en ' + t.n, 'Inscripción de ' + plata(t.insc) + ' en custodia. ' + t.cierra + '.');
      cerrarHoja(true); aviso('Te inscribiste en ' + t.n); render();
    },
    'baja-torneo': function (el) {
      var t = TORNEOS.filter(function (x) { return x.id === Number(el.dataset.id); })[0]; if (!t || !S.inscripto[t.id]) return;
      S.disp += t.insc; S.cTorneo -= t.insc; if (S.inscripto[t.id].est) S.inscripto[t.id].est = 'devuelta'; delete S.inscripto[t.id];
      mov({ t: 'devolucion', txt: 'Baja de torneo', det: t.n + ' · ' + hora(), v: t.insc, st: 'Devuelta' });
      noti('devolucion', 'Te diste de baja de ' + t.n, 'Te devolvimos la inscripción de ' + plata(t.insc) + ', sin cargo.');
      aviso('Te diste de baja · te devolvimos ' + plata(t.insc)); render();
    },
    'crear-torneo': function () { hojaCrearTorneo(); },
    'ct-cupo': function (el) { hojaCrearTorneo.st.cupo = Number(el.dataset.v); actualizarHoja(hojaCrearTorneo.cuerpo(), hojaCrearTorneo.pie()); },
    'ct-insc': function (el) { hojaCrearTorneo.st.insc = Number(el.dataset.v); actualizarHoja(hojaCrearTorneo.cuerpo(), hojaCrearTorneo.pie()); },
    'ct-rep': function (el) { hojaCrearTorneo.st.rep = el.dataset.v; actualizarHoja(hojaCrearTorneo.cuerpo(), hojaCrearTorneo.pie()); },
    'ct-ok': function () {
      var st = hojaCrearTorneo.st; if (st.insc > S.disp) return;
      var id = TORNEOS.length + 10;
      TORNEOS.unshift({ id: id, n: 'Tu torneo', cupo: st.cupo, insc: st.insc, anot: 0, rep: st.rep, cierra: 'Cierra en 72 h', ventana: 'Rondas de 30 min' });
      S.disp -= st.insc; S.cTorneo += st.insc; S.inscripto[id] = mov({ t: 'custodia', torneo: true, det: 'Tu torneo · ' + hora(), v: st.insc, est: 'juego' });
      noti('trofeo', 'Creaste tu torneo', 'Quedaste inscripto. Inscripción de ' + plata(st.insc) + ' en custodia.');
      cerrarHoja(true); S.torneoTab = 'abiertos'; aviso('Torneo creado · quedaste inscripto'); render();
    },
    'dep-sim': function () { hojaDepositar.st.sim = true; actualizarHoja(hojaDepositar.cuerpo(), hojaDepositar.pie()); },
    'dep-ok': function () {
      var st = hojaDepositar.st, r = leerMonto(st.monto); if (!st.sim || !st.comp || r.error || r.c < MIN_CARGA) return;
      st.enviado = true; mov({ t: 'deposito', txt: 'Depósito', det: hora(), v: r.c, st: 'Pendiente de validación', pend: true });
      noti('depositar', 'Carga enviada · esperando validación', 'Cargaste ' + plata(r.c) + '. Te avisamos apenas un operador la valide.');
      actualizarHoja(hojaDepositar.cuerpo(), hojaDepositar.pie());
    },
    'ret-todo': function () { hojaRetirar.st.monto = sinSigno(S.disp); actualizarHoja(hojaRetirar.cuerpo(), hojaRetirar.pie()); },
    'ret-ok': function () {
      var st = hojaRetirar.st, r = leerMonto(st.monto); if (r.error || r.c < MIN_RETIRO || r.c > S.disp || S.cDuelo > 0) return;
      S.disp -= r.c; st.listo = true; mov({ t: 'retiro', txt: 'Retiro', det: hora() + ' · a tu.alias.ejemplo', v: -r.c, st: 'Retiro solicitado' });
      noti('retirar', 'Retiro solicitado', plata(r.c) + ' a tu.alias.ejemplo. Se procesa dentro de las 24 h hábiles.');
      actualizarHoja(hojaRetirar.cuerpo(), hojaRetirar.pie()); pintarCab();
    },
    'fondo-chat': function () { hojaFondos('chat'); },
    'fondo-perfil': function () { hojaFondos('perfil'); },
    'elegir-fondo': function (el) {
      if (el.dataset.tipo === 'chat') { S.fondoChat = el.dataset.v; guardar('fondoChat', S.fondoChat); }
      else { S.fondoPerfil = el.dataset.v; guardar('fondoPerfil', S.fondoPerfil); }
      var tipo = el.dataset.tipo; render(); hojaFondos(tipo);
    },
    avatares: function () { hojaAvatares(); },
    'av-tab': function (el) { hojaAvatares(el.dataset.v); },
    'elegir-av': function (el) { S.avatar = { tipo: el.dataset.tipo, i: Number(el.dataset.v) }; guardar('avatar', S.avatar); render(); hojaAvatares(S.avatar.tipo); },
    'temas-sala': function () { hojaTemas(); },
    'elegir-sala': function (el) {
      S.sala = el.dataset.v; guardar('sala', S.sala); document.body.dataset.sala = S.sala;
      $$('.carrusel .opcion').forEach(function (b) { var on = b.dataset.v === S.sala; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); $('small', b).textContent = on ? 'En uso' : 'Elegir'; });
    },
    'cuenta-clash': function () { hojaSimple('clash', 'Tu cuenta de Clash', 'Vinculada y verificada', '<section class="sos-vos" style="box-shadow:0 0 0 1.5px rgba(172, 149, 250,.5)"><span style="display:inline-block">' + miAvatar() + '</span><h2>' + esc(S.usuario) + '</h2><p class="tag">' + esc(S.tag) + '</p><div class="tres"><div><small>Trofeos</small><b>' + miles(S.trofeos) + '</b></div><div><small>Arena</small><b>' + esc(S.arena) + '</b></div><div><small>Clan</small><b>' + esc(S.clan) + '</b></div></div></section><div class="nota">' + ic('escudo') + '<span>Un tag se vincula a una sola cuenta. Para cambiarla, escribinos a Soporte: no se hace automático.</span></div><a class="btn btn-linea btn-ancho" href="#vincular">Ver cómo se vincula</a>'); },
    logros: function () {
      var L = [['Primer duelo', 'Jugá tu primer duelo', 1, 1], ['Racha de 3', 'Ganá 3 duelos seguidos', 3, 3], ['Diez duelos', 'Jugá 10 duelos', 10, 10], ['Revancha', 'Ganá una revancha', 1, 1], ['Torneo', 'Jugá un torneo', 1, 1], ['Semana completa', 'Jugá 7 días seguidos', 4, 7], ['Cincuenta', 'Jugá 50 duelos', 12, 50], ['Finalista', 'Llegá a una final', 0, 1]];
      hojaSimple('logros', 'Logros', '5 de 12 conseguidos', '<div class="lista">' + L.map(function (l) { var ok = l[2] >= l[3]; return '<div class="pref"><span><b>' + l[0] + '</b><small>' + l[1] + '</small></span><span class="' + (ok ? 'estado libre' : 'estado esperando') + '" style="text-transform:none;letter-spacing:0">' + (ok ? 'Conseguido' : l[2] + ' de ' + l[3]) + '</span></div>'; }).join('') + '</div>');
    },
    referidos: function () { hojaSimple('ref', 'Referidos', 'Invitá amigos con tu enlace', '<div class="campo"><label for="link-m">Tu enlace</label><input class="input" id="link-m" readonly value="https://viproyale.test/i/tu_usuario"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button class="btn btn-linea" data-acc="copiar-link">' + ic('copiar') + 'Copiar</button><button class="btn btn-violeta" data-acc="compartir-link">' + ic('compartir') + 'Compartir</button></div><div class="nota">' + ic('referidos') + '<span>3 amigos se sumaron con tu enlace. Tienen que ser mayores de 18 y tener su propia cuenta de Clash.</span></div>'); },
    limites: function () { hojaSimple('lim', 'Límites y pausas', 'Vos decidís cuánto y cuándo', '<div class="lista"><div class="pref"><span><b>Límite de carga</b><small>Por día, semana o mes</small></span><span class="estado libre" style="text-transform:none;letter-spacing:0">$20.000 por semana</span></div><div class="pref"><span><b>Límite de apuesta</b><small>Por día, semana o mes</small></span><span class="estado esperando" style="text-transform:none;letter-spacing:0">Sin límite</span></div></div><p class="rk-nota">Bajar un límite es inmediato. Subirlo tarda 48 horas.</p><h2 class="sec">Pausar mi cuenta</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"><button class="chip">24 horas</button><button class="chip">7 días</button><button class="chip">30 días</button></div><h2 class="sec">Autoexclusión</h2><div class="nota roja">' + ic('alerta') + '<span>6 o 12 meses, o sin plazo. No tiene vuelta atrás: se cierran tus mesas, termina tu duelo, retirás todo sin mínimo y dejan de llegarte avisos.</span></div><button class="btn btn-rojo btn-ancho" style="text-transform:none;letter-spacing:.02em">Quiero autoexcluirme</button>'); },
    ayuda: function () { hojaSimple('ayuda', 'Ayuda', 'Preguntas frecuentes y soporte', '<div class="lista">' + [['¿Quién decide el ganador?', 'El historial oficial de Clash Royale de los dos jugadores. Gana quien hizo más coronas. El ganador lo decide la API, no nosotros.'], ['¿Qué pasa si empatamos?', 'Te devolvemos tu apuesta completa, sin comisión.'], ['¿Y si no jugamos a tiempo?', 'A los 60 minutos te devolvemos la apuesta completa, sin cargo.'], ['¿Cuánto cobra VIP Royale?', 'El 5% del pozo, solo cuando hay un ganador.'], ['¿Cómo retiro?', 'Desde Billetera, a una cuenta a tu nombre. Mínimo $2.000, se procesa dentro de las 24 h hábiles.']].map(function (q) { return '<div class="pref" style="display:block"><b>' + q[0] + '</b><small style="margin-top:5px;font-size:14px;color:var(--tx-2)">' + q[1] + '</small></div>'; }).join('') + '</div><button class="btn btn-violeta btn-ancho">' + ic('soporte') + 'Escribir a Soporte</button>'); },
    leidas: function () { NOTIS.forEach(function (n) { n.nueva = false; }); render(); },
    sonido: function () { S.sonido = !S.sonido; var b = $('[data-acc="sonido"]'); if (b) { b.innerHTML = ic(S.sonido ? 'sonido' : 'mudo'); b.setAttribute('aria-label', S.sonido ? 'Silenciar' : 'Activar sonido'); } },
    'info-sala': function () { hojaInfoSala(); },
    'chat-sala': function () { S.panel = !S.panel; if (S.panel && S.panelTab === 'chat') S.chatNuevo = false; pintarPanel(); var b = $('.sala-top [data-acc="chat-sala"]'); if (b) b.setAttribute('aria-expanded', S.panel ? 'true' : 'false'); },
    'panel-tab': function (el) { S.panelTab = el.dataset.v; if (S.panelTab === 'chat') S.chatNuevo = false; pintarPanel(); var i = $('#sala-in'); if (i && esPC()) i.focus(); },
    frase: function (el) { decirEnSala(el.dataset.v); },
    'abrir-clash': function () { aviso('En la app real, este botón abre Clash Royale'); },
    invitacion: function () { aviso('En la app real se abre el link de invitación de ' + S.rival.n + ' en Clash Royale'); },
    'ya-agregue': function () {
      S.amigosHechos[S.rival.n] = true; S.amistad = true; S.pasosAbiertos = false;
      S.log.push({ k: 'p', t: 'Ya son amigos en Clash Royale' });
      render(); aviso('Listo. Ahora jugá la amistosa 1v1 contra ' + S.rival.n);
    },
    pasos: function () {
      S.pasosAbiertos = !S.pasosAbiertos;
      var p = $('#pasos'), b = $('.pasos-resumen'); if (p) p.classList.toggle('abierto', S.pasosAbiertos); if (b) b.setAttribute('aria-expanded', S.pasosAbiertos);
    },
    agregar: function () { hojaSimple('agregar', 'Agregá a ' + esc(S.rival.n), 'La amistad es obligatoria para jugar la amistosa', '<div class="pasos-n"><div class="paso-n"><span>Tocá el botón y se abre el enlace de invitación de <b>' + esc(S.rival.n) + '</b> en Clash Royale.</span></div><div class="paso-n"><span>Aceptá la amistad y volvé a esta sala.</span></div></div><button class="btn btn-violeta btn-ancho" data-acc="abrir-clash">Abrir link de invitación de ' + esc(S.rival.n) + '</button>'); },
    'ya-jugamos': function () { S.log.push({ k: 'l', q: 'Vos', t: 'Ya jugamos' }); location.hash = '#verificando'; },
    'pedir-cancelar': function () { cajaConfirmar(); },
    'seguir-duelo': function (el, e) { if (e && e.target.closest('.caja') && !e.target.closest('[data-acc="seguir-duelo"].btn')) return; cerrarCaja(); },
    'confirmar-cancelar': function () {
      S.cancelPedido = true; S.log.push({ k: 'l', q: 'Vos', t: 'Pediste cancelar' }); cerrarCaja();
      var b = $('[data-acc="pedir-cancelar"]'); if (b) { b.disabled = true; b.textContent = 'Pedido'; }
      aviso('Le avisamos a ' + S.rival.n + '. Si los dos lo piden y no jugaron, se devuelve todo.');
    },
    revancha: function () { hojaRevancha(); },
    'revancha-ok': function () {
      var ap = S.apuesta; if (ap > S.disp) return;
      congelar(ap, 'Revancha a ' + S.rival.n + ' · ' + hora());
      S.fase = 'esperando'; S.miMesa = { monto: ap, revancha: true, vence: Date.now() + 120000 };
      cerrarHoja(true); aviso('Invitación de revancha enviada a ' + S.rival.n); location.hash = '#mesas';
      simularRival();
    },
    'saltar-intro': function () { limpiar(); terminarIntro(); var f = $('.ingreso'); if (f) { f.classList.remove('en-intro'); f.classList.add('sin-intro'); } },
    'ing-modo': function (el) { S.ingreso = el.dataset.v; sesion('intro', '1'); render(); },
    olvide: function () { hojaSimple('olvide', 'Olvidé mi contraseña', 'Te mandamos un enlace de un solo uso', '<form class="campo" data-form="olvide"><label for="o-mail">Email</label><input class="input" id="o-mail" type="email" autocomplete="email"><button class="btn btn-violeta btn-ancho" style="margin-top:8px">Mandar enlace</button></form><p class="rk-nota">Si el email tiene una cuenta, te llega en unos minutos. Al usarlo se cierran tus otras sesiones.</p>'); },
    'ejemplo-link': function () { S.vinc.valor = 'https://link.clashroyale.com/invite/friend/es?tag=8LQYV02G'; S.vinc.error = ''; render(); },
    'vinc-si': function () { S.vinc.paso = 3; render(); },
    'vinc-no': function () { S.vinc.paso = 1; render(); var i = $('#v-link'); if (i) i.focus(); }
  };
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-acc]'); if (!el) return;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
    var fn = ACC[el.dataset.acc]; if (!fn) return;
    if (el.dataset.acc === 'nada') { e.stopPropagation(); return; }
    e.preventDefault(); fn(el, e);
  });
  /* El cuadro de confirmación: tocar afuera es «Seguir» */
  document.addEventListener('click', function (e) {
    var capa = e.target.closest('#caja-cancelar');
    if (capa && !e.target.closest('.caja')) { cerrarCaja(); }
  }, true);
  /* El aro de foco aparece sólo cuando se navega con el teclado */
  document.addEventListener('keydown', function (e) { if (e.key === 'Tab') document.documentElement.classList.add('teclado'); }, true);
  document.addEventListener('pointerdown', function () { document.documentElement.classList.remove('teclado'); }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('#caja-cancelar')) { cerrarCaja(); return; }
    if (!$('#capa').hidden) { cerrarHoja(); return; }
    if (S.panel) { S.panel = null; pintarPanel(); }
  });
  /* Campos */
  document.addEventListener('input', function (e) {
    var el = e.target, k = el.dataset && el.dataset.in; if (!k) return;
    if (k === 'contar') { var c = $('#' + el.dataset.cont); if (c) c.textContent = el.value.length + '/80'; var b = el.form && $('.env', el.form); if (b) b.disabled = !el.value.trim(); }
    if (k === 'crear-otro') { hojaCrear.st.otro = el.value; refrescarCrear(true); }
    if (k === 'dep-monto') { var st = hojaDepositar.st, pos = el.selectionStart; st.monto = el.value; actualizarHoja(hojaDepositar.cuerpo(), hojaDepositar.pie()); var n = $('#dep-monto'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* nada */ } }
    if (k === 'ret-monto') { var s2 = hojaRetirar.st, p2 = el.selectionStart; s2.monto = el.value; actualizarHoja(hojaRetirar.cuerpo(), hojaRetirar.pie()); var n2 = $('#ret-monto'); n2.focus(); try { n2.setSelectionRange(p2, p2); } catch (x) { /* nada */ } }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.in === 'dep-file') {
      var f = el.files && el.files[0], st = hojaDepositar.st, err = '';
      if (f) { if (['image/jpeg', 'image/png', 'image/webp'].indexOf(f.type) < 0) err = 'Tiene que ser JPG, PNG o WebP'; else if (f.size > 8 * 1024 * 1024) err = 'La imagen pesa más de 8 MB'; }
      st.comp = f && !err ? f.name : null;
      actualizarHoja(hojaDepositar.cuerpo(), hojaDepositar.pie());
      if (err) { var m = $('#dep-file-err'); if (m) m.textContent = err; }
    }
  });
  var ultimoMsj = 0;
  function filtroContacto(t) { return /\d[\d\s.-]{6,}\d|@|https?:|www\.|\.com\b/i.test(t); }
  document.addEventListener('submit', function (e) {
    var f = e.target, k = f.dataset.form; if (!k) return; e.preventDefault();
    if (k === 'chat-global' || k === 'chat-sala') {
      var inp = $('input', f), t = inp.value.trim(); if (!t) return;
      if (Date.now() - ultimoMsj < 2000) { aviso('Esperá un momento para mandar otro mensaje'); return; }
      if (filtroContacto(t)) { aviso('No se pueden pasar datos de contacto ni de pago'); return; }
      ultimoMsj = Date.now(); inp.value = '';
      if (k === 'chat-global') {
        var d = new Date(); CHAT_G.push({ yo: true, m: t, h: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') });
        var cc = $('#chat-cuerpo'), div = document.createElement('div'); div.className = 'msj mio';
        div.innerHTML = '<div class="col"><div class="globo"></div></div>'; var g = $('.globo', div); g.textContent = t; var tm = document.createElement('time'); tm.textContent = CHAT_G[CHAT_G.length - 1].h; g.appendChild(tm);
        cc.appendChild(div); cc.scrollTop = cc.scrollHeight; $('#chat-cont').textContent = '0/80'; $('.env', f).disabled = true;
      } else { decirEnSala(t); var i2 = $('#sala-in'); if (i2) i2.focus(); }
      return;
    }
    if (k === 'vincular') {
      var v = $('#v-link').value, tag = normalizarTag(v);
      S.vinc.valor = v;
      if (!tag) { S.vinc.error = 'No pude leer tu tag. Pegá el enlace de invitación completo (o tu #tag)'; render(); var x = $('#v-link'); if (x) x.focus(); return; }
      S.vinc.error = ''; S.tag = tag; S.vinc.paso = 2; render(); return;
    }
    if (k === 'ingreso') {
      var mail = $('#i-mail').value.trim(), pass = $('#i-pass').value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) || pass.length < 8) { $('#i-err').textContent = 'Email o contraseña incorrectos'; return; }
      location.hash = '#inicio'; return;
    }
    if (k === 'registro') {
      var u = $('#r-user').value.trim(), m2 = $('#r-mail').value.trim(), p = $('#r-pass').value, nac = $('#r-nac').value, ok18 = $('#r-18').checked, err = '';
      if (!/^[A-Za-z0-9_]{3,20}$/.test(u)) err = 'El usuario lleva de 3 a 20 letras, números o guion bajo';
      else if (/^(admin|soporte|duelo|vip|viproyale|vip_royale)$/i.test(u)) err = 'Ese nombre de usuario está reservado';
      else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m2)) err = 'Revisá el email';
      else if (p.length < 8) err = 'La contraseña lleva 8 caracteres o más';
      else if (!nac) err = 'Completá tu fecha de nacimiento';
      else { var dn = new Date(nac + 'T00:00:00'), hoy = new Date(), edad = hoy.getFullYear() - dn.getFullYear() - ((hoy.getMonth() < dn.getMonth() || (hoy.getMonth() === dn.getMonth() && hoy.getDate() < dn.getDate())) ? 1 : 0); if (!(edad >= 18)) err = 'Tenés que ser mayor de 18 para usar VIP Royale'; }
      if (!err && !ok18) err = 'Confirmá que tenés 18 años o más y aceptá los Términos';
      if (err) { $('#r-err').textContent = err; return; }
      S.usuario = u; S.mail = m2; S.vinc = { paso: 1, valor: '', error: '' }; location.hash = '#vincular'; return;
    }
    if (k === 'reclamo') { cerrarHoja(); aviso('Reclamo enviado · te respondemos en 24 h'); return; }
    if (k === 'olvide') { cerrarHoja(); aviso('Si el email tiene cuenta, te llega el enlace'); }
  });

  /* ------------------------------------------------------------------
     Estados a pedido, para el visor del celular y las capturas: ?estado=...
     (no es parte de la plataforma: en la app real no existe)
     ------------------------------------------------------------------ */
  var ESTADOS = {
    'chat-todo': function () { S.panelTab = 'todo'; S.panel = true; pintarPanel(); },
    'chat-chat': function () { S.chat = [{ yo: false, m: '¡Buena suerte!' }, { yo: true, m: 'Igualmente. Te mando la amistosa' }, { yo: false, m: 'Dale, ya te la acepto' }, { yo: true, m: 'Aceptá la batalla' }]; S.panelTab = 'chat'; S.panel = true; pintarPanel(); },
    'chat-frases': function () { S.panelTab = 'frases'; S.panel = true; pintarPanel(); },
    'chat-punto': function () { S.sinSaludo = true; S.chat.push({ yo: false, m: 'Te mandé la amistosa' }); S.chatNuevo = true; var d = $('.sala-top [data-acc="chat-sala"] .punto'); if (d) d.hidden = false; luego(function () { burbuja(false, 'Te mandé la amistosa'); }, 300); },
    cancelar: function () { cajaConfirmar(); },
    temas: function () { hojaTemas(); },
    info: function () { hojaInfoSala(); },
    depositar: function () { hojaDepositar(); },
    retirar: function () { hojaRetirar(); },
    unirse: function () { hojaUnirse(1); },
    avatares: function () { hojaAvatares('med'); },
    'fondo-perfil': function () { hojaFondos('perfil'); },
    'fondo-chat': function () { hojaFondos('chat'); },
    'crear-privada': function () { var st = hojaCrear.st; if (st) { st.privada = true; refrescarCrear(); } },
    'crear-invalido': function () { var st = hojaCrear.st; if (st) { st.otro = '25,00'; refrescarCrear(); } },
    privada: function () { congelar(100000, 'Mesa privada creada · ' + hora()); S.fase = 'esperando'; S.miMesa = { monto: 100000, privada: true, vence: Date.now() + 24 * 3600000, link: 'viproyale.test/m/K7Q2XP' }; render(); hojaLink(true); },
    'mi-mesa': function () { congelar(100000, 'Mesa creada · ' + hora()); S.fase = 'esperando'; S.miMesa = { monto: 100000, privada: false, vence: Date.now() + 15 * 60000 - 23000 }; render(); simularRival(); },
    revancha: function () { hojaRevancha(); },
    inscribirme: function () { hojaInscribir(1); },
    'torneo-juego': function () { S.torneoTab = 'juego'; render(); },
    'hist-detalle': function () { hojaHistorial(0); },
    registro: function () { S.ingreso = 'crear'; render(); },
    'vinc-2': function () { S.vinc.paso = 2; render(); },
    'vinc-3': function () { S.vinc.paso = 3; render(); },
    logros: function () { ACC.logros(); },
    limites: function () { ACC.limites(); },
    'crear-torneo': function () { hojaCrearTorneo(); },
    'inicio-juegos': function () { var t = $('#t-juegos'); if (t) irA(t.getBoundingClientRect().top + desplazador().scrollTop - 110); },
    /* Verificando con los dos historiales ya leídos, quieto (sin pasar al resultado) */
    'verif-leido': function () {
      if (ruta !== 'verificando') return; limpiar();
      $$('[data-lado]').forEach(function (e) { e.className = 'lado-est leido'; e.innerHTML = ic('check') + 'Historial leído'; });
      var tick = function () { var r = Math.max(0, 3600000 - (Date.now() - S.inicioDuelo)); var t = $('#reloj-txt'); if (t) t.textContent = mmss(r); }; cada(tick, 1000);
    }
  };
  function aplicarEstado() {
    var q = new URLSearchParams(location.search);
    var sala = q.get('sala');
    if (sala && SALAS.some(function (t) { return t[0] === sala; })) { S.sala = sala; document.body.dataset.sala = sala; }
    var e = q.get('estado');
    if (e && ESTADOS[e]) ESTADOS[e]();
  }

  /* ------------------------------------------------------------------
     Arranque
     ------------------------------------------------------------------ */
  degradesIniciales();
  armarShell();
  window.addEventListener('hashchange', render);
  if (/(?:^|[?&])amigo=1(?:&|$)/.test(location.search)) S.rival = J[0];
  render();
  aplicarEstado();
})();
