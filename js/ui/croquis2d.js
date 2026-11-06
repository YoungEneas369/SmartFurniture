/**
 * Generador de Croquis Técnico 2D Vectorial (CAD Blueprint) y Pizarra de Esquema a Mano.
 *
 * Implementa el puente visual explícito entre:
 *   [1. Foto o Dibujo Esquema]  ──►  [2. Croquis Técnico 2D + Mapa de Vacíos]  ──►  [3. Modelo 3D]
 *
 * Incluye:
 *   - Detección geométrica exacta de los Espacios Vacíos (huecos abiertos, vanos para piernas,
 *     despejes inferiores y recortes escalonados) a partir de la sustracción 2D de las piezas
 *     frontales sobre el rectángulo delimitador W × H.
 *   - Vista Frontal Acotada + Vista Lateral de Profundidad (D × H) con simbología CAD:
 *       • Huecos / Espacios vacíos con achurado diagonal azul y etiqueta de luz libre (mm).
 *       • Puertas con triángulo punteado de sentido de apertura y manilla.
 *       • Cajones con correderas punteadas, tirador central y cota vertical.
 *   - Pizarra interactiva ("Dibujar Esquema a Mano") para trazar bocetos rápidos (rectángulo,
 *     líneas divisorias, pomos de cajón/puerta y marcas de espacio vacío) y convertirlos en
 *     Croquis 2D y Modelo 3D.
 */

const ESC = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Calcula las celdas vacías (huecos abiertos, vanos inferiores para silla/patas y
 * vacíos escalonados exteriores) en el plano frontal X-Y a partir de las piezas 3D.
 */
