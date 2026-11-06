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

/* ---------------- 8. Motor Universal por Columnas Independientes (2D Column-Grid + Zócalo + Cubierta Elevada) ---------------- */

function construirGrillaColumnas({
  W,
  H,
  D,
  columnasDetalle = [],
  zocaloInferior = 'ninguno',
  cubiertaSuperior = 'directa',
  alturaPatasMm = 0,
  tieneFondo = false,
}) {
  const piezas = [];
  const z0 = tieneFondo ? tf : 0;
  const p = D - z0;

  // 1. Capa Inferior: Piso, Zócalo Retraído o Patas
  let yBase = 0;
  if (zocaloInferior === 'retraido') {
    const hZoc = Math.max(35, Math.min(110, alturaPatasMm > 20 ? mm(alturaPatasMm) : mm(H * 0.09)));
    const margenZoc = Math.max(40, mm(W * 0.06));
    yBase = hZoc;
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
    );
  } else if (zocaloInferior === 'patas' || alturaPatasMm > 0) {
    yBase = Math.max(0, Math.min(mm(H * 0.65), mm(alturaPatasMm || H * 0.12)));
  }

  // Base inferior principal
  piezas.push(
    pieza({
      nombre: 'Base inferior principal',
      grupo: 'estructura',
      largo: W,
      ancho: p,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, yBase, z0],
      tam: [W, e, p],
    }),
  );

  // 2. Capa Superior: Directa, Elevada sobre Pilares o Flotante Retraída
  const hPilarSup =
    cubiertaSuperior === 'elevada_pilares'
      ? Math.max(70, mm(H * 0.15))
      : cubiertaSuperior === 'flotante'
        ? Math.max(30, mm(H * 0.09))
        : 0;

  const yTechoCuerpo = H - e - hPilarSup;
  const yCuerpo = yBase + e;
  const hCuerpoTotal = Math.max(120, yTechoCuerpo - e - yCuerpo);

  // Cubierta del cuerpo principal (completa o parcial en los extremos si hay vano en U)
  const tieneVanoCentral =
    columnasDetalle.length >= 3 &&
    columnasDetalle[1]?.abiertoArriba === true;

  if (tieneVanoCentral) {
    const wTechoLat = Math.max(160, mm(W * 0.34));
    piezas.push(
      pieza({
        nombre: 'Cubierta parcial lateral',
        grupo: 'estructura',
        largo: wTechoLat,
        ancho: p,
        tapacanto: { largo: 2, ancho: 2 },
        pos: [0, yTechoCuerpo - e, z0],
        tam: [wTechoLat, e, p],
      }),
      pieza({
        nombre: 'Cubierta parcial lateral',
        grupo: 'estructura',
        largo: wTechoLat,
        ancho: p,
        tapacanto: { largo: 2, ancho: 2 },
        pos: [W - wTechoLat, yTechoCuerpo - e, z0],
        tam: [wTechoLat, e, p],
      }),
    );
  } else {
    piezas.push(
      pieza({
        nombre: 'Cubierta cuerpo principal',
        grupo: 'estructura',
        largo: W,
        ancho: p,
        tapacanto: { largo: 2, ancho: 2 },
        pos: [0, yTechoCuerpo - e, z0],
        tam: [W, e, p],
      }),
    );
  }

  // Si hay cubierta elevada sobre pilares o flotante, añadir pilares y cubierta superior en H - e
  if (hPilarSup > 0) {
    const xPilar1 = Math.max(2 * e, mm(W * 0.22));
    const xPilar2 = W - xPilar1 - e;
    piezas.push(
      pieza({
        nombre: 'Pilar soporte cubierta',
        grupo: 'estructura',
        largo: p,
        ancho: hPilarSup,
        tapacanto: { largo: 0, ancho: 2 },
        pos: [xPilar1, yTechoCuerpo, z0],
        tam: [e, hPilarSup, p],
      }),
      pieza({
        nombre: 'Pilar soporte cubierta',
        grupo: 'estructura',
        largo: p,
        ancho: hPilarSup,
        tapacanto: { largo: 0, ancho: 2 },
        pos: [xPilar2, yTechoCuerpo, z0],
        tam: [e, hPilarSup, p],
      }),
      pieza({
        nombre: 'Cubierta superior elevada',
        grupo: 'estructura',
        largo: W,
        ancho: p,
        tapacanto: { largo: 2, ancho: 2 },
        pos: [0, H - e, z0],
        tam: [W, e, p],
      }),
    );
  }

  // 3. Laterales exteriores (desde piso si tiene patas, o desde yCuerpo si tiene zócalo/piso)
  const yLatInf = zocaloInferior === 'retraido' ? yCuerpo : 0;
  const hLatExt = (yTechoCuerpo - e) - yLatInf;
  piezas.push(
    pieza({
      nombre: 'Lateral exterior',
      grupo: 'estructura',
      largo: hLatExt,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [0, yLatInf, z0],
      tam: [e, hLatExt, p],
    }),
    pieza({
      nombre: 'Lateral exterior',
      grupo: 'estructura',
      largo: hLatExt,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [W - e, yLatInf, z0],
      tam: [e, hLatExt, p],
    }),
  );

  // 4. Columnas verticales independientes (Izquierda -> Derecha)
  const nCols = Math.max(1, Math.min(4, columnasDetalle.length || 3));
  const pesosAncho = Array.from({ length: nCols }, (_, i) => Math.max(0.2, Number(columnasDetalle[i]?.proporcionAncho) || 1));
  const fracAncho = normalizarProporciones(pesosAncho, nCols);
  const anchoDisponibleCols = W - (nCols + 1) * e;
  const anchosCols = escalarProporciones(fracAncho, anchoDisponibleCols).map((v) => mm(v));

  let xCursor = e;
  for (let c = 0; c < nCols; c++) {
    const wCol = anchosCols[c];
    const colCfg = columnasDetalle[c] || { celdas: ['hueco'] };
    const celdas = Array.isArray(colCfg.celdas) && colCfg.celdas.length ? colCfg.celdas.slice(0, 6) : ['hueco'];
    const nCeldas = celdas.length;
    const hDispCol = hCuerpoTotal - (nCeldas - 1) * e;
    const hCelda = mm(hDispCol / nCeldas);

    let yCelda = yCuerpo;
    for (let r = 0; r < nCeldas; r++) {
      const tipoCelda = celdas[r];
      const hAct = r === nCeldas - 1 ? (yCuerpo + hCuerpoTotal - yCelda) : hCelda;

      if (tipoCelda === 'puerta' || tipoCelda === 'puertas') {
        piezas.push(
          pieza({
            nombre: 'Puerta columna',
            grupo: 'puerta',
            largo: Math.max(60, hAct - 2 * s),
            ancho: Math.max(60, wCol - 2 * s),
            tapacanto: { largo: 2, ancho: 2 },
            pos: [xCursor + s, yCelda + s, z0 + p - e],
            tam: [Math.max(60, wCol - 2 * s), Math.max(60, hAct - 2 * s), e],
          }),
        );
      } else if (tipoCelda === 'cajon') {
        piezas.push(
          pieza({
            nombre: 'Frente de cajón',
            grupo: 'frente',
            largo: Math.max(60, wCol - 2 * s),
            ancho: Math.max(50, hAct - 2 * s),
            tapacanto: { largo: 2, ancho: 2 },
            pos: [xCursor + s, yCelda + s, z0 + p - e],
            tam: [Math.max(60, wCol - 2 * s), Math.max(50, hAct - 2 * s), e],
          }),
        );
      }

      yCelda += hAct;
      if (r < nCeldas - 1) {
        const profRep = (tipoCelda === 'puerta' || tipoCelda === 'cajon') ? p - e : p;
        piezas.push(
          pieza({
            nombre: 'Repisa de columna',
            grupo: 'repisa',
            largo: wCol,
            ancho: profRep,
            tapacanto: { largo: 1, ancho: 0 },
            pos: [xCursor, yCelda, z0],
            tam: [wCol, e, profRep],
          }),
        );
        yCelda += e;
      }
    }

    xCursor += wCol;
    if (c < nCols - 1) {
      piezas.push(
        pieza({
          nombre: 'División vertical maestra',
          grupo: 'estructura',
          largo: hCuerpoTotal,
          ancho: p - e,
          tapacanto: { largo: 1, ancho: 0 },
          pos: [xCursor, yCuerpo, z0],
          tam: [e, hCuerpoTotal, p - e],
        }),
      );
      xCursor += e;
    }
  }

  if (tieneFondo) {
    piezas.push(fondo(W, yTechoCuerpo, yBase));
  }

  return {
    piezas,
    detalle: { p, hLibre: hCuerpoTotal, espacios: [hCuerpoTotal], fracciones: [1], yBase },
    advertencias: advertenciasRepisas(Math.max(...anchosCols) + 2 * e, [hCuerpoTotal], 1),
    supuestos: [
      `Estructura composicional de ${nCols} columna(s) verticales independientes (${W}×${H}×${D} mm).`,
      zocaloInferior === 'retraido'
        ? `Incluye zócalo retraído inferior de ${yBase} mm.`
        : yBase > 0
          ? `Incluye patas/espacio inferior de ${yBase} mm.`
          : 'Apoyo directo a nivel de piso.',
      hPilarSup > 0 ? `Incluye cubierta superior elevada sobre pilares de ${hPilarSup} mm.` : 'Cubierta superior directa.',
    ],
  };
}

/* ---------------- 9. Mesa de Centro con Repisa Inferior (mesa_con_repisa) ---------------- */

