import { test } from 'node:test';
import assert from 'node:assert/strict';

import { calcularProyecto } from '../js/core/sistema.js';
import { normalizarResultadoIA, CROQUIS_EJEMPLO, CATALOGO_ALBUM_MUEBLES } from '../js/ia/analizador.js';
import { renderizarPlanosCorte } from '../js/ui/planoCorte.js';
import { mapaColoresPorFila } from '../js/ui/colores.js';
import { calcularEspaciosVaciosFrontales, generarCroquisTecnicoSVG, calcularUnionesYTornillos, generarManualArmadoHTML } from '../js/ui/croquis2d.js';

test('los 12 muebles del álbum Muebles y Descargas producen modelos 3D sin colisiones y planos de corte válidos', () => {
  for (const item of CATALOGO_ALBUM_MUEBLES) {
    const ia = normalizarResultadoIA(item.resultado, item.resultado.fuente);
    const W = ia.anchoDetectadoMm || 800;
    const H = ia.altoDetectadoMm || 1800;
    const D = ia.profundidadDetectadaMm || 450;

    const r = calcularProyecto(
      ia.secciones ? 'modular' : ia.tipo,
      {
        ancho: W,
        alto: H,
        profundidad: D,
        subtipo: ia.subtipo || 'estandar',
        repisas: ia.repisas,
        puertas: ia.puertas,
        cajones: ia.cajones,
        proporciones: ia.proporciones,
        secciones: ia.secciones,
        alturaPatasMm: ia.alturaPatasMm,
        tieneFondo: ia.tieneFondo,
      },
      { relacionFoto: ia.relacionAnchoAlto },
    );

    assert.ok(r.totales.planchas >= 1, `${item.id}: debe usar al menos 1 plancha`);
    const colores = mapaColoresPorFila(r.despiece.filas);
    assert.equal(colores.size, r.despiece.filas.length);

    // Verificar que ninguna pieza en 3D se salga de W×H×D ni choque con otra
    const limite = [W, H, D];
    for (const p of r.mueble.piezas) {
      for (let k = 0; k < 3; k++) {
        assert.ok(p.pos[k] >= -1e-9, `${item.id}: ${p.nombre} fuera por debajo en eje ${k}`);
        assert.ok(p.pos[k] + p.tam[k] <= limite[k] + 1e-9, `${item.id}: ${p.nombre} se sale en eje ${k}`);
      }
    }
    for (let i = 0; i < r.mueble.piezas.length; i++) {
      for (let j = i + 1; j < r.mueble.piezas.length; j++) {
        const a = r.mueble.piezas[i];
        const b = r.mueble.piezas[j];
        const choca = [0, 1, 2].every((k) => a.pos[k] < b.pos[k] + b.tam[k] - 1e-6 && b.pos[k] < a.pos[k] + a.tam[k] - 1e-6);
        assert.ok(!choca, `${item.id}: ${a.nombre} choca con ${b.nombre}`);
      }
    }

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
    proporciones: [1, 2],
    relacionAnchoAlto: -1,
  });
  assert.equal(limpio.tipo, 'librero');
  assert.equal(limpio.puertas, 4);
  assert.equal(limpio.cajones, 1);
  assert.deepEqual(limpio.proporciones, [1, 1, 1, 1]);
  assert.equal(limpio.relacionAnchoAlto, 0.6);
});

test('normalizarResultadoIA corrige inversión arriba/abajo, expande filasApiladas y evita muebles largos en fotos cuadradas', () => {
  const estanteInvertido = normalizarResultadoIA({
    categoriaMueble: 'estante_librero',
    nombreMueble: 'Estante con 3 cajones arriba',
    tieneMedidasEscritas: true,
    textoMedidasLeidas: '106 cm, 198 cm, 50 cm',
    anchoDetectadoMm: 106,
    altoDetectadoMm: 198,
    profundidadDetectadaMm: 50,
    secciones: [
      { ubicacionVertical: 'superior', tipoSeccion: 'cajon', columnas: 3, filasApiladas: 1, proporcionAlto: 0.85 },
      { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 3, proporcionAlto: 1.0 },
    ],
  });
  assert.equal(estanteInvertido.anchoDetectadoMm, 1060);
  assert.equal(estanteInvertido.altoDetectadoMm, 1980);
  assert.equal(estanteInvertido.profundidadDetectadaMm, 500);
  assert.equal(estanteInvertido.secciones.length, 4);
  assert.equal(estanteInvertido.secciones[0].tipoSeccion, 'hueco');
  assert.equal(estanteInvertido.secciones[3].tipoSeccion, 'cajon');
  assert.equal(estanteInvertido.secciones[3].columnas, 3);

  const vanitorioCorregido = normalizarResultadoIA(
    {
      categoriaMueble: 'vanitorio',
      nombreMueble: 'Vanitorio',
      tieneMedidasEscritas: false,
      anchoDetectadoMm: 1500,
      altoDetectadoMm: 820,
      profundidadDetectadaMm: 450,
      relacionAnchoAlto: 1.0,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.6 },
        { ubicacionVertical: 'superior', tipoSeccion: 'cajon', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 },
      ],
    },
    'IA',
    { wOrig: 1500, hOrig: 1500, relacionArchivo: 1.0, relacionMueble: 0.72 },
  );
  assert.ok(vanitorioCorregido.anchoDetectadoMm <= 700, `Ancho corregido fue ${vanitorioCorregido.anchoDetectadoMm}`);
  assert.equal(vanitorioCorregido.altoDetectadoMm, 820);
});


test('Croquis Técnico 2D y detector de espacios vacíos generan vistas válidas para los 47 muebles', () => {
  for (const item of CATALOGO_ALBUM_MUEBLES) {
    const ia = normalizarResultadoIA(item.resultado, item.resultado.fuente);
    const r = calcularProyecto('modular', {
      ancho: ia.anchoDetectadoMm,
      alto: ia.altoDetectadoMm,
      profundidad: ia.profundidadDetectadaMm,
      subtipo: ia.subtipo || 'estandar',
      secciones: ia.secciones,
      alturaPatasMm: ia.alturaPatasMm,
      tieneFondo: ia.tieneFondo,
    });
    const vacios = calcularEspaciosVaciosFrontales(r.mueble);
    assert.ok(Array.isArray(vacios), `${item.id}: vacios debe ser un arreglo`);
    const svg = generarCroquisTecnicoSVG(r.mueble, {
      nombreMueble: ia.nombreMueble,
      subtipo: ia.subtipo,
      tieneFondo: ia.tieneFondo,
    });
    assert.ok(svg.includes('<svg') && svg.includes('VISTA FRONTAL ACOTADA'), `${item.id}: debe generar Croquis 2D SVG`);
    const uniones = calcularUnionesYTornillos(r.mueble);
    assert.ok(uniones.puntos.length >= 2, `${item.id}: debe calcular coordenadas 3D de tornillos/herrajes`);
    const manual = generarManualArmadoHTML(r.mueble, r.despiece);
    assert.ok(manual.includes('PASO 1') && manual.includes('Tornillos Soberbio'), `${item.id}: debe generar manual de armado paso a paso`);
  }
});
