/**
 * Orquestador del motor matemático (sin nada de interfaz gráfica).
 *
 *   entrada (tipo + medidas) → plantilla → matriz de despiece → corte → resumen
 *
 * La interfaz solo llama a `calcularProyecto` y muestra lo que devuelve, así la
 * lógica se puede probar por separado (ver carpeta tests/).
 */
import { generarMueble } from './plantillas.js';
import { matrizDespiece, piezasParaCorte } from './despiece.js';
import { optimizarCorte } from './corte.js';
import { resumen } from './calculos.js';
import { compararForma } from './escala.js';

export function calcularProyecto(tipo, params, { relacionFoto = null } = {}) {
  const mueble = generarMueble(tipo, params);
  const despiece = matrizDespiece(mueble.piezas);
  const corte = optimizarCorte(piezasParaCorte(despiece.filas));
  if (corte.noCaben.length) {
    const nombres = [...new Set(corte.noCaben.map((p) => `${p.nombre} (${p.largo}×${p.ancho})`))];
    throw new Error(`Estas piezas no caben en una plancha de 2440×1220: ${nombres.join(', ')}.`);
  }
  const totales = resumen(despiece.filas, corte.planchas.length);
  const forma = compararForma(relacionFoto, params.ancho, params.alto);
  const advertencias = [...mueble.advertencias];
  if (forma?.advertir) {
    advertencias.push(
      `La forma del espacio (ancho/alto = ${forma.relacionReal.toFixed(2)}) es bastante distinta a la de la foto `
      + `(${forma.relacionFoto.toFixed(2)}): el mueble se verá más ${forma.deformacion > 1 ? 'ancho' : 'angosto'} que en la foto.`,
    );
  }
  return { mueble, despiece, corte, totales, forma, advertencias };
}
