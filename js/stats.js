/* Estadísticas puras (sin DOM) del Karting Dashboard.
 * Vuelta: { id, date: "AAAA-MM-DD", driver, lap, seconds, track } */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KartStats = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CLEAN_RATIO = 1.07; // regla del 107%: vuelta "limpia" respecto a su mejor vuelta
  const SPIN_RATIO = 1.10; // más de 110% de su mejor vuelta = trompo / desastre

  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : NaN);

  function median(a) {
    if (!a.length) return NaN;
    const s = [...a].sort((x, y) => x - y);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Desviación estándar muestral (n-1); NaN con menos de 2 datos.
  function stdDev(a) {
    if (a.length < 2) return NaN;
    const m = mean(a);
    return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1));
  }

  // Pendiente de mínimos cuadrados (unidades por índice). Negativa = va más rápido.
  function slope(values) {
    const n = values.length;
    if (n < 2) return NaN;
    const mx = (n - 1) / 2;
    const my = mean(values);
    let num = 0;
    let den = 0;
    values.forEach((y, i) => {
      num += (i - mx) * (y - my);
      den += (i - mx) ** 2;
    });
    return num / den;
  }

  function groupBy(items, keyFn) {
    const map = new Map();
    items.forEach((it) => {
      const k = keyFn(it);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    });
    return map;
  }

  const byDateLap = (a, b) => a.date.localeCompare(b.date) || a.lap - b.lap;

  function summarize(laps) {
    if (!laps.length) return null;
    const secs = laps.map((l) => l.seconds);
    const bestLap = laps.reduce((b, l) => (l.seconds < b.seconds ? l : b));
    const worstLap = laps.reduce((b, l) => (l.seconds > b.seconds ? l : b));
    const clean = secs.filter((s) => s <= bestLap.seconds * CLEAN_RATIO);
    const avg = mean(secs);
    const sd = stdDev(secs);
    return {
      count: laps.length,
      best: bestLap.seconds,
      bestLap,
      worst: worstLap.seconds,
      worstLap,
      avg,
      median: median(secs),
      stdDev: sd,
      cv: Number.isNaN(sd) ? NaN : (sd / avg) * 100,
      cleanAvg: mean(clean),
      cleanCount: clean.length,
      spins: secs.filter((s) => s > bestLap.seconds * SPIN_RATIO).length,
      spread: worstLap.seconds - bestLap.seconds,
    };
  }

  // Parrilla ordenada. sortBy: "best" | "avg" | "clean" | "consistency"
  function standings(laps, sortBy) {
    const rows = [];
    groupBy(laps, (l) => l.driver).forEach((dl, driver) => {
      rows.push({ driver, ...summarize(dl) });
    });
    const key = {
      best: (r) => r.best,
      avg: (r) => r.avg,
      clean: (r) => r.cleanAvg,
      consistency: (r) => (Number.isNaN(r.stdDev) ? Infinity : r.stdDev),
    }[sortBy] || ((r) => r.best);
    rows.sort((a, b) => key(a) - key(b) || a.best - b.best || a.driver.localeCompare(b.driver));
    rows.forEach((r, i) => {
      r.pos = i + 1;
      r.gapPole = r.best - rows[0].best;
      r.interval = i === 0 ? 0 : r.best - rows[i - 1].best;
    });
    return rows;
  }

  // Mejor y promedio por sesión (fecha) de un piloto, en orden cronológico.
  function sessionsOf(driverLaps) {
    const out = [];
    groupBy(driverLaps, (l) => l.date).forEach((dl, date) => {
      const sorted = [...dl].sort((a, b) => a.lap - b.lap);
      const secs = sorted.map((l) => l.seconds);
      out.push({
        date,
        laps: sorted,
        count: sorted.length,
        best: Math.min(...secs),
        avg: mean(secs),
        first: sorted[0].seconds,
        slope: slope(secs),
      });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }

  function longestImprovingStreak(driverLaps) {
    let best = 0;
    let cur = 0;
    let prev = null;
    [...driverLaps].sort(byDateLap).forEach((l) => {
      if (prev && prev.date === l.date && l.seconds < prev.seconds) cur += 1;
      else cur = 0;
      best = Math.max(best, cur);
      prev = l;
    });
    return best; // número de mejoras seguidas (vueltas consecutivas más rápidas)
  }

  // Mide cuánto cambia de vuelta a vuelta: promedio de |Δ| entre vueltas consecutivas de una sesión.
  function lapToLapJitter(driverLaps) {
    const deltas = [];
    sessionsOf(driverLaps).forEach((s) => {
      for (let i = 1; i < s.laps.length; i += 1) {
        deltas.push(Math.abs(s.laps[i].seconds - s.laps[i - 1].seconds));
      }
    });
    return deltas.length ? mean(deltas) : NaN;
  }

  // Estadísticas por piloto para premios y tendencias.
  function driverInsights(laps) {
    const out = [];
    groupBy(laps, (l) => l.driver).forEach((dl, driver) => {
      const sessions = sessionsOf(dl);
      const s = summarize(dl);
      const multi = sessions.filter((x) => x.count >= 2);
      // Calentamiento: cuánto más lenta fue la 1ª vuelta que la mejor de esa sesión.
      const warmUps = multi.map((x) => x.first - x.best);
      // Tendencia dentro de la tanda (s/vuelta); solo sesiones con 4+ vueltas.
      const slopes = sessions.filter((x) => x.count >= 4).map((x) => x.slope);
      // Progreso entre sesiones: mejor de la última vs mejor de la anterior.
      let sessionDelta = NaN;
      let bestEverDelta = NaN;
      if (sessions.length >= 2) {
        const last = sessions[sessions.length - 1];
        const prev = sessions[sessions.length - 2];
        sessionDelta = last.best - prev.best;
        const before = Math.min(...sessions.slice(0, -1).map((x) => x.best));
        bestEverDelta = last.best - before;
      }
      out.push({
        driver,
        summary: s,
        sessions,
        sessionCount: sessions.length,
        warmUp: warmUps.length ? mean(warmUps) : NaN,
        withinSessionSlope: slopes.length ? mean(slopes) : NaN,
        sessionDelta,
        bestEverDelta,
        streak: longestImprovingStreak(dl),
        jitter: lapToLapJitter(dl),
      });
    });
    return out;
  }

  // Enfrentamiento directo entre dos pilotos.
  function headToHead(laps, a, b) {
    const la = laps.filter((l) => l.driver === a);
    const lb = laps.filter((l) => l.driver === b);
    if (!la.length || !lb.length) return null;
    const sa = summarize(la);
    const sb = summarize(lb);
    let aWins = 0;
    let bWins = 0;
    let ties = 0;
    const mapB = new Map(lb.map((l) => [`${l.date}|${l.track}|${l.lap}`, l.seconds]));
    la.forEach((l) => {
      const other = mapB.get(`${l.date}|${l.track}|${l.lap}`);
      if (other === undefined) return;
      if (l.seconds < other) aWins += 1;
      else if (l.seconds > other) bWins += 1;
      else ties += 1;
    });
    return {
      a: sa,
      b: sb,
      bestGap: sa.best - sb.best,
      avgGap: sa.avg - sb.avg,
      aWins,
      bWins,
      ties,
      pairs: aWins + bWins + ties,
    };
  }

  // Premios para reírse (cada uno devuelve null si no hay datos suficientes).
  function trophies(laps) {
    if (!laps.length) return [];
    const ins = driverInsights(laps);
    const rows = standings(laps, "best");
    const fastest = laps.reduce((b, l) => (l.seconds < b.seconds ? l : b));
    const slowest = laps.reduce((b, l) => (l.seconds > b.seconds ? l : b));
    const pick = (arr, fn, dir) => {
      const c = arr.filter((x) => Number.isFinite(fn(x)));
      if (!c.length) return null;
      return c.reduce((b, x) => (dir === "max" ? (fn(x) > fn(b) ? x : b) : (fn(x) < fn(b) ? x : b)));
    };
    const list = [];
    const add = (id, item, driver, value, detail) => {
      if (item) list.push({ id, driver, value, detail });
    };

    add("verstappen", fastest, fastest.driver, fastest.seconds, `${fastest.date} · vuelta ${fastest.lap}`);
    add("abuelita", slowest, slowest.driver, slowest.seconds, `${slowest.date} · vuelta ${slowest.lap}`);

    const babyCar = pick(ins, (x) => x.summary.avg, "max");
    add("bebe", babyCar, babyCar && babyCar.driver, babyCar && babyCar.summary.avg, babyCar && `${babyCar.summary.count} vueltas`);

    const chicane = pick(ins.filter((x) => x.summary.count >= 2), (x) => x.summary.spread, "max");
    add("chicane", chicane, chicane && chicane.driver, chicane && chicane.summary.spread,
      chicane && `${chicane.summary.best.toFixed(3)} vs ${chicane.summary.worst.toFixed(3)}`);

    const metronome = pick(ins, (x) => x.summary.stdDev, "min");
    add("metronomo", metronome, metronome && metronome.driver, metronome && metronome.summary.stdDev,
      metronome && `${metronome.summary.count} vueltas`);

    const spinner = pick(ins.filter((x) => x.summary.spins > 0), (x) => x.summary.spins, "max");
    add("trompo", spinner, spinner && spinner.driver, spinner && spinner.summary.spins, "vueltas a más de 110% de su mejor");

    const lateBloomer = pick(ins, (x) => x.warmUp, "max");
    add("calentando", lateBloomer && lateBloomer.warmUp > 0 ? lateBloomer : null, lateBloomer && lateBloomer.driver,
      lateBloomer && lateBloomer.warmUp, "su 1ª vuelta vs su mejor de la tanda (promedio)");

    const streaker = pick(ins.filter((x) => x.streak > 0), (x) => x.streak, "max");
    add("racha", streaker, streaker && streaker.driver, streaker && streaker.streak, "vueltas seguidas más rápidas que la anterior");

    const jittery = pick(ins, (x) => x.jitter, "max");
    add("montana", jittery, jittery && jittery.driver, jittery && jittery.jitter, "cambio medio entre vueltas consecutivas");

    const fader = pick(ins, (x) => x.withinSessionSlope, "max");
    add("dormido", fader && fader.withinSessionSlope > 0 ? fader : null, fader && fader.driver,
      fader && fader.withinSessionSlope, "segundos que pierde por vuelta dentro de la tanda");

    const climber = pick(ins, (x) => x.sessionDelta, "min");
    add("remontador", climber && climber.sessionDelta < 0 ? climber : null, climber && climber.driver,
      climber && climber.sessionDelta, "mejora de su mejor vuelta vs la sesión anterior");

    const closest = rows.length > 1 ? rows.slice(1).reduce((b, r) => (r.interval < b.interval ? r : b)) : null;
    add("casi", closest, closest && closest.driver, closest && closest.interval, "diferencia con el piloto de delante");

    const blueFlag = rows.length > 1 ? rows[rows.length - 1] : null;
    add("bandera_azul", blueFlag, blueFlag && blueFlag.driver, blueFlag && blueFlag.gapPole, "distancia a la pole");

    const gas = pick(ins, (x) => x.summary.count, "max");
    add("nafta", gas, gas && gas.driver, gas && gas.summary.count, "vueltas giradas");

    const loyal = pick(ins, (x) => x.sessionCount, "max");
    add("fiel", loyal, loyal && loyal.driver, loyal && loyal.sessionCount, "tandas asistidas");

    return list;
  }

  // Tabla de gasto de nafta: top N por cantidad de vueltas.
  function topByLaps(laps, n) {
    const rows = [];
    groupBy(laps, (l) => l.driver).forEach((dl, driver) => rows.push({ driver, count: dl.length }));
    rows.sort((a, b) => b.count - a.count || a.driver.localeCompare(b.driver));
    return rows.slice(0, n);
  }

  // Resumen global de grupo.
  function groupOverview(laps) {
    if (!laps.length) return null;
    const secs = laps.map((l) => l.seconds);
    const dates = new Set(laps.map((l) => l.date));
    const sorted = [...dates].sort();
    const dayBest = sorted.map((d) => Math.min(...laps.filter((l) => l.date === d).map((l) => l.seconds)));
    return {
      laps: laps.length,
      drivers: new Set(laps.map((l) => l.driver)).size,
      sessions: dates.size,
      totalSeconds: sum(secs),
      avg: mean(secs),
      median: median(secs),
      stdDev: stdDev(secs),
      best: Math.min(...secs),
      worst: Math.max(...secs),
      // Tendencia del récord de la pista por día (negativa = el grupo se vuelve más rápido).
      dayBestSlope: slope(dayBest),
      dayBest,
      dates: sorted,
    };
  }

  function formatTime(sec) {
    if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) return "--.---";
    if (sec >= 60) {
      const m = Math.floor(sec / 60);
      const rest = (sec - m * 60).toFixed(3).padStart(6, "0");
      return `${m}:${rest}`;
    }
    return sec.toFixed(3);
  }

  // Acepta "43.520", "43,520" o "1:02.150". Devuelve null si es inválido.
  function parseTime(input) {
    if (typeof input !== "string") return null;
    const str = input.trim().replace(",", ".");
    let value;
    if (/^\d{1,2}:\d{1,2}(\.\d{1,3})?$/.test(str)) {
      const [m, s] = str.split(":");
      value = Number(m) * 60 + Number(s);
    } else if (/^\d{1,3}(\.\d{1,3})?$/.test(str)) {
      value = Number(str);
    } else {
      return null;
    }
    return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null;
  }

  return {
    CLEAN_RATIO, SPIN_RATIO,
    mean, median, stdDev, slope, groupBy,
    summarize, standings, sessionsOf, driverInsights, headToHead,
    trophies, topByLaps, groupOverview, formatTime, parseTime,
    longestImprovingStreak, lapToLapJitter,
  };
});