function construirMesaConRepisa({ W, H, D }) {
  const piezas = [];
  const hFaldon = Math.min(80, Math.max(45, mm(H * 0.14)));
  const anchoPata = Math.min(80, Math.max(45, mm(Math.min(W, D) * 0.10)));
  const hPata = H - e;
  const yRepisa = Math.max(60, Math.min(H - e - hFaldon - 80, mm(H * 0.28)));

  // 1. Cubierta superior
  piezas.push(
    pieza({
      nombre: 'Cubierta superior',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, H - e, 0],
      tam: [W, e, D],
    }),
  );

  // 2. 4 Patas en las esquinas
  const posicionesPatas = [
    [0, 0],
    [W - e, 0],
    [0, D - anchoPata],
    [W - e, D - anchoPata],
  ];
  for (const [px, pz] of posicionesPatas) {
    piezas.push(
      pieza({
        nombre: 'Pata de esquina',
        grupo: 'estructura',
        largo: hPata,
        ancho: anchoPata,
        tapacanto: { largo: 2, ancho: 1 },
        pos: [px, 0, pz],
        tam: [e, hPata, anchoPata],
      }),
    );
  }

  // 3. Faldones superiores frontales y traseros
  const largoFaldonX = W - 2 * e;
  if (largoFaldonX > 80) {
    piezas.push(
      pieza({
        nombre: 'Faldón frontal/trasero',
        grupo: 'estructura',
        largo: largoFaldonX,
        ancho: hFaldon,
        tapacanto: { largo: 1, ancho: 0 },
        pos: [e, H - e - hFaldon, anchoPata],
        tam: [largoFaldonX, hFaldon, e],
      }),
      pieza({
        nombre: 'Faldón frontal/trasero',
        grupo: 'estructura',
        largo: largoFaldonX,
        ancho: hFaldon,
        tapacanto: { largo: 1, ancho: 0 },
        pos: [e, H - e - hFaldon, D - anchoPata - e],
        tam: [largoFaldonX, hFaldon, e],
      }),
    );
  }

  // 4. Repisa horizontal inferior entre las 4 patas
  piezas.push(
    pieza({
      nombre: 'Repisa inferior',
      grupo: 'repisa',
      largo: W - 2 * e,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [e, yRepisa, 0],
      tam: [W - 2 * e, e, D],
    }),
  );

  const hVano = H - e - (yRepisa + e);
  return {
    piezas,
    detalle: { p: D, hLibre: hVano, espacios: [hVano], fracciones: [1], yBase: yRepisa },
    advertencias: advertenciasRepisas(W, [hVano], 1),
    supuestos: [
      `Mesa de centro de ${W}×${H}×${D} mm con cubierta superior, 4 patas de esquina y repisa inferior a ${yRepisa} mm del suelo.`,
    ],
  };
}

/* ---------------- 10. Taburete / Mesa Multiusos con Travesaños (taburete) ---------------- */

function construirTaburete({ W, H, D }) {
  const piezas = [];
  const hFaldon = Math.min(70, Math.max(40, mm(H * 0.11)));
  const anchoPata = Math.min(65, Math.max(36, mm(Math.min(W, D) * 0.14)));
  const hPata = H - e;
  const yTrav = Math.max(80, mm(H * 0.26));

  piezas.push(
    pieza({
      nombre: 'Cubierta / Asiento superior',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, H - e, 0],
      tam: [W, e, D],
    }),
  );

  const posicionesPatas = [
    [0, 0],
    [W - e, 0],
    [0, D - anchoPata],
    [W - e, D - anchoPata],
  ];
  for (const [px, pz] of posicionesPatas) {
    piezas.push(
      pieza({
        nombre: 'Pata vertical',
        grupo: 'estructura',
        largo: hPata,
        ancho: anchoPata,
        tapacanto: { largo: 2, ancho: 1 },
        pos: [px, 0, pz],
        tam: [e, hPata, anchoPata],
      }),
    );
  }

  const largoX = W - 2 * e;
  const largoZ = D - 2 * anchoPata;
  if (largoX > 50) {
    piezas.push(
      pieza({
        nombre: 'Faldón superior',
        grupo: 'estructura',
        largo: largoX,
        ancho: hFaldon,
        tapacanto: { largo: 1, ancho: 0 },
        pos: [e, H - e - hFaldon, 0],
        tam: [largoX, hFaldon, e],
      }),
      pieza({
        nombre: 'Faldón superior',
        grupo: 'estructura',
        largo: largoX,
        ancho: hFaldon,
        tapacanto: { largo: 1, ancho: 0 },
        pos: [e, H - e - hFaldon, D - e],
        tam: [largoX, hFaldon, e],
      }),
      pieza({
        nombre: 'Travesaño apoya-pies',
        grupo: 'estructura',
        largo: largoX,
        ancho: hFaldon,
        tapacanto: { largo: 2, ancho: 0 },
        pos: [e, yTrav, 0],
        tam: [largoX, hFaldon, e],
      }),
      pieza({
        nombre: 'Travesaño apoya-pies',
        grupo: 'estructura',
        largo: largoX,
        ancho: hFaldon,
        tapacanto: { largo: 2, ancho: 0 },
        pos: [e, yTrav, D - e],
        tam: [largoX, hFaldon, e],
      }),
    );
  }
  if (largoZ > 50) {
    piezas.push(
      pieza({
        nombre: 'Travesaño lateral',
        grupo: 'estructura',
        largo: largoZ,
        ancho: hFaldon,
        tapacanto: { largo: 2, ancho: 0 },
        pos: [0, yTrav + hFaldon, anchoPata],
        tam: [e, hFaldon, largoZ],
      }),
      pieza({
        nombre: 'Travesaño lateral',
        grupo: 'estructura',
        largo: largoZ,
        ancho: hFaldon,
        tapacanto: { largo: 2, ancho: 0 },
        pos: [W - e, yTrav + hFaldon, anchoPata],
        tam: [e, hFaldon, largoZ],
      }),
    );
  }

  return {
    piezas,
    detalle: { p: D, hLibre: hPata, espacios: [hPata], fracciones: [1], yBase: yTrav },
    advertencias: [],
    supuestos: [
      `Taburete / Mesa multiusos de ${W}×${H}×${D} mm con cubierta superior, 4 patas, faldón y travesaños apoya-pies.`,
    ],
  };
}

/* ---------------- 11. Escritorio con Pedestal de Cajones (escritorio_pedestal) ---------------- */

function construirEscritorioPedestal({ W, H, D, secciones = [] }) {
  const piezas = [];
  const wPed = Math.max(260, Math.min(W - 350, mm(W * 0.40)));
  const hCuerpo = H - e;
  const xPed0 = W - wPed;
  const wIntPed = wPed - 2 * e;

  // 1. Cubierta superior corrida + Pata lateral izquierda + Faldón trasero de rigidez
  piezas.push(
    pieza({
      nombre: 'Cubierta de escritorio',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, H - e, 0],
      tam: [W, e, D],
    }),
    pieza({
      nombre: 'Lateral soporte izquierdo',
      grupo: 'estructura',
      largo: hCuerpo,
      ancho: D,
      tapacanto: { largo: 1, ancho: 2 },
      pos: [0, 0, 0],
      tam: [e, hCuerpo, D],
    }),
    pieza({
      nombre: 'Faldón trasero bajo cubierta',
      grupo: 'estructura',
      largo: xPed0 - e,
      ancho: Math.min(180, mm(H * 0.22)),
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, H - e - Math.min(180, mm(H * 0.22)), 0],
      tam: [xPed0 - e, Math.min(180, mm(H * 0.22)), e],
    }),
  );

  // 2. Pedestal lateral derecho (2 laterales + base + frentes de cajón/puerta)
  piezas.push(
    pieza({
      nombre: 'Lateral pedestal cajonera',
      grupo: 'estructura',
      largo: hCuerpo,
      ancho: D - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xPed0, 0, 0],
      tam: [e, hCuerpo, D - e],
    }),
    pieza({
      nombre: 'Lateral pedestal cajonera',
      grupo: 'estructura',
      largo: hCuerpo,
      ancho: D - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [W - e, 0, 0],
      tam: [e, hCuerpo, D - e],
    }),
    pieza({
      nombre: 'Base inferior pedestal',
      grupo: 'estructura',
      largo: wIntPed,
      ancho: D - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xPed0 + e, 0, 0],
      tam: [wIntPed, e, D - e],
    }),
  );

  const nCeldas = Math.max(2, Math.min(5, secciones?.length || 4));
  const hDisp = hCuerpo - e;
  const hCelda = mm(hDisp / nCeldas);
  let yCursor = e;
  for (let i = 0; i < nCeldas; i++) {
    const hAct = i === nCeldas - 1 ? hCuerpo - yCursor : hCelda;
    const tipoSec = secciones?.[i]?.tipoSeccion || 'cajon';
    const nombreFrente = tipoSec === 'puertas' ? 'Puerta pedestal' : 'Frente cajón pedestal';
    const grupoFrente = tipoSec === 'puertas' ? 'puerta' : 'frente';
    piezas.push(
      pieza({
        nombre: nombreFrente,
        grupo: grupoFrente,
        largo: wIntPed + 2 * e - 2 * s,
        ancho: Math.max(60, hAct - s),
        tapacanto: { largo: 2, ancho: 2 },
        pos: [xPed0 + s, yCursor, D - e],
        tam: [wIntPed + 2 * e - 2 * s, Math.max(60, hAct - s), e],
      }),
    );
    yCursor += hAct;
  }

  return {
    piezas,
    detalle: { p: D, hLibre: hCuerpo, espacios: [hCuerpo], fracciones: [1], yBase: 0 },
    advertencias: advertenciasRepisas(W - wPed, [hCuerpo], 1),
    supuestos: [
      `Escritorio de ${W}×${H}×${D} mm con vano libre para piernas (${xPed0 - e} mm) y módulo pedestal lateral (${wPed} mm) con ${nCeldas} compartimentos.`,
    ],
  };
}

