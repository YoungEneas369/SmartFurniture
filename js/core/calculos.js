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

/**
 * Calcula automáticamente la lista de herrajes/quincallería (BOM) y el
 * presupuesto estimado en Pesos Chilenos (CLP), al estilo de Polyboard / OpenCutList.
 */
export function calcularHerrajesYCostos(despiece, totales, params = {}) {
  const piezas = despiece?.piezas || [];
  const filas = despiece?.filas || [];
  const D = Number(params.profundidad) || 450;
  const W = Number(params.ancho) || 800;

  const puertas = piezas.filter((p) => p.grupo === 'puerta');
  const frentesCajon = piezas.filter((p) => p.grupo === 'frente');
  const tablerosEstructurales = piezas.filter(
    (p) => p.grupo === 'estructura' || p.grupo === 'repisa' || p.grupo === 'cajon',
  );
  const fondos = piezas.filter((p) => p.grupo === 'fondo');

  // Bisagras cazoleta 35 mm según altura de cada puerta (2 hasta 950 mm, 3 hasta 1600 mm, 4 si > 1600 mm)
  let totalBisagras = 0;
  for (const p of puertas) {
    const altoPuerta = Math.max(p.largo, p.ancho);
    totalBisagras += altoPuerta > 1600 ? 4 : altoPuerta > 950 ? 3 : 2;
  }

  // Pares de correderas telescópicas (largo comercial múltiplo de 50 mm entre 250 y 550 mm)
  const paresCorrederas = frentesCajon.length;
  const largoCorrederaMm = Math.min(550, Math.max(250, Math.floor((D - 30) / 50) * 50));

  // Tiradores / manillas (1 por puerta + 1 por cajón)
  const totalTiradores = puertas.length + frentesCajon.length;

  // Tornillos soberbios 4×50 mm y tarugos de madera 8 mm (4 por unión estructural)
  const totalTornillos = Math.max(8, tablerosEstructurales.length * 4);
  const totalTarugos = Math.max(8, tablerosEstructurales.length * 2);

  // Clavos / grapas para fondo HDF 3 mm
  const clavosFondo = fondos.length > 0 ? Math.max(20, fondos.length * 24) : 0;

  // Patines deslizadores inferiores
  const patinesPiso = W >= 1500 ? 6 : 4;

  const itemsHerrajes = [];
  if (totalBisagras > 0) {
    itemsHerrajes.push({
      nombre: 'Bisagra cazoleta 35 mm cierre suave',
      cantidad: totalBisagras,
      unidad: 'unid.',
      costoUnitarioClp: 1290,
    });
  }
  if (paresCorrederas > 0) {
    itemsHerrajes.push({
      nombre: `Corredera telescópica ${largoCorrederaMm} mm (par)`,
      cantidad: paresCorrederas,
      unidad: 'pares',
      costoUnitarioClp: 3990,
    });
  }
  if (totalTiradores > 0) {
    itemsHerrajes.push({
      nombre: 'Tirador / Manilla metálica 128 mm',
      cantidad: totalTiradores,
      unidad: 'unid.',
      costoUnitarioClp: 1490,
    });
  }
  itemsHerrajes.push(
    {
      nombre: 'Tornillo soberbio 4×50 mm + tapa adhesiva',
      cantidad: totalTornillos,
      unidad: 'unid.',
      costoUnitarioClp: 45,
    },
    {
      nombre: 'Tarugo de madera estriado 8×35 mm',
      cantidad: totalTarugos,
      unidad: 'unid.',
      costoUnitarioClp: 30,
    },
    {
      nombre: 'Patín deslizador a piso antihumedad',
      cantidad: patinesPiso,
      unidad: 'unid.',
      costoUnitarioClp: 250,
    },
  );
  if (clavosFondo > 0) {
    itemsHerrajes.push({
      nombre: 'Clavo / Grapa 15 mm para fondo HDF',
      cantidad: clavosFondo,
      unidad: 'unid.',
      costoUnitarioClp: 15,
    });
  }

  const costoHerrajesClp = itemsHerrajes.reduce((acc, it) => acc + it.cantidad * it.costoUnitarioClp, 0);
  const costoPlanchasClp = (totales?.planchas || 1) * 36900;
  const costoFondoClp = (totales?.areaFondo || 0) > 0 ? 12900 : 0;
  const metrosTapacanto = Math.ceil((totales?.tapacanto || 0) / 1000);
  const costoTapacantoClp = metrosTapacanto * 390;
  const costoTotalClp = costoPlanchasClp + costoFondoClp + costoTapacantoClp + costoHerrajesClp;

  return {
    items: itemsHerrajes,
    costos: {
      planchasClp: costoPlanchasClp,
      fondoClp: costoFondoClp,
      tapacantoClp: costoTapacantoClp,
      herrajesClp: costoHerrajesClp,
      totalClp: costoTotalClp,
    },
  };
}
