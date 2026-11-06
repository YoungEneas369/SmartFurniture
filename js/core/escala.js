/**
 * Funciones de escalamiento.
 *
 * Idea central del proyecto: la foto entrega PROPORCIONES (sin unidades) y el
 * usuario entrega MEDIDAS REALES (mm). Escalar es multiplicar cada proporción
 * por la longitud real disponible: g(x) = k · x.
 */

/** Factor de escala k = nuevo / original. */
export function factorEscala(nuevo, original) {
  if (!(original > 0)) throw new Error('La medida original debe ser mayor que 0.');
  return nuevo / original;
}

/** Función lineal de escalamiento g(x) = k·x. */
export function escalar(x, k) {
  return k * x;
}

/**
 * Convierte una lista de alturas relativas (por ejemplo [1, 1, 2] leída en la
 * foto) en fracciones que suman 1: fᵢ = xᵢ / Σx.
 * Si no se entrega nada, reparte en partes iguales.
 */
export function normalizarProporciones(valores, cantidad) {
  if (!valores || valores.length === 0) {
    return Array.from({ length: cantidad }, () => 1 / cantidad);
  }
  if (valores.length !== cantidad) {
    throw new Error(
      `Se esperaban ${cantidad} proporciones (una por espacio) y llegaron ${valores.length}.`,
    );
  }
  if (valores.some((v) => !(Number(v) > 0))) {
    throw new Error('Todas las proporciones deben ser números mayores que 0.');
  }
  const suma = valores.reduce((a, b) => a + Number(b), 0);
  return valores.map((v) => Number(v) / suma);
}

/**
 * Aplica g(f) = k·f a cada fracción, con k = longitud libre real (mm).
 * Devuelve la medida en mm de cada espacio.
 */
export function escalarProporciones(fracciones, longitudLibre) {
  return fracciones.map((f) => escalar(f, longitudLibre));
}

/**
 * Compara la forma de la foto con la forma del espacio real.
 * r₀ = ancho/alto en la foto, r = W/H real. Si r/r₀ se aleja de 1,
 * el mueble resultante se verá "estirado" respecto de la foto.
 */
export function compararForma(relacionFoto, ancho, alto) {
  if (!(relacionFoto > 0)) return null;
  const relacionReal = ancho / alto;
  const deformacion = relacionReal / relacionFoto;
  return {
    relacionFoto,
    relacionReal,
    deformacion,
    advertir: deformacion < 0.75 || deformacion > 1.33,
  };
}

/**
 * Parsea un texto como "1, 1, 2" o "1 1.5 2" a números. Texto vacío → [].
 * Separadores: coma, punto y coma o espacio. Decimales: con punto.
 */
export function parsearProporciones(texto) {
  if (!texto || !texto.trim()) return [];
  return texto
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((t) => Number(t));
}
