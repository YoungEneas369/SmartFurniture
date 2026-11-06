/**
 * Optimización de corte 2D (Cutting Stock / Bin Packing bidimensional).
 *
 * Objetivo: usar el menor número de planchas posible.
 * Restricción: las piezas no se superponen, caben en la plancha y se respeta
 * el ancho de la sierra (kerf).
 *
 * Encontrar la solución óptima es un problema NP-difícil, por eso se usa una
 * heurística de cortes en guillotina (los cortes van de lado a lado, igual que
 * en una dimensionadora). Se prueban varias combinaciones de orden y criterio
 * y se elige la que use menos planchas. El resultado es bueno, pero no se
 * garantiza que sea el óptimo.
 */
import { PLANCHA, KERF } from './constantes.js';

const ORDENES = {
  area: (a, b) => b.largo * b.ancho - a.largo * a.ancho,
  ladoMayor: (a, b) => Math.max(b.largo, b.ancho) - Math.max(a.largo, a.ancho),
  perimetro: (a, b) => b.largo + b.ancho - (a.largo + a.ancho),
};

const CRITERIOS = {
  // Elige el espacio libre que deja menos área sobrante.
  mejorArea: (libre, w, h) => libre.w * libre.h - w * h,
  // Elige el espacio libre donde la pieza calza más justo por su lado corto.
  ladoCorto: (libre, w, h) => Math.min(libre.w - w, libre.h - h),
};

function empaquetar(piezas, { L, A, kerf, rotar, orden, criterio }) {
  const lista = [...piezas].sort(ORDENES[orden]);
  const planchas = [];
  const noCaben = [];
  const puntaje = CRITERIOS[criterio];

  const nuevaPlancha = () => {
    // Se agrega un kerf a la plancha y a cada pieza: así entre piezas queda
    // exactamente un kerf y la última pieza puede llegar al borde.
    const p = { piezas: [], libres: [{ x: 0, y: 0, w: L + kerf, h: A + kerf }] };
    planchas.push(p);
    return p;
  };

  const buscar = (w, h) => {
    let mejor = null;
    planchas.forEach((plancha, ip) => {
      plancha.libres.forEach((libre, il) => {
        const opciones = [[w, h, false]];
        if (rotar && w !== h) opciones.push([h, w, true]);
        for (const [pw, ph, rotada] of opciones) {
          if (pw + kerf <= libre.w && ph + kerf <= libre.h) {
            const valor = puntaje(libre, pw + kerf, ph + kerf);
            if (!mejor || valor < mejor.valor) mejor = { ip, il, pw, ph, rotada, valor };
          }
        }
      });
    });
    return mejor;
  };

  for (const pieza of lista) {
    const cabeEnBlanco = (pieza.largo <= L && pieza.ancho <= A) || (rotar && pieza.ancho <= L && pieza.largo <= A);
    if (!cabeEnBlanco) {
      noCaben.push(pieza);
      continue;
    }
    let pos = buscar(pieza.largo, pieza.ancho);
    if (!pos) {
      nuevaPlancha();
      pos = buscar(pieza.largo, pieza.ancho);
    }
    const plancha = planchas[pos.ip];
    const libre = plancha.libres[pos.il];
    plancha.piezas.push({ ...pieza, x: libre.x, y: libre.y, w: pos.pw, h: pos.ph, rotada: pos.rotada });

    // Corte en guillotina: el espacio sobrante se divide en dos rectángulos.
    const wk = pos.pw + kerf;
    const hk = pos.ph + kerf;
    const sobraW = libre.w - wk;
    const sobraH = libre.h - hk;
    const cortarHorizontal = sobraW <= sobraH; // regla del eje sobrante más corto
    const derecha = { x: libre.x + wk, y: libre.y, w: sobraW, h: cortarHorizontal ? hk : libre.h };
    const abajo = { x: libre.x, y: libre.y + hk, w: cortarHorizontal ? libre.w : wk, h: sobraH };
    plancha.libres.splice(pos.il, 1);
    if (derecha.w > kerf && derecha.h > kerf) plancha.libres.push(derecha);
    if (abajo.w > kerf && abajo.h > kerf) plancha.libres.push(abajo);
  }

  return {
    planchas: planchas.map((p, i) => ({
      indice: i + 1,
      piezas: p.piezas,
      areaUsada: p.piezas.reduce((a, q) => a + q.w * q.h, 0),
    })),
    noCaben,
  };
}

/**
 * @param {{id:string, nombre:string, largo:number, ancho:number}[]} piezas
 * @returns {{planchas: object[], noCaben: object[], heuristica: string, L: number, A: number, kerf: number}}
 */
export function optimizarCorte(piezas, { L = PLANCHA.largo, A = PLANCHA.ancho, kerf = KERF, rotar = true } = {}) {
  let mejor = null;
  for (const orden of Object.keys(ORDENES)) {
    for (const criterio of Object.keys(CRITERIOS)) {
      const r = empaquetar(piezas, { L, A, kerf, rotar, orden, criterio });
      const n = r.planchas.length;
      // Desempate: preferir la que deja la última plancha más vacía
      // (el sobrante queda concentrado y es más reutilizable).
      const ultima = n ? r.planchas[n - 1].areaUsada : 0;
      if (!mejor || n < mejor.n || (n === mejor.n && ultima < mejor.ultima)) {
        mejor = { n, ultima, r, heuristica: `${orden} + ${criterio}` };
      }
    }
  }
  return { ...mejor.r, heuristica: mejor.heuristica, L, A, kerf };
}