/* ---------------- 12. Silla / Sillón / Banca con Respaldo (silla_respaldo) ---------------- */

function construirSillaRespaldo({ W, H, D }) {
  const piezas = [];
  const yAsiento = Math.max(280, Math.min(H - 220, mm(H * 0.45)));
  const tieneBrazos = W >= 560;
  const hBrazo = Math.min(H - e, yAsiento + Math.max(140, mm(H * 0.22)));

  if (tieneBrazos) {
    // Sillón / Banca con laterales que forman patas + apoyabrazos
    piezas.push(
      pieza({
        nombre: 'Costado / Apoyabrazo lateral',
        grupo: 'estructura',
        largo: hBrazo,
        ancho: D,
        tapacanto: { largo: 2, ancho: 2 },
        pos: [0, 0, 0],
        tam: [e, hBrazo, D],
      }),
      pieza({
        nombre: 'Costado / Apoyabrazo lateral',
        grupo: 'estructura',
        largo: hBrazo,
        ancho: D,
        tapacanto: { largo: 2, ancho: 2 },
        pos: [W - e, 0, 0],
        tam: [e, hBrazo, D],
      }),
      pieza({
        nombre: 'Tablero de asiento',
        grupo: 'estructura',
        largo: W - 2 * e,
        ancho: D - e,
        tapacanto: { largo: 2, ancho: 1 },
        pos: [e, yAsiento, e],
        tam: [W - 2 * e, e, D - e],
      }),
      pieza({
        nombre: 'Faldón bajo asiento',
        grupo: 'estructura',
        largo: W - 2 * e,
        ancho: 70,
        tapacanto: { largo: 1, ancho: 0 },
        pos: [e, yAsiento - 70, D - e],
        tam: [W - 2 * e, 70, e],
      }),
      pieza({
        nombre: 'Respaldo trasero superior',
        grupo: 'estructura',
        largo: W - 2 * e,
        ancho: H - yAsiento,
        tapacanto: { largo: 2, ancho: 2 },
        pos: [e, yAsiento, 0],
        tam: [W - 2 * e, H - yAsiento, e],
      }),
    );
  } else {
    // Silla de comedor: 2 montantes traseros hasta H, 2 patas delanteras hasta yAsiento, asiento y respaldo
    const anchoPata = Math.max(40, mm(D * 0.12));
    piezas.push(
      pieza({
        nombre: 'Montante trasero largo',
        grupo: 'estructura',
        largo: H,
        ancho: anchoPata,
        tapacanto: { largo: 2, ancho: 1 },
        pos: [0, 0, 0],
        tam: [e, H, anchoPata],
      }),
      pieza({
        nombre: 'Montante trasero largo',
        grupo: 'estructura',
        largo: H,
        ancho: anchoPata,
        tapacanto: { largo: 2, ancho: 1 },
        pos: [W - e, 0, 0],
        tam: [e, H, anchoPata],
      }),
      pieza({
        nombre: 'Pata delantera',
        grupo: 'estructura',
        largo: yAsiento,
        ancho: anchoPata,
        tapacanto: { largo: 2, ancho: 1 },
        pos: [0, 0, D - anchoPata],
        tam: [e, yAsiento, anchoPata],
      }),
      pieza({
        nombre: 'Pata delantera',
        grupo: 'estructura',
        largo: yAsiento,
        ancho: anchoPata,
        tapacanto: { largo: 2, ancho: 1 },
        pos: [W - e, 0, D - anchoPata],
        tam: [e, yAsiento, anchoPata],
      }),
      pieza({
        nombre: 'Tablero de asiento',
        grupo: 'estructura',
        largo: W,
        ancho: D - anchoPata,
        tapacanto: { largo: 2, ancho: 2 },
        pos: [0, yAsiento, anchoPata],
        tam: [W, e, D - anchoPata],
      }),
      pieza({
        nombre: 'Respaldo superior',
        grupo: 'estructura',
        largo: W - 2 * e,
        ancho: Math.max(120, mm((H - yAsiento) * 0.45)),
        tapacanto: { largo: 2, ancho: 0 },
        pos: [e, H - Math.max(120, mm((H - yAsiento) * 0.45)), 0],
        tam: [W - 2 * e, Math.max(120, mm((H - yAsiento) * 0.45)), e],
      }),
    );
  }

  return {
    piezas,
    detalle: { p: D, hLibre: H - yAsiento, espacios: [H - yAsiento], fracciones: [1], yBase: yAsiento },
    advertencias: [],
    supuestos: [
      `Asiento / Silla con respaldo de ${W}×${H}×${D} mm (altura de asiento a ${yAsiento} mm del suelo).`,
    ],
  };
}

/* ---------------- 13. Escalera / Banqueta de 2 Peldaños (escalera_2_peldanos) ---------------- */

function construirEscaleraPeldanos({ W, H, D }) {
  const piezas = [];
  const hPeldano1 = mm(H / 2);
  const dHuella = mm(D / 2);
  const interior = W - 2 * e;

  piezas.push(
    // 2 Costados traseros altos + 2 Costados delanteros bajos (forman el perfil escalonado sin colisiones)
    pieza({
      nombre: 'Lateral tramo alto (trasero)',
      grupo: 'estructura',
      largo: H - e,
      ancho: dHuella,
      tapacanto: { largo: 2, ancho: 1 },
      pos: [0, 0, 0],
      tam: [e, H - e, dHuella],
    }),
    pieza({
      nombre: 'Lateral tramo alto (trasero)',
      grupo: 'estructura',
      largo: H - e,
      ancho: dHuella,
      tapacanto: { largo: 2, ancho: 1 },
      pos: [W - e, 0, 0],
      tam: [e, H - e, dHuella],
    }),
    pieza({
      nombre: 'Lateral tramo bajo (delantero)',
      grupo: 'estructura',
      largo: hPeldano1 - e,
      ancho: D - dHuella,
      tapacanto: { largo: 2, ancho: 1 },
      pos: [0, 0, dHuella],
      tam: [e, hPeldano1 - e, D - dHuella],
    }),
    pieza({
      nombre: 'Lateral tramo bajo (delantero)',
      grupo: 'estructura',
      largo: hPeldano1 - e,
      ancho: D - dHuella,
      tapacanto: { largo: 2, ancho: 1 },
      pos: [W - e, 0, dHuella],
      tam: [e, hPeldano1 - e, D - dHuella],
    }),
    // Peldaño inferior (delantero) y Peldaño superior (trasero)
    pieza({
      nombre: 'Huella peldaño inferior',
      grupo: 'estructura',
      largo: W,
      ancho: D - dHuella,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, hPeldano1 - e, dHuella],
      tam: [W, e, D - dHuella],
    }),
    pieza({
      nombre: 'Huella peldaño superior',
      grupo: 'estructura',
      largo: W,
      ancho: dHuella,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, H - e, 0],
      tam: [W, e, dHuella],
    }),
    // Contrahuellas de refuerzo
    pieza({
      nombre: 'Contrahuella inferior',
      grupo: 'estructura',
      largo: interior,
      ancho: hPeldano1 - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, 0, D - e],
      tam: [interior, hPeldano1 - e, e],
    }),
    pieza({
      nombre: 'Contrahuella superior',
      grupo: 'estructura',
      largo: interior,
      ancho: H - e - hPeldano1,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, hPeldano1, dHuella - e],
      tam: [interior, H - e - hPeldano1, e],
    }),
  );

  return {
    piezas,
    detalle: { p: D, hLibre: H, espacios: [hPeldano1, H - hPeldano1], fracciones: [0.5, 0.5], yBase: 0 },
    advertencias: [],
    supuestos: [
      `Escalera / Banqueta de 2 peldaños (${W}×${H}×${D} mm): primer peldaño a ${hPeldano1} mm y segundo peldaño a ${H} mm.`,
    ],
  };
}


/* ---------------- 14. Nuevas Topologías Verificadas 1-a-1 (Álbumes Muebles y Muebles2) ---------------- */

function construirRepisaTetris({ W, H, D }) {
  const piezas = [
    pieza({ nombre: 'Base inferior marco', grupo: 'estructura', largo: W, ancho: D, tapacanto: { largo: 2, ancho: 2 }, pos: [0, 0, 0], tam: [W, e, D] }),
    pieza({ nombre: 'Cubierta superior marco', grupo: 'estructura', largo: W, ancho: D, tapacanto: { largo: 2, ancho: 2 }, pos: [0, H - e, 0], tam: [W, e, D] }),
    pieza({ nombre: 'Lateral izquierdo marco', grupo: 'estructura', largo: H - 2 * e, ancho: D, tapacanto: { largo: 2, ancho: 0 }, pos: [0, e, 0], tam: [e, H - 2 * e, D] }),
    pieza({ nombre: 'Lateral derecho marco', grupo: 'estructura', largo: H - 2 * e, ancho: D, tapacanto: { largo: 2, ancho: 0 }, pos: [W - e, e, 0], tam: [e, H - 2 * e, D] }),
  ];

  const x1 = mm(W * 0.36);
  const x2 = W - x1 - e;
  const y1 = mm(H * 0.36);
  const y2 = H - y1 - e;

  piezas.push(
    // 1. División vertical superior-izquierda (baja desde cubierta superior hasta y1 + e)
    pieza({
      nombre: 'División vertical interior',
      grupo: 'estructura',
      largo: H - e - (y1 + e),
      ancho: D,
      tapacanto: { largo: 2, ancho: 1 },
      pos: [x1, y1 + e, 0],
      tam: [e, H - e - (y1 + e), D],
    }),
    // 2. Repisa horizontal inferior-izquierda (desde lateral izquierdo hasta x2)
    pieza({
      nombre: 'Repisa interior asimétrica',
      grupo: 'repisa',
      largo: x2 - e,
      ancho: D,
      tapacanto: { largo: 2, ancho: 1 },
      pos: [e, y1, 0],
      tam: [x2 - e, e, D],
    }),
    // 3. División vertical inferior-derecha (sube desde base hasta y2)
    pieza({
      nombre: 'División vertical interior',
      grupo: 'estructura',
      largo: y2 - e,
      ancho: D,
      tapacanto: { largo: 2, ancho: 1 },
      pos: [x2, e, 0],
      tam: [e, y2 - e, D],
    }),
    // 4. Repisa horizontal superior-derecha (desde x1 + e hasta lateral derecho)
    pieza({
      nombre: 'Repisa interior asimétrica',
      grupo: 'repisa',
      largo: W - e - (x1 + e),
      ancho: D,
      tapacanto: { largo: 2, ancho: 1 },
      pos: [x1 + e, y2, 0],
      tam: [W - e - (x1 + e), e, D],
    }),
  );

  return {
    piezas,
    detalle: { p: D, hLibre: H - 2 * e, espacios: [y1 - e, y2 - y1, H - e - y2], fracciones: [0.36, 0.28, 0.36], yBase: 0 },
    advertencias: [],
    supuestos: [
      `Repisa mural cuadrada tipo molinete/Tetris de ${W}×${H}×${D} mm con 4 divisiones interiores entrelazadas de ${x2 - e} mm.`,
    ],
  };
}

