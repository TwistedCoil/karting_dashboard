# 🏎️ Karting Dashboard

Dashboard local para registrar vueltas de karting entre amigos, comparar ritmos y reírse de los resultados. Es **un solo archivo HTML** (`index.html`): con el diseño racing/F1 original (Tailwind compilado y embebido), HTML y JavaScript juntos. Sin servidor, sin base de datos, sin cuentas ni instalación.

## Inicio rápido

1. Descarga o clona el repositorio.
2. Abre `index.html` en un navegador moderno (Chrome, Edge, Firefox, Safari).
3. Pulsa **Cargar datos de ejemplo** para ver el tablero completo, o agrega pilotos con **+ Agregar Piloto**, pistas con **+ Pista** y vueltas con **Registrar Vuelta**.
4. Exporta un respaldo desde **Datos y respaldos** de vez en cuando.

Para compartirlo basta con pasar el archivo; también sirve tal cual en GitHub Pages.

## Datos

Los pilotos, pistas y vueltas se guardan en el `localStorage` de tu navegador; nada se envía a ningún servidor. Cada vuelta:

```json
{ "id": "lap_...", "date": "2026-10-30", "driver": "Tiroloco McGrau", "lap": 3, "seconds": 42.15, "track": "Circuito GP Indoor" }
```

- Tiempos entre **10 s y 10 min**; acepta `43.520`, `43,520` o `1:02.150`.
- No se permiten dos vueltas con el mismo piloto, fecha, pista y número.
- Cada **pista** es independiente: los tiempos de circuitos distintos no son comparables. La vista «Todas» mezcla pistas y lo advierte.
- Al crear una pista puedes indicar sus **metros totales** (50–5000 m); con eso se calculan km/h (velocidad punta, media y km recorridos) en el podio, trofeos, tendencias y ficha del piloto. Para cambiar los metros de una pista existente, usa **+ Pista** con el mismo nombre y los nuevos metros.
- **Pistas que solo dan un resumen** (tiempo total, nº de vueltas y mejor vuelta): en **Registrar Vuelta** elige «Resumen de tanda». Cuenta para mejor tiempo, promedio (total ÷ vueltas), km/h, puntos y posiciones. Regularidad, trompos y tendencias solo usan vueltas individuales (se muestran «--» si un piloto solo tiene resúmenes). Se borran desde la ficha del piloto.
- **Importar JSON** valida todo (tipos, fechas reales, rangos, límites de 60 pilotos / 30 pistas / 20 000 vueltas / 5 MB), descarta las vueltas inválidas y pide confirmación antes de reemplazar tus datos.

## Estadísticas

**Parrilla** (día o histórico; orden por mejor vuelta, promedio, promedio limpio o regularidad): mejor vuelta, promedio, mediana, promedio limpio, desviación estándar, gap a la pole, intervalo con el de delante, cantidad de vueltas y etiqueta de ritmo.

- **Vuelta limpia:** ≤ 107 % de la mejor vuelta del propio piloto (regla del 107 %).
- **Trompo:** vuelta > 110 % de la mejor del piloto.
- **Desviación estándar:** muestral (n − 1); requiere 2+ vueltas. **CV** = desviación / promedio.
- **Tendencia en tanda:** pendiente de mínimos cuadrados de los tiempos por vuelta (solo tandas de 4+ vueltas). Negativa = va afinando.
- **Calentamiento:** promedio de (1ª vuelta − mejor vuelta de la tanda).

**Premios tóxicos (originales):** El Verstappen de barrio, Llevando a la abuelita, Conductor de coche de bebé, Chicane móvil con patas, El Metrónomo robótico y Gastadores de nafta.

**Premios nuevos:** Rey del trompo, Dormido en la largada, Se durmió en la curva, El remontador, Montaña rusa, Flor tardía, Racha de mejora, Casi-casi, Brecha del pedal y Socio del circuito.

**Campeonato:** puntos estilo F1 (25-18-15-12-10-8-6-4-2-1) por cada tanda según la mejor vuelta, con poles, podios y puntos por tanda.

**Tendencias:** El promedio miente (promedio − mediana), Índice de Temblor (CV), Ahora sí (vuelta 1 → 2), Eye of the Tiger (última tanda vs mejor previa), Niño Karate Kid (promedio última vs primera tanda), De aquí te veo Insecto, SugarDaddy paga y Récord del grupo.

**Gráficos:** tiempos por vuelta (eje invertido) y La Curva del Saco (promedio por piloto en cada fecha). **Ficha individual** con historial borrable y **Cara a cara** entre dos pilotos (mejor, promedio, vuelta a vuelta emparejando fecha, pista y número).

> Todas las métricas son recreativas: no miden habilidad ni condición física. Para tendencias confiables registra varias sesiones en la misma pista.

## Seguridad

- Todo valor dinámico (incluidos nombres importados) pasa por `escapeHtml` antes de entrar al DOM; sin `onclick` en línea (delegación de eventos).
- **Content-Security-Policy**: sin conexiones de red (`connect-src 'none'`), sin formularios externos, sin objetos embebidos. Lo único externo es Chart.js 4.5.1 (MIT) desde jsDelivr con **SRI** (hash de integridad); si no carga, los gráficos se ocultan con un aviso y el resto funciona.
- Validación y normalización de todo dato de entrada, formularios y JSON importado (nombres sin `<`, `>` ni caracteres de control; nombres de prototipo rechazados; IDs saneados).
- Sin cookies, sin telemetría, `referrer` desactivado.

## Estructura

Todo está en `index.html`: CSS de Tailwind v3.4.17 compilado en línea (funciona sin conexión; solo las fuentes de Google y Chart.js vienen de CDN), el HTML del tablero y un `<script>` con la lógica. Los datos de ejemplo usan personajes ficticios: Pierre Nodoyuna, Tiroloco McGrau, Agente Cobra, Porko Rosso y Pedro Picapiedra.

## Licencia

[MIT](LICENSE). Chart.js es MIT (© Chart.js Contributors).
