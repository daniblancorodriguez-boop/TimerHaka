const assert = require('assert');
const T = require('../www/js/timer.js');

// Simula el reloj a 100 ms y recoge eventos
function sim(id, cfg, prep, opts, until) {
  const plan = T.buildPlan(id, cfg);
  let prev = null, events = [];
  const end = until || ((prep + plan.total + 3) * 1000);
  for (let ms = 0; ms <= end; ms += 100) {
    const cur = T.stateAt(plan, prep, ms);
    T.eventsFor(plan, prev, cur, opts).forEach(e => events.push([ms, e]));
    prev = cur;
  }
  return { plan, events };
}
const count = (ev, n) => ev.filter(e => e[1] === n).length;

// Tabata: 8 rondas, 4:00 total
let r = sim('tabata', {}, 10, { beepLast3: true });
assert.strictEqual(r.plan.total, 240);
assert.strictEqual(count(r.events, 'go'), 1);
assert.strictEqual(count(r.events, 'end'), 1);
assert.strictEqual(count(r.events, 'work'), 7);   // inicio de cada trabajo salvo el primero
assert.strictEqual(count(r.events, 'rest'), 8);
// Cuenta previa: pitidos en 3,2,1 (a los 7 s, 8 s, 9 s) y "go" a los 10 s
const pre = r.events.filter(e => e[1] === 'countdown' && e[0] < 10000).map(e => e[0]);
assert.deepStrictEqual(pre, [7000, 8000, 9000].map(x => x + 100 - 100 + 0).map(x => pre[pre.indexOf(x)]));
assert.strictEqual(pre.length, 3);
assert.strictEqual(r.events.find(e => e[1] === 'go')[0], 10000);
console.log('tabata ok, pitidos previos en ms:', pre);

// EMOM 10 x 60 s: 9 cambios de minuto + fin
r = sim('emom', { rounds: 10, interval: 60 }, 10, { beepLast3: false });
assert.strictEqual(count(r.events, 'minute'), 9);
assert.strictEqual(count(r.events, 'end'), 1);
console.log('emom ok');

// AMRAP 12:00 sin time cap
r = sim('amrap', {}, 10, { beepLast3: true });
assert.strictEqual(r.plan.total, 720);
assert.strictEqual(count(r.events, 'end'), 1);
assert.strictEqual(count(r.events, 'countdown'), 3 + 3);
console.log('amrap ok');

// For Time con cap de 5 min
r = sim('fortime', { cap: 300 }, 3, {}, 400000);
assert.strictEqual(count(r.events, 'end'), 1);
assert.strictEqual(r.events.find(e => e[1] === 'end')[0], 303000);
// For Time sin cap: nunca termina solo
r = sim('fortime', { cap: 0 }, 10, {}, 3600000);
assert.strictEqual(count(r.events, 'end'), 0);
console.log('fortime ok');

// Fight Gone Bad: 3 x 5 x 60 + 2 x 60 = 1020 s
r = sim('fortime', {}, 0, {}, 1000);
const fgb = T.buildPlan('fgb', {});
assert.strictEqual(fgb.total, 3 * 5 * 60 + 2 * 60);
assert.strictEqual(T.stateAt(fgb, 10, 10000 + 61000).label, 'Estación 2');
assert.strictEqual(T.stateAt(fgb, 10, 10000 + 301000).label, 'Descanso');
assert.strictEqual(T.stateAt(fgb, 10, 10000 + 361000).round, 2);
console.log('fgb ok');

// Trabajo = descanso y descanso temporizado
assert.strictEqual(T.buildPlan('equal', { work: 30, rounds: 3 }).total, 150);
assert.strictEqual(T.buildPlan('rest', { dur: 90 }).total, 90);
assert.strictEqual(T.stateAt(T.buildPlan('rest', { dur: 90 }), 0, 1).display, 90);
assert.strictEqual(T.fmt(125), '02:05');