function construirIslaAlero({ W, H, D }) {
  const piezas = [];
  const z0 = tf;
  const p = D - z0;
  const wCuerpo = mm(W * 0.655);
  const x0 = W - wCuerpo;
  const wInt = wCuerpo - 2 * e;
  const yBase = 55;
  const hLat = H - e;
  const yNicho = mm(hLat * 0.68);
  const hPuertaZona = yNicho - (yBase + e);

  piezas.push(
    // Cubierta superior completa con alero izquierdo
    pieza({
      nombre: 'Cubierta superior con alero',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, H - e, 0],
      tam: [W, e, D],
    }),
    // Faldón soporte bajo el alero izquierdo
    pieza({
      nombre: 'Soporte bajo alero',
      grupo: 'estructura',
      largo: x0,
      ancho: 70,
      tapacanto: { largo: 1, ancho: 1 },
      pos: [0, H - e - 70, z0],
      tam: [x0, 70, e],
    }),
    // Laterales del gabinete derecho
    pieza({
      nombre: 'Lateral gabinete',
      grupo: 'estructura',
      largo: hLat,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [x0, 0, z0],
      tam: [e, hLat, p],
    }),
    pieza({
      nombre: 'Lateral gabinete',
      grupo: 'estructura',
      largo: hLat,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [W - e, 0, z0],
      tam: [e, hLat, p],
    }),
    // Base inferior + zócalo frontal + repisa nicho superior + repisa interna
    pieza({
      nombre: 'Base gabinete',
      grupo: 'estructura',
      largo: wInt,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [x0 + e, yBase, z0],
      tam: [wInt, e, p],
    }),
    pieza({
      nombre: 'Zócalo frontal',
      grupo: 'estructura',
      largo: wInt,
      ancho: yBase,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [x0 + e, 0, z0 + p - e],
      tam: [wInt, yBase, e],
    }),
    pieza({
      nombre: 'Bandeja nicho abierto superior',
      grupo: 'repisa',
      largo: wInt,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [x0 + e, yNicho, z0],
      tam: [wInt, e, p],
    }),
    pieza({
      nombre: 'Repisa interior gabinete',
      grupo: 'repisa',
      largo: wInt,
      ancho: p - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [x0 + e, yBase + e + mm(hPuertaZona * 0.48), z0],
      tam: [wInt, e, p - e],
    }),
  );

  // 2 Puertas batientes en la parte inferior del cuerpo derecho
  const wPuerta = mm((wInt - s) / 2);
  const hPuerta = hPuertaZona - s;
  for (let c = 0; c < 2; c++) {
    piezas.push(
      pieza({
        nombre: 'Puerta batiente inferior',
        grupo: 'puerta',
        largo: hPuerta,
        ancho: wPuerta,
        tapacanto: { largo: 2, ancho: 2 },
        pos: [x0 + e + c * (wPuerta + s), yBase + e, z0 + p - e],
        tam: [wPuerta, hPuerta, e],
      }),
    );
  }

  // Fondo trasero solo detrás del gabinete derecho
  piezas.push(
    pieza({
      nombre: 'Fondo trasero gabinete',
      grupo: 'fondo',
      largo: hLat - yBase,
      ancho: wCuerpo,
      espesor: tf,
      material: MATERIAL.FONDO,
      pos: [x0, yBase, 0],
      tam: [wCuerpo, hLat - yBase, tf],
    }),
  );

  return {
    piezas,
    detalle: { p, hLibre: hLat - yBase, espacios: [hPuertaZona, hLat - yNicho - e], fracciones: [0.68, 0.32], yBase },
    advertencias: [],
    supuestos: [
      `Mueble isla auxiliar de ${W}×${H}×${D} mm con cubierta superior en voladizo izquierdo (${x0} mm libres) y cuerpo derecho de ${wCuerpo} mm con nicho abierto superior y 2 puertas inferiores.`,
    ],
  };
}

function construirEscritorioPedestalIzq({ W, H, D }) {
  const piezas = [];
  const wPed = mm(W * 0.393); // 472 mm para W=1200
  const hCuerpo = H - e;
  const wIntPed = wPed - 2 * e;
  const hNichoSup = Math.max(95, mm(H * 0.16));
  const yTechoCajones = hCuerpo - hNichoSup - e;

  piezas.push(
    // Cubierta principal corrida
    pieza({
      nombre: 'Cubierta de escritorio',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, H - e, 0],
      tam: [W, e, D],
    }),
    // 2 laterales del pedestal izquierdo + base + bandeja divisoria bajo nicho abierto
    pieza({
      nombre: 'Lateral izquierdo pedestal',
      grupo: 'estructura',
      largo: hCuerpo,
      ancho: D,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [0, 0, 0],
      tam: [e, hCuerpo, D],
    }),
    pieza({
      nombre: 'Lateral interior pedestal',
      grupo: 'estructura',
      largo: hCuerpo,
      ancho: D,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [wPed - e, 0, 0],
      tam: [e, hCuerpo, D],
    }),
    pieza({
      nombre: 'Base inferior pedestal',
      grupo: 'estructura',
      largo: wIntPed,
      ancho: D - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, 0, 0],
      tam: [wIntPed, e, D - e],
    }),
    pieza({
      nombre: 'Bandeja nicho superior pedestal',
      grupo: 'repisa',
      largo: wIntPed,
      ancho: D,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, yTechoCajones, 0],
      tam: [wIntPed, e, D],
    }),
    // Costado derecho soporte + travesaño trasero
    pieza({
      nombre: 'Lateral soporte derecho',
      grupo: 'estructura',
      largo: hCuerpo,
      ancho: D,
      tapacanto: { largo: 1, ancho: 2 },
      pos: [W - e, 0, 0],
      tam: [e, hCuerpo, D],
    }),
    pieza({
      nombre: 'Faldón trasero de rigidez',
      grupo: 'estructura',
      largo: W - wPed - e,
      ancho: 160,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [wPed, H - e - 160, 0],
      tam: [W - wPed - e, 160, e],
    }),
  );

  // 3 Cajones proporcionales en el pedestal izquierdo: inferior alto (archivo 35,2 cm) + 2 superiores de 12 cm
  const hDispCaj = yTechoCajones - e;
  const fracs = [0.58, 0.21, 0.21];
  let yCur = e;
  for (let i = 0; i < 3; i++) {
    const hAct = i === 2 ? yTechoCajones - yCur : mm(hDispCaj * fracs[i]);
    piezas.push(
      pieza({
        nombre: i === 0 ? 'Frente cajón archivador' : 'Frente cajón superior',
        grupo: 'frente',
        largo: wIntPed - 2 * s,
        ancho: Math.max(55, hAct - s),
        tapacanto: { largo: 2, ancho: 2 },
        pos: [e + s, yCur, D - e],
        tam: [wIntPed - 2 * s, Math.max(55, hAct - s), e],
      }),
    );
    yCur += hAct;
  }

  return {
    piezas,
    detalle: { p: D, hLibre: hCuerpo, espacios: [yTechoCajones, hNichoSup], fracciones: [0.8, 0.2], yBase: 0 },
    advertencias: [],
    supuestos: [
      `Escritorio de ${W}×${H}×${D} mm con módulo pedestal a la IZQUIERDA (${wPed} mm: 1 cajón archivador inferior + 2 cajones + nicho abierto bajo cubierta) y vano libre derecho para silla.`,
    ],
  };
}

