/* HAKATIMER — lógica pura de temporizadores (sin DOM, testeable en Node) */
(function (root) {
  'use strict';

  /* Definición de modos. Los tiempos se guardan en segundos. */
  var MODES = [
    {
      id: 'fortime', name: 'For Time',
      desc: 'Cronómetro hacia arriba. Termina el entreno lo más rápido posible.',
      manual: true,
      fields: [{ k: 'cap', type: 'time', label: 'Time cap (00:00 = sin límite)', def: 0 }]
    },
    {
      id: 'amrap', name: 'AMRAP',
      desc: 'Cuenta atrás. Haz tantas rondas como puedas y apúntalas en el contador.',
      manual: true,
      fields: [{ k: 'dur', type: 'time', label: 'Duración', def: 720 }]
    },
    {
      id: 'amrapx', name: 'AMRAP con descansos',
      desc: 'Varios bloques AMRAP con descanso entre ellos. Con contador de rondas.',
      manual: true,
      fields: [
        { k: 'dur', type: 'time', label: 'Duración de cada AMRAP', def: 600 },
        { k: 'blocks', type: 'num', label: 'Bloques', def: 2, min: 1, max: 10 },
        { k: 'rest', type: 'time', label: 'Descanso entre bloques', def: 60 }
      ]
    },
    {
      id: 'emom', name: 'EMOM',
      desc: 'Cada minuto en el minuto. Suena en cada cambio de intervalo.',
      fields: [
        { k: 'interval', type: 'time', label: 'Duración del intervalo', def: 60 },
        { k: 'rounds', type: 'num', label: 'Rondas', def: 10, min: 1, max: 99 }
      ]
    },
    {
      id: 'tabata', name: 'Tabata',
      desc: 'Trabajo y descanso en rondas. Clásico: 20 s / 10 s × 8.',
      fields: [
        { k: 'work', type: 'time', label: 'Trabajo', def: 20 },
        { k: 'rest', type: 'time', label: 'Descanso', def: 10 },
        { k: 'rounds', type: 'num', label: 'Rondas', def: 8, min: 1, max: 99 }
      ]
    },
    {
      id: 'interval', name: 'Intervalos',
      desc: 'Rondas con tiempos de trabajo y descanso a tu medida.',
      fields: [
        { k: 'work', type: 'time', label: 'Trabajo', def: 40 },
        { k: 'rest', type: 'time', label: 'Descanso', def: 20 },
        { k: 'rounds', type: 'num', label: 'Rondas', def: 8, min: 1, max: 99 }
      ]
    },
    {
      id: 'rest', name: 'Descanso',
      desc: 'Cuenta atrás para controlar el descanso entre series.',
      fields: [{ k: 'dur', type: 'time', label: 'Duración del descanso', def: 60 }]
    },
    {
      id: 'equal', name: 'Trabajo = descanso',
      desc: 'Descansas el mismo tiempo que has trabajado.',
      fields: [
        { k: 'work', type: 'time', label: 'Trabajo (y descanso)', def: 30 },
        { k: 'rounds', type: 'num', label: 'Rondas', def: 10, min: 1, max: 99 }
      ]
    },
    {
      id: 'counter', name: 'Contador de rondas',
      desc: 'Solo cuenta rondas, sin reloj. Para usar en cualquier entreno del box.',
      fields: []
    },
    {
      id: 'fgb', name: 'Fight Gone Bad',
      desc: 'Clásico: 5 estaciones de 1 min, 1 min de descanso, 3 rondas.',
      fields: [
        { k: 'rounds', type: 'num', label: 'Rondas', def: 3, min: 1, max: 20 },
        { k: 'stations', type: 'num', label: 'Estaciones por ronda', def: 5, min: 1, max: 20 },
        { k: 'work', type: 'time', label: 'Tiempo por estación', def: 60 },
        { k: 'rest', type: 'time', label: 'Descanso entre rondas', def: 60 }
      ]
    }
  ];

  var ORDER = ['fortime', 'emom', 'amrap', 'amrapx', 'tabata', 'interval', 'rest', 'equal', 'fgb', 'counter'];
  MODES.sort(function (a, b) { return ORDER.indexOf(a.id) - ORDER.indexOf(b.id); });

  function getMode(id) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i];
    return null;
  }

  function defaultConfig(id) {
    var m = getMode(id), c = {};
    if (!m) return c;
    m.fields.forEach(function (f) { c[f.k] = f.def; });
    return c;
  }

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* Texto corto con la configuración, para listas */
  function summary(id, c) {
    c = Object.assign(defaultConfig(id), c || {});
    switch (id) {
      case 'fortime': return c.cap ? 'Time cap ' + fmt(c.cap) : 'Sin time cap';
      case 'amrap': return fmt(c.dur) + ' min';
      case 'emom': return c.rounds + ' × ' + fmt(c.interval);
      case 'tabata':
      case 'interval': return c.rounds + ' × ' + fmt(c.work) + ' / ' + fmt(c.rest);
      case 'amrapx': return c.blocks + ' × ' + fmt(c.dur) + ' AMRAP / ' + fmt(c.rest);
      case 'rest': return fmt(c.dur);
      case 'equal': return c.rounds + ' × ' + fmt(c.work) + ' / ' + fmt(c.work);
      case 'fgb': return c.rounds + ' rondas × ' + c.stations + ' × ' + fmt(c.work);
      case 'counter': return 'Sin reloj';
    }
    return '';
  }

  /* Plan: lista de segmentos {dur, type, label, round}. */
  function buildPlan(id, cfg) {
    var c = Object.assign(defaultConfig(id), cfg || {});
    var segs = [], i, k;
    var plan = { mode: id, kind: 'segments', segments: segs, manual: false, cap: 0 };

    switch (id) {
      case 'fortime':
        plan.kind = 'up'; plan.manual = true; plan.cap = c.cap || 0;
        break;
      case 'amrap':
        plan.manual = true;
        segs.push({ dur: c.dur, type: 'work', label: 'AMRAP', round: 0 });
        break;
      case 'emom':
        for (i = 1; i <= c.rounds; i++) segs.push({ dur: c.interval, type: 'minute', label: 'EMOM', round: i });
        break;
      case 'tabata':
        for (i = 1; i <= c.rounds; i++) {
          segs.push({ dur: c.work, type: 'work', label: 'Trabajo', round: i });
          if (c.rest > 0) segs.push({ dur: c.rest, type: 'rest', label: 'Descanso', round: i });
        }
        break;
      case 'interval':
        for (i = 1; i <= c.rounds; i++) {
          segs.push({ dur: c.work, type: 'work', label: 'Trabajo', round: i });
          if (c.rest > 0 && i < c.rounds) segs.push({ dur: c.rest, type: 'rest', label: 'Descanso', round: i });
        }
        break;
      case 'equal':
        for (i = 1; i <= c.rounds; i++) {
          segs.push({ dur: c.work, type: 'work', label: 'Trabajo', round: i });
          if (i < c.rounds) segs.push({ dur: c.work, type: 'rest', label: 'Descanso', round: i });
        }
        break;
      case 'amrapx':
        plan.manual = true;
        for (i = 1; i <= c.blocks; i++) {
          segs.push({ dur: c.dur, type: 'work', label: 'AMRAP ' + i + '/' + c.blocks, round: i });
          if (c.rest > 0 && i < c.blocks) segs.push({ dur: c.rest, type: 'rest', label: 'Descanso', round: i });
        }
        break;
      case 'rest':
        segs.push({ dur: c.dur, type: 'rest', label: 'Descanso', round: 0 });
        break;
      case 'fgb':
        for (i = 1; i <= c.rounds; i++) {
          for (k = 1; k <= c.stations; k++) {
            segs.push({ dur: c.work, type: 'minute', label: 'Estación ' + k, round: i });
          }
          if (c.rest > 0 && i < c.rounds) segs.push({ dur: c.rest, type: 'rest', label: 'Descanso', round: i });
        }
        break;
      case 'counter':
        plan.kind = 'counter';
        break;
      default:
        throw new Error('Modo desconocido: ' + id);
    }
    plan.total = segs.reduce(function (a, s) { return a + s.dur; }, 0);
    return plan;
  }

  /* Muestras de audio (www/audio): el pitido largo del archivo de cuenta atrás empieza en el ms 3020, así que el archivo
     se arranca 3,02 s antes de cada cambio para que el pitido largo caiga justo en él. */
  var COUNT_LEAD_MS = 3020, COUNT_LEN_MS = 4049, HALF_LEN_MS = 1680, WELL_LEN_MS = 900, WELL_DELAY_MS = 1250, HALF_MIN_SEC = 15;

  /* Línea de tiempo de sonidos: [{ev, ms}] ordenada, con ms desde el pulsar Empezar.
     Es lo que permite programar los pitidos por adelantado en el reloj de audio.
     Opciones (todas apagadas por defecto, así el comportamiento clásico no cambia):
       beepLast3   pitidos 3-2-1 al final de cada intervalo
       countSample en el arranque y en cada cambio de «minuto» (EMOM, Fight Gone Bad) suena el archivo de cuenta atrás
                   (3 pitidos + largo) en lugar de los pitidos sueltos; los eventos sustituidos quedan con silent:true (solo vibran)
       halfway     voz «mitad del tiempo superada» a la mitad de cada tiempo de trabajo (≥ 15 s) y, en For Time con límite, del límite
       wellDone    voz «Well done» 1,25 s después de la bocina final */
  function timeline(plan, prepSec, opts) {
    opts = opts || {};
    var out = [], P = prepSec * 1000, r, e;
    var fileStart = !!opts.countSample && P >= COUNT_LEAD_MS;
    if (fileStart) out.push({ ev: 'countfile', ms: P - COUNT_LEAD_MS, len: COUNT_LEN_MS });
    for (r = Math.min(3, prepSec); r >= 1; r--) { e = { ev: 'countdown', ms: P - r * 1000 }; if (fileStart) e.silent = true; out.push(e); }
    e = { ev: 'go', ms: P }; if (fileStart) e.silent = true; out.push(e);
    var endMs, hasWork = plan.kind === 'up';
    if (plan.kind === 'up') {
      if (plan.cap) {
        endMs = P + plan.cap * 1000;
        if (opts.halfway && plan.cap >= HALF_MIN_SEC) out.push({ ev: 'half', ms: P + plan.cap * 500, len: HALF_LEN_MS });
        out.push({ ev: 'end', ms: endMs });
      }
    } else {
      var acc = P, segs = plan.segments, prevFile = false;
      segs.forEach(function (sg, i) {
        if (sg.type !== 'rest') hasWork = true;
        if (i > 0) {
          e = { ev: sg.type === 'minute' ? 'minute' : sg.type === 'rest' ? 'rest' : 'work', ms: acc };
          if (prevFile) e.silent = true;
          out.push(e);
        }
        var next = segs[i + 1];
        var file = !!opts.countSample && !!opts.beepLast3 && !!next && next.type === 'minute' && sg.dur * 1000 >= COUNT_LEAD_MS + 300;
        if (file) out.push({ ev: 'countfile', ms: acc + sg.dur * 1000 - COUNT_LEAD_MS, len: COUNT_LEN_MS });
        if (opts.beepLast3 && sg.dur > 3) for (r = 3; r >= 1; r--) { e = { ev: 'countdown', ms: acc + (sg.dur - r) * 1000 }; if (file) e.silent = true; out.push(e); }
        if (opts.halfway && (sg.type === 'minute' || sg.type === 'work') && sg.dur >= HALF_MIN_SEC) out.push({ ev: 'half', ms: acc + sg.dur * 500, len: HALF_LEN_MS });
        prevFile = file;
        acc += sg.dur * 1000;
      });
      endMs = acc;
      out.push({ ev: 'end', ms: endMs });
    }
    if (opts.wellDone && hasWork && endMs !== undefined) out.push({ ev: 'well', ms: endMs + WELL_DELAY_MS, len: WELL_LEN_MS });
    return out.sort(function (a, b) { return a.ms - b.ms; });
  }

  /* Estado del reloj tras `ms` milisegundos desde el inicio (incluye la cuenta previa). */
  function stateAt(plan, prepSec, ms) {
    var prepMs = prepSec * 1000;
    if (ms < prepMs) {
      var rem = Math.ceil((prepMs - ms) / 1000);
      return { phase: 'prep', display: rem, remaining: rem, round: 0, segIndex: -1, type: 'prep', label: 'Preparados' };
    }
    var t = ms - prepMs;

    if (plan.kind === 'up') {
      if (plan.cap && t >= plan.cap * 1000) {
        return { phase: 'done', display: plan.cap, remaining: 0, round: 0, segIndex: 0, type: 'done', label: 'Fin' };
      }
      return { phase: 'run', display: Math.floor(t / 1000), remaining: null, round: 0, segIndex: 0, type: 'work', label: 'En marcha' };
    }

    var acc = 0, segs = plan.segments;
    for (var i = 0; i < segs.length; i++) {
      var end = acc + segs[i].dur * 1000;
      if (t < end) {
        var remaining = Math.ceil((end - t) / 1000);
        return { phase: 'run', display: remaining, remaining: remaining, round: segs[i].round, segIndex: i, type: segs[i].type, label: segs[i].label, segDur: segs[i].dur };
      }
      acc = end;
    }
    var last = segs.length ? segs[segs.length - 1] : { round: 0 };
    return { phase: 'done', display: 0, remaining: 0, round: last.round, segIndex: segs.length, type: 'done', label: 'Fin' };
  }

  /* Eventos de sonido a disparar al pasar del estado `prev` al estado `cur`. */
  function eventsFor(plan, prev, cur, opts) {
    var ev = [];
    opts = opts || {};
    if (!prev) prev = { phase: 'init' };

    if (cur.phase === 'prep') {
      if (cur.remaining > 0 && cur.remaining <= 3 && (prev.phase !== 'prep' || prev.remaining !== cur.remaining)) ev.push('countdown');
      return ev;
    }
    if (cur.phase === 'run') {
      if (prev.phase === 'init' || prev.phase === 'prep') {
        ev.push('go');
        return ev;
      }
      if (prev.phase === 'run') {
        if (cur.segIndex !== prev.segIndex) {
          if (cur.type === 'minute') ev.push('minute');
          else if (cur.type === 'rest') ev.push('rest');
          else ev.push('work');
        } else if (opts.beepLast3 && cur.remaining != null && cur.remaining >= 1 && cur.remaining <= 3 &&
                   prev.remaining !== cur.remaining && (cur.segDur || 0) > 3) {
          ev.push('countdown');
        }
      }
      return ev;
    }
    if (cur.phase === 'done' && prev.phase !== 'done') ev.push('end');
    return ev;
  }

  /* En EMOM, intervalos, tabata y trabajo=descanso cada ronda es un ejercicio de la lista:
     si hay menos rondas que ejercicios, el entreno no se puede hacer entero. Devuelve el texto del error o null. */
  var ROTATING = ['emom', 'interval', 'tabata', 'equal'];
  function exerciseCount(lines) { return (lines || []).filter(function (l) { return l.t === 'ex'; }).length; }
  function validateLines(modeId, cfg, lines) {
    var n = exerciseCount(lines);
    if (!n || ROTATING.indexOf(modeId) === -1) return null;
    var c = Object.assign(defaultConfig(modeId), cfg || {});
    if (c.rounds >= n) return null;
    var total = buildPlan(modeId, c).total;
    return 'El tiempo (' + fmt(total) + ') o las rondas (' + c.rounds + ') son inferiores al número de ejercicios (' + n + '). Sube las rondas o quita ejercicios.';
  }

  var api = {
    ROTATING: ROTATING, exerciseCount: exerciseCount, validateLines: validateLines,
    MODES: MODES, getMode: getMode, defaultConfig: defaultConfig, fmt: fmt, summary: summary,
    buildPlan: buildPlan, stateAt: stateAt, eventsFor: eventsFor, timeline: timeline,
    COUNT_LEAD_MS: COUNT_LEAD_MS, COUNT_LEN_MS: COUNT_LEN_MS, HALF_LEN_MS: HALF_LEN_MS, WELL_LEN_MS: WELL_LEN_MS, WELL_DELAY_MS: WELL_DELAY_MS
  };
  root.Timer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
