/**
 * Constantes del dominio (todas las medidas en milímetros).
 * Son los "supuestos" del modelo: si cambian en la realidad, se cambian aquí.
 */

/** Plancha estándar de melamina en Chile. */
export const PLANCHA = Object.freeze({ largo: 2440, ancho: 1220 });

/** Espesor de la melamina estructural. NO se escala. */
export const ESPESOR = 18;

/** Espesor del fondo (HDF / "durolac"), que se clava atrás. */
export const ESPESOR_FONDO = 3;

/** Ancho de corte de la sierra de la dimensionadora (kerf). */
export const KERF = 3;

/** Holgura entre el borde exterior del mueble y una puerta o frente. */
export const HOLGURA = 2;

/** Separación entre dos puertas o frentes vecinos. */
export const SEPARACION = 3;

/** Espacio que ocupa cada corredera telescópica de cajón, por lado. */
export const CORREDERA = 13;

/** Distancia máxima recomendada sin apoyo para una repisa de 18 mm. */
export const LUZ_MAX_REPISA = 900;

/** Rangos aceptados para las medidas del espacio. */
export const LIMITES = Object.freeze({
  ancho: [200, 3000],
  alto: [200, 2600],
  profundidad: [150, 800],
});

export const MATERIAL = Object.freeze({
  MELAMINA: 'Melamina 18 mm',
  FONDO: 'HDF 3 mm (fondo)',
});
