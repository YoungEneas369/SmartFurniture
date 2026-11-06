/**
 * Matriz de despiece.
 *
 * Agrupa las piezas iguales en una fila de la matriz M:
 *   M = [ cantidad  largo  ancho  espesor ]   (una fila por tipo de pieza)
 */
import { MATERIAL } from './constantes.js';

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const etiqueta = (i) => (i < 26 ? LETRAS[i] : LETRAS[Math.floor(i / 26) - 1] + LETRAS[i % 26]);

function clave(p) {
  return [p.nombre, p.largo, p.ancho, p.espesor, p.material, p.tapacanto.largo, p.tapacanto.ancho].join('|');
}

/**
 * @returns {{ filas: object[], piezas: object[], M: number[][] }}
 *   filas: una por tipo de pieza (con id A, B, C...)
 *   piezas: las mismas piezas de entrada, cada una con su `idFila`
 *   M: la matriz numérica [cantidad, largo, ancho, espesor]
 */
export function matrizDespiece(piezas) {
  const porClave = new Map();
  const filas = [];
  const conId = piezas.map((p) => {
    const k = clave(p);
    let fila = porClave.get(k);
    if (!fila) {
      fila = {
        id: etiqueta(filas.length),
        nombre: p.nombre,
        grupo: p.grupo,
        cant: 0,
        largo: p.largo,
        ancho: p.ancho,
        espesor: p.espesor,
        material: p.material,
        tapacanto: p.tapacanto,
      };
      porClave.set(k, fila);
      filas.push(fila);
    }
    fila.cant += 1;
    return { ...p, idFila: fila.id };
  });
  const M = filas.map((f) => [f.cant, f.largo, f.ancho, f.espesor]);
  return { filas, piezas: conId, M };
}

/** Expande las filas de melamina a una lista de rectángulos para el corte. */
export function piezasParaCorte(filas) {
  const lista = [];
  for (const f of filas) {
    if (f.material !== MATERIAL.MELAMINA) continue;
    for (let i = 0; i < f.cant; i++) lista.push({ id: f.id, nombre: f.nombre, largo: f.largo, ancho: f.ancho });
  }
  return lista;
}
