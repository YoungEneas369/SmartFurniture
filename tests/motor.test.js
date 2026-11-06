import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generarMueble } from '../js/core/plantillas.js';
import { matrizDespiece, piezasParaCorte } from '../js/core/despiece.js';
import { optimizarCorte } from '../js/core/corte.js';
import { resumen, tapacantoTotal, areaUtil } from '../js/core/calculos.js';
import { normalizarProporciones, parsearProporciones, compararForma, factorEscala } from '../js/core/escala.js';
import { calcularProyecto } from '../js/core/sistema.js';
import { MATERIAL } from '../js/core/constantes.js';

/* ---------------- Escalamiento ---------------- */

test('normalizar proporciones: suman 1 y respetan la razón', () => {
  const f = normalizarProporciones([1, 1, 2], 3);
  assert.deepEqual(f, [0.25, 0.25, 0.5]);
  assert.deepEqual(normalizarProporciones([], 4), [0.25, 0.25, 0.25, 0.25]);
});

test('normalizar proporciones: rechaza cantidad incorrecta o valores no positivos', () => {
  assert.throws(() => normalizarProporciones([1, 2], 3));
  assert.throws(() => normalizarProporciones([1, 0, 2], 3));
});

test('parsear proporciones desde texto', () => {
  assert.deepEqual(parsearProporciones('1, 1.5 ;2'), [1, 1.5, 2]);
  assert.deepEqual(parsearProporciones('  '), []);
});

test('factor de escala y comparación de forma', () => {
  assert.equal(factorEscala(1600, 800), 2);
  assert.equal(compararForma(0.5, 800, 1600).advertir, false);
  assert.equal(compararForma(0.5, 1600, 800).advertir, true);
});

/* ---------------- Plantillas ---------------- */

test('librero 800×1800×300 con 4 repisas: medidas correctas', () => {
  const m = generarMueble('librero', { ancho: 800, alto: 1800, profundidad: 300, repisas: 4 });
  const laterales = m.piezas.filter((p) => p.nombre === 'Lateral');
  const repisas = m.piezas.filter((p) => p.nombre === 'Repisa');
  assert.equal(laterales.length, 2);
  assert.equal(repisas.length, 4);
  // p = D − 3 = 297 ; f(W) = W − 2e = 764
  assert.deepEqual([laterales[0].largo, laterales[0].ancho], [1800, 297]);
  assert.deepEqual([repisas[0].largo, repisas[0].ancho], [764, 297]);
  // H_libre = 1800 − 6·18 = 1692 ; h = 1692 / 5 = 338.4
  assert.equal(m.detalle.hLibre, 1692);
  m.detalle.espacios.forEach((h) => assert.ok(Math.abs(h - 338.4) < 1e-9));
  // Fondo
  const fondo = m.piezas.find((p) => p.nombre === 'Fondo');
  assert.equal(fondo.material, MATERIAL.FONDO);
  assert.deepEqual([fondo.largo, fondo.ancho], [1800, 800]);
});

test('las piezas en 3D no se salen del volumen W×H×D ni se superponen', () => {
  const casos = [
    ['librero', { ancho: 900, alto: 2000, profundidad: 350, repisas: 5 }],
    ['mueble_puertas', { ancho: 800, alto: 850, profundidad: 560, repisas: 1, puertas: 2 }],
    ['cajonera', { ancho: 500, alto: 700, profundidad: 450, cajones: 4 }],
  ];
  for (const [tipo, params] of casos) {
    const { piezas } = generarMueble(tipo, params);
    const limite = [params.ancho, params.alto, params.profundidad];
    for (const p of piezas) {
      for (let k = 0; k < 3; k++) {
        assert.ok(p.pos[k] >= -1e-9, `${tipo}: ${p.nombre} fuera por debajo en eje ${k}`);
        assert.ok(p.pos[k] + p.tam[k] <= limite[k] + 1e-9, `${tipo}: ${p.nombre} se sale en eje ${k}`);
      }
    }
    for (let i = 0; i < piezas.length; i++) {
      for (let j = i + 1; j < piezas.length; j++) {
        const a = piezas[i];
        const b = piezas[j];
        const choca = [0, 1, 2].every((k) => a.pos[k] < b.pos[k] + b.tam[k] - 1e-6 && b.pos[k] < a.pos[k] + a.tam[k] - 1e-6);
        assert.ok(!choca, `${tipo}: ${a.nombre} choca con ${b.nombre}`);
      }
    }
  }
});

