/**
 * Plantillas paramétricas y motor modular multi-topología.
 *
 * Además de las plantillas clásicas (librero, mueble_puertas, cajonera), incluye
 * el constructor 'modular', capaz de armar cualquier mueble reconocido en fotos o croquis:
 *   - Cajoneras, veladores, cómodas y armarios
 *   - Estantes mixtos (repisas abiertas abajo + 3 cajones/puertas arriba en fila)
 *   - Vanitorios de baño con cajón superior, espacio abierto, repisa inferior y patas
 *   - Escritorios con cajones superiores y amplio espacio inferior para piernas
 *   - Mesas de 4 patas con cubierta y faldón perimetral (subtipo: 'mesa')
 *   - Arrimos/credenzas asimétricas con hueco lateral y puertas (tipoSeccion: 'mixto_hueco_puertas')
 *   - Estantes de pared con 2 torres laterales y puente central (subtipo: 'puente_laterales')
 *   - Repisas flotantes geométricas entrelazadas (subtipo: 'flotante_entrelazada')
 *   - Góndolas exhibidoras con bandejas laterales y columna central (subtipo: 'gondola')
 *   - Libreros con divisiones verticales alternadas / zig-zag (subtipo: 'intercalado')
 */
import {
  ESPESOR as e,
  ESPESOR_FONDO as tf,
  HOLGURA as g,
  SEPARACION as s,
  CORREDERA,
  LUZ_MAX_REPISA,
  LIMITES,
  MATERIAL,
} from './constantes.js';
import { normalizarProporciones, escalarProporciones } from './escala.js';

const mm = (v) => Math.floor(v + 1e-9);

function pieza({ nombre, grupo, largo, ancho, espesor = e, material = MATERIAL.MELAMINA,
  tapacanto = { largo: 0, ancho: 0 }, pos, tam }) {
  return { nombre, grupo, largo: mm(largo), ancho: mm(ancho), espesor, material, tapacanto, pos, tam };
}

export function validarMedidas({ ancho, alto, profundidad }) {
  const errores = [];
  const revisar = (valor, [min, max], etiqueta) => {
    if (!Number.isFinite(valor)) errores.push(`${etiqueta}: ingresa un número.`);
    else if (valor < min || valor > max) errores.push(`${etiqueta}: debe estar entre ${min} y ${max} mm.`);
  };
  revisar(ancho, LIMITES.ancho, 'Ancho');
  revisar(alto, LIMITES.alto, 'Alto');
  revisar(profundidad, LIMITES.profundidad, 'Profundidad');
  return errores;
}

function enteroEnRango(valor, min, max, etiqueta) {
  if (!Number.isInteger(valor) || valor < min || valor > max) {
    throw new Error(`${etiqueta}: debe ser un número entero entre ${min} y ${max}.`);
  }
}

function carcasa(W, H, p, z0, yBase = 0) {
  const interior = W - 2 * e;
  return [
    pieza({ nombre: 'Lateral', grupo: 'estructura', largo: H, ancho: p,
      tapacanto: { largo: 1, ancho: 0 }, pos: [0, 0, z0], tam: [e, H, p] }),
    pieza({ nombre: 'Lateral', grupo: 'estructura', largo: H, ancho: p,
      tapacanto: { largo: 1, ancho: 0 }, pos: [W - e, 0, z0], tam: [e, H, p] }),
    pieza({ nombre: 'Base', grupo: 'estructura', largo: interior, ancho: p,
      tapacanto: { largo: 1, ancho: 0 }, pos: [e, yBase, z0], tam: [interior, e, p] }),
    pieza({ nombre: 'Techo', grupo: 'estructura', largo: interior, ancho: p,
      tapacanto: { largo: 1, ancho: 0 }, pos: [e, H - e, z0], tam: [interior, e, p] }),
  ];
}

function repisas(W, H, p, z0, n, proporciones) {
  const hLibre = H - (n + 2) * e;
  if (hLibre <= 0) throw new Error('No caben tantas repisas en esa altura.');
  const fracciones = normalizarProporciones(proporciones, n + 1);
  const espacios = escalarProporciones(fracciones, hLibre);
  const interior = W - 2 * e;
  const lista = [];
  let y = e;
  for (let j = 0; j < n; j++) {
    y += espacios[j];
    lista.push(pieza({ nombre: 'Repisa', grupo: 'repisa', largo: interior, ancho: p,
      tapacanto: { largo: 1, ancho: 0 }, pos: [e, y, z0], tam: [interior, e, p] }));
    y += e;
  }
  return { lista, espacios, hLibre, fracciones };
}

function fondo(W, H, yBase = 0) {
  const altoF = H - yBase;
  return pieza({ nombre: 'Fondo', grupo: 'fondo', largo: altoF, ancho: W, espesor: tf,
    material: MATERIAL.FONDO, pos: [0, yBase, 0], tam: [W, altoF, tf] });
}

function advertenciasRepisas(W, espacios, maxColumnas = 1) {
  const avisos = [];
  const luzEfectiva = (W - 2 * e) / Math.max(1, maxColumnas);
  if (luzEfectiva > LUZ_MAX_REPISA) {
    avisos.push(`Las repisas tienen una luz libre de ${Math.round(luzEfectiva)} mm (> ${LUZ_MAX_REPISA} mm) y pueden curvarse.`);
  }
  if (espacios.some((h) => h < 120)) {
    avisos.push('Hay niveles con menos de 120 mm de alto libre.');
  }
  return avisos;
}

/* ---------------- Plantillas clásicas ---------------- */

function librero({ ancho: W, alto: H, profundidad: D, repisas: n = 3, proporciones }) {
  enteroEnRango(n, 0, 15, 'Repisas');
  const p = D - tf;
  const r = repisas(W, H, p, tf, n, proporciones);
  return {
    piezas: [...carcasa(W, H, p, tf), ...r.lista, fondo(W, H)],
    detalle: { p, hLibre: r.hLibre, espacios: r.espacios, fracciones: r.fracciones },
    advertencias: advertenciasRepisas(W, r.espacios),
    supuestos: [
      `Fondo de ${tf} mm clavado atrás: las piezas de melamina tienen ${p} mm de profundidad (D − ${tf}).`,
      'Base y techo van entre los laterales (largo = W − 2e).',
      'Tapacanto solo en el borde frontal visible de cada pieza.',
    ],
  };
}

