/**
 * Paleta de colores compartida entre el visor 3D, la tabla de despiece y los
 * planos de corte 2D.
 */
export const PALETA_PIEZAS = Object.freeze([
  '#38bdf8', // A - celeste
  '#34d399', // B - verde esmeralda
  '#fbbf24', // C - ámbar
  '#a78bfa', // D - violeta
  '#f472b6', // E - rosa
  '#fb923c', // F - naranja
  '#2dd4bf', // G - turquesa
  '#818cf8', // H - índigo
]);

export function colorPorIndice(i) {
  return PALETA_PIEZAS[i % PALETA_PIEZAS.length];
}

export function mapaColoresPorFila(filas) {
  const mapa = new Map();
  filas.forEach((f, i) => {
    mapa.set(f.id, f.grupo === 'fondo' ? '#64748b' : colorPorIndice(i));
  });
  return mapa;
}
