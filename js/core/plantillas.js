/**
 * Plantillas paramétricas de muebles.
 *
 * Cada plantilla recibe las medidas reales del espacio (mm) y devuelve la lista
 * de piezas. Cada pieza trae:
 *   - largo × ancho × espesor (la medida de corte)
 *   - qué bordes llevan tapacanto
 *   - su vector posición p = (x, y, z) y su tamaño en 3D
 *
 * Sistema de coordenadas: x = ancho (izq → der), y = alto (abajo → arriba),
 * z = profundidad (atrás → adelante). El origen es la esquina trasera inferior
 * izquierda del mueble.
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

/** Redondea hacia abajo a mm enteros (para que la pieza siempre quepa). */
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

/** Laterales, base y techo. p = profundidad de las piezas, z0 = donde empiezan. */
function carcasa(W, H, p, z0) {
  const interior = W - 2 * e; // f(W) = W − 2e
  return [
    pieza({ nombre: 'Lateral', grupo: 'estructura', largo: H, ancho: p,
      tapacanto: { largo: 1, ancho: 0 }, pos: [0, 0, z0], tam: [e, H, p] }),
    pieza({ nombre: 'Lateral', grupo: 'estructura', largo: H, ancho: p,
      tapacanto: { largo: 1, ancho: 0 }, pos: [W - e, 0, z0], tam: [e, H, p] }),
    pieza({ nombre: 'Base', grupo: 'estructura', largo: interior, ancho: p,
      tapacanto: { largo: 1, ancho: 0 }, pos: [e, 0, z0], tam: [interior, e, p] }),
    pieza({ nombre: 'Techo', grupo: 'estructura', largo: interior, ancho: p,
      tapacanto: { largo: 1, ancho: 0 }, pos: [e, H - e, z0], tam: [interior, e, p] }),
  ];
}

/**
 * Repisas interiores. La altura libre se reparte según las proporciones:
 *   H_libre = H − (n + 2)·e
 *   hᵢ = fᵢ · H_libre            (escalamiento lineal)
 */
function repisas(W, H, p, z0, n, proporciones) {
  const hLibre = H - (n + 2) * e;
  if (hLibre <= 0) throw new Error('No caben tantas repisas en esa altura.');
  const fracciones = normalizarProporciones(proporciones, n + 1);
  const espacios = escalarProporciones(fracciones, hLibre);
  const interior = W - 2 * e;
  const lista = [];
  let y = e; // sobre la base
  for (let j = 0; j < n; j++) {
    y += espacios[j];
    lista.push(pieza({ nombre: 'Repisa', grupo: 'repisa', largo: interior, ancho: p,
      tapacanto: { largo: 1, ancho: 0 }, pos: [e, y, z0], tam: [interior, e, p] }));
    y += e;
  }
  return { lista, espacios, hLibre, fracciones };
}

function fondo(W, H) {
  return pieza({ nombre: 'Fondo', grupo: 'fondo', largo: H, ancho: W, espesor: tf,
    material: MATERIAL.FONDO, pos: [0, 0, 0], tam: [W, H, tf] });
}

function advertenciasRepisas(W, espacios) {
  const avisos = [];
  if (W - 2 * e > LUZ_MAX_REPISA) {
    avisos.push(`Las repisas miden más de ${LUZ_MAX_REPISA} mm sin apoyo y pueden curvarse: considera una división vertical.`);
  }
  if (espacios.some((h) => h < 150)) {
    avisos.push('Hay espacios de menos de 150 mm de alto: revisa el número de repisas.');
  }
  return avisos;
}

/* ------------------------------------------------------------------------ */

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
  const p = D - tf - e; // las puertas ocupan e mm al frente
  if (p < 100) throw new Error('La profundidad es muy pequeña para un mueble con puertas.');
  const r = repisas(W, H, p, tf, n, proporciones);

  // Puertas que cubren el frente completo:
  //   alto = H − 2g ;  ancho = (W − 2g − s·(np − 1)) / np
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
  // Largo de corredera: múltiplo de 50 mm que quepa, entre 250 y 600 mm.
  const largoCaja = Math.min(600, Math.floor((p - 10) / 50) * 50);
  if (largoCaja < 250) throw new Error('La profundidad es muy pequeña para correderas de cajón (mínimo 250 mm).');

  // Frentes:  alto_total = H − 2g − s·(k − 1);  altoᵢ = fᵢ · alto_total
  const altoTotal = H - 2 * g - s * (k - 1);
  const fracciones = normalizarProporciones(proporciones, k);
  const altos = escalarProporciones(fracciones, altoTotal).map(mm);
  if (altos.some((a) => a < 100)) throw new Error('Algún frente de cajón queda bajo 100 mm: usa menos cajones.');
  const anchoFrente = W - 2 * g;
  const anchoCaja = W - 2 * e - 2 * CORREDERA;

  const piezas = [...carcasa(W, H, p, tf)];
  let y = g;
  altos.forEach((alto, i) => {
    piezas.push(pieza({ nombre: 'Frente de cajón', grupo: 'frente', largo: anchoFrente, ancho: alto,
      tapacanto: { largo: 2, ancho: 2 }, pos: [g, y, tf + p], tam: [anchoFrente, alto, e] }));
    const hc = alto - 40; // alto de la caja interior
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

export const PLANTILLAS = Object.freeze({
  librero: { nombre: 'Librero / repisa abierta', generar: librero, proporcionesDe: 'espacios entre repisas' },
  mueble_puertas: { nombre: 'Mueble con puertas', generar: mueblePuertas, proporcionesDe: 'espacios entre repisas' },
  cajonera: { nombre: 'Cajonera', generar: cajonera, proporcionesDe: 'frentes de cajón' },
});

/** Punto de entrada: valida y genera el mueble. Lanza Error con mensaje claro. */
export function generarMueble(tipo, params) {
  const plantilla = PLANTILLAS[tipo];
  if (!plantilla) throw new Error(`Tipo de mueble desconocido: ${tipo}`);
  const errores = validarMedidas(params);
  if (errores.length) throw new Error(errores.join(' '));
  return { tipo, params, ...plantilla.generar(params) };
}