function mueblePuertas({ ancho: W, alto: H, profundidad: D, repisas: n = 1, puertas: np = 2, proporciones }) {
  enteroEnRango(n, 0, 10, 'Repisas');
  enteroEnRango(np, 1, 4, 'Puertas');
  const p = D - tf - e;
  if (p < 100) throw new Error('La profundidad es muy pequeña para un mueble con puertas.');
  const r = repisas(W, H, p, tf, n, proporciones);

  const altoP = H - 2 * g;
  const anchoP = (W - 2 * g - s * (np - 1)) / np;
  const puertas = Array.from({ length: np }, (_, k) => pieza({
    nombre: 'Puerta', grupo: 'puerta', largo: altoP, ancho: anchoP,
    tapacanto: { largo: 2, ancho: 2 },
    pos: [g + k * (mm(anchoP) + s), g, tf + p], tam: [mm(anchoP), mm(altoP), e],
  }));

  const avisos = advertenciasRepisas(W, r.espacios);
  if (anchoP > 600) avisos.push('Cada puerta mide más de 600 mm de ancho: considera agregar otra puerta.');
  return {
    piezas: [...carcasa(W, H, p, tf), ...r.lista, ...puertas, fondo(W, H)],
    detalle: { p, hLibre: r.hLibre, espacios: r.espacios, fracciones: r.fracciones, altoP, anchoP, np },
    advertencias: avisos,
    supuestos: [
      `Puertas sobrepuestas de ${e} mm: el cuerpo tiene ${p} mm de profundidad (D − ${tf} − ${e}).`,
      `Holgura de ${g} mm en el borde exterior y ${s} mm entre puertas.`,
      'Las puertas llevan tapacanto en sus 4 bordes; el cuerpo solo al frente.',
    ],
  };
}

function cajonera({ ancho: W, alto: H, profundidad: D, cajones: k = 3, proporciones }) {
  enteroEnRango(k, 1, 8, 'Cajones');
  const p = D - tf - e;
  const largoCaja = Math.min(600, Math.floor((p - 10) / 50) * 50);
  if (largoCaja < 250) throw new Error('La profundidad es muy pequeña para correderas de cajón (mínimo 250 mm).');

  const altoTotal = H - 2 * g - s * (k - 1);
  const fracciones = normalizarProporciones(proporciones, k);
  const altos = escalarProporciones(fracciones, altoTotal).map(mm);
  if (altos.some((a) => a < 100)) throw new Error('Algún frente de cajón queda bajo 100 mm: usa menos cajones.');
  const anchoFrente = W - 2 * g;
  const anchoCaja = W - 2 * e - 2 * CORREDERA;

  const piezas = [...carcasa(W, H, p, tf)];
  let y = g;
  altos.forEach((alto) => {
    piezas.push(pieza({ nombre: 'Frente de cajón', grupo: 'frente', largo: anchoFrente, ancho: alto,
      tapacanto: { largo: 2, ancho: 2 }, pos: [g, y, tf + p], tam: [anchoFrente, alto, e] }));
    const hc = Math.max(60, alto - 40);
    const yc = y + 20;
    const zc = tf + p - largoCaja;
    const x0 = e + CORREDERA;
    piezas.push(
      pieza({ nombre: 'Costado de cajón', grupo: 'cajon', largo: largoCaja, ancho: hc,
        tapacanto: { largo: 1, ancho: 0 }, pos: [x0, yc, zc], tam: [e, hc, largoCaja] }),
      pieza({ nombre: 'Costado de cajón', grupo: 'cajon', largo: largoCaja, ancho: hc,
        tapacanto: { largo: 1, ancho: 0 }, pos: [x0 + anchoCaja - e, yc, zc], tam: [e, hc, largoCaja] }),
      pieza({ nombre: 'Frente/trasera de cajón', grupo: 'cajon', largo: anchoCaja - 2 * e, ancho: hc,
        tapacanto: { largo: 1, ancho: 0 }, pos: [x0 + e, yc, zc + largoCaja - e], tam: [anchoCaja - 2 * e, hc, e] }),
      pieza({ nombre: 'Frente/trasera de cajón', grupo: 'cajon', largo: anchoCaja - 2 * e, ancho: hc,
        tapacanto: { largo: 1, ancho: 0 }, pos: [x0 + e, yc, zc], tam: [anchoCaja - 2 * e, hc, e] }),
      pieza({ nombre: 'Fondo de cajón', grupo: 'fondo', largo: largoCaja, ancho: anchoCaja, espesor: tf,
        material: MATERIAL.FONDO, pos: [x0, yc - tf, zc], tam: [anchoCaja, tf, largoCaja] }),
    );
    y += alto + s;
  });
  piezas.push(fondo(W, H));

  const avisos = [];
  if (anchoFrente > 1000) avisos.push('Cajones de más de 1 m de ancho son poco firmes: considera dos columnas.');
  return {
    piezas,
    detalle: { p, largoCaja, altoTotal, altos, fracciones, anchoCaja, anchoFrente },
    advertencias: avisos,
    supuestos: [
      `Correderas telescópicas de ${largoCaja} mm, ${CORREDERA} mm por lado.`,
      'Caja de cajón 40 mm más baja que su frente.',
      `Frentes sobrepuestos con holgura de ${g} mm y ${s} mm entre ellos.`,
    ],
  };
}

/* ---------------- Subtipos Especiales dentro de Modular ---------------- */

