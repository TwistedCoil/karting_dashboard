/* Tests sin dependencias: abre test/index.html en un navegador (o ejecútalo con Node si lo tienes). */
(function () {
  "use strict";
  const S = typeof require === "function" ? require("../js/stats.js") : window.KartStats;
  const D = typeof require === "function" ? require("../js/store.js") : window.KartStore;

  const results = [];
  function test(name, fn) {
    try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, msg: e.message }); }
  }
  function eq(actual, expected, label) {
    if (actual !== expected) throw new Error(`${label || "valor"}: esperado ${expected}, obtenido ${actual}`);
  }
  function near(actual, expected, label, eps) {
    if (!(Math.abs(actual - expected) <= (eps || 1e-6))) throw new Error(`${label || "valor"}: esperado ≈${expected}, obtenido ${actual}`);
  }

  const demo = D.demoDatabase();
  const day = demo.laps.filter((l) => l.date === "2026-10-30");

  // Datos originales de la tanda del 30-10-2026 (nombres de personajes).
  test("demo: 3 sesiones, 5 pilotos, 69 vueltas", () => {
    eq(demo.drivers.length, 5, "pilotos");
    eq(demo.laps.length, 69, "vueltas");
  });

  test("día 30-10: 23 vueltas, pole Tiroloco McGrau 42.150", () => {
    eq(day.length, 23, "vueltas");
    const rows = S.standings(day, "best");
    eq(rows[0].driver, "Tiroloco McGrau");
    near(rows[0].best, 42.15, "pole");
    eq(rows[4].driver, "Porko Rosso");
  });

  test("gap e intervalo", () => {
    const rows = S.standings(day, "best");
    near(rows[1].gapPole, rows[1].best - 42.15, "gap P2");
    near(rows[1].interval, rows[1].best - rows[0].best, "intervalo P2");
    eq(rows[0].gapPole, 0);
  });

  test("media, mediana y desviación muestral", () => {
    near(S.mean([1, 2, 3, 4]), 2.5);
    near(S.median([5, 1, 3]), 3);
    near(S.median([1, 2, 3, 4]), 2.5);
    near(S.stdDev([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7));
    eq(Number.isNaN(S.stdDev([3])), true, "n=1");
  });

  test("pendiente de mínimos cuadrados", () => {
    near(S.slope([10, 8, 6, 4]), -2);
    near(S.slope([5, 5, 5]), 0);
  });

  test("promedio limpio (107%) descarta trompos", () => {
    const pedro = day.filter((l) => l.driver === "Pedro Picapiedra");
    const s = S.summarize(pedro);
    near(s.best, 43.4);
    eq(s.cleanCount, 2, "limpias"); // 43.4 y 43.85; 48.2 y 57.3 quedan fuera
    eq(s.spins, 2, "trompos");
    near(s.cleanAvg, (43.4 + 43.85) / 2);
  });

  test("premios: Verstappen, Abuelita, Chicane, Nafta", () => {
    const t = Object.fromEntries(S.trophies(day).map((x) => [x.id, x]));
    eq(t.verstappen.driver, "Tiroloco McGrau");
    eq(t.abuelita.driver, "Porko Rosso");
    near(t.abuelita.value, 58.4);
    eq(t.chicane.driver, "Pedro Picapiedra");
    near(t.chicane.value, 57.3 - 43.4);
    eq(t.bebe.driver, "Porko Rosso");
    eq(t.nafta.value, 5);
  });

  test("progreso entre sesiones usa la mejor vuelta anterior", () => {
    const ins = S.driverInsights(demo.laps).find((x) => x.driver === "Tiroloco McGrau");
    near(ins.sessionDelta, 42.15 - 42.9);
    eq(ins.sessionCount, 3);
  });

  test("racha de mejoras solo dentro de la misma tanda", () => {
    const l = (date, lap, seconds) => ({ id: `${date}${lap}`, date, driver: "X", lap, seconds, track: "T" });
    eq(S.longestImprovingStreak([l("2026-01-01", 1, 50), l("2026-01-01", 2, 49), l("2026-01-01", 3, 48), l("2026-01-02", 1, 40)]), 2);
  });

  test("cara a cara compara solo vueltas emparejadas", () => {
    const h = S.headToHead(day, "Tiroloco McGrau", "Pierre Nodoyuna");
    eq(h.pairs, 5, "pares");
    eq(h.aWins + h.bWins + h.ties, 5);
    eq(h.aWins, 4, "A gana"); // A gana las vueltas 2 a 5; B gana la 1
  });

  test("formatTime y parseTime", () => {
    eq(S.formatTime(43.52), "43.520");
    eq(S.formatTime(62.15), "1:02.150");
    eq(S.formatTime(NaN), "--.---");
    eq(S.parseTime("43,52"), 43.52);
    eq(S.parseTime("1:02.150"), 62.15);
    eq(S.parseTime("abc"), null);
    eq(S.parseTime("-5"), null);
    eq(S.parseTime("1e3"), null);
    eq(S.parseTime(""), null);
  });

  test("seguridad: nombres con marcado o prototipos se rechazan/limpian", () => {
    eq(D.cleanName("<img src=x onerror=alert(1)>"), "img src=x onerror=alert(1)");
    eq(D.cleanName("__proto__"), null);
    eq(D.cleanName("   "), null);
    eq(D.cleanName("x".repeat(41)), null);
    eq(D.cleanName("A\u0000B"), "AB");
  });

  test("seguridad: importación descarta vueltas inválidas y limita tamaños", () => {
    const v = D.validateDatabase({
      drivers: ["Ana"],
      laps: [
        { id: "a", date: "2026-02-30", driver: "Ana", lap: 1, seconds: 40 },
        { id: "b", date: "2026-02-20", driver: "Ana", lap: 1, seconds: 5 },
        { id: "c", date: "2026-02-20", driver: "Ana", lap: 0, seconds: 40 },
        { id: "d", date: "2026-02-20", driver: "Ana", lap: 1, seconds: "40" },
        { id: "e", date: "2026-02-20", driver: "Ana", lap: 1, seconds: 40.1234 },
        { id: "e", date: "2026-02-20", driver: "ana", lap: 2, seconds: 41 },
        null,
      ],
    });
    eq(v.laps.length, 2, "válidas");
    eq(v.skipped, 5, "descartadas");
    near(v.laps[0].seconds, 40.123);
    eq(new Set(v.laps.map((l) => l.id)).size, 2, "ids únicos");
    eq(v.laps[1].driver, "Ana", "nombre canónico");
    let threw = false;
    try { D.validateDatabase({ drivers: [], laps: new Array(D.LIMITS.maxLaps + 1).fill({}) }); } catch (e) { threw = true; }
    eq(threw, true, "límite de vueltas");
    threw = false;
    try { D.validateDatabase([]); } catch (e) { threw = true; }
    eq(threw, true, "raíz inválida");
  });

  const failed = results.filter((r) => !r.ok);
  const text = results.map((r) => `${r.ok ? "PASS" : "FAIL"} ${r.name}${r.ok ? "" : ` -> ${r.msg}`}`).join("\n");
  if (typeof document !== "undefined") {
    document.getElementById("out").textContent = text;
    document.getElementById("summary").textContent = `${results.length - failed.length}/${results.length} OK`;
  } else {
    console.log(text);
    console.log(`${results.length - failed.length}/${results.length} OK`);
    if (failed.length) process.exit(1);
  }
})();