function construirMesaCentroNichos({ W, H, D }) {
  const piezas = [];
  const yBase = Math.max(110, mm(H * 0.30));
  const hNichoSup = Math.max(110, mm(H * 0.31));
  const yRepisaMed = H - e - hNichoSup - e;
  const hNichoInf = Math.max(40, yRepisaMed - (yBase + e));
  const wPataZ = Math.max(110, mm(D * 0.24));
  const xMid = mm((W - e) / 2);

  piezas.push(
    // Cubierta superior, repisa intermedia y plataforma base
    pieza({
      nombre: 'Cubierta superior',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, H - e, 0],
      tam: [W, e, D],
    }),
    pieza({
      nombre: 'Bandeja intermedia',
      grupo: 'repisa',
      largo: W - 2 * e,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [e, yRepisaMed, 0],
      tam: [W - 2 * e, e, D],
    }),
    pieza({
      nombre: 'Plataforma inferior',
      grupo: 'estructura',
      largo: W - 2 * e,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [e, yBase, 0],
      tam: [W - 2 * e, e, D],
    }),
    // Divisiones centrales verticales en ambos niveles de nichos
    pieza({
      nombre: 'División central superior',
      grupo: 'estructura',
      largo: hNichoSup,
      ancho: D,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [xMid, yRepisaMed + e, 0],
      tam: [e, hNichoSup, D],
    }),
    pieza({
      nombre: 'División central inferior',
      grupo: 'estructura',
      largo: hNichoInf,
      ancho: D,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [xMid, yBase + e, 0],
      tam: [e, hNichoInf, D],
    }),
  );

  // 4 Montantes anchos de esquina (de piso a cubierta) que dejan ventana lateral abierta
  for (const [px, pz] of [[0, 0], [W - e, 0], [0, D - wPataZ], [W - e, D - wPataZ]]) {
    piezas.push(
      pieza({
        nombre: 'Montante ancho de esquina',
        grupo: 'estructura',
        largo: H - e,
        ancho: wPataZ,
        tapacanto: { largo: 2, ancho: 1 },
        pos: [px, 0, pz],
        tam: [e, H - e, wPataZ],
      }),
    );
  }

  return {
    piezas,
    detalle: { p: D, hLibre: H - yBase, espacios: [hNichoInf, hNichoSup], fracciones: [0.5, 0.5], yBase },
    advertencias: [],
    supuestos: [
      `Mesa de centro arquitectónica de ${W}×${H}×${D} mm con montantes anchos de esquina (${wPataZ} mm), despeje inferior de ${yBase} mm y doble nivel de nichos abiertos.`,
    ],
  };
}

function construirMesonAlzada({ W, H, D }) {
  const piezas = [];
  const hMeson = mm(H * 0.385); // 750 mm cuando H = 1950
  const dAlzada = mm(D * 0.50); // 300 mm cuando D = 600 (mitad de profundidad)
  const yRepBaja = 100;
  const anchoPata = 75;

  // 1. Mesón de trabajo inferior (profundidad completa D, 4 patas de esquina + repisa inferior + faldón)
  piezas.push(
    pieza({
      nombre: 'Cubierta mesón de trabajo',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, hMeson - e, 0],
      tam: [W, e, D],
    }),
    pieza({
      nombre: 'Repisa inferior mesón',
      grupo: 'repisa',
      largo: W - 2 * e,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [e, yRepBaja, 0],
      tam: [W - 2 * e, e, D],
    }),
    pieza({
      nombre: 'Faldón frontal bajo mesón',
      grupo: 'estructura',
      largo: W - 2 * e,
      ancho: 65,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, hMeson - e - 65, D - e],
      tam: [W - 2 * e, 65, e],
    }),
  );

  for (const [px, pz] of [[0, 0], [W - e, 0], [0, D - anchoPata], [W - e, D - anchoPata]]) {
    piezas.push(
      pieza({
        nombre: 'Pata mesón de trabajo',
        grupo: 'estructura',
        largo: hMeson - e,
        ancho: anchoPata,
        tapacanto: { largo: 2, ancho: 1 },
        pos: [px, 0, pz],
        tam: [e, hMeson - e, anchoPata],
      }),
    );
  }

  // 2. Alzada superior de mitad de profundidad (dAlzada): vano libre inferior de 60 cm + cuerpo superior de 3 columnas (laterales con repisa media)
  const hAlzada = H - e - hMeson;
  const yRepMediaAlzada = hMeson + mm(hAlzada * 0.50); // 60 cm sobre el mesón
  const hZonaSup = (H - e) - (yRepMediaAlzada + e);
  const wInt = W - 2 * e;
  const wCol = mm((wInt - 2 * e) / 3);
  const xDiv1 = e + wCol;
  const xDiv2 = e + 2 * wCol + e;
  const wColDer = W - e - (xDiv2 + e);
  const ySubRep = yRepMediaAlzada + e + mm((hZonaSup - e) / 2);

  piezas.push(
    pieza({
      nombre: 'Cubierta superior alzada',
      grupo: 'estructura',
      largo: W,
      ancho: dAlzada,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, H - e, 0],
      tam: [W, e, dAlzada],
    }),
    pieza({
      nombre: 'Lateral alzada superior',
      grupo: 'estructura',
      largo: hAlzada,
      ancho: dAlzada,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [0, hMeson, 0],
      tam: [e, hAlzada, dAlzada],
    }),
    pieza({
      nombre: 'Lateral alzada superior',
      grupo: 'estructura',
      largo: hAlzada,
      ancho: dAlzada,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [W - e, hMeson, 0],
      tam: [e, hAlzada, dAlzada],
    }),
    pieza({
      nombre: 'Repisa corrida alzada',
      grupo: 'repisa',
      largo: wInt,
      ancho: dAlzada,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [e, yRepMediaAlzada, 0],
      tam: [wInt, e, dAlzada],
    }),
    pieza({
      nombre: 'División vertical alzada',
      grupo: 'estructura',
      largo: hZonaSup,
      ancho: dAlzada,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xDiv1, yRepMediaAlzada + e, 0],
      tam: [e, hZonaSup, dAlzada],
    }),
    pieza({
      nombre: 'División vertical alzada',
      grupo: 'estructura',
      largo: hZonaSup,
      ancho: dAlzada,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xDiv2, yRepMediaAlzada + e, 0],
      tam: [e, hZonaSup, dAlzada],
    }),
    pieza({
      nombre: 'Sub-repisa izquierda alzada',
      grupo: 'repisa',
      largo: wCol,
      ancho: dAlzada,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, ySubRep, 0],
      tam: [wCol, e, dAlzada],
    }),
    pieza({
      nombre: 'Sub-repisa derecha alzada',
      grupo: 'repisa',
      largo: wColDer,
      ancho: dAlzada,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xDiv2 + e, ySubRep, 0],
      tam: [wColDer, e, dAlzada],
    }),
  );

  return {
    piezas,
    detalle: { p: D, hLibre: H - yRepBaja, espacios: [hMeson - yRepBaja, yRepMediaAlzada - hMeson, hZonaSup], fracciones: [0.38, 0.31, 0.31], yBase: yRepBaja },
    advertencias: [],
    supuestos: [
      `Estantería de trabajo con mesón inferior de ${W}×${hMeson}×${D} mm (4 patas y repisa base) y alzada superior retranqueada (${W}×${H - hMeson}×${dAlzada} mm) con vano libre de trabajo y 3 columnas superiores.`,
    ],
  };
}

function construirRackPuenteDerecho({ W, H, D }) {
  const piezas = [];
  const yBase = 25;
  const hBajo = mm(H * 0.656); // 315 mm cuando H = 480
  const hIntBajo = hBajo - e - (yBase + e);
  const wPuertaIzq = mm(W * 0.353); // 600 mm cuando W = 1700
  const wPuente = mm(W * 0.706); // 1200 mm cuando W = 1700
  const xPuente0 = W - wPuente; // 500 mm
  const hPuente = H - e - hBajo;

  piezas.push(
    // Base y cubierta del cuerpo inferior (largo total W)
    pieza({
      nombre: 'Base inferior rack',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, yBase, 0],
      tam: [W, e, D],
    }),
    pieza({
      nombre: 'Cubierta módulo inferior',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, hBajo - e, 0],
      tam: [W, e, D],
    }),
    // Laterales y divisiones del cuerpo inferior (1 puerta izquierda de 60 cm + 2 nichos abiertos derechos)
    pieza({
      nombre: 'Lateral izquierdo inferior',
      grupo: 'estructura',
      largo: hIntBajo,
      ancho: D,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [0, yBase + e, 0],
      tam: [e, hIntBajo, D],
    }),
    pieza({
      nombre: 'División puerta / nicho',
      grupo: 'estructura',
      largo: hIntBajo,
      ancho: D,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [wPuertaIzq, yBase + e, 0],
      tam: [e, hIntBajo, D],
    }),
    pieza({
      nombre: 'División central nichos',
      grupo: 'estructura',
      largo: hIntBajo,
      ancho: D,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [wPuertaIzq + mm((W - wPuertaIzq) * 0.5), yBase + e, 0],
      tam: [e, hIntBajo, D],
    }),
    pieza({
      nombre: 'Lateral derecho inferior',
      grupo: 'estructura',
      largo: hIntBajo,
      ancho: D,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [W - e, yBase + e, 0],
      tam: [e, hIntBajo, D],
    }),
    // Puerta abatible izquierda (60 cm)
    pieza({
      nombre: 'Puerta izquierda rack',
      grupo: 'puerta',
      largo: wPuertaIzq - e - 2 * s,
      ancho: hIntBajo - 2 * s,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [e + s, yBase + e + s, D - e],
      tam: [wPuertaIzq - e - 2 * s, hIntBajo - 2 * s, e],
    }),
    // Puente superior derecho en L (120 cm de ancho)
    pieza({
      nombre: 'Cubierta puente superior derecho',
      grupo: 'estructura',
      largo: wPuente,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [xPuente0, H - e, 0],
      tam: [wPuente, e, D],
    }),
    pieza({
      nombre: 'Soporte izquierdo puente',
      grupo: 'estructura',
      largo: hPuente,
      ancho: D,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xPuente0, hBajo, 0],
      tam: [e, hPuente, D],
    }),
    pieza({
      nombre: 'Lateral derecho puente',
      grupo: 'estructura',
      largo: hPuente,
      ancho: D,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [W - e, hBajo, 0],
      tam: [e, hPuente, D],
    }),
  );

  return {
    piezas,
    detalle: { p: D, hLibre: H - yBase, espacios: [hIntBajo, hPuente], fracciones: [0.65, 0.35], yBase },
    advertencias: [],
    supuestos: [
      `Rack TV escalonado de ${W}×${H}×${D} mm: módulo inferior de ${hBajo} mm con puerta izquierda (${wPuertaIzq} mm) y 2 nichos abiertos, más puente superior derecho de ${wPuente} mm.`,
    ],
  };
}