export function calcularEspaciosVaciosFrontales(mueble) {
  const W = Math.max(100, Number(mueble?.params?.ancho) || 600);
  const H = Math.max(100, Number(mueble?.params?.alto) || 600);
  const piezas = Array.isArray(mueble?.piezas) ? mueble.piezas : [];

  // Ignorar el fondo trasero (grupo 'fondo') y los costados internos de cajón ('cajon')
  // para evaluar qué zonas del frente están ocupadas por madera sólida o frentes cerrados.
  const solidas = piezas.filter((p) => p.grupo !== 'fondo' && p.grupo !== 'cajon');

  // Coordenadas X e Y críticas (bordes de tableros, repisas y frentes)
  const xsSet = new Set([0, W]);
  const ysSet = new Set([0, H]);
  for (const p of solidas) {
    const [x0, y0] = p.pos;
    const [dx, dy] = p.tam;
    xsSet.add(Math.max(0, Math.min(W, Math.round(x0))));
    xsSet.add(Math.max(0, Math.min(W, Math.round(x0 + dx))));
    ysSet.add(Math.max(0, Math.min(H, Math.round(y0))));
    ysSet.add(Math.max(0, Math.min(H, Math.round(y0 + dy))));
  }

  const xs = [...xsSet].sort((a, b) => a - b);
  const ys = [...ysSet].sort((a, b) => a - b);
  const nX = xs.length - 1;
  const nY = ys.length - 1;
  if (nX <= 0 || nY <= 0) return [];

  // Matriz booleana de celdas elementales vacías
  const esVacia = Array.from({ length: nY }, () => new Array(nX).fill(true));
  for (let iy = 0; iy < nY; iy++) {
    const cy = (ys[iy] + ys[iy + 1]) / 2;
    const hCell = ys[iy + 1] - ys[iy];
    for (let ix = 0; ix < nX; ix++) {
      const cx = (xs[ix] + xs[ix + 1]) / 2;
      const wCell = xs[ix + 1] - xs[ix];
      if (wCell < 2 || hCell < 2) {
        esVacia[iy][ix] = false;
        continue;
      }
      for (const p of solidas) {
        const [x0, y0] = p.pos;
        const [dx, dy] = p.tam;
        if (cx > x0 + 0.5 && cx < x0 + dx - 0.5 && cy > y0 + 0.5 && cy < y0 + dy - 0.5) {
          esVacia[iy][ix] = false;
          break;
        }
      }
    }
  }

  // Fusionar celdas vacías adyacentes en rectángulos maximalmente grandes (greedy 2D merge)
  const visitada = Array.from({ length: nY }, () => new Array(nX).fill(false));
  const vacios = [];

  for (let iy = 0; iy < nY; iy++) {
    for (let ix = 0; ix < nX; ix++) {
      if (!esVacia[iy][ix] || visitada[iy][ix]) continue;

      let ixFin = ix;
      while (ixFin + 1 < nX && esVacia[iy][ixFin + 1] && !visitada[iy][ixFin + 1]) {
        ixFin++;
      }

      let iyFin = iy;
      while (iyFin + 1 < nY) {
        let filaLibre = true;
        for (let k = ix; k <= ixFin; k++) {
          if (!esVacia[iyFin + 1][k] || visitada[iyFin + 1][k]) {
            filaLibre = false;
            break;
          }
        }
        if (!filaLibre) break;
        iyFin++;
      }

      for (let r = iy; r <= iyFin; r++) {
        for (let c = ix; c <= ixFin; c++) {
          visitada[r][c] = true;
        }
      }

      const x0 = xs[ix];
      const x1 = xs[ixFin + 1];
      const y0 = ys[iy];
      const y1 = ys[iyFin + 1];
      const w = x1 - x0;
      const h = y1 - y0;

      // Solo considerar espacios vacíos significativos (>= 32 mm de luz libre)
      if (w >= 32 && h >= 32) {
        const tocaPiso = y0 <= 2;
        const tocaTecho = y1 >= H - 2;
        const tocaIzq = x0 <= 2;
        const tocaDer = x1 >= W - 2;

        let subtipoVacio = 'hueco_interno';
        let etiqueta = 'HUECO ABIERTO';
        if (tocaPiso && (w > W * 0.28 || h > H * 0.35)) {
          subtipoVacio = 'vano_piernas';
          etiqueta = h > 300 ? 'VANO LIBRE / SILLA' : 'DESPEJE PATAS';
        } else if (tocaPiso) {
          subtipoVacio = 'despeje_inferior';
          etiqueta = 'VACÍO INFERIOR';
        } else if (tocaTecho && (tocaIzq || tocaDer)) {
          subtipoVacio = 'vacio_escalonado';
          etiqueta = 'VACÍO ESCALONADO';
        } else if (tocaIzq && !tocaTecho && y1 < H - 15) {
          subtipoVacio = 'vacio_alero';
          etiqueta = 'VANO BAJO ALERO';
        }

        vacios.push({ x: x0, y: y0, w, h, subtipoVacio, etiqueta });
      }
    }
  }

  return vacios;
}

/**
 * Genera el SVG del Croquis Técnico 2D (Vista Frontal + Vista Lateral + Mapa de Espacios Vacíos).
 */
