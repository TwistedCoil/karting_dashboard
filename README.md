# 🏎️ Karting Dashboard

Dashboard local para registrar vueltas de karting entre amigos, comparar ritmos y reírse de los resultados. Es **un solo archivo HTML** (`index.html`): HTML, CSS y JavaScript juntos. Sin servidor, sin base de datos, sin cuentas ni instalación.

## Inicio rápido

1. Descarga o clona el repositorio.
2. Abre `index.html` en un navegador moderno (Chrome, Edge, Firefox, Safari).
3. Pulsa **Cargar datos de ejemplo** para ver el tablero completo, o agrega pilotos con **+ Piloto** y vueltas con **+ Registrar vuelta**.
4. Exporta un respaldo con **Exportar JSON** de vez en cuando.

Para compartirlo basta con pasar el archivo; también sirve tal cual en GitHub Pages.

## Datos

Los pilotos, pistas y vueltas se guardan en el `localStorage` de tu navegador; nada se envía a ningún servidor. Cada vuelta:

```json
{ "id": "lap_...", "date": "2026-10-30", "driver": "Tiroloco McGrau", "lap": 3, "seconds": 42.15, "track": "Circuito GP Indoor" }
```

- Tiempos entre **10 s y 10 min**; acepta `43.520`, `43,520` o `1:02.150`.
- No se permiten dos vueltas con el mismo piloto, fecha, pista y número.
- Cada **pista** es independiente: los tiempos de circuitos distintos no son comparables. La vista «Todas» mezcla pistas y lo advierte.
- **Importar JSON** valida todo (tipos, fechas reales, rangos, límites de 60 pilotos / 30 pistas / 20 000 vueltas / 5 MB), descarta las vueltas inválidas y pide confirmación antes de reemplazar tus datos.

## Estadísticas

**Parrilla** (día o histórico; orden por mejor vuelta, promedio, promedio limpio o regularidad): mejor vuelta, promedio, mediana, promedio limpio, desviación estándar, gap a la pole, intervalo con el de delante, cantidad de vueltas y etiqueta de ritmo.

- **Vuelta limpia:** ≤ 107 % de la mejor vuelta del propio piloto (regla del 107 %).
- **Trompo:** vuelta > 110 % de la mejor del piloto.
- **Desviación estándar:** muestral (n − 1); requiere 2+ vueltas. **CV** = desviación / promedio.
- **Tendencia en tanda:** pendiente de mínimos cuadrados de los tiempos por vuelta (solo tandas de 4+ vueltas). Negativa = va afinando.
- **Calentamiento:** promedio de (1ª vuelta − mejor vuelta de la tanda).

**Premios tóxicos:** Verstappen de barrio, Llevando a la abuelita, Coche de bebé, Chicane móvil con patas, Metrónomo robótico, Trompo serial, Calentando motores, En racha, Montaña rusa, Se durmió en la curva, El remontador, Casi casi, Bandera azul, Gastador de nafta (+ top 3) y Socio del circuito.

**Tendencias del grupo:** promedio vs mediana, dispersión, tiempo total en pista, tendencia del récord por sesión, cuántos mejoraron respecto de la sesión anterior, costo del calentamiento, trompos totales y regularidad media.

**Gráficos:** tiempos por vuelta (eje invertido) y mejor vuelta por sesión. **Ficha individual** con historial borrable y **Cara a cara** entre dos pilotos (mejor, promedio, vuelta a vuelta emparejando fecha, pista y número).

> Todas las métricas son recreativas: no miden habilidad ni condición física. Para tendencias confiables registra varias sesiones en la misma pista.

## Seguridad

- Sin `innerHTML`: todo el contenido dinámico (incluidos nombres importados) se inserta como texto.
- **Content-Security-Policy**: sin conexiones de red (`connect-src 'none'`), sin formularios externos, sin objetos embebidos. Lo único externo es Chart.js 4.5.1 (MIT) desde jsDelivr con **SRI** (hash de integridad); si no carga, los gráficos se ocultan con un aviso y el resto funciona.
- Validación y normalización de todo dato de entrada, formularios y JSON importado (nombres sin `<`, `>` ni caracteres de control; nombres de prototipo rechazados; IDs saneados).
- Sin cookies, sin telemetría, `referrer` desactivado.

## Estructura

Todo está en `index.html`, en este orden: estilos, HTML, y un `<script>` con tres secciones (estadísticas puras, validación/datos de ejemplo, interfaz). Los nombres de los datos de ejemplo son personajes ficticios: Pierre Nodoyuna, Tiroloco McGrau, Agente Cobra, Porko Rosso y Pedro Picapiedra.

## Licencia

[MIT](LICENSE). Chart.js es MIT (© Chart.js Contributors).