function construirMesa({ W, H, D }) {
  const hPata = H - e;
  const wPata = Math.min(90, Math.max(45, mm(W * 0.065)));
  const hFaldon = Math.min(120, Math.max(55, mm(H * 0.13)));
  const yFaldon = H - e - hFaldon;
  const largoFaldon = W - 2 * wPata;
  const anchoFaldonLat = D - 2 * e;

  const piezas = [
    pieza({ nombre: 'Cubierta superior', grupo: 'estructura', largo: W, ancho: D,
      tapacanto: { largo: 2, ancho: 2 }, pos: [0, H - e, 0], tam: [W, e, D] }),
    // 4 patas en las esquinas
    pieza({ nombre: 'Pata vertical', grupo: 'estructura', largo: hPata, ancho: wPata,
      tapacanto: { largo: 2, ancho: 0 }, pos: [0, 0, D - e], tam: [wPata, hPata, e] }),
    pieza({ nombre: 'Pata vertical', grupo: 'estructura', largo: hPata, ancho: wPata,
      tapacanto: { largo: 2, ancho: 0 }, pos: [W - wPata, 0, D - e], tam: [wPata, hPata, e] }),
    pieza({ nombre: 'Pata vertical', grupo: 'estructura', largo: hPata, ancho: wPata,
      tapacanto: { largo: 2, ancho: 0 }, pos: [0, 0, 0], tam: [wPata, hPata, e] }),
    pieza({ nombre: 'Pata vertical', grupo: 'estructura', largo: hPata, ancho: wPata,
      tapacanto: { largo: 2, ancho: 0 }, pos: [W - wPata, 0, 0], tam: [wPata, hPata, e] }),
    // 2 faldones longitudinales (frente y atrás)
    pieza({ nombre: 'Faldón longitudinal', grupo: 'repisa', largo: largoFaldon, ancho: hFaldon,
      tapacanto: { largo: 1, ancho: 0 }, pos: [wPata, yFaldon, D - e], tam: [largoFaldon, hFaldon, e] }),
    pieza({ nombre: 'Faldón longitudinal', grupo: 'repisa', largo: largoFaldon, ancho: hFaldon,
      tapacanto: { largo: 1, ancho: 0 }, pos: [wPata, yFaldon, 0], tam: [largoFaldon, hFaldon, e] }),
    // 2 faldones transversales (costados)
    pieza({ nombre: 'Faldón transversal', grupo: 'repisa', largo: anchoFaldonLat, ancho: hFaldon,
      tapacanto: { largo: 1, ancho: 0 }, pos: [0, yFaldon, e], tam: [e, hFaldon, anchoFaldonLat] }),
    pieza({ nombre: 'Faldón transversal', grupo: 'repisa', largo: anchoFaldonLat, ancho: hFaldon,
      tapacanto: { largo: 1, ancho: 0 }, pos: [W - e, yFaldon, e], tam: [e, hFaldon, anchoFaldonLat] }),
  ];

  return {
    piezas,
    detalle: { p: D, hLibre: yFaldon, espacios: [yFaldon], fracciones: [1], yBase: yFaldon },
    advertencias: W > 1600 ? ['Para mesas de más de 1600 mm de largo se recomienda refuerzo central bajo cubierta.'] : [],
    supuestos: [
      `Mesa/escritorio rectangular con cubierta superior de ${W} × ${D} mm en melamina de ${e} mm.`,
      `4 patas de esquina (${hPata} × ${wPata} mm) unidas por 4 faldones perimetrales superiores de ${hFaldon} mm.`,
      `Altura libre inferior para piernas y sillas: ${yFaldon} mm.`,
    ],
  };
}

function construirPuenteLaterales({ W, H, D }) {
  const wTorre = Math.max(2 * e + 60, mm(W * 0.275));
  const wIntTorre = wTorre - 2 * e;
  const wPuente = W - 2 * wTorre;
  const xDer = W - wTorre;

  const yRepIzq = Math.max(e + 40, mm(H * 0.25));
  const yRepDer = Math.max(e + 40, mm(H * 0.48));
  const yPuenteInf = Math.max(e + 30, mm(H * 0.30));
  const yPuenteSup = Math.min(H - 2 * e - 30, Math.max(yPuenteInf + e + 60, mm(H * 0.62)));
  const hDivPuente = yPuenteSup - (yPuenteInf + e);
  const xDivPuente = wTorre + mm(wPuente * 0.72);

  const piezas = [
    // Torre izquierda
    pieza({ nombre: 'Lateral de torre', grupo: 'estructura', largo: H, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [0, 0, 0], tam: [e, H, D] }),
    pieza({ nombre: 'Lateral de torre', grupo: 'estructura', largo: H, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [wTorre - e, 0, 0], tam: [e, H, D] }),
    pieza({ nombre: 'Base/Techo de torre', grupo: 'estructura', largo: wIntTorre, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [e, 0, 0], tam: [wIntTorre, e, D] }),
    pieza({ nombre: 'Base/Techo de torre', grupo: 'estructura', largo: wIntTorre, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [e, H - e, 0], tam: [wIntTorre, e, D] }),
    pieza({ nombre: 'Repisa de torre', grupo: 'repisa', largo: wIntTorre, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [e, yRepIzq, 0], tam: [wIntTorre, e, D] }),

    // Torre derecha
    pieza({ nombre: 'Lateral de torre', grupo: 'estructura', largo: H, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [xDer, 0, 0], tam: [e, H, D] }),
    pieza({ nombre: 'Lateral de torre', grupo: 'estructura', largo: H, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [W - e, 0, 0], tam: [e, H, D] }),
    pieza({ nombre: 'Base/Techo de torre', grupo: 'estructura', largo: wIntTorre, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [xDer + e, 0, 0], tam: [wIntTorre, e, D] }),
    pieza({ nombre: 'Base/Techo de torre', grupo: 'estructura', largo: wIntTorre, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [xDer + e, H - e, 0], tam: [wIntTorre, e, D] }),
    pieza({ nombre: 'Repisa de torre', grupo: 'repisa', largo: wIntTorre, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [xDer + e, yRepDer, 0], tam: [wIntTorre, e, D] }),

    // Puente central
    pieza({ nombre: 'Repisa puente central', grupo: 'repisa', largo: wPuente, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [wTorre, yPuenteInf, 0], tam: [wPuente, e, D] }),
    pieza({ nombre: 'Repisa puente central', grupo: 'repisa', largo: wPuente, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [wTorre, yPuenteSup, 0], tam: [wPuente, e, D] }),
    pieza({ nombre: 'División vertical puente', grupo: 'estructura', largo: hDivPuente, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [xDivPuente, yPuenteInf + e, 0], tam: [e, hDivPuente, D] }),
  ];

  return {
    piezas,
    detalle: { p: D, hLibre: H - 2 * e, espacios: [yRepIzq, H - yRepIzq], fracciones: [0.5, 0.5], yBase: 0 },
    advertencias: [],
    supuestos: [
      `Estante de pared compuesto por 2 torres laterales de ${wTorre} × ${H} mm y puente central de ${wPuente} mm.`,
      `Espacio central entre repisas del puente: ${hDivPuente} mm.`,
      'Estructura abierta sin fondo trasero para fijación mural.',
    ],
  };
}