export function generarCroquisTecnicoSVG(mueble, opciones = {}) {
  if (!mueble || !mueble.params) return '';
  const { ancho: W, alto: H, profundidad: D } = mueble.params;
  const tieneFondo = opciones.tieneFondo ?? (mueble.piezas || []).some((p) => p.grupo === 'fondo');
  const nombre = opciones.nombreMueble || 'Croquis Técnico 2D';
  const subtipo = opciones.subtipo || mueble.detalle?.subtipo || 'estandar';

  const svgW = 780;
  const svgH = 420;
  const padTop = 58;
  const padBot = 58;
  const dispH = svgH - padTop - padBot;

  // Escala compartida para Vista Frontal (W×H) y Vista Lateral (D×H)
  const dispWTotal = svgW - 170;
  const esc = Math.min(dispWTotal / Math.max(200, W + D), dispH / Math.max(200, H));

  const wFrontPx = W * esc;
  const dSidePx = D * esc;
  const hPx = H * esc;

  const gapVistas = Math.max(48, Math.min(72, (svgW - wFrontPx - dSidePx) * 0.32));
  const xFront0 = Math.max(48, (svgW - (wFrontPx + gapVistas + dSidePx)) / 2);
  const xSide0 = xFront0 + wFrontPx + gapVistas;
  const yTop0 = padTop + (dispH - hPx) / 2;
  const yBot0 = yTop0 + hPx;

  const fx = (xMm) => (xFront0 + xMm * esc).toFixed(1);
  const fy = (yMm) => (yBot0 - yMm * esc).toFixed(1);
  const sx = (zMm) => (xSide0 + zMm * esc).toFixed(1);

  const vacios = calcularEspaciosVaciosFrontales(mueble);
  const piezas = mueble.piezas || [];

  // 1. Renderizar Espacios Vacíos (Huecos abiertos, vanos de patas/silla y recortes escalonados)
  const svgVacios = vacios
    .map((v, idx) => {
      const rx = fx(v.x);
      const ry = fy(v.y + v.h);
      const rw = (v.w * esc).toFixed(1);
      const rh = (v.h * esc).toFixed(1);
      const cx = (Number(rx) + Number(rw) / 2).toFixed(1);
      const cy = (Number(ry) + Number(rh) / 2).toFixed(1);

      const esExterior = v.subtipoVacio === 'vacio_escalonado' || v.subtipoVacio === 'vacio_alero';
      const fillUrl = esExterior ? 'url(#patron-vacio-ext)' : 'url(#patron-vacio-int)';
      const strokeCol = esExterior ? '#64748b' : '#0284c7';

      const mostrarTexto = Number(rw) >= 42 && Number(rh) >= 24;
      const mostrarEtiqueta = Number(rw) >= 64 && Number(rh) >= 42;

      return `
        <g class="croquis-celda-vacia" data-vacio-idx="${idx}">
          <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}"
                fill="${fillUrl}" stroke="${strokeCol}" stroke-width="1" stroke-dasharray="3,2"/>
          ${
            mostrarEtiqueta
              ? `<text x="${cx}" y="${(Number(cy) - 5).toFixed(1)}" text-anchor="middle" fill="#0369a1" font-size="8.5" font-weight="700" font-family="monospace">${ESC(v.etiqueta)}</text>`
              : ''
          }
          ${
            mostrarTexto
              ? `<text x="${cx}" y="${(Number(cy) + (mostrarEtiqueta ? 7 : 3)).toFixed(1)}" text-anchor="middle" fill="#0f172a" font-size="9" font-weight="600" font-family="monospace">${Math.round(v.w)}×${Math.round(v.h)}</text>`
              : ''
          }
        </g>`;
    })
    .join('');

  // 2. Renderizar Estructura y Repisas en Vista Frontal (ordenados de atrás hacia adelante en Z)
  const piezasFront = [...piezas]
    .filter((p) => p.grupo !== 'fondo' && p.grupo !== 'cajon')
    .sort((a, b) => a.pos[2] - b.pos[2]);

  const svgPiezasFront = piezasFront
    .map((p) => {
      const [x0, y0] = p.pos;
      const [dx, dy] = p.tam;
      const rx = Number(fx(x0));
      const ry = Number(fy(y0 + dy));
      const rw = dx * esc;
      const rh = dy * esc;

      if (p.grupo === 'puerta') {
        // Símbolo técnico CAD de puerta batiente (hoja + triángulo punteado de bisagra + tirador)
        const abreIzq = x0 + dx / 2 <= W / 2;
        const xBisagra = abreIzq ? rx : rx + rw;
        const xManilla = abreIzq ? rx + rw - Math.min(10, rw * 0.15) : rx + Math.min(10, rw * 0.15);
        const yMid = ry + rh / 2;
        return `
          <g class="croquis-pieza-puerta">
            <rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}"
                  fill="#fef3c7" fill-opacity="0.88" stroke="#b45309" stroke-width="1.6"/>
            <polyline points="${xBisagra.toFixed(1)},${ry.toFixed(1)} ${xManilla.toFixed(1)},${yMid.toFixed(1)} ${xBisagra.toFixed(1)},${(ry + rh).toFixed(1)}"
                      fill="none" stroke="#d97706" stroke-width="1" stroke-dasharray="4,3"/>
            <line x1="${xManilla.toFixed(1)}" y1="${(yMid - Math.min(12, rh * 0.15)).toFixed(1)}"
                  x2="${xManilla.toFixed(1)}" y2="${(yMid + Math.min(12, rh * 0.15)).toFixed(1)}"
                  stroke="#78350f" stroke-width="2.2" stroke-linecap="round"/>
            ${
              rw >= 40 && rh >= 26
                ? `<text x="${(rx + rw / 2).toFixed(1)}" y="${(yMid + 3).toFixed(1)}" text-anchor="middle" fill="#92400e" font-size="8.5" font-weight="700" font-family="monospace">PUERTA ${Math.round(dx)}×${Math.round(dy)}</text>`
                : ''
            }
          </g>`;
      }

      if (p.grupo === 'frente') {
        // Símbolo técnico CAD de frente de cajón (marco + tirador central horizontal + cota)
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        const wTir = Math.min(26, rw * 0.28);
        return `
          <g class="croquis-pieza-cajon">
            <rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}"
                  fill="#fce7f3" fill-opacity="0.88" stroke="#be185d" stroke-width="1.6"/>
            <rect x="${(rx + 3).toFixed(1)}" y="${(ry + 3).toFixed(1)}" width="${Math.max(2, rw - 6).toFixed(1)}" height="${Math.max(2, rh - 6).toFixed(1)}"
                  fill="none" stroke="#f472b6" stroke-width="0.8" stroke-dasharray="2,2"/>
            <line x1="${(cx - wTir / 2).toFixed(1)}" y1="${(cy - (rh > 26 ? 4 : 0)).toFixed(1)}"
                  x2="${(cx + wTir / 2).toFixed(1)}" y2="${(cy - (rh > 26 ? 4 : 0)).toFixed(1)}"
                  stroke="#831843" stroke-width="2.2" stroke-linecap="round"/>
            ${
              rw >= 42 && rh >= 18
                ? `<text x="${cx.toFixed(1)}" y="${(cy + (rh > 26 ? 8 : 3)).toFixed(1)}" text-anchor="middle" fill="#9d174d" font-size="8.5" font-weight="700" font-family="monospace">CAJÓN ${Math.round(dx)}×${Math.round(dy)}</text>`
                : ''
            }
          </g>`;
      }

      // Piezas de estructura o repisas (tableros de 18 mm)
      const fillTab = p.grupo === 'repisa' ? '#bae6fd' : '#cbd5e1';
      return `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${Math.max(1.5, rw).toFixed(1)}" height="${Math.max(1.5, rh).toFixed(1)}"
                    fill="${fillTab}" stroke="#0f172a" stroke-width="1.2"/>`;
    })
    .join('');

  // 3. Renderizar Vista Lateral Derecha (Perfil Z-Y: Profundidad D × Alto H)
  const piezasSide = [...piezas].sort((a, b) => a.pos[0] - b.pos[0]);
  const svgPiezasSide = piezasSide
    .map((p) => {
      const [, y0, z0] = p.pos;
      const [, dy, dz] = p.tam;
      const rx = Number(sx(z0));
      const ry = Number(fy(y0 + dy));
      const rw = Math.max(1.5, dz * esc);
      const rh = Math.max(1.5, dy * esc);
      const fill =
        p.grupo === 'fondo'
          ? '#94a3b8'
          : p.grupo === 'puerta'
            ? '#fcd34d'
            : p.grupo === 'frente'
              ? '#f9a8d4'
              : p.grupo === 'repisa'
                ? '#7dd3fc'
                : '#e2e8f0';
      return `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}"
                    fill="${fill}" fill-opacity="0.78" stroke="#1e293b" stroke-width="1"/>`;
    })
    .join('');

  const nVacios = vacios.length;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" height="100%"
         style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;max-height:420px">
      <defs>
        <pattern id="grid-cad" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.7"/>
        </pattern>
        <pattern id="patron-vacio-int" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="10" fill="#e0f2fe" fill-opacity="0.55"/>
          <line x1="0" y1="0" x2="0" y2="10" stroke="#38bdf8" stroke-width="1.2" stroke-opacity="0.55"/>
        </pattern>
        <pattern id="patron-vacio-ext" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <rect width="10" height="10" fill="#f1f5f9" fill-opacity="0.65"/>
          <line x1="0" y1="0" x2="0" y2="10" stroke="#94a3b8" stroke-width="1" stroke-opacity="0.45"/>
        </pattern>
        <marker id="flecha-cad" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#0f172a"/>
        </marker>
      </defs>

      <!-- Fondo cuadriculado de plano técnico -->
      <rect width="${svgW}" height="${svgH}" fill="url(#grid-cad)"/>

      <!-- Encabezado del Croquis Técnico 2D -->
      <rect x="0" y="0" width="${svgW}" height="34" fill="#0f172a"/>
      <text x="14" y="21" fill="#38bdf8" font-size="12" font-weight="700" font-family="monospace">
        📐 CROQUIS TÉCNICO 2D PRE-3D · ${ESC(nombre.toUpperCase())} (${W}×${H}×${D} mm)
      </text>
      <text x="${svgW - 14}" y="21" text-anchor="end" fill="#e2e8f0" font-size="10.5" font-family="monospace">
        Topología: ${ESC(subtipo)} · ${nVacios} espacio(s) vacío(s) · ${tieneFondo ? 'Con fondo 3mm' : 'Fondo abierto'}
      </text>

      <!-- Títulos de Vistas -->
      <text x="${(xFront0 + wFrontPx / 2).toFixed(1)}" y="${(yTop0 - 22).toFixed(1)}" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="700" font-family="sans-serif">
        VISTA FRONTAL ACOTADA (ANCHO × ALTO)
      </text>
      <text x="${(xSide0 + dSidePx / 2).toFixed(1)}" y="${(yTop0 - 22).toFixed(1)}" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="700" font-family="sans-serif">
        PERFIL LATERAL (FONDO)
      </text>

      <!-- Contorno delimitador punteado W × H -->
      <rect x="${xFront0.toFixed(1)}" y="${yTop0.toFixed(1)}" width="${wFrontPx.toFixed(1)}" height="${hPx.toFixed(1)}"
            fill="#ffffff" fill-opacity="0.7" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,4"/>

      <!-- Capas Vista Frontal: 1. Espacios Vacíos achurados, 2. Tableros, Puertas y Cajones -->
      ${svgVacios}
      ${svgPiezasFront}

      <!-- Cota Horizontal Ancho W -->
      <line x1="${xFront0.toFixed(1)}" y1="${(yBot0 + 20).toFixed(1)}" x2="${(xFront0 + wFrontPx).toFixed(1)}" y2="${(yBot0 + 20).toFixed(1)}"
            stroke="#0f172a" stroke-width="1.4" marker-start="url(#flecha-cad)" marker-end="url(#flecha-cad)"/>
      <text x="${(xFront0 + wFrontPx / 2).toFixed(1)}" y="${(yBot0 + 34).toFixed(1)}" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="700" font-family="monospace">
        W = ${W} mm (${(W / 10).toFixed(1)} cm)
      </text>

      <!-- Cota Vertical Alto H -->
      <line x1="${(xFront0 - 16).toFixed(1)}" y1="${yTop0.toFixed(1)}" x2="${(xFront0 - 16).toFixed(1)}" y2="${yBot0.toFixed(1)}"
            stroke="#0f172a" stroke-width="1.4" marker-start="url(#flecha-cad)" marker-end="url(#flecha-cad)"/>
      <text x="${(xFront0 - 24).toFixed(1)}" y="${(yTop0 + hPx / 2).toFixed(1)}" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="700" font-family="monospace"
            transform="rotate(-90 ${(xFront0 - 24).toFixed(1)} ${(yTop0 + hPx / 2).toFixed(1)})">
        H = ${H} mm (${(H / 10).toFixed(1)} cm)
      </text>

      <!-- Vista Lateral Derecha D × H -->
      <rect x="${xSide0.toFixed(1)}" y="${yTop0.toFixed(1)}" width="${dSidePx.toFixed(1)}" height="${hPx.toFixed(1)}"
            fill="#ffffff" fill-opacity="0.7" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4,4"/>
      ${svgPiezasSide}

      <!-- Cota Horizontal Profundidad D -->
      <line x1="${xSide0.toFixed(1)}" y1="${(yBot0 + 20).toFixed(1)}" x2="${(xSide0 + dSidePx).toFixed(1)}" y2="${(yBot0 + 20).toFixed(1)}"
            stroke="#0f172a" stroke-width="1.4" marker-start="url(#flecha-cad)" marker-end="url(#flecha-cad)"/>
      <text x="${(xSide0 + dSidePx / 2).toFixed(1)}" y="${(yBot0 + 34).toFixed(1)}" text-anchor="middle" fill="#0f172a" font-size="11" font-weight="700" font-family="monospace">
        D = ${D} mm (${(D / 10).toFixed(1)} cm)
      </text>

      <!-- Leyenda inferior del Croquis Técnico -->
      <g transform="translate(14, ${svgH - 16})" font-family="sans-serif" font-size="10" fill="#1e293b">
        <rect x="0" y="-9" width="12" height="10" fill="url(#patron-vacio-int)" stroke="#0284c7" stroke-width="1"/>
        <text x="16" y="0" font-weight="600">Espacio vacío / Hueco abierto (${nVacios})</text>

        <rect x="210" y="-9" width="12" height="10" fill="#cbd5e1" stroke="#0f172a" stroke-width="1"/>
        <text x="226" y="0" font-weight="600">Tablero melamina 18 mm</text>

        <rect x="375" y="-9" width="12" height="10" fill="#fce7f3" stroke="#be185d" stroke-width="1.2"/>
        <text x="391" y="0" font-weight="600">Frente de Cajón</text>

        <rect x="495" y="-9" width="12" height="10" fill="#fef3c7" stroke="#b45309" stroke-width="1.2"/>
        <text x="511" y="0" font-weight="600">Puerta batiente (línea = bisagra)</text>
      </g>
    </svg>
  `;
}

/**
 * Inicializa la Pizarra Interactiva de Dibujo Esquema a Mano ("Dibujo Esquema -> Croquis 2D -> 3D").
 * Permite trazar líneas/rectángulos de estructura, círculos (pomos de cajón/puerta) y cruces de vacío,
 * convirtiendo el dibujo directamente en imagen analizable y en estructura paramétrica.
 */
export function inicializarPizarraEsquema(canvas, alConvertirEsquema) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  let herramienta = 'linea'; // 'rect' | 'linea' | 'pomo' | 'vacio' | 'lapiz'
  let dibujando = false;
  let pInicio = null;
  let snapshot = null;

  // Historial semántico de trazos para interpretación exacta de esquemas dibujados a mano
  const trazos = [];

  function limpiarPizarra() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Dibujar guía suave de contorno sugerido
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let x = 40; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 40; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    trazos.length = 0;
  }

  function dibujarPlantillaBase() {
    limpiarPizarra();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.strokeRect(70, 35, 260, 210);
    trazos.push({ tipo: 'rect', x0: 70, y0: 35, x1: 330, y1: 245 });
  }

  dibujarPlantillaBase();

  function posRelativa(ev) {
    const r = canvas.getBoundingClientRect();
    const clientX = ev.touches?.[0]?.clientX ?? ev.changedTouches?.[0]?.clientX ?? ev.clientX;
    const clientY = ev.touches?.[0]?.clientY ?? ev.changedTouches?.[0]?.clientY ?? ev.clientY;
    return {
      x: Math.round(((clientX - r.left) / r.width) * canvas.width),
      y: Math.round(((clientY - r.top) / r.height) * canvas.height),
    };
  }

  function iniciarTrazo(ev) {
    ev.preventDefault();
    dibujando = true;
    pInicio = posRelativa(ev);
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (herramienta === 'pomo') {
      ctx.fillStyle = '#be185d';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pInicio.x, pInicio.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      trazos.push({ tipo: 'pomo', x: pInicio.x, y: pInicio.y });
      dibujando = false;
    } else if (herramienta === 'vacio') {
      // Marca un espacio vacío explícito (achurado azul + etiqueta HUECO)
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(pInicio.x - 28, pInicio.y - 16, 56, 32);
      ctx.setLineDash([]);
      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VACÍO', pInicio.x, pInicio.y + 4);
      trazos.push({ tipo: 'vacio', x: pInicio.x, y: pInicio.y });
      dibujando = false;
    } else if (herramienta === 'lapiz') {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pInicio.x, pInicio.y);
    }
  }

  function moverTrazo(ev) {
    if (!dibujando || !pInicio) return;
    ev.preventDefault();
    const p = posRelativa(ev);

    if (herramienta === 'lapiz') {
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      return;
    }

    ctx.putImageData(snapshot, 0, 0);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5;

    if (herramienta === 'rect') {
      ctx.strokeRect(pInicio.x, pInicio.y, p.x - pInicio.x, p.y - pInicio.y);
    } else if (herramienta === 'linea') {
      // Ajustar a horizontal o vertical si el ángulo es cercano (< 18°) para facilitar croquis limpios
      let x2 = p.x;
      let y2 = p.y;
      if (Math.abs(x2 - pInicio.x) > Math.abs(y2 - pInicio.y) * 2.5) y2 = pInicio.y;
      else if (Math.abs(y2 - pInicio.y) > Math.abs(x2 - pInicio.x) * 2.5) x2 = pInicio.x;
      ctx.beginPath();
      ctx.moveTo(pInicio.x, pInicio.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  function terminarTrazo(ev) {
    if (!dibujando || !pInicio) return;
    ev.preventDefault();
    const p = posRelativa(ev);
    dibujando = false;

    if (herramienta === 'rect') {
      const x0 = Math.min(pInicio.x, p.x);
      const y0 = Math.min(pInicio.y, p.y);
      const x1 = Math.max(pInicio.x, p.x);
      const y1 = Math.max(pInicio.y, p.y);
      if (x1 - x0 > 15 && y1 - y0 > 15) {
        trazos.push({ tipo: 'rect', x0, y0, x1, y1 });
      }
    } else if (herramienta === 'linea') {
      let x2 = p.x;
      let y2 = p.y;
      if (Math.abs(x2 - pInicio.x) > Math.abs(y2 - pInicio.y) * 2.5) y2 = pInicio.y;
      else if (Math.abs(y2 - pInicio.y) > Math.abs(x2 - pInicio.x) * 2.5) x2 = pInicio.x;
      if (Math.hypot(x2 - pInicio.x, y2 - pInicio.y) > 15) {
        trazos.push({ tipo: 'linea', x0: pInicio.x, y0: pInicio.y, x1: x2, y1: y2 });
      }
    }
  }

  canvas.addEventListener('mousedown', iniciarTrazo);
  canvas.addEventListener('mousemove', moverTrazo);
  window.addEventListener('mouseup', terminarTrazo);
  canvas.addEventListener('touchstart', iniciarTrazo, { passive: false });
  canvas.addEventListener('touchmove', moverTrazo, { passive: false });
  canvas.addEventListener('touchend', terminarTrazo, { passive: false });

  /**
   * Interpreta geométricamente los trazos de la pizarra (rectángulos, líneas horizontales/verticales,
   * pomos y marcas de vacío) para construir las secciones de abajo hacia arriba.
   */
  function interpretarTrazosEsquema(wMm = 800, hMm = 1200, dMm = 400) {
    const rects = trazos.filter((t) => t.tipo === 'rect');
    const box = rects.length
      ? {
          x0: Math.min(...rects.map((r) => r.x0)),
          y0: Math.min(...rects.map((r) => r.y0)),
          x1: Math.max(...rects.map((r) => r.x1)),
          y1: Math.max(...rects.map((r) => r.y1)),
        }
      : { x0: 60, y0: 30, x1: 340, y1: 250 };

    const altoBox = Math.max(40, box.y1 - box.y0);
    const anchoBox = Math.max(40, box.x1 - box.x0);

    // Extraer líneas horizontales internas (repisas / separadores de nivel)
    const ysInternas = [box.y0, box.y1];
    for (const t of trazos) {
      if (t.tipo === 'linea' && Math.abs(t.y1 - t.y0) <= 14) {
        const ym = Math.round((t.y0 + t.y1) / 2);
        if (ym > box.y0 + 16 && ym < box.y1 - 16) {
          if (!ysInternas.some((yExist) => Math.abs(yExist - ym) < 16)) {
            ysInternas.push(ym);
          }
        }
      }
    }
    ysInternas.sort((a, b) => a - b);

    // Construir niveles de abajo hacia arriba (en pantalla Y crece hacia abajo, por eso invertimos)
    const nivelesPantalla = [];
    for (let i = 0; i < ysInternas.length - 1; i++) {
      const ySup = ysInternas[i];
      const yInf = ysInternas[i + 1];
      const hFrac = Math.max(0.3, Number(((yInf - ySup) / (altoBox / Math.max(1, ysInternas.length - 1))).toFixed(2)));

      // Contar divisiones verticales que cruzan este nivel
      const xsDiv = [];
      for (const t of trazos) {
        if (t.tipo === 'linea' && Math.abs(t.x1 - t.x0) <= 14) {
          const xm = (t.x0 + t.x1) / 2;
          const yMinL = Math.min(t.y0, t.y1);
          const yMaxL = Math.max(t.y0, t.y1);
          const solapaY = Math.min(yInf, yMaxL) - Math.max(ySup, yMinL);
          if (xm > box.x0 + 18 && xm < box.x1 - 18 && solapaY > (yInf - ySup) * 0.45) {
            if (!xsDiv.some((xE) => Math.abs(xE - xm) < 18)) xsDiv.push(xm);
          }
        }
      }
      const columnas = Math.max(1, Math.min(4, xsDiv.length + 1));

      // Verificar si hay pomos/tiradores o marcas de vacío dentro de este nivel
      const pomosNivel = trazos.filter((t) => t.tipo === 'pomo' && t.y >= ySup && t.y <= yInf);
      const vaciosNivel = trazos.filter((t) => t.tipo === 'vacio' && t.y >= ySup && t.y <= yInf);

      let tipoSeccion = 'hueco';
      if (pomosNivel.length > 0 && vaciosNivel.length > 0) {
        tipoSeccion = 'mixto_hueco_puertas';
      } else if (pomosNivel.length > 0) {
        const relacionCelda = (anchoBox / columnas) / Math.max(1, yInf - ySup);
        tipoSeccion = relacionCelda >= 1.15 ? 'cajon' : 'puertas';
      }

      nivelesPantalla.push({
        ubicacionVertical: i === 0 ? 'superior' : i === ysInternas.length - 2 ? 'inferior' : 'intermedio',
        tipoSeccion,
        columnas,
        filasApiladas: 1,
        proporcionAlto: hFrac,
      });
    }

    const secciones = nivelesPantalla.reverse();
    const nHuecos = secciones.filter((s) => s.tipoSeccion === 'hueco').length;

    return {
      categoriaMueble: 'estante_librero',
      subtipo: 'estandar',
      nombreMueble: `Esquema dibujado a mano (${secciones.length} niveles · ${nHuecos} nivel(es) abiertos)`,
      tieneMedidasEscritas: false,
      textoMedidasLeidas: '',
      anchoDetectadoMm: wMm,
      altoDetectadoMm: hMm,
      profundidadDetectadaMm: dMm,
      alturaPatasMm: 0,
      tieneFondo: true,
      secciones,
      relacionAnchoAlto: Number((anchoBox / altoBox).toFixed(2)),
      descripcion: `Esquema lineal convertido automáticamente a Croquis Técnico 2D (${secciones.length} niveles verticales detectados, ${nHuecos} con espacios vacíos abiertos) y pasado a Modelo 3D.`,
      fuente: '✏️ Esquema a Mano → Croquis 2D → 3D',
    };
  }

  return {
    setHerramienta: (h) => {
      herramienta = h;
    },
    limpiar: limpiarPizarra,
    plantillaBase: dibujarPlantillaBase,
    convertir: (wMm, hMm, dMm) => {
      const resultado = interpretarTrazosEsquema(wMm, hMm, dMm);
      const dataUrl = canvas.toDataURL('image/png');
      if (alConvertirEsquema) alConvertirEsquema(resultado, dataUrl);
      return resultado;
    },
  };
}
