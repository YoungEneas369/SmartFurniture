/**
 * Optimización de corte 2D (Cutting Stock / Bin Packing bidimensional).
 *
 * Inspirado en los algoritmos de referencia open-source en GitHub:
 *   - Jukka Jylänki, "A Thousand Ways to Pack the Bin" (GuillotineBinPack:
 *     criterios BAF, BSSF, BLSF + reglas de partición SAS, LAS, SLAS, LLAS, MAXAS
 *     + desfragmentación por fusión de rectángulos libres adyacentes).
 *   - OpenCutList (respeto estricto de cortes de guillotina de lado a lado y
 *     espesor de sierra / kerf = 3 mm).
 */
import { PLANCHA, KERF } from './constantes.js';

const ORDENES = {
  area: (a, b) => b.largo * b.ancho - a.largo * a.ancho,
  ladoMayor: (a, b) => Math.max(b.largo, b.ancho) - Math.max(a.largo, a.ancho),
  perimetro: (a, b) => b.largo + b.ancho - (a.largo + a.ancho),
  ladoMenor: (a, b) => Math.min(b.largo, b.ancho) - Math.min(a.largo, a.ancho),
};

const CRITERIOS = {
  // BAF (Best Area Fit): elige el espacio libre que deja menos área sobrante.
  mejorArea: (libre, w, h) => libre.w * libre.h - w * h,
  // BSSF (Best Short Side Fit): calza más justo por el lado corto sobrante.
  ladoCorto: (libre, w, h) => Math.min(libre.w - w, libre.h - h),
  // BLSF (Best Long Side Fit): calza más justo por el lado largo sobrante.
  ladoLargo: (libre, w, h) => Math.max(libre.w - w, libre.h - h),
};

/**
 * Reglas de partición en guillotina (Jylänki):
 * Devuelven `true` si el corte principal se hace horizontal (creando un rectángulo
 * abajo de ancho completo `libre.w`) o `false` si se hace vertical (creando un
 * rectángulo a la derecha de alto completo `libre.h`).
 */
const REGLAS_DIVISION = {
  // SLAS: Shorter Leftover Axis Split
  ejeSobranteCorto: (libre, wk, hk, sobraW, sobraH) => sobraW <= sobraH,
  // LLAS: Longer Leftover Axis Split
  ejeSobranteLargo: (libre, wk, hk, sobraW, sobraH) => sobraW > sobraH,
  // SAS: Shorter Axis Split
  ejeCorto: (libre) => libre.w <= libre.h,
  // MAXAS: Maximizar el rectángulo sobrante continuo más grande
  maxAreaContinua: (libre, wk, hk, sobraW, sobraH) => {
    const maxHoriz = Math.max(sobraW * hk, libre.w * sobraH);
    const maxVert = Math.max(sobraW * libre.h, wk * sobraH);
    return maxHoriz >= maxVert;
  },
};

/**
 * Fusiona rectángulos libres colineales y adyacentes en la misma plancha
 * (Guillotine Free Rectangle Merge) para recuperar espacio fragmentado.
 */
function fusionarRectangulosLibres(libres) {
  let huboFusion = true;
  while (huboFusion) {
    huboFusion = false;
    for (let i = 0; i < libres.length && !huboFusion; i++) {
      for (let j = i + 1; j < libres.length; j++) {
        const a = libres[i];
        const b = libres[j];
        if (a.x === b.x && a.w === b.w) {
          if (a.y + a.h === b.y) {
            a.h += b.h;
            libres.splice(j, 1);
            huboFusion = true;
            break;
          }
          if (b.y + b.h === a.y) {
            a.y = b.y;
            a.h += b.h;
            libres.splice(j, 1);
            huboFusion = true;
            break;
          }
        } else if (a.y === b.y && a.h === b.h) {
          if (a.x + a.w === b.x) {
            a.w += b.w;
            libres.splice(j, 1);
            huboFusion = true;
            break;
          }
          if (b.x + b.w === a.x) {
            a.x = b.x;
            a.w += b.w;
            libres.splice(j, 1);
            huboFusion = true;
            break;
          }
        }
      }
    }
  }
}

function empaquetar(piezas, { L, A, kerf, rotar, orden, criterio, division }) {
  const lista = [...piezas].sort(ORDENES[orden]);
  const planchas = [];
  const noCaben = [];
  const puntaje = CRITERIOS[criterio];
  const reglaCortarHorizontal = REGLAS_DIVISION[division];

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
    const cortarHorizontal = reglaCortarHorizontal(libre, wk, hk, sobraW, sobraH);
    const derecha = { x: libre.x + wk, y: libre.y, w: sobraW, h: cortarHorizontal ? hk : libre.h };
    const abajo = { x: libre.x, y: libre.y + hk, w: cortarHorizontal ? libre.w : wk, h: sobraH };
    plancha.libres.splice(pos.il, 1);
    if (derecha.w > kerf && derecha.h > kerf) plancha.libres.push(derecha);
    if (abajo.w > kerf && abajo.h > kerf) plancha.libres.push(abajo);
    fusionarRectangulosLibres(plancha.libres);
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
      for (const division of Object.keys(REGLAS_DIVISION)) {
        const r = empaquetar(piezas, { L, A, kerf, rotar, orden, criterio, division });
        const n = r.planchas.length;
        // Desempate: preferir menor número de planchas y, a igual número de planchas,
        // la que deja la última plancha con más área libre continua reutilizable.
        const ultima = n ? r.planchas[n - 1].areaUsada : 0;
        if (!mejor || n < mejor.n || (n === mejor.n && ultima < mejor.ultima)) {
          mejor = { n, ultima, r, heuristica: `${orden} + ${criterio} + ${division}` };
        }
      }
    }
  }
  return { ...mejor.r, heuristica: mejor.heuristica, L, A, kerf };
}