function construirFlotanteEntrelazada({ W, H, D }) {
  const x1 = Math.max(e + 40, mm(W * 0.237));
  const x2 = W - x1;
  const y1 = Math.max(e + 40, mm(H * 0.237));
  const y2 = H - y1;
  const wCubo = x2 - x1;
  const hCuboInt = y2 - y1 - 2 * e;
  const wAla = x1 - e;
  const hBrazoVert = y2 - y1;

  const piezas = [
    // Cubo central (30×30 cm en el modelo original)
    pieza({ nombre: 'Horizontal cubo central', grupo: 'estructura', largo: wCubo, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [x1, y1, 0], tam: [wCubo, e, D] }),
    pieza({ nombre: 'Horizontal cubo central', grupo: 'estructura', largo: wCubo, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [x1, y2 - e, 0], tam: [wCubo, e, D] }),
    pieza({ nombre: 'Vertical cubo central', grupo: 'estructura', largo: hCuboInt, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [x1, y1 + e, 0], tam: [e, hCuboInt, D] }),
    pieza({ nombre: 'Vertical cubo central', grupo: 'estructura', largo: hCuboInt, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [x2 - e, y1 + e, 0], tam: [e, hCuboInt, D] }),

    // Escuadra superior izquierda (45 cm × 45 cm)
    pieza({ nombre: 'Repisa superior saliente', grupo: 'repisa', largo: x2, ancho: D,
      tapacanto: { largo: 1, ancho: 1 }, pos: [0, H - e, 0], tam: [x2, e, D] }),
    pieza({ nombre: 'Lateral exterior izquierdo', grupo: 'estructura', largo: H - e - y1, ancho: D,
      tapacanto: { largo: 1, ancho: 1 }, pos: [0, y1, 0], tam: [e, H - e - y1, D] }),
    pieza({ nombre: 'Repisa corta lateral', grupo: 'repisa', largo: wAla, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [e, mm((y1 + y2) / 2), 0], tam: [wAla, e, D] }),
    pieza({ nombre: 'Tabique conector vertical', grupo: 'estructura', largo: H - e - y2, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [mm((x1 + x2) / 2), y2, 0], tam: [e, H - e - y2, D] }),

    // Escuadra inferior derecha (45 cm × 45 cm)
    pieza({ nombre: 'Repisa inferior saliente', grupo: 'repisa', largo: W - x1, ancho: D,
      tapacanto: { largo: 1, ancho: 1 }, pos: [x1, 0, 0], tam: [W - x1, e, D] }),
    pieza({ nombre: 'Lateral exterior derecho', grupo: 'estructura', largo: y2 - e, ancho: D,
      tapacanto: { largo: 1, ancho: 1 }, pos: [W - e, e, 0], tam: [e, y2 - e, D] }),
    pieza({ nombre: 'Repisa corta lateral', grupo: 'repisa', largo: wAla, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [x2, mm((y1 + y2) / 2), 0], tam: [wAla, e, D] }),
    pieza({ nombre: 'Tabique conector vertical', grupo: 'estructura', largo: y1 - e, ancho: D,
      tapacanto: { largo: 1, ancho: 0 }, pos: [mm((x1 + x2) / 2), e, 0], tam: [e, y1 - e, D] }),
  ];

  return {
    piezas,
    detalle: { p: D, hLibre: hCuboInt, espacios: [y1, hCuboInt, H - y2], fracciones: [0.25, 0.5, 0.25], yBase: 0 },
    advertencias: [],
    supuestos: [
      `Repisa flotante geométrica con cubo central de ${wCubo} × ${hBrazoVert} mm y brazos entrelazados de ${x2} mm.`,
      ` Extensiones perimetrales de ${x1} mm con profundidad uniforme de ${D} mm.`,
    ],
  };
}

function construirGondola({ W, H, D, niveles = 4 }) {
  const nNiv = Math.max(2, Math.min(6, niveles));
  const wAla = Math.max(100, mm(W * 0.18));
  const xIzq = wAla;
  const xDer = W - wAla - e;
  const wCentro = xDer - (xIzq + e);
  const pCentro = D - e;

  const piezas = [
    // 2 montantes verticales maestros
    pieza({ nombre: 'Montante vertical maestro', grupo: 'estructura', largo: H, ancho: D,
      tapacanto: { largo: 1, ancho: 1 }, pos: [xIzq, 0, 0], tam: [e, H, D] }),
    pieza({ nombre: 'Montante vertical maestro', grupo: 'estructura', largo: H, ancho: D,
      tapacanto: { largo: 1, ancho: 1 }, pos: [xDer, 0, 0], tam: [e, H, D] }),
    // Panel central trasero en melamina
    pieza({ nombre: 'Panel respaldo central', grupo: 'estructura', largo: H, ancho: wCentro,
      tapacanto: { largo: 0, ancho: 1 }, pos: [xIzq + e, 0, 0], tam: [wCentro, H, e] }),
  ];

  const pasoY = mm((H - mm(H * 0.18) - e) / Math.max(1, nNiv - 1));
  const espacios = [];
  for (let i = 0; i < nNiv; i++) {
    const y = i * pasoY;
    if (i > 0) espacios.push(pasoY - e);
    // Repisa central
    piezas.push(pieza({
      nombre: 'Repisa central góndola', grupo: 'repisa', largo: wCentro, ancho: pCentro,
      tapacanto: { largo: 1, ancho: 0 }, pos: [xIzq + e, y, e], tam: [wCentro, e, pCentro],
    }));
    // Bandejas laterales izquierda y derecha
    piezas.push(pieza({
      nombre: 'Bandeja lateral exhibidora', grupo: 'repisa', largo: D, ancho: wAla,
      tapacanto: { largo: 1, ancho: 2 }, pos: [0, y, 0], tam: [wAla, e, D],
    }));
    piezas.push(pieza({
      nombre: 'Bandeja lateral exhibidora', grupo: 'repisa', largo: D, ancho: wAla,
      tapacanto: { largo: 1, ancho: 2 }, pos: [xDer + e, y, 0], tam: [wAla, e, D],
    }));
  }

  return {
    piezas,
    detalle: { p: D, hLibre: H, espacios, fracciones: espacios.map(() => 1 / espacios.length), yBase: 0 },
    advertencias: advertenciasRepisas(wCentro + 2 * e, espacios, 1),
    supuestos: [
      `Góndola exhibidora de ${nNiv} niveles con cuerpo central de ${wCentro} mm y 2 alas laterales de ${wAla} mm.`,
      'Incluye 2 montantes verticales maestros a piso y panel de respaldo central.',
    ],
  };
}

/* ---------------- 5. Rack TV Escalonado (ej. R-1456 176×66.5×37.5 cm) ---------------- */

