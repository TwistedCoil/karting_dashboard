/* UI del Karting Dashboard. Todo el contenido dinámico se inserta con textContent (sin innerHTML). */
(function () {
  "use strict";

  const S = window.KartStats;
  const D = window.KartStore;
  const STORAGE_KEY = "karting_dashboard_v2";
  const ALL_TRACKS = "__all__";
  const COLORS = ["#e10600", "#ffcc00", "#00d2be", "#b138dd", "#60a5fa", "#fb923c", "#34d399", "#f472b6", "#a3e635", "#94a3b8"];

  let db = { drivers: [], tracks: [D.DEFAULT_TRACK], laps: [] };
  const ui = { track: D.DEFAULT_TRACK, date: "", scope: "daily", sort: "best", driver: "", h2hA: "", h2hB: "" };
  const charts = { lap: null, session: null };

  const $ = (id) => document.getElementById(id);

  function el(tag, opts, children) {
    const node = document.createElement(tag);
    const o = opts || {};
    if (o.cls) node.className = o.cls;
    if (o.text !== undefined) node.textContent = o.text;
    if (o.attrs) Object.entries(o.attrs).forEach(([k, v]) => node.setAttribute(k, v));
    (children || []).forEach((c) => c && node.appendChild(c));
    return node;
  }

  const fmt = S.formatTime;
  const num = (n, d) => (Number.isFinite(n) ? n.toFixed(d === undefined ? 3 : d) : "--");
  const signed = (n, d) => (Number.isFinite(n) ? `${n > 0 ? "+" : ""}${n.toFixed(d === undefined ? 3 : d)}` : "--");

  // ---------- Persistencia ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = D.validateDatabase(JSON.parse(raw));
        db = { drivers: v.drivers, tracks: v.tracks.length ? v.tracks : [D.DEFAULT_TRACK], laps: v.laps };
      }
    } catch (e) {
      toast("No se pudieron leer los datos guardados; se inició vacío.", true);
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ drivers: db.drivers, tracks: db.tracks, laps: db.laps }));
    } catch (e) {
      toast("No se pudo guardar (almacenamiento lleno o bloqueado). Exporta un respaldo.", true);
    }
  }

  let toastTimer = null;
  function toast(msg, isError) {
    const t = $("toast");
    t.textContent = msg;
    t.className = isError ? "toast err" : "toast";
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 4500);
  }

  // ---------- Filtros y datos visibles ----------
  function trackLaps() {
    return ui.track === ALL_TRACKS ? db.laps : db.laps.filter((l) => l.track === ui.track);
  }

  function visibleLaps() {
    const base = trackLaps();
    return ui.scope === "daily" ? base.filter((l) => l.date === ui.date) : base;
  }

  function fillSelect(select, values, selected, labelFn) {
    select.textContent = "";
    values.forEach((v) => {
      const o = el("option", { text: labelFn ? labelFn(v) : v, attrs: { value: v } });
      select.appendChild(o);
    });
    if (values.includes(selected)) select.value = selected;
  }

  function syncFilters() {
    const trackOpts = [ALL_TRACKS, ...db.tracks];
    if (!trackOpts.includes(ui.track)) ui.track = db.tracks[0];
    fillSelect($("trackFilter"), trackOpts, ui.track, (v) => (v === ALL_TRACKS ? "Todas (mezcla)" : v));
    $("trackNote").hidden = !(ui.track === ALL_TRACKS && db.tracks.length > 1);

    const dates = [...new Set(trackLaps().map((l) => l.date))].sort().reverse();
    if (!dates.includes(ui.date)) ui.date = dates[0] || "";
    fillSelect($("dateFilter"), dates, ui.date, (d) => `🏁 ${d}`);
    $("dateFilter").disabled = ui.scope !== "daily" || !dates.length;
    $("sortFilter").value = ui.sort;
    document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("active", b.dataset.scope === ui.scope));

    if (!db.drivers.includes(ui.driver)) ui.driver = db.drivers[0] || "";
    if (!db.drivers.includes(ui.h2hA)) ui.h2hA = db.drivers[0] || "";
    if (!db.drivers.includes(ui.h2hB) || ui.h2hB === ui.h2hA) ui.h2hB = db.drivers.find((d) => d !== ui.h2hA) || "";
    fillSelect($("driverSelect"), db.drivers, ui.driver);
    fillSelect($("h2hA"), db.drivers, ui.h2hA);
    fillSelect($("h2hB"), db.drivers, ui.h2hB);
  }

  // ---------- Render ----------
  function render() {
    syncFilters();
    const hasLaps = db.laps.length > 0;
    $("emptyState").hidden = hasLaps;
    $("dashboard").hidden = !hasLaps;
    if (!hasLaps) return;
    const laps = visibleLaps();
    renderKpis(laps);
    renderGrid(laps);
    renderTrophies(laps);
    renderGroupStats(laps);
    renderCharts(laps);
    renderDriver();
    renderH2H();
  }

  function renderKpis(laps) {
    const rows = S.standings(laps, "best");
    if (!rows.length) {
      $("kpiPole").textContent = "--.---";
      $("kpiPoleWho").textContent = "Sin vueltas en esta selección";
      $("kpiClean").textContent = "--.---";
      $("kpiSpread").textContent = "+0.000s";
      $("kpiSpreadWho").textContent = "--";
      $("kpiGroup").textContent = "0";
      $("kpiGroupDetail").textContent = "pilotos · 0 vueltas";
      return;
    }
    const lead = rows[0];
    $("kpiPole").textContent = fmt(lead.best);
    $("kpiPoleWho").textContent = `${lead.driver} · vuelta ${lead.bestLap.lap} · ${lead.bestLap.date}`;
    const cleanVals = rows.map((r) => r.cleanAvg).filter(Number.isFinite);
    $("kpiClean").textContent = fmt(S.mean(cleanVals));
    const last = rows.reduce((b, r) => (r.best > b.best ? r : b));
    $("kpiSpread").textContent = `+${(last.best - lead.best).toFixed(3)}s`;
    $("kpiSpreadWho").textContent = rows.length > 1 ? `${lead.driver} vs ${last.driver}` : "Un solo piloto";
    $("kpiGroup").textContent = String(rows.length);
    $("kpiGroupDetail").textContent = `${rows.length === 1 ? "piloto" : "pilotos"} · ${laps.length} vueltas`;
  }

  function paceBadge(gap) {
    const cls = gap <= 1.5 ? "ok" : gap <= 3.5 ? "mid" : "bad";
    const text = gap <= 1.5 ? "🔥 PUNTERO" : gap <= 3.5 ? "⚡ RITMO MEDIO" : "🐢 REZAGADO";
    return el("span", { cls: `pill ${cls}`, text });
  }

  function renderGrid(laps) {
    const body = $("gridBody");
    body.textContent = "";
    S.standings(laps, ui.sort).forEach((r, i) => {
      const lead = i === 0;
      const tr = el("tr");
      const td = (text, cls) => tr.appendChild(el("td", { text, cls }));
      td(`${lead ? "🥇 " : ""}P${r.pos}`);
      td(r.driver, lead ? "leader" : "");
      td(fmt(r.best), `r mono${lead ? " leader" : ""}`);
      td(fmt(r.avg), "r mono");
      td(fmt(r.median), "r mono");
      td(fmt(r.cleanAvg), "r mono");
      td(Number.isFinite(r.stdDev) ? `±${r.stdDev.toFixed(3)}` : "--", "r mono");
      td(lead ? "LÍDER" : `+${r.gapPole.toFixed(3)}s`, "r mono");
      td(lead ? "--" : `+${r.interval.toFixed(3)}s`, "r mono");
      td(String(r.count), "r mono");
      const last = el("td");
      last.appendChild(paceBadge(r.gapPole));
      tr.appendChild(last);
      body.appendChild(tr);
    });
  }

  const TROPHY_META = {
    verstappen: { e: "🏆", t: "EL VERSTAPPEN DE BARRIO", d: "La vuelta más rápida. Ya se cree listo para el asiento de Red Bull.", q: "Frenó con la mente y aceleró con el corazón.", f: fmt },
    abuelita: { e: "👵", t: "LLEVANDO A LA ABUELITA", d: "La vuelta individual más exasperantemente lenta.", q: "Iba poniendo las luces de estacionamiento.", f: fmt },
    bebe: { e: "🍼", t: "COCHE DE BEBÉ", d: "El peor promedio de vuelta del grupo.", q: "Los comisarios sacaron bandera azul solo para él.", f: fmt },
    chicane: { e: "🐢", t: "CHICANE MÓVIL CON PATAS", d: "Mayor brecha entre su mejor vuelta y su peor desastre.", q: "En una vuelta parecía Senna, en la siguiente chocó los neumáticos.", f: (v) => `+${v.toFixed(3)}s` },
    metronomo: { e: "🤖", t: "EL METRÓNOMO ROBÓTICO", d: "Menor desviación estándar entre sus vueltas.", q: "Parece clonado por IA en cada sector.", f: (v) => `±${v.toFixed(3)}s` },
    trompo: { e: "🌀", t: "TROMPO SERIAL", d: "Más vueltas a más de 110% de su propia mejor vuelta.", q: "El kart giraba más que la rueda de la fortuna.", f: (v) => `${v} ${v === 1 ? "trompo" : "trompos"}` },
    calentando: { e: "🥶", t: "CALENTANDO MOTORES", d: "Cuánto más lenta es su primera vuelta que su mejor (promedio de sesiones).", q: "Las primeras vueltas eran 'de reconocimiento'. Siempre.", f: (v) => `+${v.toFixed(3)}s` },
    racha: { e: "🔥", t: "EN RACHA", d: "Mayor cantidad de vueltas seguidas más rápidas que la anterior.", q: "Cada vuelta, un poco menos de pánico.", f: (v) => `${v} ${v === 1 ? "mejora" : "mejoras"}` },
    montana: { e: "🎢", t: "MONTAÑA RUSA", d: "Mayor cambio medio entre vueltas consecutivas.", q: "Ni él sabe qué tiempo va a hacer.", f: (v) => `±${v.toFixed(3)}s` },
    dormido: { e: "😴", t: "SE DURMIÓ EN LA CURVA", d: "Más segundos pierde por vuelta dentro de la tanda (mín. 4 vueltas).", q: "Los brazos cansados también cuentan como excusa.", f: (v) => `+${v.toFixed(3)}s/vuelta` },
    remontador: { e: "🚀", t: "EL REMONTADOR", d: "Mayor mejora de su mejor vuelta respecto de la sesión anterior.", q: "Entrenó en secreto. Seguro.", f: (v) => `${v.toFixed(3)}s` },
    casi: { e: "😬", t: "CASI, CASI…", d: "Menor diferencia con el piloto que tiene delante.", q: "Lo pudo pasar. No lo pasó.", f: (v) => `+${v.toFixed(3)}s` },
    bandera_azul: { e: "🔵", t: "BANDERA AZUL", d: "El más lejos de la pole.", q: "Se le ve mejor por el retrovisor del resto.", f: (v) => `+${v.toFixed(3)}s` },
    nafta: { e: "⛽", t: "GASTADOR DE NAFTA", d: "Quien más vueltas le metió al asfalto.", q: "Se gastó el sueldo del mes en tandas de 10 minutos.", f: (v) => `${v} vueltas` },
    fiel: { e: "📅", t: "SOCIO DEL CIRCUITO", d: "Más tandas asistidas.", q: "Tiene su propio casillero en la pista.", f: (v) => `${v} ${v === 1 ? "tanda" : "tandas"}` },
  };

  function renderTrophies(laps) {
    const box = $("trophies");
    box.textContent = "";
    S.trophies(laps).forEach((t) => {
      const m = TROPHY_META[t.id];
      if (!m) return;
      box.appendChild(el("article", { cls: "card" }, [
        el("span", { cls: "emoji", text: m.e }),
        el("h4", { text: m.t }),
        el("p", { cls: "desc", text: m.d }),
        el("div", { cls: "who", text: t.driver }),
        el("div", { cls: "val", text: m.f(t.value) }),
        el("div", { cls: "detail", text: t.detail }),
        el("div", { cls: "quip", text: `"${m.q}"` }),
      ]));
    });
    const top = S.topByLaps(laps, 3);
    if (top.length > 1) {
      const medals = ["🥇", "🥈", "🥉"];
      box.appendChild(el("article", { cls: "card" }, [
        el("span", { cls: "emoji", text: "🛢️" }),
        el("h4", { text: "TOP 3 GASTADORES" }),
        ...top.map((r, i) => el("div", { cls: "who", text: `${medals[i]} ${r.driver} · ${r.count}` })),
      ]));
    }
  }

  function stat(k, v, d, cls) {
    return el("div", { cls: "stat" }, [
      el("div", { cls: "k", text: k }),
      el("div", { cls: `v${cls ? ` ${cls}` : ""}`, text: v }),
      el("div", { cls: "d", text: d }),
    ]);
  }

  function renderGroupStats(laps) {
    const box = $("groupStats");
    box.textContent = "";
    const o = S.groupOverview(laps);
    if (!o) { box.appendChild(stat("Sin datos", "--", "Registra vueltas para ver tendencias.")); return; }
    const lapsOnly = laps.map((l) => l.seconds);
    const mean = o.avg;
    const med = o.median;
    box.appendChild(stat("Promedio vs mediana", `${num(mean)} / ${num(med)}`, mean > med
      ? `Un puñado de vueltas lentas sube el promedio ${(mean - med).toFixed(3)}s.`
      : "El promedio no está inflado por vueltas lentas."));
    box.appendChild(stat("Dispersión del grupo", Number.isFinite(o.stdDev) ? `±${o.stdDev.toFixed(3)}s` : "--", `Rango ${fmt(o.best)} – ${fmt(o.worst)} (${(o.worst - o.best).toFixed(3)}s)`));
    box.appendChild(stat("Tiempo total en pista", `${Math.floor(o.totalSeconds / 60)}m ${Math.round(o.totalSeconds % 60)}s`, `${o.laps} vueltas · ${o.sessions} ${o.sessions === 1 ? "sesión" : "sesiones"}`));
    if (o.dayBest.length >= 2) {
      const s = o.dayBestSlope;
      box.appendChild(stat("Tendencia del récord por sesión", `${signed(s)}s/sesión`, s < 0 ? "El grupo se está volviendo más rápido 📉" : s > 0 ? "El récord de cada día va empeorando 📈" : "Estancados.", s < 0 ? "up" : s > 0 ? "down" : ""));
    }
    const ins = S.driverInsights(laps);
    const improvers = ins.filter((x) => Number.isFinite(x.sessionDelta));
    if (improvers.length) {
      const better = improvers.filter((x) => x.sessionDelta < 0).length;
      box.appendChild(stat("Mejoraron vs sesión anterior", `${better} / ${improvers.length}`, `Promedio ${signed(S.mean(improvers.map((x) => x.sessionDelta)))}s en su mejor vuelta.`));
    }
    const warm = ins.map((x) => x.warmUp).filter(Number.isFinite);
    if (warm.length) box.appendChild(stat("Costo del calentamiento", `+${S.mean(warm).toFixed(3)}s`, "Lo que pierde la 1ª vuelta vs la mejor de la tanda."));
    const spins = ins.reduce((a, x) => a + x.summary.spins, 0);
    box.appendChild(stat("Trompos totales", String(spins), `${((spins / lapsOnly.length) * 100).toFixed(1)}% de las vueltas pasó de 110% de la mejor del piloto.`));
    const cv = ins.map((x) => x.summary.cv).filter(Number.isFinite);
    if (cv.length) box.appendChild(stat("Regularidad media (CV)", `${S.mean(cv).toFixed(2)}%`, "Desviación relativa promedio; más bajo = más constante."));
  }

  // ---------- Gráficos ----------
  function chartBase() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { labels: { color: "#cbd5e1" } } },
      scales: {
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#1a2232" } },
        y: { reverse: true, ticks: { color: "#94a3b8" }, grid: { color: "#1a2232" } },
      },
    };
  }

  function renderCharts(laps) {
    if (typeof window.Chart !== "function") { $("chartFallback").hidden = false; return; }
    const drivers = [...new Set(laps.map((l) => l.driver))].sort();
    const color = (name) => COLORS[db.drivers.indexOf(name) % COLORS.length];
    const per = drivers.map((d) => laps.filter((l) => l.driver === d).sort((a, b) => a.date.localeCompare(b.date) || a.lap - b.lap));
    const maxN = Math.max(0, ...per.map((x) => x.length));
    const lapData = {
      labels: Array.from({ length: maxN }, (_, i) => i + 1),
      datasets: drivers.map((d, i) => ({ label: d, data: per[i].map((l) => l.seconds), borderColor: color(d), backgroundColor: color(d), tension: 0.25, pointRadius: 3 })),
    };
    charts.lap = upsert(charts.lap, "lapChart", lapData);

    const all = trackLaps();
    const dates = [...new Set(all.map((l) => l.date))].sort();
    const dDrivers = [...new Set(all.map((l) => l.driver))].sort();
    const sessData = {
      labels: dates,
      datasets: dDrivers.map((d) => ({
        label: d,
        borderColor: color(d),
        backgroundColor: color(d),
        spanGaps: true,
        tension: 0.2,
        data: dates.map((dt) => {
          const v = all.filter((l) => l.driver === d && l.date === dt).map((l) => l.seconds);
          return v.length ? Math.min(...v) : null;
        }),
      })),
    };
    charts.session = upsert(charts.session, "sessionChart", sessData);
  }

  function upsert(chart, canvasId, data) {
    if (chart) { chart.data = data; chart.update(); return chart; }
    return new window.Chart($(canvasId), { type: "line", data, options: chartBase() });
  }

  // ---------- Ficha individual ----------
  function renderDriver() {
    const cards = $("driverCards");
    const body = $("historyBody");
    cards.textContent = "";
    body.textContent = "";
    const all = trackLaps().filter((l) => l.driver === ui.driver);
    $("btnDeleteDriver").disabled = !ui.driver;
    if (!all.length) { cards.appendChild(stat("Sin vueltas", "--", "Este piloto no tiene vueltas en la pista seleccionada.")); return; }
    const sum = S.summarize(all);
    const ins = S.driverInsights(all)[0];
    cards.appendChild(stat("Mejor vuelta personal", fmt(sum.best), `${sum.bestLap.date} · vuelta ${sum.bestLap.lap}`, "leader"));
    cards.appendChild(stat("Promedio / mediana", `${fmt(sum.avg)} / ${fmt(sum.median)}`, `${sum.count} vueltas`));
    cards.appendChild(stat("Promedio limpio", fmt(sum.cleanAvg), `${sum.cleanCount} vueltas ≤ 107% de su mejor`));
    cards.appendChild(stat("Regularidad", Number.isFinite(sum.stdDev) ? `±${sum.stdDev.toFixed(3)}s` : "--", Number.isFinite(sum.cv) ? `CV ${sum.cv.toFixed(2)}%` : "Faltan vueltas"));
    cards.appendChild(stat("Peor vuelta", fmt(sum.worst), `+${sum.spread.toFixed(3)}s sobre su mejor · ${sum.spins} trompo(s)`));
    if (Number.isFinite(ins.sessionDelta)) {
      cards.appendChild(stat("Vs sesión anterior", `${signed(ins.sessionDelta)}s`, ins.sessionDelta < 0 ? "Mejoró su mejor vuelta 🚀" : ins.sessionDelta > 0 ? "Empeoró su mejor vuelta 🐌" : "Igual", ins.sessionDelta < 0 ? "up" : ins.sessionDelta > 0 ? "down" : ""));
    }
    if (Number.isFinite(ins.warmUp)) cards.appendChild(stat("Calentamiento", `+${ins.warmUp.toFixed(3)}s`, "1ª vuelta vs mejor de la tanda (promedio)"));
    if (Number.isFinite(ins.withinSessionSlope)) {
      const s = ins.withinSessionSlope;
      cards.appendChild(stat("Tendencia en tanda", `${signed(s)}s/vuelta`, s < 0 ? "Va afinando durante la tanda" : "Se cansa durante la tanda", s < 0 ? "up" : "down"));
    }
    all.sort((a, b) => b.date.localeCompare(a.date) || a.lap - b.lap).forEach((l) => {
      const tr = el("tr");
      tr.appendChild(el("td", { text: l.date }));
      tr.appendChild(el("td", { text: l.track }));
      tr.appendChild(el("td", { text: String(l.lap), cls: "r mono" }));
      tr.appendChild(el("td", { text: fmt(l.seconds), cls: `r mono${l.id === sum.bestLap.id ? " leader" : ""}` }));
      tr.appendChild(el("td", { text: l.id === sum.bestLap.id ? "PB 🟣" : `+${(l.seconds - sum.best).toFixed(3)}s`, cls: "r mono" }));
      const act = el("td", { cls: "r" });
      const del = el("button", { cls: "btn danger small", text: "Borrar", attrs: { type: "button", "aria-label": `Borrar vuelta ${l.lap} del ${l.date}` } });
      del.addEventListener("click", () => {
        if (!window.confirm("¿Borrar esta vuelta?")) return;
        db.laps = db.laps.filter((x) => x.id !== l.id);
        save();
        render();
      });
      act.appendChild(del);
      tr.appendChild(act);
      body.appendChild(tr);
    });
  }

  function renderH2H() {
    const box = $("h2hResult");
    box.textContent = "";
    const r = ui.h2hA && ui.h2hB ? S.headToHead(trackLaps(), ui.h2hA, ui.h2hB) : null;
    if (!r) { box.appendChild(stat("Cara a cara", "--", "Elige dos pilotos con vueltas en la pista seleccionada.")); return; }
    const who = (gap) => (gap < 0 ? ui.h2hA : gap > 0 ? ui.h2hB : "Empate");
    box.appendChild(stat("Mejor vuelta", `${fmt(r.a.best)} vs ${fmt(r.b.best)}`, `${who(r.bestGap)} por ${Math.abs(r.bestGap).toFixed(3)}s`));
    box.appendChild(stat("Promedio", `${fmt(r.a.avg)} vs ${fmt(r.b.avg)}`, `${who(r.avgGap)} por ${Math.abs(r.avgGap).toFixed(3)}s`));
    box.appendChild(stat("Vuelta a vuelta", r.pairs ? `${r.aWins} - ${r.bWins}` : "--", r.pairs ? `${r.pairs} vueltas comparables (misma fecha, pista y nº)${r.ties ? ` · ${r.ties} empates` : ""}` : "No hay vueltas con la misma fecha y número."));
    box.appendChild(stat("Regularidad", `${num(r.a.stdDev)} vs ${num(r.b.stdDev)}`, "Desviación estándar (menor = más constante)"));
  }

  // ---------- Formularios ----------
  function showError(id, msg) { const p = $(id); p.textContent = msg; p.hidden = !msg; }

  function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function suggestLapNumber() {
    const existing = db.laps.filter((l) => l.driver === $("lapDriver").value && l.date === $("lapDate").value && l.track === $("lapTrack").value);
    $("lapNumber").value = existing.length ? Math.max(...existing.map((l) => l.lap)) + 1 : 1;
  }

  function openLapDialog() {
    if (!db.drivers.length) { toast("Primero agrega un piloto.", true); openDriverDialog(); return; }
    fillSelect($("lapDriver"), db.drivers, ui.driver);
    fillSelect($("lapTrack"), db.tracks, ui.track === ALL_TRACKS ? db.tracks[0] : ui.track);
    $("lapDate").value = ui.scope === "daily" && ui.date ? ui.date : today();
    $("lapTime").value = "";
    showError("lapError", "");
    suggestLapNumber();
    $("lapDialog").showModal();
    $("lapTime").focus();
  }

  function openDriverDialog() { $("driverName").value = ""; showError("driverError", ""); $("driverDialog").showModal(); $("driverName").focus(); }
  function openTrackDialog() { $("trackName").value = ""; showError("trackError", ""); $("trackDialog").showModal(); $("trackName").focus(); }

  function submitLap(ev) {
    ev.preventDefault();
    const driver = $("lapDriver").value;
    const track = $("lapTrack").value;
    const date = $("lapDate").value;
    const lap = Number($("lapNumber").value);
    const seconds = S.parseTime($("lapTime").value);
    if (!db.drivers.includes(driver) || !db.tracks.includes(track)) return showError("lapError", "Piloto o pista inválidos.");
    if (!D.isValidDate(date)) return showError("lapError", "Fecha inválida.");
    if (!Number.isInteger(lap) || lap < 1 || lap > D.LIMITS.maxLapNumber) return showError("lapError", `El número de vuelta debe estar entre 1 y ${D.LIMITS.maxLapNumber}.`);
    if (seconds === null || !D.isValidSeconds(seconds)) return showError("lapError", "Tiempo inválido. Usa 43.520 o 1:02.150 (entre 10 s y 10 min).");
    if (db.laps.length >= D.LIMITS.maxLaps) return showError("lapError", "Se alcanzó el máximo de vueltas.");
    if (db.laps.some((l) => l.driver === driver && l.date === date && l.track === track && l.lap === lap)) {
      return showError("lapError", "Ya existe esa vuelta para ese piloto, fecha y pista.");
    }
    db.laps.push({ id: D.newId("lap"), date, driver, lap, seconds, track });
    ui.driver = driver;
    if (ui.track !== ALL_TRACKS) ui.track = track;
    ui.date = date;
    save();
    $("lapDialog").close();
    render();
    toast(`Vuelta de ${driver}: ${fmt(seconds)}`);
  }

  function submitDriver(ev) {
    ev.preventDefault();
    const name = D.cleanName($("driverName").value);
    if (!name) return showError("driverError", `Nombre inválido (1 a ${D.LIMITS.maxNameLength} caracteres, sin < >).`);
    if (db.drivers.some((d) => d.toLowerCase() === name.toLowerCase())) return showError("driverError", "Ese piloto ya existe.");
    if (db.drivers.length >= D.LIMITS.maxDrivers) return showError("driverError", "Se alcanzó el máximo de pilotos.");
    db.drivers.push(name);
    db.drivers.sort((a, b) => a.localeCompare(b, "es"));
    ui.driver = name;
    save();
    $("driverDialog").close();
    render();
  }

  function submitTrack(ev) {
    ev.preventDefault();
    const name = D.cleanName($("trackName").value);
    if (!name) return showError("trackError", `Nombre inválido (1 a ${D.LIMITS.maxNameLength} caracteres, sin < >).`);
    if (db.tracks.some((t) => t.toLowerCase() === name.toLowerCase())) return showError("trackError", "Esa pista ya existe.");
    if (db.tracks.length >= D.LIMITS.maxTracks) return showError("trackError", "Se alcanzó el máximo de pistas.");
    db.tracks.push(name);
    ui.track = name;
    save();
    $("trackDialog").close();
    render();
  }

  // ---------- Datos ----------
  function exportJson() {
    const blob = new Blob([D.serialize(db)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { attrs: { href: url, download: `karting_dashboard_${today()}.json` } });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importJson(file) {
    if (!file) return;
    if (file.size > D.LIMITS.maxImportBytes) { toast("El archivo es demasiado grande.", true); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const v = D.validateDatabase(JSON.parse(String(reader.result)));
        if (!window.confirm(`Esto reemplazará tus datos actuales por ${v.laps.length} vueltas y ${v.drivers.length} pilotos. ¿Continuar?`)) return;
        db = { drivers: v.drivers, tracks: v.tracks.length ? v.tracks : [D.DEFAULT_TRACK], laps: v.laps };
        save();
        render();
        toast(`Importado: ${v.laps.length} vueltas${v.skipped ? ` (${v.skipped} descartadas por inválidas)` : ""}.`);
      } catch (e) {
        toast(`Importación rechazada: ${e.message}`, true);
      }
    };
    reader.onerror = () => toast("No se pudo leer el archivo.", true);
    reader.readAsText(file);
  }

  function loadDemo() {
    if (db.laps.length && !window.confirm("Esto reemplazará tus datos actuales por datos de ejemplo. ¿Continuar?")) return;
    const v = D.demoDatabase();
    db = { drivers: v.drivers, tracks: v.tracks, laps: v.laps };
    ui.track = D.DEFAULT_TRACK;
    ui.date = "";
    save();
    render();
  }

  function resetAll() {
    if (!window.confirm("¿Borrar TODOS los pilotos, pistas y vueltas de este navegador?")) return;
    db = { drivers: [], tracks: [D.DEFAULT_TRACK], laps: [] };
    save();
    render();
  }

  function deleteDriver() {
    if (!ui.driver) return;
    const n = db.laps.filter((l) => l.driver === ui.driver).length;
    if (!window.confirm(`¿Eliminar a ${ui.driver} y sus ${n} vueltas (de todas las pistas)?`)) return;
    db.laps = db.laps.filter((l) => l.driver !== ui.driver);
    db.drivers = db.drivers.filter((d) => d !== ui.driver);
    save();
    render();
  }

  // ---------- Eventos ----------
  function bind() {
    $("btnAddLap").addEventListener("click", openLapDialog);
    $("btnAddDriver").addEventListener("click", openDriverDialog);
    $("btnAddTrack").addEventListener("click", openTrackDialog);
    $("btnExport").addEventListener("click", exportJson);
    $("importFile").addEventListener("change", (e) => { importJson(e.target.files[0]); e.target.value = ""; });
    $("btnDemo").addEventListener("click", loadDemo);
    $("btnDemo2").addEventListener("click", loadDemo);
    $("btnReset").addEventListener("click", resetAll);
    $("btnDeleteDriver").addEventListener("click", deleteDriver);
    $("lapForm").addEventListener("submit", submitLap);
    $("driverForm").addEventListener("submit", submitDriver);
    $("trackForm").addEventListener("submit", submitTrack);
    ["lapDriver", "lapTrack", "lapDate"].forEach((id) => $(id).addEventListener("change", suggestLapNumber));
    document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
    $("trackFilter").addEventListener("change", (e) => { ui.track = e.target.value; render(); });
    $("dateFilter").addEventListener("change", (e) => { ui.date = e.target.value; render(); });
    $("sortFilter").addEventListener("change", (e) => { ui.sort = e.target.value; render(); });
    $("driverSelect").addEventListener("change", (e) => { ui.driver = e.target.value; renderDriver(); });
    $("h2hA").addEventListener("change", (e) => { ui.h2hA = e.target.value; renderH2H(); });
    $("h2hB").addEventListener("change", (e) => { ui.h2hB = e.target.value; renderH2H(); });
    document.querySelectorAll(".seg button").forEach((b) => b.addEventListener("click", () => { ui.scope = b.dataset.scope; render(); }));
  }

  load();
  bind();
  render();
})();
