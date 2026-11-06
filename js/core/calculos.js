/**
 * Sumatorias del proyecto.
 *
 *   Área útil        = Σ cantᵢ · largoᵢ · anchoᵢ           (solo melamina)
 *   Tapacanto        = Σ cantᵢ · (nLᵢ · largoᵢ + nAᵢ · anchoᵢ)
 *                      nL, nA = n° de bordes visibles de cada medida
 *   Cota inferior    = ⌈ Área útil / Área plancha ⌉
 *   % aprovechamiento = Área útil / (N · Área plancha) · 100
 *   % desperdicio     = 100 − % aprovechamiento
 */
import { PLANCHA, MATERIAL } from './constantes.js';

export function areaUtil(filas, material = MATERIAL.MELAMINA) {
  return filas
    .filter((f) => f.material === material)
    .reduce((suma, f) => suma + f.cant * f.largo * f.ancho, 0);
}

export function tapacantoPorFila(f) {
  return f.cant * (f.tapacanto.largo * f.largo + f.tapacanto.ancho * f.ancho);
}

export function tapacantoTotal(filas) {
  return filas.reduce((suma, f) => suma + tapacantoPorFila(f), 0);
}

export function cotaInferiorPlanchas(area, plancha = PLANCHA) {
  return Math.ceil(area / (plancha.largo * plancha.ancho));
}

export function resumen(filas, numPlanchas, plancha = PLANCHA) {
  const areaPlancha = plancha.largo * plancha.ancho;
  const util = areaUtil(filas);
  const aprovechamiento = numPlanchas ? (util / (numPlanchas * areaPlancha)) * 100 : 0;
  return {
    areaPlancha,
    areaUtil: util,
    areaFondo: areaUtil(filas, MATERIAL.FONDO),
    tapacanto: tapacantoTotal(filas),
    cotaInferior: cotaInferiorPlanchas(util, plancha),
    planchas: numPlanchas,
    aprovechamiento,
    desperdicio: numPlanchas ? 100 - aprovechamiento : 0,
  };
}