function construirRackEscalonado({ W, H, D }) {
  const piezas = [];
  const yZoc = Math.max(24, Math.min(60, mm(H * 0.055)));
  const yBaseSup = yZoc + e;

  // Zócalo perimetral inferior y base continua a piso
  piezas.push(
    pieza({
      nombre: 'Zócalo frontal',
      grupo: 'estructura',
      largo: W - 2 * e,
      ancho: yZoc,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, 0, D - 2 * e],
      tam: [W - 2 * e, yZoc, e],
    }),
    pieza({
      nombre: 'Zócalo trasero',
      grupo: 'estructura',
      largo: W - 2 * e,
      ancho: yZoc,
      tapacanto: { largo: 0, ancho: 0 },
      pos: [e, 0, e],
      tam: [W - 2 * e, yZoc, e],
    }),
    pieza({
      nombre: 'Base inferior principal',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, yZoc, 0],
      tam: [W, e, D],
    }),
  );

  // Dimensiones proporcionales de los 2 gabinetes laterales (ej. 385×450×300 mm en 1760×665×375 mm)
  const wLat = Math.max(180, mm(W * 0.22));
  const hCuerpoMax = H - yBaseSup - e;
  const hLat = Math.max(140, mm(hCuerpoMax * 0.74));
  const dLat = Math.max(150, mm(D * 0.82));

  // Laterales exteriores izquierdo y derecho
  piezas.push(
    pieza({
      nombre: 'Lateral exterior módulo',
      grupo: 'estructura',
      largo: hLat - e,
      ancho: dLat - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [0, yBaseSup, 0],
      tam: [e, hLat - e, dLat - e],
    }),
    pieza({
      nombre: 'Lateral exterior módulo',
      grupo: 'estructura',
      largo: hLat - e,
      ancho: dLat - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [W - e, yBaseSup, 0],
      tam: [e, hLat - e, dLat - e],
    }),
    // Cubiertas de los 2 módulos laterales
    pieza({
      nombre: 'Cubierta módulo lateral',
      grupo: 'estructura',
      largo: wLat,
      ancho: dLat,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, yBaseSup + hLat - e, 0],
      tam: [wLat, e, dLat],
    }),
    pieza({
      nombre: 'Cubierta módulo lateral',
      grupo: 'estructura',
      largo: wLat,
      ancho: dLat,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [W - wLat, yBaseSup + hLat - e, 0],
      tam: [wLat, e, dLat],
    }),
    // 2 Puertas de los módulos laterales (ej. 380×450 mm)
    pieza({
      nombre: 'Puerta gabinete lateral',
      grupo: 'puerta',
      largo: hLat - e - s,
      ancho: wLat - s,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [s, yBaseSup + s, dLat - e],
      tam: [wLat - s, hLat - e - s, e],
    }),
    pieza({
      nombre: 'Puerta gabinete lateral',
      grupo: 'puerta',
      largo: hLat - e - s,
      ancho: wLat - s,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [W - wLat, yBaseSup + s, dLat - e],
      tam: [wLat - s, hLat - e - s, e],
    }),
  );

  // 2 Montantes verticales centrales que suben hasta la cubierta puente superior
  const xMontIzq = wLat;
  const xMontDer = W - wLat - e;
  const wCentro = xMontDer - (xMontIzq + e);
  piezas.push(
    pieza({
      nombre: 'Montante vertical central',
      grupo: 'estructura',
      largo: hCuerpoMax,
      ancho: D - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xMontIzq, yBaseSup, 0],
      tam: [e, hCuerpoMax, D - e],
    }),
    pieza({
      nombre: 'Montante vertical central',
      grupo: 'estructura',
      largo: hCuerpoMax,
      ancho: D - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xMontDer, yBaseSup, 0],
      tam: [e, hCuerpoMax, D - e],
    }),
  );

  // Cubierta superior puente elevada (ej. 1130×375 mm)
  const wPuente = Math.min(W, Math.max(wCentro + 2 * e + 80, mm(W * 0.64)));
  const xPuente = mm((W - wPuente) / 2);
  piezas.push(
    pieza({
      nombre: 'Cubierta superior puente',
      grupo: 'estructura',
      largo: wPuente,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [xPuente, H - e, 0],
      tam: [wPuente, e, D],
    }),
  );

  // Sección central inferior: Gaveta / Cajón ancho (ej. 878×267 mm) + repisa divisoria encima
  const hCajon = Math.max(90, mm((hCuerpoMax - e) * 0.48));
  piezas.push(
    pieza({
      nombre: 'Frente de cajón central',
      grupo: 'frente',
      largo: wCentro - 2 * s,
      ancho: hCajon - s,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [xMontIzq + e + s, yBaseSup + s, D - e],
      tam: [wCentro - 2 * s, hCajon - s, e],
    }),
    pieza({
      nombre: 'Repisa central sobre cajón',
      grupo: 'repisa',
      largo: wCentro,
      ancho: D - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xMontIzq + e, yBaseSup + hCajon, 0],
      tam: [wCentro, e, D - e],
    }),
  );

  // Sección central superior bajo el puente: división vertical al medio + sub-repisa derecha
  const yNicho = yBaseSup + hCajon + e;
  const hNicho = H - e - yNicho;
  if (hNicho > 70 && wCentro > 180) {
    const wMitadIzq = mm((wCentro - e) / 2);
    const xDivNicho = xMontIzq + e + wMitadIzq;
    const wMitadDer = xMontDer - (xDivNicho + e);
    piezas.push(
      pieza({
        nombre: 'División vertical nicho',
        grupo: 'estructura',
        largo: hNicho,
        ancho: D - e,
        tapacanto: { largo: 1, ancho: 0 },
        pos: [xDivNicho, yNicho, 0],
        tam: [e, hNicho, D - e],
      }),
    );
    if (hNicho > 110 && wMitadDer > 80) {
      const hSub = mm((hNicho - e) / 2);
      piezas.push(
        pieza({
          nombre: 'Repisa nicho derecho',
          grupo: 'repisa',
          largo: wMitadDer,
          ancho: D - e,
          tapacanto: { largo: 1, ancho: 0 },
          pos: [xDivNicho + e, yNicho + hSub, 0],
          tam: [wMitadDer, e, D - e],
        }),
      );
    }
  }

  return {
    piezas,
    detalle: { p: D, hLibre: hCuerpoMax, espacios: [hCajon, Math.max(40, hNicho)], fracciones: [0.5, 0.5], yBase: yZoc },
    advertencias: advertenciasRepisas(wCentro + 2 * e, [hCajon], 1),
    supuestos: [
      `Rack TV escalonado de 3 cuerpos: 2 gabinetes laterales con puerta (${wLat}×${hLat} mm) y cuerpo central elevado (${H} mm).`,
      `Incluye cajón central inferior (${wCentro}×${hCajon} mm), nichos superiores subdivididos y cubierta puente de ${wPuente} mm.`,
    ],
  };
}

/* ---------------- 6. Rack TV con Flancos y Cubierta Flotante ---------------- */

