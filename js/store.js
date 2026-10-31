/* Modelo de datos, validación y demo del Karting Dashboard. Sin DOM. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KartStore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SCHEMA_VERSION = 2;
  const LIMITS = {
    maxDrivers: 60,
    maxTracks: 30,
    maxLaps: 20000,
    maxNameLength: 40,
    minSeconds: 10,
    maxSeconds: 600,
    maxLapNumber: 999,
    maxImportBytes: 5 * 1024 * 1024,
  };
  const DEFAULT_TRACK = "Circuito GP Indoor";

  // SECURITY: nombres como texto plano; sin caracteres de control ni marcado.
  function cleanName(value) {
    if (typeof value !== "string") return null;
    const name = value.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
    if (!name || name.length > LIMITS.maxNameLength) return null;
    if (name === "__proto__" || name === "constructor" || name === "prototype") return null;
    return name;
  }

  function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && value >= "2000-01-01" && value <= "2100-12-31";
  }

  function isValidSeconds(n) {
    return typeof n === "number" && Number.isFinite(n) && n >= LIMITS.minSeconds && n <= LIMITS.maxSeconds;
  }

  function newId(prefix) {
    const rnd = (typeof crypto !== "undefined" && crypto.getRandomValues)
      ? Array.from(crypto.getRandomValues(new Uint32Array(2)), (x) => x.toString(36)).join("")
      : Math.random().toString(36).slice(2);
    return `${prefix}_${Date.now().toString(36)}${rnd}`;
  }

  function cleanId(value, fallbackPrefix) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : newId(fallbackPrefix);
  }

  // Valida y normaliza una base completa. Lanza Error con mensaje legible si es inválida.
  function validateDatabase(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("El archivo no es una base de datos válida.");
    if (!Array.isArray(raw.laps) || !Array.isArray(raw.drivers)) throw new Error("Faltan las listas de pilotos o vueltas.");
    if (raw.drivers.length > LIMITS.maxDrivers) throw new Error(`Máximo ${LIMITS.maxDrivers} pilotos.`);
    if (raw.laps.length > LIMITS.maxLaps) throw new Error(`Máximo ${LIMITS.maxLaps} vueltas.`);

    const drivers = [];
    const seen = new Set();
    raw.drivers.forEach((d) => {
      const name = cleanName(d);
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        drivers.push(name);
      }
    });

    const tracks = [];
    const seenTracks = new Set();
    const addTrack = (t) => {
      const name = cleanName(t);
      if (name && !seenTracks.has(name.toLowerCase()) && tracks.length < LIMITS.maxTracks) {
        seenTracks.add(name.toLowerCase());
        tracks.push(name);
      }
      return name;
    };
    (Array.isArray(raw.tracks) ? raw.tracks : []).forEach(addTrack);

    const laps = [];
    const ids = new Set();
    let skipped = 0;
    raw.laps.forEach((l) => {
      if (!l || typeof l !== "object") { skipped += 1; return; }
      const driver = cleanName(l.driver);
      const track = addTrack(l.track === undefined ? DEFAULT_TRACK : l.track);
      const lap = Number(l.lap);
      const seconds = typeof l.seconds === "number" ? Math.round(l.seconds * 1000) / 1000 : NaN;
      if (!driver || !track || !isValidDate(l.date) || !Number.isInteger(lap) || lap < 1 || lap > LIMITS.maxLapNumber || !isValidSeconds(seconds)) {
        skipped += 1;
        return;
      }
      let id = cleanId(l.id, "lap");
      while (ids.has(id)) id = newId("lap");
      ids.add(id);
      if (!seen.has(driver.toLowerCase())) {
        if (drivers.length >= LIMITS.maxDrivers) { skipped += 1; return; }
        seen.add(driver.toLowerCase());
        drivers.push(driver);
      }
      // Usa el nombre canónico ya registrado (mismas mayúsculas).
      const canonical = drivers.find((x) => x.toLowerCase() === driver.toLowerCase());
      laps.push({ id, date: l.date, driver: canonical, lap, seconds, track });
    });

    drivers.sort((a, b) => a.localeCompare(b, "es"));
    return { drivers, tracks, laps, skipped };
  }

  function serialize(db) {
    return JSON.stringify({ app: "karting_dashboard", version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), drivers: db.drivers, tracks: db.tracks, laps: db.laps }, null, 2);
  }

  // Datos de ejemplo ficticios con nombres de personajes.
  function demoDatabase() {
    const track = DEFAULT_TRACK;
    const sessions = [
      ["2026-10-16", {
        "Pierre Nodoyuna": [47.9, 45.6, 44.8, 44.5, 44.9],
        "Tiroloco McGrau": [48.3, 44.9, 43.6, 43.9, 44.2],
        "Agente Cobra": [50.2, 46.8, 45.7, 45.1],
        "Porko Rosso": [60.1, 56.0, 54.8, 55.3],
        "Pedro Picapiedra": [49.4, 44.6, 58.9, 45.0],
      }],
      ["2026-10-23", {
        "Pierre Nodoyuna": [47.2, 44.9, 43.8, 43.5, 43.7],
        "Tiroloco McGrau": [47.6, 44.2, 42.9, 43.3, 43.5],
        "Agente Cobra": [49.7, 46.1, 44.8, 44.5, 44.6],
        "Porko Rosso": [59.0, 55.1, 53.9, 54.2],
        "Pedro Picapiedra": [48.8, 44.0, 43.9, 57.8, 44.4],
      }],
      ["2026-10-30", {
        "Pierre Nodoyuna": [46.850, 44.320, 43.190, 43.050, 43.210],
        "Tiroloco McGrau": [47.100, 43.800, 42.150, 42.680, 43.010],
        "Agente Cobra": [49.300, 45.420, 44.110, 43.900, 44.200],
        "Porko Rosso": [58.400, 54.120, 52.650, 53.020],
        "Pedro Picapiedra": [48.200, 43.400, 57.300, 43.850],
      }],
    ];
    const laps = [];
    sessions.forEach(([date, byDriver]) => {
      Object.entries(byDriver).forEach(([driver, times]) => {
        times.forEach((seconds, i) => laps.push({ id: `demo_${date}_${driver.split(" ")[0]}_${i + 1}`, date, driver, lap: i + 1, seconds, track }));
      });
    });
    return validateDatabase({ drivers: [...new Set(laps.map((l) => l.driver))], tracks: [track], laps });
  }

  return { SCHEMA_VERSION, LIMITS, DEFAULT_TRACK, cleanName, isValidDate, isValidSeconds, newId, validateDatabase, serialize, demoDatabase };
});