test('repisas con proporciones de la foto: espacios escalados', () => {
  const m = generarMueble('librero', { ancho: 800, alto: 1000, profundidad: 300, repisas: 1, proporciones: [1, 3] });
  // H_libre = 1000 − 3·18 = 946 → 236.5 y 709.5
  assert.deepEqual(m.detalle.espacios, [236.5, 709.5]);
  const repisa = m.piezas.find((p) => p.nombre === 'Repisa');
  assert.equal(repisa.pos[1], 18 + 236.5);
});

test('mueble con puertas: ancho de cada puerta = (W − 2g − s(np−1)) / np', () => {
  const m = generarMueble('mueble_puertas', { ancho: 800, alto: 720, profundidad: 560, repisas: 1, puertas: 2 });
  const puertas = m.piezas.filter((p) => p.nombre === 'Puerta');
  assert.equal(puertas.length, 2);
  // (800 − 4 − 3) / 2 = 396.5 → 396 (se redondea hacia abajo para que quepa)
  assert.equal(puertas[0].ancho, 396);
  assert.equal(puertas[0].largo, 716);
  assert.deepEqual(puertas[0].tapacanto, { largo: 2, ancho: 2 });
});

test('cajonera: frentes suman el alto disponible', () => {
  const m = generarMueble('cajonera', { ancho: 500, alto: 700, profundidad: 450, cajones: 3 });
  const frentes = m.piezas.filter((p) => p.nombre === 'Frente de cajón');
  assert.equal(frentes.length, 3);
  const suma = frentes.reduce((a, f) => a + f.ancho, 0) + 2 * 3; // + separaciones
  assert.ok(suma <= 700 - 4 && suma >= 700 - 4 - 3, `suma ${suma}`);
  assert.equal(m.detalle.largoCaja, 400); // p = 450 − 21 = 429 → 400
});

test('validaciones: medidas fuera de rango y combinaciones imposibles', () => {
  assert.throws(() => generarMueble('librero', { ancho: 50, alto: 1800, profundidad: 300, repisas: 2 }));
  assert.throws(() => generarMueble('librero', { ancho: 800, alto: 300, profundidad: 300, repisas: 15 }));
  assert.throws(() => generarMueble('cajonera', { ancho: 500, alto: 700, profundidad: 200, cajones: 3 }));
  assert.throws(() => generarMueble('otro', { ancho: 500, alto: 700, profundidad: 400 }));
});

/* ---------------- Matriz y sumatorias ---------------- */

test('matriz de despiece agrupa piezas iguales', () => {
  const m = generarMueble('librero', { ancho: 800, alto: 1800, profundidad: 300, repisas: 4 });
  const { filas, M } = matrizDespiece(m.piezas);
  const repisa = filas.find((f) => f.nombre === 'Repisa');
  assert.equal(repisa.cant, 4);
  assert.equal(M.length, filas.length);
  assert.equal(M.reduce((a, fila) => a + fila[0], 0), m.piezas.length);
});

test('sumatorias: área útil y tapacanto calculados a mano', () => {
  const m = generarMueble('librero', { ancho: 800, alto: 1800, profundidad: 300, repisas: 4 });
  const { filas } = matrizDespiece(m.piezas);
  // Laterales: 2·1800·297 ; base+techo+4 repisas: 6·764·297
  assert.equal(areaUtil(filas), 2 * 1800 * 297 + 6 * 764 * 297);
  // Bordes frontales: 2·1800 + 6·764
  assert.equal(tapacantoTotal(filas), 2 * 1800 + 6 * 764);
});