function construirRackFlancos({ W, H, D }) {
  const piezas = [];
  const hZoc = Math.max(24, Math.min(60, mm(H * 0.08)));
  const hGapSup = Math.max(28, Math.min(70, mm(H * 0.10)));

  // 1. Placa base inferior en el suelo + zócalo retraído
  const margenZoc = Math.max(40, mm(W * 0.06));
  piezas.push(
    pieza({
      nombre: 'Placa base inferior',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, 0, 0],
      tam: [W, e, D],
    }),
    pieza({
      nombre: 'Zócalo retraído inferior',
      grupo: 'estructura',
      largo: W - 2 * margenZoc,
      ancho: hZoc,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [margenZoc, e, D - 3 * e],
      tam: [W - 2 * margenZoc, hZoc, e],
    }),
    pieza({
      nombre: 'Zócalo retraído inferior',
      grupo: 'estructura',
      largo: W - 2 * margenZoc,
      ancho: hZoc,
      tapacanto: { largo: 0, ancho: 0 },
      pos: [margenZoc, e, 2 * e],
      tam: [W - 2 * margenZoc, hZoc, e],
    }),
  );

  // 2. Cuerpo principal dividido en 3 columnas (Cajón izquierdo | 2 Repisas centrales | Cajón derecho)
  const yCuerpo = e + hZoc;
  const yTechoCuerpo = H - e - hGapSup;
  const hInt = yTechoCuerpo - e - (yCuerpo + e);
  const wCol = mm((W - 4 * e) / 3);
  const xDiv1 = e + wCol;
  const xDiv2 = W - e - wCol - e;
  const wCentro = xDiv2 - (xDiv1 + e);

  piezas.push(
    pieza({
      nombre: 'Base cuerpo principal',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, yCuerpo, 0],
      tam: [W, e, D],
    }),
    pieza({
      nombre: 'Cubierta cuerpo principal',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, yTechoCuerpo - e, 0],
      tam: [W, e, D],
    }),
    pieza({
      nombre: 'Lateral exterior',
      grupo: 'estructura',
      largo: hInt,
      ancho: D - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [0, yCuerpo + e, 0],
      tam: [e, hInt, D - e],
    }),
    pieza({
      nombre: 'Lateral exterior',
      grupo: 'estructura',
      largo: hInt,
      ancho: D - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [W - e, yCuerpo + e, 0],
      tam: [e, hInt, D - e],
    }),
    pieza({
      nombre: 'División vertical columna',
      grupo: 'estructura',
      largo: hInt,
      ancho: D - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xDiv1, yCuerpo + e, 0],
      tam: [e, hInt, D - e],
    }),
    pieza({
      nombre: 'División vertical columna',
      grupo: 'estructura',
      largo: hInt,
      ancho: D - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xDiv2, yCuerpo + e, 0],
      tam: [e, hInt, D - e],
    }),
    // Frentes de los 2 cajones laterales
    pieza({
      nombre: 'Frente de cajón lateral',
      grupo: 'frente',
      largo: wCol - 2 * s,
      ancho: hInt - 2 * s,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [e + s, yCuerpo + e + s, D - e],
      tam: [wCol - 2 * s, hInt - 2 * s, e],
    }),
    pieza({
      nombre: 'Frente de cajón lateral',
      grupo: 'frente',
      largo: wCol - 2 * s,
      ancho: hInt - 2 * s,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [xDiv2 + e + s, yCuerpo + e + s, D - e],
      tam: [wCol - 2 * s, hInt - 2 * s, e],
    }),
    // Repisa horizontal en la columna central abierta
    pieza({
      nombre: 'Repisa central abierta',
      grupo: 'repisa',
      largo: wCentro,
      ancho: D - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xDiv1 + e, yCuerpo + e + mm((hInt - e) / 2), 0],
      tam: [wCentro, e, D - e],
    }),
  );

  // 3. Soportes superiores retraídos + Cubierta superior flotante
  piezas.push(
    pieza({
      nombre: 'Soporte cubierta flotante',
      grupo: 'estructura',
      largo: W - 2 * margenZoc,
      ancho: hGapSup,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [margenZoc, yTechoCuerpo, D - 3 * e],
      tam: [W - 2 * margenZoc, hGapSup, e],
    }),
    pieza({
      nombre: 'Soporte cubierta flotante',
      grupo: 'estructura',
      largo: W - 2 * margenZoc,
      ancho: hGapSup,
      tapacanto: { largo: 0, ancho: 0 },
      pos: [margenZoc, yTechoCuerpo, 2 * e],
      tam: [W - 2 * margenZoc, hGapSup, e],
    }),
    pieza({
      nombre: 'Cubierta superior flotante',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, H - e, 0],
      tam: [W, e, D],
    }),
  );

  return {
    piezas,
    detalle: { p: D, hLibre: hInt, espacios: [mm(hInt / 2), mm(hInt / 2)], fracciones: [0.5, 0.5], yBase: yCuerpo },
    advertencias: advertenciasRepisas(wCentro + 2 * e, [mm(hInt / 2)], 1),
    supuestos: [
      `Rack TV de 3 columnas con 2 cajones laterales (${wCol} mm), columna central con 2 espacios abiertos (${wCentro} mm) y cubierta superior flotante.`,
      `Incluye placa base inferior y soportes retraídos de ${hZoc} mm y ${hGapSup} mm.`,
    ],
  };
}

/* ---------------- 7. Consola / Arrimo con Cubierta Elevada sobre Pilares (ej. 135×90×35 cm) ---------------- */