function construirRepisaEscalonada3({ W, H, D }) {
  const piezas = [];
  const wBan = mm(W * 0.672); // 800 mm cuando W = 1190
  const xDer0 = W - wBan; // 390 mm
  const hTope = Math.max(110, mm(H * 0.27)); // 150 mm
  const yMid = mm(H * 0.36); // 200 mm
  const yTop = H - hTope - e; // 382 mm

  piezas.push(
    // 1. Bandeja inferior (alineada a la DERECHA: xDer0 .. W) + tope derecho + conector izquierdo
    pieza({
      nombre: 'Bandeja horizontal inferior',
      grupo: 'repisa',
      largo: wBan,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [xDer0, 0, 0],
      tam: [wBan, e, D],
    }),
    pieza({
      nombre: 'Tope vertical inferior derecho',
      grupo: 'estructura',
      largo: hTope,
      ancho: D,
      tapacanto: { largo: 2, ancho: 1 },
      pos: [W - e, e, 0],
      tam: [e, hTope, D],
    }),
    pieza({
      nombre: 'Montante conector inferior-medio',
      grupo: 'estructura',
      largo: yMid - e,
      ancho: D,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [xDer0, e, 0],
      tam: [e, yMid - e, D],
    }),
    // 2. Bandeja central (alineada a la IZQUIERDA: 0 .. wBan) + tope izquierdo + conector derecho
    pieza({
      nombre: 'Bandeja horizontal central',
      grupo: 'repisa',
      largo: wBan,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, yMid, 0],
      tam: [wBan, e, D],
    }),
    pieza({
      nombre: 'Tope vertical central izquierdo',
      grupo: 'estructura',
      largo: hTope,
      ancho: D,
      tapacanto: { largo: 2, ancho: 1 },
      pos: [0, yMid + e, 0],
      tam: [e, hTope, D],
    }),
    pieza({
      nombre: 'Montante conector medio-superior',
      grupo: 'estructura',
      largo: yTop - (yMid + e),
      ancho: D,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [wBan - e, yMid + e, 0],
      tam: [e, yTop - (yMid + e), D],
    }),
    // 3. Bandeja superior (alineada a la DERECHA: xDer0 .. W) + topes verticales en ambos extremos
    pieza({
      nombre: 'Bandeja horizontal superior',
      grupo: 'repisa',
      largo: wBan,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [xDer0, yTop, 0],
      tam: [wBan, e, D],
    }),
    pieza({
      nombre: 'Tope vertical superior izquierdo',
      grupo: 'estructura',
      largo: H - (yTop + e),
      ancho: D,
      tapacanto: { largo: 2, ancho: 1 },
      pos: [xDer0, yTop + e, 0],
      tam: [e, H - (yTop + e), D],
    }),
    pieza({
      nombre: 'Tope vertical superior derecho',
      grupo: 'estructura',
      largo: H - (yTop + e),
      ancho: D,
      tapacanto: { largo: 2, ancho: 1 },
      pos: [W - e, yTop + e, 0],
      tam: [e, H - (yTop + e), D],
    }),
  );

  return {
    piezas,
    detalle: { p: D, hLibre: H, espacios: [yMid, yTop - yMid, H - yTop], fracciones: [0.36, 0.36, 0.28], yBase: 0 },
    advertencias: [],
    supuestos: [
      `Repisa mural escalonada de 3 bandejas horizontales de ${wBan}×${D} mm (ancho total ${W} mm, alto ${H} mm) con topes laterales de ${hTope} mm.`,
    ],
  };
}

function construirCocinaModular({ W, H, D }) {
  const piezas = [];
  const z0 = tf;
  const pBajo = D - z0;
  const yZoc = 100;
  const hBajo = mm(H * 0.405); // 850 mm cuando H = 2100
  const hIntBajo = hBajo - e - (yZoc + e);
  const wInt = W - 2 * e;

  // 1. Módulo bajo mesada (profundidad completa D = 524 mm, 4 cuerpos: 80cm + 60cm + 60cm + 40cm)
  piezas.push(
    pieza({
      nombre: 'Cubierta mesada cocina',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, hBajo - e, 0],
      tam: [W, e, D],
    }),
    pieza({
      nombre: 'Base módulo bajo cocina',
      grupo: 'estructura',
      largo: wInt,
      ancho: pBajo,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, yZoc, z0],
      tam: [wInt, e, pBajo],
    }),
    pieza({
      nombre: 'Zócalo inferior cocina',
      grupo: 'estructura',
      largo: wInt,
      ancho: yZoc,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, 0, z0 + pBajo - e],
      tam: [wInt, yZoc, e],
    }),
    pieza({
      nombre: 'Lateral bajo izquierdo',
      grupo: 'estructura',
      largo: hBajo - e,
      ancho: pBajo,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [0, 0, z0],
      tam: [e, hBajo - e, pBajo],
    }),
    pieza({
      nombre: 'Lateral bajo derecho',
      grupo: 'estructura',
      largo: hBajo - e,
      ancho: pBajo,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [W - e, 0, z0],
      tam: [e, hBajo - e, pBajo],
    }),
  );

  // 4 columnas inferiores proporcionales (80 : 60 : 60 : 40)
  const fracsCols = [80 / 240, 60 / 240, 60 / 240, 40 / 240];
  const wDispCols = wInt - 3 * e;
  let xCur = e;
  for (let c = 0; c < 4; c++) {
    const wCol = c === 3 ? (W - e - xCur) : mm(wDispCols * fracsCols[c]);
    if (c < 2) {
      // Módulos izquierdos con puertas batientes
      const nP = c === 0 ? 2 : 1;
      const wP = mm((wCol - (nP - 1) * s) / nP);
      for (let k = 0; k < nP; k++) {
        piezas.push(
          pieza({
            nombre: 'Puerta bajo mesada',
            grupo: 'puerta',
            largo: hIntBajo - 2 * s,
            ancho: wP - s,
            tapacanto: { largo: 2, ancho: 2 },
            pos: [xCur + k * (wP + s), yZoc + e + s, z0 + pBajo - e],
            tam: [wP - s, hIntBajo - 2 * s, e],
          }),
        );
      }
    } else if (c === 2) {
      // Módulo horno/cocina central (repisa abierta horno + cajón inferior)
      const hCajInf = mm(hIntBajo * 0.25);
      piezas.push(
        pieza({
          nombre: 'Bandeja soporte horno',
          grupo: 'repisa',
          largo: wCol,
          ancho: pBajo,
          tapacanto: { largo: 1, ancho: 0 },
          pos: [xCur, yZoc + e + hCajInf, z0],
          tam: [wCol, e, pBajo],
        }),
        pieza({
          nombre: 'Frente cajón bajo horno',
          grupo: 'frente',
          largo: wCol - 2 * s,
          ancho: hCajInf - s,
          tapacanto: { largo: 2, ancho: 2 },
          pos: [xCur + s, yZoc + e, z0 + pBajo - e],
          tam: [wCol - 2 * s, hCajInf - s, e],
        }),
      );
    } else {
      // Módulo derecho de 40 cm con 3 cajones
      const hCaj = mm(hIntBajo / 3);
      for (let r = 0; r < 3; r++) {
        const yC = yZoc + e + r * hCaj;
        const hA = r === 2 ? (yZoc + e + hIntBajo - yC) : hCaj;
        piezas.push(
          pieza({
            nombre: 'Frente cajón cocina',
            grupo: 'frente',
            largo: wCol - 2 * s,
            ancho: hA - s,
            tapacanto: { largo: 2, ancho: 2 },
            pos: [xCur + s, yC, z0 + pBajo - e],
            tam: [wCol - 2 * s, hA - s, e],
          }),
        );
      }
    }
    xCur += wCol;
    if (c < 3) {
      piezas.push(
        pieza({
          nombre: 'División vertical bajo mesada',
          grupo: 'estructura',
          largo: hIntBajo,
          ancho: pBajo - e,
          tapacanto: { largo: 1, ancho: 0 },
          pos: [xCur, yZoc + e, z0],
          tam: [e, hIntBajo, pBajo - e],
        }),
      );
      xCur += e;
    }
  }

  // 2. Alacena aérea superior (mitad de profundidad dSup = 288 mm, desde ySup0 hasta H)
  const dSup = mm(D * 0.55); // 288 mm cuando D = 524
  const pSup = dSup - z0;
  const hSup = mm(H * 0.343); // 720 mm cuando H = 2100
  const ySup0 = H - hSup;
  const hIntSup = hSup - 2 * e;

  piezas.push(
    pieza({
      nombre: 'Base alacena aérea',
      grupo: 'estructura',
      largo: wInt,
      ancho: pSup,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, ySup0, z0],
      tam: [wInt, e, pSup],
    }),
    pieza({
      nombre: 'Cubierta alacena aérea',
      grupo: 'estructura',
      largo: wInt,
      ancho: pSup,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, H - e, z0],
      tam: [wInt, e, pSup],
    }),
    pieza({
      nombre: 'Lateral alacena aérea',
      grupo: 'estructura',
      largo: hSup,
      ancho: pSup,
      tapacanto: { largo: 1, ancho: 2 },
      pos: [0, ySup0, z0],
      tam: [e, hSup, pSup],
    }),
    pieza({
      nombre: 'Lateral alacena aérea',
      grupo: 'estructura',
      largo: hSup,
      ancho: pSup,
      tapacanto: { largo: 1, ancho: 2 },
      pos: [W - e, ySup0, z0],
      tam: [e, hSup, pSup],
    }),
  );

  let xSup = e;
  for (let c = 0; c < 4; c++) {
    const wCol = c === 3 ? (W - e - xSup) : mm(wDispCols * fracsCols[c]);
    const hPuertaSup = c === 2 ? mm(hIntSup * 0.65) : hIntSup - 2 * s;
    const yPuertaSup = c === 2 ? (H - e - hPuertaSup) : (ySup0 + e + s);
    const nP = c === 0 ? 2 : 1;
    const wP = mm((wCol - (nP - 1) * s) / nP);
    for (let k = 0; k < nP; k++) {
      piezas.push(
        pieza({
          nombre: 'Puerta alacena aérea',
          grupo: 'puerta',
          largo: hPuertaSup,
          ancho: wP - s,
          tapacanto: { largo: 2, ancho: 2 },
          pos: [xSup + k * (wP + s), yPuertaSup, z0 + pSup - e],
          tam: [wP - s, hPuertaSup, e],
        }),
      );
    }
    xSup += wCol;
    if (c < 3) {
      piezas.push(
        pieza({
          nombre: 'División vertical alacena',
          grupo: 'estructura',
          largo: hIntSup,
          ancho: pSup - e,
          tapacanto: { largo: 1, ancho: 0 },
          pos: [xSup, ySup0 + e, z0],
          tam: [e, hIntSup, pSup - e],
        }),
      );
      xSup += e;
    }
  }

  return {
    piezas,
    detalle: { p: pBajo, hLibre: H - yZoc, espacios: [hBajo - yZoc, ySup0 - hBajo, hSup], fracciones: [0.38, 0.27, 0.35], yBase: yZoc },
    advertencias: [],
    supuestos: [
      `Cocina modular de ${W}×${H}×${D} mm: bajo mesada de 4 módulos (${hBajo}×${D} mm con puertas, nicho de horno y cajonera), espacio central libre sobre mesada y alacena aérea superior de ${hSup}×${dSup} mm.`,
    ],
  };
}

