import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calcularProyecto } from '../js/core/sistema.js';
import { normalizarResultadoIA, CROQUIS_EJEMPLO } from '../js/ia/analizador.js';
import { renderizarPlanosCorte } from '../js/ui/planoCorte.js';
import { mapaColoresPorFila } from '../js/ui/colores.js';

test('los 3 croquis de ejemplo producen proyectos válidos con planchas y planos SVG', () => {
  for (const croquis of CROQUIS_EJEMPLO) {
    const ia = normalizarResultadoIA(croquis.resultado, croquis.resultado.fuente);
    const r = calcularProyecto(
      ia.tipo,
      {
        ancho: 800,
        alto: 1800,
        profundidad: 450,
        repisas: ia.repisas,
        puertas: ia.puertas,
        cajones: ia.cajones,
        proporciones: ia.proporciones,
      },
      { relacionFoto: ia.relacionAnchoAlto },
    );

    assert.ok(r.totales.planchas >= 1);
    const colores = mapaColoresPorFila(r.despiece.filas);
    assert.equal(colores.size, r.despiece.filas.length);

    const contenedor = { innerHTML: '' };
    renderizarPlanosCorte(contenedor, r.corte, r.despiece.filas);
    assert.ok(contenedor.innerHTML.includes('<svg'), 'Debe renderizar el SVG de la plancha');
    assert.ok(contenedor.innerHTML.includes('2440 mm'), 'Debe incluir la cota de 2440 mm');
  }
});

test('normalizarResultadoIA corrige datos incompletos o fuera de rango', () => {
  const limpio = normalizarResultadoIA({
    tipo: 'invalido',
    repisas: 3,
    puertas: 99,
    cajones: -2,
    proporciones: [1, 2], // cantidad distinta de repisas + 1 (4)
    relacionAnchoAlto: -1,
  });
  assert.equal(limpio.tipo, 'librero');
  assert.equal(limpio.puertas, 4);
  assert.equal(limpio.cajones, 1);
  assert.deepEqual(limpio.proporciones, [1, 1, 1, 1]);
  assert.equal(limpio.relacionAnchoAlto, 0.6);
});