function construirConsolaPilares({ W, H, D }) {
  const piezas = [];
  const hZoc = Math.max(40, Math.min(110, mm(H * 0.095)));
  const margenZoc = Math.max(45, mm(W * 0.06));
  const yBase = hZoc;

  // 1. Zócalo retraído inferior (frente, trasera y 2 costados cortos)
  piezas.push(
    pieza({
      nombre: 'Zócalo retraído frontal',
      grupo: 'estructura',
      largo: W - 2 * margenZoc,
      ancho: hZoc,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [margenZoc, 0, D - 2 * e],
      tam: [W - 2 * margenZoc, hZoc, e],
    }),
    pieza({
      nombre: 'Zócalo retraído trasero',
      grupo: 'estructura',
      largo: W - 2 * margenZoc,
      ancho: hZoc,
      tapacanto: { largo: 0, ancho: 0 },
      pos: [margenZoc, 0, e],
      tam: [W - 2 * margenZoc, hZoc, e],
    }),
    pieza({
      nombre: 'Base inferior principal',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, yBase, 0],
      tam: [W, e, D],
    }),
  );

  // 2. Dos cuerpos laterales con nicho vertical y techo parcial que vuela hacia el centro
  const yCuerpo = yBase + e;
  const hPilar = Math.max(80, mm(H * 0.16));
  const yTechoParcial = H - e - hPilar - e;
  const hColLat = yTechoParcial - yCuerpo;

  const wNichoLat = Math.max(140, mm(W * 0.22));
  const wTechoParcial = Math.max(wNichoLat + 2 * e, mm(W * 0.34));
  const xDivIzq = e + wNichoLat;
  const xDivDer = W - e - wNichoLat - e;
  const wCentro = xDivDer - (xDivIzq + e);

  piezas.push(
    // Laterales exteriores izquierdo y derecho
    pieza({
      nombre: 'Lateral exterior',
      grupo: 'estructura',
      largo: hColLat,
      ancho: D,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [0, yCuerpo, 0],
      tam: [e, hColLat, D],
    }),
    pieza({
      nombre: 'Lateral exterior',
      grupo: 'estructura',
      largo: hColLat,
      ancho: D,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [W - e, yCuerpo, 0],
      tam: [e, hColLat, D],
    }),
    // Divisiones verticales interiores que delimitan los nichos laterales y el vano central
    pieza({
      nombre: 'División vertical interior',
      grupo: 'estructura',
      largo: hColLat,
      ancho: D,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [xDivIzq, yCuerpo, 0],
      tam: [e, hColLat, D],
    }),
    pieza({
      nombre: 'División vertical interior',
      grupo: 'estructura',
      largo: hColLat,
      ancho: D,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [xDivDer, yCuerpo, 0],
      tam: [e, hColLat, D],
    }),
    // Cubiertas parciales izquierda y derecha (en voladizo hacia el centro dejando vano en U)
    pieza({
      nombre: 'Cubierta parcial lateral',
      grupo: 'estructura',
      largo: wTechoParcial,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, yTechoParcial, 0],
      tam: [wTechoParcial, e, D],
    }),
    pieza({
      nombre: 'Cubierta parcial lateral',
      grupo: 'estructura',
      largo: wTechoParcial,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [W - wTechoParcial, yTechoParcial, 0],
      tam: [wTechoParcial, e, D],
    }),
    // Repisa horizontal central a media altura entre las dos divisiones interiores
    pieza({
      nombre: 'Repisa central abierta',
      grupo: 'repisa',
      largo: wCentro,
      ancho: D,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [xDivIzq + e, yCuerpo + mm(hColLat * 0.42), 0],
      tam: [wCentro, e, D],
    }),
  );

  // 3. Dos pilares / soportes superiores sobre las cubiertas parciales + Cubierta superior corrida
  const yPilar = yTechoParcial + e;
  const xPilarIzq = Math.min(wTechoParcial - 2 * e, Math.max(e, xDivIzq - e));
  const xPilarDer = Math.max(W - wTechoParcial + e, W - xPilarIzq - e);

  piezas.push(
    pieza({
      nombre: 'Pilar soporte cubierta',
      grupo: 'estructura',
      largo: D,
      ancho: hPilar,
      tapacanto: { largo: 0, ancho: 2 },
      pos: [xPilarIzq, yPilar, 0],
      tam: [e, hPilar, D],
    }),
    pieza({
      nombre: 'Pilar soporte cubierta',
      grupo: 'estructura',
      largo: D,
      ancho: hPilar,
      tapacanto: { largo: 0, ancho: 2 },
      pos: [xPilarDer, yPilar, 0],
      tam: [e, hPilar, D],
    }),
    pieza({
      nombre: 'Cubierta superior principal',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, H - e, 0],
      tam: [W, e, D],
    }),
  );

  return {
    piezas,
    detalle: { p: D, hLibre: hColLat, espacios: [mm(hColLat * 0.42), mm(hColLat * 0.58)], fracciones: [0.42, 0.58], yBase: hZoc },
    advertencias: advertenciasRepisas(wCentro + 2 * e, [mm(hColLat * 0.42)], 1),
    supuestos: [
      `Arrimo / Consola escalonada de ${W}×${H}×${D} mm con zócalo retraído inferior (${hZoc} mm).`,
      `Incluye 2 módulos laterales con cubiertas parciales (${wTechoParcial} mm), vano central abierto en U con repisa media (${wCentro} mm) y cubierta superior corrida sobre 2 pilares (${hPilar} mm).`,
    ],
  };
}

/* ---------------- Constructor Modular General ---------------- */