function construirClosetAbierto2Col({ W, H, D, alturaPatasMm = 85, tieneFondo = true }) {
  const z0 = tieneFondo ? tf : 0;
  const p = D - z0;
  const yBase = Math.max(50, mm(alturaPatasMm || 85));
  const hMaletero = Math.max(240, mm(H * 0.15)); // 300 mm cuando H = 2000
  const yMaletero = H - e - hMaletero - e;
  const hCuerpo = yMaletero - (yBase + e);
  const wInt = W - 2 * e;
  const wColIzq = mm((wInt - e) * 0.498);
  const xDiv = e + wColIzq;
  const wColDer = W - e - (xDiv + e);

  const piezas = [
    ...carcasa(W, H, p, z0, yBase),
    // Zócalo frontal
    pieza({
      nombre: 'Zócalo frontal',
      grupo: 'estructura',
      largo: wInt,
      ancho: yBase,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, 0, z0 + p - e],
      tam: [wInt, yBase, e],
    }),
    // Repisa horizontal maletero superior + división central del maletero
    pieza({
      nombre: 'Repisa maletero superior',
      grupo: 'repisa',
      largo: wInt,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, yMaletero, z0],
      tam: [wInt, e, p],
    }),
    pieza({
      nombre: 'División vertical maletero',
      grupo: 'estructura',
      largo: hMaletero,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xDiv, yMaletero + e, z0],
      tam: [e, hMaletero, p],
    }),
    // División vertical maestra entre columna de repisas (izq) y colgado alto (der)
    pieza({
      nombre: 'División central clóset',
      grupo: 'estructura',
      largo: hCuerpo,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xDiv, yBase + e, z0],
      tam: [e, hCuerpo, p],
    }),
    // Barra de colgar en el vano alto derecho (148 cm libres)
    pieza({
      nombre: 'Barra de colgar ropa',
      grupo: 'estructura',
      largo: wColDer,
      ancho: 25,
      tapacanto: { largo: 0, ancho: 0 },
      pos: [xDiv + e, yMaletero - 75, z0 + mm(p * 0.48)],
      tam: [wColDer, 25, 25],
    }),
  ];

  // 3 Repisas horizontales EXCLUSIVAS de la columna izquierda (forman 4 nichos de ~35,7 cm)
  const hNichoIzq = mm((hCuerpo - 3 * e) / 4);
  for (let r = 1; r <= 3; r++) {
    const yRep = yBase + e + r * hNichoIzq + (r - 1) * e;
    piezas.push(
      pieza({
        nombre: 'Repisa columna izquierda',
        grupo: 'repisa',
        largo: wColIzq,
        ancho: p,
        tapacanto: { largo: 1, ancho: 0 },
        pos: [e, yRep, z0],
        tam: [wColIzq, e, p],
      }),
    );
  }

  if (tieneFondo) {
    piezas.push(fondo(W, H, yBase));
  }

  return {
    piezas,
    detalle: { p, hLibre: H - yBase, espacios: [hCuerpo, hMaletero], fracciones: [0.83, 0.17], yBase },
    advertencias: [],
    supuestos: [
      `Clóset organizador abierto de ${W}×${H}×${D} mm con zócalo de ${yBase} mm, columna izquierda con 4 espacios de repisas (${wColIzq} mm), columna derecha de colgado alto (${hCuerpo} mm) y maletero superior de ${hMaletero} mm.`,
    ],
  };
}

function construirEstanteCubosEscalonado({ W, H, D }) {
  const piezas = [];
  const y1 = mm(H * 0.34); // 255 mm
  const y2 = mm(H * 0.67); // 502 mm
  const xEscDer = mm(W * 0.84); // 1008 mm
  const xEscIzq = mm(W * 0.15); // 180 mm

  piezas.push(
    // Tableros horizontales escalonados (sin puertas ni cajones)
    pieza({
      nombre: 'Base inferior escalonada',
      grupo: 'estructura',
      largo: xEscDer,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, 0, 0],
      tam: [xEscDer, e, D],
    }),
    pieza({
      nombre: 'Bandeja intermedia principal',
      grupo: 'repisa',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, y1, 0],
      tam: [W, e, D],
    }),
    pieza({
      nombre: 'Bandeja nivel medio-alto',
      grupo: 'repisa',
      largo: W - xEscIzq,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [xEscIzq, y2, 0],
      tam: [W - xEscIzq, e, D],
    }),
    pieza({
      nombre: 'Cubierta superior escalonada',
      grupo: 'estructura',
      largo: xEscDer - xEscIzq,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [xEscIzq, H - e, 0],
      tam: [xEscDer - xEscIzq, e, D],
    }),
  );

  // Montantes verticales del Nivel 1 (y = e .. y1)
  for (const xPos of [0, mm(W * 0.28), mm(W * 0.56), xEscDer - e]) {
    piezas.push(
      pieza({
        nombre: 'División vertical nivel 1',
        grupo: 'estructura',
        largo: y1 - e,
        ancho: D,
        tapacanto: { largo: 2, ancho: 0 },
        pos: [xPos, e, 0],
        tam: [e, y1 - e, D],
      }),
    );
  }

  // Montantes verticales del Nivel 2 (y = y1 + e .. y2)
  for (const xPos of [0, xEscIzq, mm(W * 0.46), mm(W * 0.74), W - e]) {
    const hMont = xPos === 0 ? mm((y2 - y1) * 0.65) : y2 - (y1 + e);
    piezas.push(
      pieza({
        nombre: 'División vertical nivel 2',
        grupo: 'estructura',
        largo: hMont,
        ancho: D,
        tapacanto: { largo: 2, ancho: 0 },
        pos: [xPos, y1 + e, 0],
        tam: [e, hMont, D],
      }),
    );
  }

  // Montantes verticales del Nivel 3 (y = y2 + e .. H - e)
  for (const xPos of [xEscIzq, mm(W * 0.50), xEscDer - e]) {
    piezas.push(
      pieza({
        nombre: 'División vertical nivel 3',
        grupo: 'estructura',
        largo: H - e - (y2 + e),
        ancho: D,
        tapacanto: { largo: 2, ancho: 0 },
        pos: [xPos, y2 + e, 0],
        tam: [e, H - e - (y2 + e), D],
      }),
    );
  }

  return {
    piezas,
    detalle: { p: D, hLibre: H - 2 * e, espacios: [y1 - e, y2 - y1 - e, H - e - y2 - e], fracciones: [0.34, 0.33, 0.33], yBase: 0 },
    advertencias: [],
    supuestos: [
      `Estante / Rack geométrico abierto de cubos entrelazados (${W}×${H}×${D} mm) en 3 niveles escalonados sin puertas ni cajones.`,
    ],
  };
}

