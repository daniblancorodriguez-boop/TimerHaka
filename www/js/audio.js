/* HAKATIMER — sonidos sintetizados con Web Audio + sonidos propios subidos por el usuario */
(function (root) {
  'use strict';
  var ctx = null;
  var buffers = {}; // evento -> {src, buffer}

  function ensure() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  var live = [];   // nodos programados que aún no han terminado (para poder cancelarlos al pausar)
  function track(node) {
    live.push(node);
    node.onended = function () { var i = live.indexOf(node); if (i > -1) live.splice(i, 1); };
  }
  function tone(c, dest, o) {
    var osc = c.createOscillator(), g = c.createGain();
    var t0 = (o.when !== undefined ? o.when : c.currentTime) + (o.start || 0);
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.freqEnd) osc.frequency.linearRampToValueAtTime(o.freqEnd, t0 + o.dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.5, t0 + 0.008);
    if (o.sustain) g.gain.setValueAtTime(o.gain || 0.5, t0 + o.dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(dest);
    osc.start(t0); osc.stop(t0 + o.dur + 0.02); track(osc);
  }

  /* Cada preset recibe (contexto, destino). */
  var PRESETS = {
    beep:   { label: 'Pitido',        play: function (c, d, w) { tone(c, d, { when: w, freq: 880, dur: 0.16, gain: 0.6 }); } },
    high:   { label: 'Pitido agudo',  play: function (c, d, w) { tone(c, d, { when: w, freq: 1480, dur: 0.5, gain: 0.5 }); } },
    double: { label: 'Doble pitido',  play: function (c, d, w) {
      tone(c, d, { when: w, freq: 1000, dur: 0.1, gain: 0.55 });
      tone(c, d, { when: w, freq: 1000, dur: 0.1, gain: 0.55, start: 0.16 });
    } },
    horn:   { label: 'Bocina',        play: function (c, d, w) {
      tone(c, d, { when: w, type: 'sawtooth', freq: 196, dur: 1.1, gain: 0.35, sustain: true });
      tone(c, d, { when: w, type: 'square', freq: 247, dur: 1.1, gain: 0.18, sustain: true });
    } },
    bell:   { label: 'Campana',       play: function (c, d, w) {
      [[660, 0.5], [1320, 0.28], [1980, 0.14], [2640, 0.08]].forEach(function (p) {
        tone(c, d, { when: w, freq: p[0], dur: 1.4, gain: p[1] });
      });
    } },
    siren:  { label: 'Sirena',        play: function (c, d, w) {
      tone(c, d, { when: w, type: 'triangle', freq: 600, freqEnd: 1100, dur: 0.5, gain: 0.5 });
      tone(c, d, { when: w, type: 'triangle', freq: 1100, freqEnd: 600, dur: 0.5, gain: 0.5, start: 0.5 });
    } },
    gong:   { label: 'Gong',          play: function (c, d, w) {
      [[110, 0.6], [165, 0.35], [233, 0.25], [330, 0.15]].forEach(function (p) {
        tone(c, d, { when: w, freq: p[0], dur: 2.2, gain: p[1] });
      });
    } },
    tick:   { label: 'Pitido corto (trabajo)', play: function (c, d, w) {
      tone(c, d, { when: w, freq: 1800, dur: 0.07, gain: 0.55 });
      tone(c, d, { when: w, freq: 1800, dur: 0.07, gain: 0.55, start: 0.12 });
    } },
    long:   { label: 'Tono largo grave (descanso)', play: function (c, d, w) {
      tone(c, d, { when: w, freq: 330, dur: 1.3, gain: 0.55, sustain: true });
    } },
    none:   { label: 'Silencio',      play: function () {} }
  };

  /* Muestras (archivos en www/audio): cuenta atrás con 3 pitidos + pitido largo, voz «mitad del tiempo» y voz «Well done».
     La línea SAMPLE_SRC se sustituye por data-URI en HAKATIMER.html (versión de un solo archivo). */
  var SAMPLE_SRC = { countfile: 'audio/cuenta-atras.mp3', half: 'audio/mitad-tiempo.mp3', well: 'audio/well-done.mp3', lastround: 'audio/ultima-ronda.mp3', lastmin: 'audio/ultimo-minuto.mp3', tensec: 'audio/diez-segundos.mp3' };
  var sampleBuf = {}, samplePending = {};
  function loadSample(c, name) {
    if (sampleBuf[name]) return Promise.resolve(sampleBuf[name]);
    if (samplePending[name]) return samplePending[name];
    var p = Promise.resolve().then(function () { return fetch(SAMPLE_SRC[name]); }).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
      return new Promise(function (res, rej) { c.decodeAudioData(ab, res, rej); });
    }).then(function (buf) { sampleBuf[name] = buf; delete samplePending[name]; return buf; })
      .catch(function (e) { delete samplePending[name]; throw e; });
    samplePending[name] = p; return p;
  }
  /* Reproduce una muestra dentro de `delay` s empezando en el segundo `offset` del archivo.
     Si el audio aún no estaba decodificado y llega tarde, salta al punto que corresponde para no desalinear el pitido largo. */
  function playSample(name, volume, delay, offset) {
    var c = ensure();
    if (!c || !SAMPLE_SRC[name]) return;
    var dest = master(c, volume), when = c.currentTime + (delay || 0), off = offset || 0;
    function go(buf) {
      var t = when, o = off, late = c.currentTime - t;
      if (late > 0) { o += late; t = c.currentTime; }
      if (o >= buf.duration - 0.05) return;
      var src = c.createBufferSource();
      src.buffer = buf; src.connect(dest); src.start(t, o); track(src);
    }
    if (sampleBuf[name]) go(sampleBuf[name]);
    else loadSample(c, name).then(go).catch(function () {});
  }

  var vibTimers = [];
  /* Vibración distinta por tipo: pulso corto = trabajo, largo = descanso */
  var VIB = { countdown: 40, go: 400, minute: [200, 100, 200], work: [90, 70, 90], rest: 700, end: [300, 120, 300, 120, 600], half: [120, 60, 120] };
  function vibrate(event, s) { if (s.vibrate && navigator.vibrate) navigator.vibrate(VIB[event] || 120); }

  /* Ajuste recomendado de accesibilidad: cada evento suena distinto (corto y agudo = trabajo, largo y grave = descanso) */
  var ACCESSIBLE = { countdown: 'beep', go: 'high', minute: 'bell', work: 'tick', rest: 'long', end: 'horn' };

  function master(c, volume) {
    var g = c.createGain();
    g.gain.value = Math.max(0, Math.min(1, volume));
    g.connect(c.destination);
    return g;
  }

  function decode(c, key, snd) {
    if (buffers[key] && buffers[key].src === snd.data) return Promise.resolve(buffers[key].buffer);
    return fetch(snd.data).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
      return new Promise(function (res, rej) { c.decodeAudioData(ab, res, rej); });
    }).then(function (buf) { buffers[key] = { src: snd.data, buffer: buf }; return buf; });
  }

  function playSound(snd, key, volume, delay) {
    var c = ensure();
    if (!c || !snd) return;
    var dest = master(c, volume), when = c.currentTime + (delay || 0);
    if (snd.preset === 'custom' && snd.data) {
      decode(c, key, snd).then(function (buf) {
        var s = c.createBufferSource();
        s.buffer = buf; s.connect(dest); s.start(Math.max(when, c.currentTime)); track(s);
      }).catch(function () { PRESETS.beep.play(c, dest, when); });
      return;
    }
    var p = PRESETS[snd.preset] || PRESETS.beep;
    p.play(c, dest, when);
  }

  root.Sound = {
    PRESETS: PRESETS,
    ACCESSIBLE: ACCESSIBLE,
    unlock: ensure, // llamar desde un gesto del usuario (botón Empezar)
    /* «Boop» pulsante al tocar INICIAR: dos pulsos redondos que bajan de tono */
    boop: function () {
      var s = root.Store.settings(), c = ensure();
      if (navigator.vibrate && s.vibrate) navigator.vibrate(35);
      if (!c) return;
      var d = master(c, s.volume);
      tone(c, d, { freq: 560, freqEnd: 430, dur: 0.13, gain: 0.7 });
      tone(c, d, { freq: 430, freqEnd: 250, dur: 0.24, gain: 0.7, start: 0.12 });
    },
    /* Reproduce el sonido configurado para un evento: countdown, go, minute, work, rest, end */
    play: function (event) {
      var s = root.Store.settings();
      if (SAMPLE_SRC[event]) { playSample(event, s.volume, 0, 0); vibrate(event, s); return; }
      playSound(s.sounds[event], event, s.volume);
      vibrate(event, s);
    },
    /* Programa el sonido en el reloj de audio para dentro de `delaySec` segundos (exacto aunque la página vaya lenta).
       Devuelve false si no hay Web Audio (entonces hay que usar play() en el momento). */
    /* o (opcional): { silent: no suena, solo vibra · offset: segundo del archivo por el que empezar (muestras) } */
    schedule: function (event, delaySec, o) {
      var s = root.Store.settings();
      if (!ensure()) return false;
      o = o || {};
      if (!o.silent) {
        if (SAMPLE_SRC[event]) playSample(event, s.volume, Math.max(0, delaySec), o.offset || 0);
        else playSound(s.sounds[event], event, s.volume, Math.max(0, delaySec));
      }
      if (event !== 'countfile' && event !== 'well' && event !== 'lastround' && event !== 'lastmin' && event !== 'tensec' && s.vibrate && navigator.vibrate) {
        var t = setTimeout(function () { vibrate(event, s); }, Math.max(0, delaySec) * 1000);
        vibTimers.push(t);
      }
      return true;
    },
    available: function () { return !!(root.AudioContext || root.webkitAudioContext); },
    /* Cancela todo lo programado que aún no ha sonado (pausa, reinicio, terminar) */
    cancelAll: function () {
      live.slice().forEach(function (n) { try { n.stop(0); } catch (e) {} });
      live.length = 0;
      vibTimers.forEach(clearTimeout); vibTimers.length = 0;
      if (navigator.vibrate) navigator.vibrate(0);
    },
    /* Decodifica los sonidos propios con antelación para que estén listos al programarlos */
    prepare: function () {
      var c = ensure(), s = root.Store.settings();
      if (!c) return;
      Object.keys(s.sounds).forEach(function (k) { var sn = s.sounds[k]; if (sn && sn.preset === 'custom' && sn.data) decode(c, k, sn).catch(function () {}); });
      Object.keys(SAMPLE_SRC).forEach(function (k) { loadSample(c, k).catch(function () {}); });
    },
    preview: function (event) {
      var s = root.Store.settings();
      if (SAMPLE_SRC[event]) { playSample(event, s.volume, 0, 0); return; }
      playSound(s.sounds[event], event, s.volume);
    },
    /* Convierte un archivo de audio en dataURL para guardarlo (máx. ~700 KB) */
    readFile: function (file) {
      return new Promise(function (res, rej) {
        if (file.size > 700 * 1024) return rej(new Error('El archivo pesa más de 700 KB. Usa un sonido más corto.'));
        var fr = new FileReader();
        fr.onload = function () { res(fr.result); };
        fr.onerror = function () { rej(new Error('No se pudo leer el archivo.')); };
        fr.readAsDataURL(file);
      });
    }
  };
})(window);