function modular({
  ancho: W,
  alto: H,
  profundidad: D,
  secciones = [],
  alturaPatasMm = 0,
  tieneFondo = true,
  subtipo = 'estandar',
}) {
  if (subtipo === 'mesa') return construirMesa({ W, H, D });
  if (subtipo === 'puente_laterales') return construirPuenteLaterales({ W, H, D });
  if (subtipo === 'flotante_entrelazada') return construirFlotanteEntrelazada({ W, H, D });
  if (subtipo === 'gondola') return construirGondola({ W, H, D, niveles: secciones?.length || 4 });
  if (subtipo === 'rack_escalonado') return construirRackEscalonado({ W, H, D });
  if (subtipo === 'rack_flancos') return construirRackFlancos({ W, H, D });
  if (subtipo === 'consola_pilares') return construirConsolaPilares({ W, H, D });

  const listaSec = Array.isArray(secciones) && secciones.length
    ? secciones
    : [{ tipoSeccion: 'hueco', columnas: 1, proporcionAlto: 1 }];

  const nNiveles = listaSec.length;
  const nRepisasDivisorias = nNiveles - 1;
  // Permitir patas altas en escritorios/arrimos (hasta dejar al menos 45 mm por nivel arriba)
  const yBaseMax = Math.max(0, H - (nRepisasDivisorias + 2) * e - nNiveles * 45);
  const yBase = Math.max(0, Math.min(yBaseMax, Math.round(H * 0.84), Math.round(Number(alturaPatasMm) || 0)));

  const tieneFrentes = listaSec.some(
    (sec) => sec.tipoSeccion === 'cajon' || sec.tipoSeccion === 'puertas' || sec.tipoSeccion === 'mixto_hueco_puertas',
  );
  const z0 = tieneFondo ? tf : 0;
  const p = D - z0 - (tieneFrentes ? e : 0);
  if (p < 60) throw new Error('Profundidad insuficiente para construir los componentes internos.');

  const hLibre = H - yBase - (nRepisasDivisorias + 2) * e;
  if (hLibre < nNiveles * 30) {
    throw new Error('Altura insuficiente para la cantidad de niveles detectados en el mueble.');
  }

  const props = listaSec.map((sec) => Math.max(0.2, Number(sec.proporcionAlto) || 1));
  const fracciones = normalizarProporciones(props, nNiveles);
  const espacios = escalarProporciones(fracciones, hLibre);
  const interior = W - 2 * e;

  const piezas = [...carcasa(W, H, p, z0, yBase)];
  let y = yBase + e;
  let maxColumnas = 1;

  listaSec.forEach((sec, idx) => {
    const hNivel = espacios[idx];
    const hNivelMm = mm(hNivel);
    const cols = Math.max(1, Math.min(4, Math.round(Number(sec.columnas) || 1)));
    if (cols > maxColumnas) maxColumnas = cols;

    if (sec.tipoSeccion === 'mixto_hueco_puertas') {
      // Sección mixta asimétrica (ej. Arrimo ComboSala: hueco izquierdo ~45% + 2 puertas derechas ~55%)
      const wHueco = mm(interior * 0.45);
      const xDiv = e + wHueco;
      const wZonaPuertas = interior - wHueco - e;
      const nPuertas = Math.max(1, cols >= 2 ? cols - 1 : 2);
      const anchoPuerta = (wZonaPuertas - s * (nPuertas - 1)) / nPuertas;
      const altoPuerta = Math.max(60, hNivelMm - s);

      piezas.push(pieza({
        nombre: 'División vertical',
        grupo: 'estructura',
        largo: hNivelMm,
        ancho: p,
        tapacanto: { largo: 1, ancho: 0 },
        pos: [xDiv, y, z0],
        tam: [e, hNivelMm, p],
      }));

      for (let c = 0; c < nPuertas; c++) {
        const xp = xDiv + e + c * (mm(anchoPuerta) + s);
        piezas.push(pieza({
          nombre: 'Puerta / Tapa frontal',
          grupo: 'puerta',
          largo: altoPuerta,
          ancho: anchoPuerta,
          tapacanto: { largo: 2, ancho: 2 },
          pos: [xp, y, z0 + p],
          tam: [mm(anchoPuerta), mm(altoPuerta), e],
        }));
      }
    } else {
      const anchoCelda = (interior - (cols - 1) * e) / cols;

      // Divisiones verticales internas (con opción de desfasar en libreros intercalados)
      for (let c = 1; c < cols; c++) {
        let xDiv = e + c * anchoCelda + (c - 1) * e;
        if (subtipo === 'intercalado' && cols === 2) {
          const factorPos = idx % 2 === 0 ? 0.36 : 0.64;
          xDiv = e + mm((interior - e) * factorPos);
        }
        piezas.push(pieza({
          nombre: 'División vertical',
          grupo: 'estructura',
          largo: hNivelMm,
          ancho: p,
          tapacanto: { largo: 1, ancho: 0 },
          pos: [xDiv, y, z0],
          tam: [e, hNivelMm, p],
        }));
      }

      if (sec.tipoSeccion === 'puertas') {
        const anchoPuerta = (interior - s * (cols - 1)) / cols;
        const altoPuerta = Math.max(60, hNivelMm - s);
        for (let c = 0; c < cols; c++) {
          const xp = e + c * (mm(anchoPuerta) + s);
          piezas.push(pieza({
            nombre: 'Puerta / Tapa frontal',
            grupo: 'puerta',
            largo: altoPuerta,
            ancho: anchoPuerta,
            tapacanto: { largo: 2, ancho: 2 },
            pos: [xp, y, z0 + p],
            tam: [mm(anchoPuerta), mm(altoPuerta), e],
          }));
        }
      } else if (sec.tipoSeccion === 'cajon') {
        const largoCaja = Math.min(550, Math.max(200, Math.floor((p - 10) / 50) * 50));
        const anchoFrente = (interior - s * (cols - 1)) / cols;
        const altoFrente = Math.max(55, hNivelMm - s);
        for (let c = 0; c < cols; c++) {
          const xf = e + c * (mm(anchoFrente) + s);
          piezas.push(pieza({
            nombre: 'Frente de cajón',
            grupo: 'frente',
            largo: anchoFrente,
            ancho: altoFrente,
            tapacanto: { largo: 2, ancho: 2 },
            pos: [xf, y, z0 + p],
            tam: [mm(anchoFrente), mm(altoFrente), e],
          }));

          const anchoCaja = mm(anchoCelda) - 2 * CORREDERA;
          const hc = Math.max(45, mm(altoFrente) - 25);
          if (anchoCaja > 2 * e + 40 && largoCaja <= p && hc + 12 <= hNivelMm) {
            const x0 = e + c * (anchoCelda + e) + CORREDERA;
            const yc = y + 8;
            const zc = z0 + p - largoCaja;
            piezas.push(
              pieza({ nombre: 'Costado de cajón', grupo: 'cajon', largo: largoCaja, ancho: hc,
                tapacanto: { largo: 1, ancho: 0 }, pos: [x0, yc, zc], tam: [e, hc, largoCaja] }),
              pieza({ nombre: 'Costado de cajón', grupo: 'cajon', largo: largoCaja, ancho: hc,
                tapacanto: { largo: 1, ancho: 0 }, pos: [x0 + anchoCaja - e, yc, zc], tam: [e, hc, largoCaja] }),
              pieza({ nombre: 'Frente/trasera de cajón', grupo: 'cajon', largo: anchoCaja - 2 * e, ancho: hc,
                tapacanto: { largo: 1, ancho: 0 }, pos: [x0 + e, yc, zc + largoCaja - e], tam: [anchoCaja - 2 * e, hc, e] }),
              pieza({ nombre: 'Frente/trasera de cajón', grupo: 'cajon', largo: anchoCaja - 2 * e, ancho: hc,
                tapacanto: { largo: 1, ancho: 0 }, pos: [x0 + e, yc, zc], tam: [anchoCaja - 2 * e, hc, e] }),
              pieza({ nombre: 'Fondo de cajón', grupo: 'fondo', largo: largoCaja, ancho: anchoCaja, espesor: tf,
                material: MATERIAL.FONDO, pos: [x0, yc - tf, zc], tam: [anchoCaja, tf, largoCaja] }),
            );
          }
        }
      }
    }

    y += hNivel;
    if (idx < nNiveles - 1) {
      piezas.push(pieza({
        nombre: 'Repisa horizontal',
        grupo: 'repisa',
        largo: interior,
        ancho: p,
        tapacanto: { largo: 1, ancho: 0 },
        pos: [e, y, z0],
        tam: [interior, e, p],
      }));
      y += e;
    }
  });

  if (tieneFondo) {
    piezas.push(fondo(W, H, yBase));
  }

  return {
    piezas,
    detalle: { p, hLibre, espacios, fracciones, yBase, subtipo },
    advertencias: advertenciasRepisas(W, espacios, maxColumnas),
    supuestos: [
      `Estructura modular de ${nNiveles} nivel(es) verticales en melamina de ${e} mm.`,
      yBase > 0 ? `Espacio libre inferior de ${yBase} mm desde el suelo (patas/soportes laterales).` : 'Base apoyada a nivel de piso.',
      tieneFondo ? `Incluye fondo trasero de ${tf} mm.` : 'Diseño de fondo abierto (sin placa trasera).',
    ],
  };
}

export const PLANTILLAS = Object.freeze({
  librero: { nombre: 'Librero / repisa abierta', generar: librero, proporcionesDe: 'espacios entre repisas' },
  mueble_puertas: { nombre: 'Mueble con puertas', generar: mueblePuertas, proporcionesDe: 'espacios entre repisas' },
  cajonera: { nombre: 'Cajonera', generar: cajonera, proporcionesDe: 'frentes de cajón' },
  modular: { nombre: 'Mueble modular por secciones', generar: modular, proporcionesDe: 'niveles de abajo hacia arriba' },
});

export function generarMueble(tipo, params) {
  const plantilla = PLANTILLAS[tipo];
  if (!plantilla) throw new Error(`Tipo de mueble desconocido: ${tipo}`);
  const errores = validarMedidas(params);
  if (errores.length) throw new Error(errores.join(' '));
  return { tipo, params, ...plantilla.generar(params) };
}
