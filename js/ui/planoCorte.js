/**
 * Dibujante SVG del plano de corte 2D para cada plancha de 2440 × 1220 mm.
 */
import { mapaColoresPorFila } from './colores.js';

export function renderizarPlanosCorte(contenedor, corte, filas) {
  const colores = mapaColoresPorFila(filas);
  const { L, A, planchas } = corte;

  if (!planchas.length) {
    contenedor.innerHTML = '<p class="texto-suave">No hay piezas de melamina para cortar.</p>';
    return;
  }

  const bloques = planchas.map((plancha) => {
    const porc = ((plancha.areaUsada / (L * A)) * 100).toFixed(1);
    const pad = 38;
    const vw = L + pad * 2;
    const vh = A + pad * 2;

    const rects = plancha.piezas.map((p) => {
      const color = colores.get(p.id) || '#38bdf8';
      const x = pad + p.x;
      const y = pad + p.y;
      const mostrarTexto = p.w >= 110 && p.h >= 70;
      const mostrarDims = p.w >= 170 && p.h >= 120;
      const cx = x + p.w / 2;
      const cy = y + p.h / 2;
      const etiquetaRot = p.rotada ? ' ↻' : '';
      return `
        <g class="pieza-corte">
          <rect x="${x}" y="${y}" width="${p.w}" height="${p.h}"
                fill="${color}" fill-opacity="0.28" stroke="${color}" stroke-width="4" rx="4"/>
          ${mostrarTexto ? `<text x="${cx}" y="${mostrarDims ? cy - 16 : cy + 12}" text-anchor="middle" fill="#f8fafc" font-size="38" font-weight="bold" font-family="system-ui, sans-serif">${p.id}${etiquetaRot}</text>` : ''}
          ${mostrarDims ? `<text x="${cx}" y="${cy + 30}" text-anchor="middle" fill="#cbd5e1" font-size="28" font-family="system-ui, sans-serif">${p.w}×${p.h}</text>` : ''}
        </g>`;
    }).join('');

    return `
      <div class="tarjeta-plancha">
        <div class="cabecera-plancha">
          <strong>Plancha #${plancha.indice} (${L} × ${A} mm)</strong>
          <span class="chip">${plancha.piezas.length} piezas · ${porc}% ocupado</span>
        </div>
        <svg viewBox="0 0 ${vw} ${vh}" class="svg-plancha" role="img" aria-label="Plano de corte de la plancha ${plancha.indice}">
          <defs>
            <pattern id="achurado-${plancha.indice}" width="40" height="40" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="40" stroke="#334155" stroke-width="6"/>
            </pattern>
          </defs>
          <!-- Fondo de sobrante achurado -->
          <rect x="${pad}" y="${pad}" width="${L}" height="${A}" fill="url(#achurado-${plancha.indice})" stroke="#64748b" stroke-width="5"/>
          <rect x="${pad}" y="${pad}" width="${L}" height="${A}" fill="#0f172a" fill-opacity="0.65" stroke="#64748b" stroke-width="5"/>
          ${rects}
          <!-- Cotas exteriores -->
          <text x="${pad + L / 2}" y="${pad - 12}" text-anchor="middle" fill="#94a3b8" font-size="28" font-family="system-ui, sans-serif">${L} mm</text>
          <text x="${pad - 12}" y="${pad + A / 2}" text-anchor="middle" fill="#94a3b8" font-size="28" font-family="system-ui, sans-serif" transform="rotate(-90, ${pad - 12}, ${pad + A / 2})">${A} mm</text>
        </svg>
      </div>`;
  });

  contenedor.innerHTML = bloques.join('');
}