function construirMesaCentroDoble({ W, H, D }) {
  const piezas = [];
  const hZoc = 25;
  const hEscalon = Math.max(85, mm(H * 0.23)); // 104 mm (10 cm en plano)
  const yEscalon = hZoc + e + hEscalon;
  const wEscalon = mm(W * 0.78);
  const hPilar = H - e - (yEscalon + e);
  const wCajaCentral = mm(W * 0.48); // 576 mm (~60 cm en plano)
  const xCaja0 = mm((W - wCajaCentral) * 0.45);
  const dCaja = mm(D * 0.74);
  const zCaja0 = mm((D - dCaja) / 2);

  piezas.push(
    // Placa base inferior completa (120 × 70 cm)
    pieza({
      nombre: 'Placa base inferior',
      grupo: 'estructura',
      largo: W,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, hZoc, 0],
      tam: [W, e, D],
    }),
    // Escalón intermedio de 10 cm de alto (bandeja en C izquierda)
    pieza({
      nombre: 'Costado izquierdo escalón',
      grupo: 'estructura',
      largo: hEscalon,
      ancho: D,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [0, hZoc + e, 0],
      tam: [e, hEscalon, D],
    }),
    pieza({
      nombre: 'Costado derecho escalón',
      grupo: 'estructura',
      largo: hEscalon,
      ancho: D,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [wEscalon - e, hZoc + e, 0],
      tam: [e, hEscalon, D],
    }),
    pieza({
      nombre: 'Bandeja escalonada intermedia',
      grupo: 'repisa',
      largo: wEscalon,
      ancho: D,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [0, yEscalon, 0],
      tam: [wEscalon, e, D],
    }),
    // Pedestal / bloque central de 60 cm que sostiene la cubierta superior
    pieza({
      nombre: 'Pilar bloque central izquierdo',
      grupo: 'estructura',
      largo: hPilar,
      ancho: dCaja,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [xCaja0, yEscalon + e, zCaja0],
      tam: [e, hPilar, dCaja],
    }),
    pieza({
      nombre: 'Pilar bloque central derecho',
      grupo: 'estructura',
      largo: hPilar,
      ancho: dCaja,
      tapacanto: { largo: 2, ancho: 0 },
      pos: [xCaja0 + wCajaCentral - e, yEscalon + e, zCaja0],
      tam: [e, hPilar, dCaja],
    }),
    pieza({
      nombre: 'Frente bloque central',
      grupo: 'estructura',
      largo: wCajaCentral - 2 * e,
      ancho: hPilar,
      tapacanto: { largo: 0, ancho: 2 },
      pos: [xCaja0 + e, yEscalon + e, zCaja0 + dCaja - e],
      tam: [wCajaCentral - 2 * e, hPilar, e],
    }),
    // Cubierta superior principal (120 × 70 cm)
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
    detalle: { p: D, hLibre: hPilar, espacios: [hEscalon, hPilar], fracciones: [0.3, 0.7], yBase: hZoc },
    advertencias: [],
    supuestos: [
      `Mesa de centro moderna de 2 niveles (${W}×${H}×${D} mm): placa base inferior, bandeja escalonada de ${hEscalon} mm y cubierta superior sostenida por bloque central de ${wCajaCentral} mm.`,
    ],
  };
}

function construirOrganizador2ColMixto({ W, H, D, alturaPatasMm = 50, tieneFondo = true }) {
  const z0 = tieneFondo ? tf : 0;
  const p = D - z0;
  const yBase = Math.max(40, mm(alturaPatasMm || 50));
  const hCuerpo = H - e - (yBase + e);
  const wInt = W - 2 * e;
  // Columna izquierda abierta de 67 cm (~61,5%) y columna derecha de 42 cm (~38,5%)
  const wIzq = mm((wInt - e) * 0.615);
  const xDiv = e + wIzq;
  const wDer = W - e - (xDiv + e);

  const piezas = [
    ...carcasa(W, H, p, z0, yBase),
    pieza({
      nombre: 'Zócalo frontal',
      grupo: 'estructura',
      largo: wInt,
      ancho: yBase,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, 0, z0 + p - e],
      tam: [wInt, yBase, e],
    }),
    // División vertical maestra entre columna izquierda (repisas) y derecha (cajón + puerta)
    pieza({
      nombre: 'División vertical maestra',
      grupo: 'estructura',
      largo: hCuerpo,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xDiv, yBase + e, z0],
      tam: [e, hCuerpo, p],
    }),
  ];

  // COLUMNA IZQUIERDA (67 cm): 2 nichos inferiores subdivididos (33,5 cm de alto) + 2 repisas abiertas superiores
  const hBajoIzq = mm(hCuerpo * 0.42);
  const yRepIzq1 = yBase + e + hBajoIzq;
  const hRestoIzq = (H - e) - (yRepIzq1 + e);
  const hMedioIzq = mm((hRestoIzq - e) / 2);
  const yRepIzq2 = yRepIzq1 + e + hMedioIzq;

  piezas.push(
    pieza({
      nombre: 'División vertical inferior izquierda',
      grupo: 'estructura',
      largo: hBajoIzq,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e + mm((wIzq - e) / 2), yBase + e, z0],
      tam: [e, hBajoIzq, p],
    }),
    pieza({
      nombre: 'Repisa izquierda nivel 1',
      grupo: 'repisa',
      largo: wIzq,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, yRepIzq1, z0],
      tam: [wIzq, e, p],
    }),
    pieza({
      nombre: 'Repisa izquierda nivel 2',
      grupo: 'repisa',
      largo: wIzq,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [e, yRepIzq2, z0],
      tam: [wIzq, e, p],
    }),
  );

  // COLUMNA DERECHA (42 cm): 1 puerta alta abajo (67 cm) + 1 cajón superior
  const hPuertaDer = mm(hCuerpo * 0.79);
  const yDivDer = yBase + e + hPuertaDer;
  const hCajonDer = (H - e) - (yDivDer + e);

  piezas.push(
    pieza({
      nombre: 'Repisa interior puerta derecha',
      grupo: 'repisa',
      largo: wDer,
      ancho: p - e,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xDiv + e, yBase + e + mm(hPuertaDer * 0.5), z0],
      tam: [wDer, e, p - e],
    }),
    pieza({
      nombre: 'Puerta batiente derecha',
      grupo: 'puerta',
      largo: hPuertaDer - 2 * s,
      ancho: wDer - 2 * s,
      tapacanto: { largo: 2, ancho: 2 },
      pos: [xDiv + e + s, yBase + e + s, z0 + p - e],
      tam: [wDer - 2 * s, hPuertaDer - 2 * s, e],
    }),
    pieza({
      nombre: 'Separador cajón / puerta',
      grupo: 'repisa',
      largo: wDer,
      ancho: p,
      tapacanto: { largo: 1, ancho: 0 },
      pos: [xDiv + e, yDivDer, z0],
      tam: [wDer, e, p],
    }),
    pieza({
      nombre: 'Frente cajón superior derecho',
      grupo: 'frente',
      largo: wDer - 2 * s,
      ancho: Math.max(55, hCajonDer - 2 * s),
      tapacanto: { largo: 2, ancho: 2 },
      pos: [xDiv + e + s, yDivDer + e + s, z0 + p - e],
      tam: [wDer - 2 * s, Math.max(55, hCajonDer - 2 * s), e],
    }),
  );

  if (tieneFondo) {
    piezas.push(fondo(W, H, yBase));
  }

  return {
    piezas,
    detalle: { p, hLibre: hCuerpo, espacios: [hBajoIzq, hMedioIzq, hCajonDer], fracciones: [0.42, 0.29, 0.29], yBase },
    advertencias: [],
    supuestos: [
      `Mueble organizador asimétrico de 2 columnas (${W}×${H}×${D} mm): columna izquierda abierta (${wIzq} mm) con 2 repisas superiores y 2 compartimentos inferiores subdivididos; columna derecha (${wDer} mm) con cajón superior y puerta alta inferior.`,
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
  if (subtipo === 'mesa_con_repisa') return construirMesaConRepisa({ W, H, D });
  if (subtipo === 'taburete') return construirTaburete({ W, H, D });
  if (subtipo === 'escritorio_pedestal') return construirEscritorioPedestal({ W, H, D, secciones });
  if (subtipo === 'silla_respaldo') return construirSillaRespaldo({ W, H, D });
  if (subtipo === 'escalera_2_peldanos') return construirEscaleraPeldanos({ W, H, D });
  if (subtipo === 'repisa_tetris') return construirRepisaTetris({ W, H, D });
  if (subtipo === 'isla_alero') return construirIslaAlero({ W, H, D });
  if (subtipo === 'escritorio_pedestal_izq') return construirEscritorioPedestalIzq({ W, H, D });
  if (subtipo === 'mesa_centro_nichos') return construirMesaCentroNichos({ W, H, D });
  if (subtipo === 'meson_alzada') return construirMesonAlzada({ W, H, D });
  if (subtipo === 'cocina_modular') return construirCocinaModular({ W, H, D });
  if (subtipo === 'rack_puente_derecho') return construirRackPuenteDerecho({ W, H, D });
  if (subtipo === 'repisa_escalonada_3') return construirRepisaEscalonada3({ W, H, D });
  if (subtipo === 'closet_abierto_2col') return construirClosetAbierto2Col({ W, H, D, alturaPatasMm, tieneFondo });
  if (subtipo === 'estante_cubos_escalonado') return construirEstanteCubosEscalonado({ W, H, D });
  if (subtipo === 'mesa_centro_doble') return construirMesaCentroDoble({ W, H, D });
  if (subtipo === 'organizador_2col_mixto') return construirOrganizador2ColMixto({ W, H, D, alturaPatasMm, tieneFondo });
  if (subtipo === 'grilla_columnas' || (Array.isArray(secciones?.columnasDetalle) && secciones.columnasDetalle.length > 0)) {
    return construirGrillaColumnas({
      W, H, D,
      columnasDetalle: secciones?.columnasDetalle || [
        { proporcionAncho: 1, celdas: ['hueco'] },
        { proporcionAncho: 1.4, abiertoArriba: true, celdas: ['hueco', 'hueco'] },
        { proporcionAncho: 1, celdas: ['hueco'] },
      ],
      zocaloInferior: secciones?.zocaloInferior || (alturaPatasMm > 0 ? 'retraido' : 'ninguno'),
      cubiertaSuperior: secciones?.cubiertaSuperior || 'directa',
      alturaPatasMm,
      tieneFondo,
    });
  }

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
        } else if (subtipo === 'intercalado' && cols === 3) {
          const f = idx % 2 === 0
            ? (c === 1 ? 0.35 : 0.65)
            : (c === 1 ? 0.19 : 0.81);
          xDiv = e + mm((interior - 2 * e) * f) + (c - 1) * e;
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