// Sin cuenta previa: "go" inmediato
r = sim('rest', { dur: 5 }, 0, {});
assert.strictEqual(r.events[0][1], 'go');
// Pantalla de resumen para listas
assert.strictEqual(T.summary('emom', { rounds: 12, interval: 60 }), '12 × 01:00');
// AMRAP con descansos: 2 x 10' + 1' de descanso
r = sim('amrapx', { dur: 600, blocks: 2, rest: 60 }, 10, { beepLast3: false });
assert.strictEqual(r.plan.total, 1260);
assert.strictEqual(count(r.events, 'rest'), 1);
assert.strictEqual(count(r.events, 'work'), 1);
assert.strictEqual(count(r.events, 'end'), 1);
assert.strictEqual(T.stateAt(r.plan, 0, 100000).label, 'AMRAP 1/2');
assert.strictEqual(T.stateAt(r.plan, 0, 700000).label, 'AMRAP 2/2');
// Contador de rondas: sin reloj; y el menú queda ordenado
assert.strictEqual(T.buildPlan('counter', {}).kind, 'counter');
const ids = T.MODES.map(m => m.id);
assert.deepStrictEqual(ids.slice(0, 3), ['fortime', 'emom', 'amrap']);
assert.strictEqual(ids[ids.length - 1], 'counter');
assert.ok(!ids.includes('clock'), 'el Reloj ya no existe');
// Validación: EMOM con menos rondas que ejercicios
const L = n => Array.from({ length: n }, () => ({ t: 'ex', parts: [{ ex: 'run', qty: '' }], note: '' }));
const e1 = T.validateLines('emom', { interval: 60, rounds: 5 }, L(6));
assert.ok(/05:00/.test(e1) && /\(5\)/.test(e1) && /\(6\)/.test(e1), e1);
assert.strictEqual(T.validateLines('emom', { interval: 60, rounds: 6 }, L(6)), null);
assert.strictEqual(T.validateLines('emom', { interval: 60, rounds: 12 }, L(3)), null);
assert.strictEqual(T.validateLines('amrap', { dur: 60 }, L(6)), null, 'AMRAP no rota ejercicios');
assert.strictEqual(T.validateLines('emom', { rounds: 2 }, [{ t: 'txt', text: '21-15-9' }]), null, 'el texto libre no cuenta');
console.log('TODOS LOS TESTS OK');

// ---- timeline == eventsFor (muestreo fino) en todos los modos ----
{
  const T = require('../www/js/timer.js');
  const Tm = T.Timer || global.Timer || T;
  for (const id of Tm.MODES.map(m => m.id).filter(i => i !== 'counter')) {
    for (const prep of [0, 2, 10]) {
      const plan = Tm.buildPlan(id, Tm.defaultConfig(id));
      if (plan.kind === 'up') plan.cap = 90;
      const tl = Tm.timeline(plan, prep, { beepLast3: true });
      const ev = []; let prev = null;
      const total = ((plan.total || plan.cap) + prep + 2) * 1000;
      for (let ms = 0; ms <= total; ms += 10) {
        const cur = Tm.stateAt(plan, prep, ms);
        Tm.eventsFor(plan, prev, cur, { beepLast3: true }).forEach(e => ev.push([e, ms])); prev = cur;
      }
      const a = tl.map(e => e.ev).join(','), b = ev.map(e => e[0]).join(',');
      assert.strictEqual(a, b, `timeline ${id} prep ${prep}: mismas secuencias de eventos`);
      tl.forEach((e, i) => assert.ok(Math.abs(e.ms - ev[i][1]) <= 10, `${id} ${e.ev}: ${e.ms} vs ${ev[i][1]}`));
    }
  }
  console.log('timeline coincide con eventsFor en todos los modos');
}