/* ---------------- Corte ---------------- */

function verificarCorte(piezas, r) {
  const { L, A, kerf } = r;
  const colocadas = r.planchas.flatMap((p) => p.piezas.map((q) => ({ ...q, plancha: p.indice })));
  assert.equal(colocadas.length + r.noCaben.length, piezas.length, 'se perdieron piezas');
  for (const q of colocadas) {
    assert.ok(q.x >= 0 && q.y >= 0 && q.x + q.w <= L && q.y + q.h <= A, 'pieza fuera de la plancha');
    const dims = [q.w, q.h].sort((a, b) => a - b);
    const orig = [q.largo, q.ancho].sort((a, b) => a - b);
    assert.deepEqual(dims, orig, 'la pieza cambió de medida');
  }
  for (let i = 0; i < colocadas.length; i++) {
    for (let j = i + 1; j < colocadas.length; j++) {
      const a = colocadas[i];
      const b = colocadas[j];
      if (a.plancha !== b.plancha) continue;
      const separadas = a.x + a.w + kerf <= b.x || b.x + b.w + kerf <= a.x
        || a.y + a.h + kerf <= b.y || b.y + b.h + kerf <= a.y;
      assert.ok(separadas, 'piezas superpuestas o sin espacio para la sierra');
    }
  }
}

test('corte: piezas sin superposición, dentro de la plancha y con kerf', () => {
  const m = generarMueble('mueble_puertas', { ancho: 1200, alto: 2000, profundidad: 600, repisas: 4, puertas: 2 });
  const { filas } = matrizDespiece(m.piezas);
  const piezas = piezasParaCorte(filas);
  const r = optimizarCorte(piezas);
  verificarCorte(piezas, r);
  const t = resumen(filas, r.planchas.length);
  assert.ok(t.planchas >= t.cotaInferior);
  assert.ok(t.aprovechamiento > 0 && t.aprovechamiento <= 100);
});

test('corte: pruebas aleatorias (300 casos)', () => {
  let semilla = 12345;
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) % 2 ** 31;
    return semilla / 2 ** 31;
  };
  for (let caso = 0; caso < 300; caso++) {
    const n = 1 + Math.floor(azar() * 25);
    const piezas = Array.from({ length: n }, (_, i) => ({
      id: String(i), nombre: 'P', largo: 50 + Math.floor(azar() * 2390), ancho: 50 + Math.floor(azar() * 1170),
    }));
    const r = optimizarCorte(piezas);
    assert.equal(r.noCaben.length, 0);
    verificarCorte(piezas, r);
    const area = piezas.reduce((a, p) => a + p.largo * p.ancho, 0);
    assert.ok(r.planchas.length >= Math.ceil(area / (2440 * 1220)));
  }
});

test('corte: pieza más grande que la plancha queda en noCaben', () => {
  const r = optimizarCorte([{ id: 'X', nombre: 'Gigante', largo: 2600, ancho: 500 }]);
  assert.equal(r.noCaben.length, 1);
  assert.equal(r.planchas.length, 0);
});

test('corte: plancha llena exacta (2 piezas de 1218.5 no, 2 de 1218 sí caben a lo largo)', () => {
  // 1218 + 3 (kerf) + 1218 = 2439 ≤ 2440
  const r = optimizarCorte([
    { id: 'A', nombre: 'A', largo: 1218, ancho: 1220 },
    { id: 'B', nombre: 'B', largo: 1218, ancho: 1220 },
  ]);
  assert.equal(r.planchas.length, 1);
});

/* ---------------- Sistema completo ---------------- */

test('calcularProyecto: flujo completo y advertencia por forma distinta a la foto', () => {
  const r = calcularProyecto('librero', { ancho: 1600, alto: 800, profundidad: 300, repisas: 1 }, { relacionFoto: 0.5 });
  assert.ok(r.totales.planchas >= 1);
  assert.ok(r.advertencias.some((a) => a.includes('foto')));
  assert.ok(r.advertencias.some((a) => a.includes('curvarse')));
});

await import('./ui.test.js');

