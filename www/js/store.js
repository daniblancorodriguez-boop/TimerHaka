/* HAKATIMER — almacenamiento local: ajustes, ejercicios, entrenos predefinidos, contador */
(function (root) {
  'use strict';
  var KEY = 'hakatimer.v1';

  /* ---------- Entrenos predefinidos de serie ----------
     Cada línea es {t:'ex', parts:[{ex, qty}], note} (uno o varios ejercicios juntos)
     o {t:'txt', text} (texto libre: 21-15-9, Buy out…). */
  function ex(id, qty) { return { ex: id, qty: qty || '' }; }
  function L(parts, note) { return { t: 'ex', parts: parts, note: note || '' }; }
  function X(text) { return { t: 'txt', text: text }; }

  function seedPresets() {
    return [
      { id: 'p2', name: "AMRAP 20'", mode: 'amrap', cfg: { dur: 1200 }, numbered: false, lines: [
        L([ex('american-swing', '15')]), L([ex('wallballs-lunge', '20')]), L([ex('du', '25')]),
        L([ex('shuttle-run', '3 × 12,5 m')]), L([ex('sled-pull', 'Max m')])] },
      { id: 'p3', name: 'Partner For Time 21-15-9 + 30-24-18', mode: 'fortime', cfg: { cap: 0 }, numbered: false, lines: [
        X('21-15-9'), L([ex('burpee-pull-ups')]), L([ex('db-hang-snatch')]), L([ex('db-step-up')]), L([ex('push-ups')]),
        X('+'), L([ex('cal-bike', '30-24-18 cal'), ex('run', '400 m')], 'juntos'),
        X('Buy out:'), L([ex('du', '150')], 'a repartir')] },
      { id: 'p4', name: "EMOM 10' · Burpees", mode: 'emom', cfg: { interval: 60, rounds: 10 }, numbered: false, lines: [
        L([ex('burpees', '8-14')], 'sin rest')] },
      { id: 'p6', name: "EMOM 12' · Front squat / Pull ups / Row", mode: 'emom', cfg: { interval: 60, rounds: 12 }, numbered: true, lines: [
        L([ex('tempo-front-squat', '6')]), L([ex('iso-pull-ups', 'Máx time')]), L([ex('db-bench-row', '6+6')])] },
      { id: 'p7', name: "EMOM 12' · Back squat / Bike / Run", mode: 'emom', cfg: { interval: 60, rounds: 12 }, numbered: true, lines: [
        L([ex('back-squat', '8')]), L([ex('sprint-bike', '30"')]), L([ex('run', '200 m')]), L([ex('rest')])] },
      { id: 'p8', name: "10' AMRAP × 2R × 1' REST", mode: 'amrapx', cfg: { dur: 600, blocks: 2, rest: 60 }, numbered: false, lines: [
        L([ex('run', '200 m')]), L([ex('ski', '200 m')]), L([ex('push-ups', '12')]), L([ex('burpees', '12')]), L([ex('sled-push', 'Max')])] }
    ];
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function defaults() {
    return {
      settings: {
        prep: 10, beepLast3: true, countFile: true, halfVoice: true, wellVoice: true, volume: 0.8, vibrate: true, gymName: '', logo: null,
        sounds: {
          countdown: { preset: 'beep' }, go: { preset: 'horn' }, minute: { preset: 'bell' },
          work: { preset: 'tick' }, rest: { preset: 'long' }, end: { preset: 'horn' }
        }
      },
      configs: {},
      exercises: clone(root.SEED_EXERCISES || []),
      presets: seedPresets(),
      counter: 0,
      history: [],
      session: null,
      seedsSeen: seedsSeenNow()
    };
  }

  /* Entrenos guardados con la versión anterior (solo texto): los de serie se sustituyen por la
     versión con ejercicios; los creados por el usuario se convierten en líneas de texto. */
  function migratePreset(pr, seeds) {
    if (Array.isArray(pr.lines)) return pr;
    var seed = seeds.filter(function (s) { return s.id === pr.id; })[0];
    if (seed) return seed;
    var lines = String(pr.desc || '').split('\n').filter(function (t) { return t.trim(); }).map(function (t) { return X(t.trim()); });
    return { id: pr.id, name: pr.name, mode: pr.mode, cfg: pr.cfg, numbered: false, lines: lines };
  }

  var OLD_P = ['p2', 'p3', 'p4', 'p6', 'p7', 'p8'];
  var NEW_E = [];
  function seedsSeenNow() { return { p: seedPresets().map(function (x) { return x.id; }), e: (root.SEED_EXERCISES || []).map(function (x) { return x.id; }) }; }
  var data;
  function load() {
    var d = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        d.settings = Object.assign(d.settings, p.settings || {});
        d.settings.sounds = Object.assign(defaults().settings.sounds, (p.settings && p.settings.sounds) || {});
        d.configs = p.configs || {};
        if (Array.isArray(p.exercises)) d.exercises = p.exercises;
        if (Array.isArray(p.presets)) { var seeds = seedPresets(); d.presets = p.presets.map(function (x) { return migratePreset(x, seeds); }); }
        /* Ejemplos y ejercicios nuevos de una versión posterior: se añaden una sola vez (si los borras, no vuelven solos) */
        var seen = p.seedsSeen || { p: OLD_P.slice(), e: (root.SEED_EXERCISES || []).map(function (e) { return e.id; }).filter(function (id) { return NEW_E.indexOf(id) < 0; }) };
        var haveP = {}, haveE = {};
        d.presets.forEach(function (x) { haveP[x.id] = 1; }); d.exercises.forEach(function (x) { haveE[x.id] = 1; });
        seedPresets().forEach(function (x) { if (seen.p.indexOf(x.id) < 0 && !haveP[x.id]) d.presets.push(x); });
        clone(root.SEED_EXERCISES || []).forEach(function (x) { if (seen.e.indexOf(x.id) < 0 && !haveE[x.id]) d.exercises.push(x); });
        d.counter = +p.counter || 0;
        if (Array.isArray(p.history)) d.history = p.history;
        if (p.session && p.session.pending && typeof p.session.elapsed === 'number') d.session = p.session;
      }
    } catch (e) { /* datos corruptos: se usan los valores por defecto */ }
    d.seedsSeen = seedsSeenNow();
    return d;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) {
      return false;      // sin espacio en el almacenamiento
    }
  }
  function newId(prefix) { return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1000); }

  data = load();

  var Store = {
    settings: function () { return data.settings; },
    setSettings: function (patch) { Object.assign(data.settings, patch); return persist(); },
    setSound: function (ev, snd) { data.settings.sounds[ev] = snd; return persist(); },

    /* ---- ejercicios ---- */
    exercises: function () {
      return data.exercises.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }); });
    },
    getExercise: function (id) { return data.exercises.filter(function (e) { return e.id === id; })[0] || null; },
    addExercise: function (e) {
      var item = { id: newId('x'), name: e.name, desc: e.desc || '' };
      data.exercises.push(item); persist(); return item;
    },
    updateExercise: function (id, e) {
      var it = Store.getExercise(id); if (!it) return null;
      it.name = e.name; it.desc = e.desc || ''; persist(); return it;
    },
    /* Nombres de los entrenos que usan un ejercicio */
    exerciseUsage: function (id) {
      return data.presets.filter(function (pr) {
        return pr.lines.some(function (l) { return l.t === 'ex' && l.parts.some(function (pt) { return pt.ex === id; }); });
      }).map(function (pr) { return pr.name; });
    },
    removeExercise: function (id) {
      if (Store.exerciseUsage(id).length) return false;
      data.exercises = data.exercises.filter(function (e) { return e.id !== id; }); persist(); return true;
    },
    restoreExercises: function () {
      var have = {}; data.exercises.forEach(function (e) { have[e.id] = 1; });
      var add = clone(root.SEED_EXERCISES || []).filter(function (e) { return !have[e.id]; });
      data.exercises = data.exercises.concat(add); persist(); return add.length;
    },

    /* ---- entrenos predefinidos ---- */
    presets: function () { return data.presets.slice(); },
    getPreset: function (id) { return data.presets.filter(function (x) { return x.id === id; })[0] || null; },
    addPreset: function (pr) {
      var item = { id: newId('p'), name: pr.name, mode: pr.mode, cfg: pr.cfg, numbered: !!pr.numbered, lines: pr.lines || [] };
      data.presets.push(item); persist(); return item;
    },
    updatePreset: function (id, pr) {
      var it = Store.getPreset(id); if (!it) return null;
      it.name = pr.name; it.mode = pr.mode; it.cfg = pr.cfg; it.numbered = !!pr.numbered; it.lines = pr.lines || []; persist(); return it;
    },
    removePreset: function (id) { data.presets = data.presets.filter(function (x) { return x.id !== id; }); persist(); },
    /* Vuelve a añadir los ejemplos del box que se hayan borrado (no toca los demás) */
    restorePresets: function () {
      var have = {}; data.presets.forEach(function (x) { have[x.id] = 1; });
      var missing = seedPresets().filter(function (x) { return !have[x.id]; });
      Store.restoreExercises();
      data.presets = data.presets.concat(missing); persist(); return missing.length;
    },

    /* ---- historial de resultados y marcas personales ---- */
    /* Puntuación comparable: For Time = menos tiempo es mejor; AMRAP = más rondas (y repes) es mejor. Otros modos: sin marca. */
    score: function (r) {
      if (r.modeId === 'fortime' && r.kind === 'time' && r.value > 0) return { dir: -1, v: r.value };
      if ((r.modeId === 'amrap' || r.modeId === 'amrapx') && r.kind === 'rounds' && (r.value > 0 || r.reps > 0)) return { dir: 1, v: r.value * 1000 + (r.reps || 0) };
      return null;
    },
    history: function () { return data.history.slice(); },
    addResult: function (r) {
      var key = r.modeId + '|' + String(r.name || '').trim().toLowerCase();
      var rec = Object.assign({}, r, { id: newId('h'), ts: Date.now(), key: key, pr: false });
      var sc = Store.score(rec);
      if (sc) {
        var prev = data.history.filter(function (h) { return h.key === key && Store.score(h); });
        if (prev.length) {
          var best = prev.reduce(function (a, h) { var v = Store.score(h).v; return sc.dir * v > sc.dir * a ? v : a; }, Store.score(prev[0]).v);
          rec.pr = sc.dir * sc.v > sc.dir * best;
        }
      }
      data.history.push(rec);
      if (data.history.length > 500) data.history.splice(0, data.history.length - 500);
      persist(); return rec;
    },
    removeResult: function (id) { data.history = data.history.filter(function (h) { return h.id !== id; }); persist(); },
    clearHistory: function () { data.history = []; persist(); },

    /* ---- entreno pausado y guardado para retomar ---- */
    session: function () { return data.session || null; },
    saveSession: function (x) { data.session = x; return persist(); },
    clearSession: function () { data.session = null; persist(); },

    counter: function () { return data.counter || 0; },
    setCounter: function (n) { data.counter = Math.max(0, Math.min(99, n | 0)); persist(); },

    config: function (mode) { return Object.assign(root.Timer.defaultConfig(mode), data.configs[mode] || {}); },
    setConfig: function (mode, cfg) { data.configs[mode] = Object.assign({}, cfg); persist(); }
  };
  root.Store = Store;
})(window);