// ---- Sonidos nuevos: cuenta atrás con archivo, voz de mitad, Well done ----
{
  const Tm = require('../www/js/timer.js');
  const ALL = { beepLast3: true, countSample: true, halfway: true, wellDone: true };
  const by = (tl, ev) => tl.filter(e => e.ev === ev);
  const LEAD = Tm.COUNT_LEAD_MS;
  assert.strictEqual(LEAD, 3020, 'el pitido largo del archivo empieza en 3,02 s');

  // EMOM 3 × 60 s con cuenta atrás de 10 s
  let tl = Tm.timeline(Tm.buildPlan('emom', { interval: 60, rounds: 3 }), 10, ALL);
  assert.deepStrictEqual(by(tl, 'countfile').map(e => e.ms), [10000 - LEAD, 70000 - LEAD, 130000 - LEAD], 'archivo de cuenta atrás: al inicio y en cada cambio de minuto');
  by(tl, 'countfile').forEach(e => assert.strictEqual(e.len, Tm.COUNT_LEN_MS));
  assert.deepStrictEqual(by(tl, 'half').map(e => e.ms), [40000, 100000, 160000], 'mitad de cada minuto');
  assert.ok(by(tl, 'go')[0].silent && by(tl, 'minute').every(e => e.silent), 'go y minute no suenan (los cubre el archivo), solo vibran');
  assert.ok(by(tl, 'countdown').filter(e => e.ms < 190000 - 3500).every(e => e.silent), 'pitidos sueltos sustituidos por el archivo');
  assert.ok(by(tl, 'countdown').filter(e => e.ms >= 187000).every(e => !e.silent), 'antes del final siguen los 3 pitidos y la bocina');
  assert.strictEqual(by(tl, 'end')[0].ms, 190000);
  assert.strictEqual(by(tl, 'well')[0].ms, 190000 + Tm.WELL_DELAY_MS, 'Well done después de la bocina');
  assert.ok(Tm.WELL_DELAY_MS >= 1100, 'la bocina (1,1 s) termina antes de la voz');
  // sin choques: el archivo termina en el cambio y la voz de mitad termina antes de que empiece el siguiente archivo
  assert.ok(100000 + Tm.HALF_LEN_MS < 130000 - LEAD);

  // AMRAP 20': mitad del tiempo total
  tl = Tm.timeline(Tm.buildPlan('amrap', { dur: 1200 }), 10, ALL);
  assert.deepStrictEqual(by(tl, 'half').map(e => e.ms), [10000 + 600000]);
  assert.strictEqual(by(tl, 'countfile').length, 1, 'en AMRAP solo al empezar');
  assert.strictEqual(by(tl, 'well').length, 1);

  // For Time con límite: mitad del límite; sin límite: nada (acaba a mano)
  tl = Tm.timeline(Tm.buildPlan('fortime', { cap: 600 }), 10, ALL);
  assert.deepStrictEqual(by(tl, 'half').map(e => e.ms), [10000 + 300000]);
  assert.strictEqual(by(tl, 'well')[0].ms, 610000 + Tm.WELL_DELAY_MS);
  tl = Tm.timeline(Tm.buildPlan('fortime', { cap: 0 }), 10, ALL);
  assert.strictEqual(by(tl, 'half').length + by(tl, 'well').length, 0);

  // Tabata 20/10: mitad solo del trabajo; el cambio trabajo/descanso conserva sus sonidos
  tl = Tm.timeline(Tm.buildPlan('tabata', { work: 20, rest: 10, rounds: 2 }), 10, ALL);
  assert.deepStrictEqual(by(tl, 'half').map(e => e.ms), [20000, 50000]);
  assert.ok(by(tl, 'rest').concat(by(tl, 'work')).every(e => !e.silent), 'trabajo/descanso suenan como siempre');
  assert.strictEqual(by(tl, 'countfile').length, 1, 'en trabajo/descanso no se usa el archivo');
  // intervalo de trabajo corto (< 15 s): sin mitad
  tl = Tm.timeline(Tm.buildPlan('tabata', { work: 10, rest: 5, rounds: 2 }), 10, ALL);
  assert.strictEqual(by(tl, 'half').length, 0);

  // Descanso: ni Well done ni mitad
  tl = Tm.timeline(Tm.buildPlan('rest', { dur: 60 }), 10, ALL);
  assert.strictEqual(by(tl, 'well').length + by(tl, 'half').length, 0);

  // Cuenta atrás previa demasiado corta: pitidos de siempre al empezar
  tl = Tm.timeline(Tm.buildPlan('emom', { interval: 60, rounds: 2 }), 3, ALL);
  assert.ok(by(tl, 'countfile').every(e => e.ms > 3000), 'con 3 s no cabe el archivo al inicio');
  assert.ok(!by(tl, 'go')[0].silent && by(tl, 'countdown').slice(0, 3).every(e => !e.silent));
  tl = Tm.timeline(Tm.buildPlan('emom', { interval: 60, rounds: 2 }), 0, ALL);
  assert.strictEqual(by(tl, 'countfile').filter(e => e.ms < 0).length, 0, 'nunca se programa antes de empezar');

  // Interruptores apagados = comportamiento clásico
  const plan = Tm.buildPlan('emom', { interval: 60, rounds: 3 });
  assert.deepStrictEqual(Tm.timeline(plan, 10, { beepLast3: true }), Tm.timeline(plan, 10, { beepLast3: true, countSample: false, halfway: false, wellDone: false }));
  tl = Tm.timeline(plan, 10, { beepLast3: true, countSample: true });
  assert.strictEqual(by(tl, 'half').length + by(tl, 'well').length, 0, 'mitad y Well done apagados');
  tl = Tm.timeline(plan, 10, { beepLast3: false, countSample: true });
  assert.ok(by(tl, 'minute').every(e => !e.silent), 'sin pitidos 3-2-1 el cambio de minuto conserva su sonido');
  tl = Tm.timeline(plan, 10, { beepLast3: true, halfway: true });
  assert.strictEqual(by(tl, 'countfile').length, 0);

  // las líneas de tiempo siguen ordenadas
  for (const id of Tm.MODES.map(m => m.id).filter(i => i !== 'counter')) {
    const pl = Tm.buildPlan(id, Tm.defaultConfig(id)); if (pl.kind === 'up') pl.cap = 300;
    const t2 = Tm.timeline(pl, 10, ALL);
    t2.forEach((e, i) => { if (i) assert.ok(e.ms >= t2[i - 1].ms, id + ' ordenado'); assert.ok(e.ms >= 0, id + ' sin tiempos negativos'); });
  }
  console.log('sonidos nuevos (cuenta atrás, mitad, Well done) OK');

  // ---- Voces de aviso: Last round! / Last minute! / Ten seconds! ----
  const AL = Object.assign({}, ALL, { alerts: true });
  const ms = (t, ev) => by(t, ev).map(e => e.ms);
  tl = Tm.timeline(Tm.buildPlan('emom', { interval: 60, rounds: 5 }), 10, AL);
  assert.deepStrictEqual(ms(tl, 'lastround'), [10000 + 240000 + Tm.VOICE_AFTER_FILE_MS], 'EMOM: Last round tras el archivo de cuenta atrás');
  assert.strictEqual(by(tl, 'lastmin').length, 0, 'EMOM: la última ronda ya es el último minuto, no se repite');
  assert.deepStrictEqual(ms(tl, 'tensec'), [310000 - 10000 + Tm.VOICE_GAP_MS]);
  tl = Tm.timeline(Tm.buildPlan('amrap', { dur: 1200 }), 10, AL);
  assert.strictEqual(by(tl, 'lastround').length, 0, 'AMRAP simple: sin Last round');
  assert.deepStrictEqual(ms(tl, 'lastmin'), [10000 + 1140000 + Tm.VOICE_GAP_MS]);
  assert.deepStrictEqual(ms(tl, 'tensec'), [10000 + 1190000 + Tm.VOICE_GAP_MS]);
  tl = Tm.timeline(Tm.buildPlan('emom', { interval: 60, rounds: 3 }), 10, AL);
  assert.strictEqual(by(tl, 'lastmin').length, 0);
  tl = Tm.timeline(Tm.buildPlan('tabata', { work: 20, rest: 10, rounds: 2 }), 10, AL);
  assert.deepStrictEqual(ms(tl, 'lastround'), [10000 + 30000 + Tm.VOICE_GAP_MS], 'Tabata: Last round al empezar la 2ª ronda');
  assert.strictEqual(by(tl, 'lastmin').length, 0, 'entreno de 1 min: sin Last minute');
  assert.strictEqual(by(tl, 'tensec').length, 1);
  tl = Tm.timeline(Tm.buildPlan('tabata', { work: 10, rest: 2, rounds: 2 }), 10, AL);
  assert.strictEqual(by(tl, 'tensec').length, 0, 'entreno de menos de 30 s: sin Ten seconds');
  tl = Tm.timeline(Tm.buildPlan('fortime', { cap: 600 }), 10, AL);
  assert.strictEqual(by(tl, 'lastround').length, 0, 'For Time: sin Last round');
  assert.deepStrictEqual(ms(tl, 'lastmin'), [10000 + 540000 + Tm.VOICE_GAP_MS]);
  tl = Tm.timeline(Tm.buildPlan('fortime', { cap: 0 }), 10, AL);
  assert.strictEqual(by(tl, 'lastmin').length + by(tl, 'tensec').length, 0, 'For Time sin límite: sin avisos');
  tl = Tm.timeline(Tm.buildPlan('rest', { dur: 120 }), 10, AL);
  assert.strictEqual(by(tl, 'lastround').length, 0, 'Descanso: sin Last round');
  // Last minute coincide con Half time (último tramo de 2 min): solo suena «half»
  tl = Tm.timeline(Tm.buildPlan('amrap', { dur: 120 }), 10, Object.assign({}, AL, { halfway: true }));
  assert.strictEqual(by(tl, 'half').length, 1); assert.strictEqual(by(tl, 'lastmin').length, 0, 'no se repite con Half time');
  // avisos apagados = igual que antes
  const noAl = Tm.timeline(Tm.buildPlan('emom', { interval: 60, rounds: 5 }), 10, ALL);
  assert.strictEqual(['lastround', 'lastmin', 'tensec'].reduce((n, k) => n + by(noAl, k).length, 0), 0);
  for (const id of Tm.MODES.map(m => m.id).filter(i => i !== 'counter')) {
    const pl = Tm.buildPlan(id, Tm.defaultConfig(id)); if (pl.kind === 'up') pl.cap = 300;
    const t2 = Tm.timeline(pl, 10, AL);
    t2.forEach((e, i) => { if (i) assert.ok(e.ms >= t2[i - 1].ms, id + ' ordenado (avisos)'); });
  }
  console.log('voces de aviso OK');
}
