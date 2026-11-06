/**
 * Módulo de análisis de foto o croquis.
 *
 * La foto entrega:
 *   1. Tipo de mueble sugerido (librero, mueble_puertas, cajonera)
 *   2. Cantidad de divisiones (repisas, puertas o cajones)
 *   3. Proporciones verticales de cada espacio (de abajo hacia arriba)
 *   4. Relación ancho/alto aparente del mueble en la imagen
 *
 * IMPORTANTE: una foto 2D no contiene milímetros reales. Las medidas en mm
 * siempre las ingresa el usuario y luego se escalan con g(x) = k·x.
 */

const ESQUEMA_RESPUESTA = {
  type: 'OBJECT',
  properties: {
    tipo: {
      type: 'STRING',
      enum: ['librero', 'mueble_puertas', 'cajonera'],
      description: 'Tipo de plantilla que mejor representa al mueble de la imagen.',
    },
    repisas: {
      type: 'INTEGER',
      description: 'Número de repisas horizontales interiores (0 a 10).',
    },
    puertas: {
      type: 'INTEGER',
      description: 'Número de puertas batientes frontales (1 a 4, solo si tipo = mueble_puertas).',
    },
    cajones: {
      type: 'INTEGER',
      description: 'Número de cajones apilados (1 a 8, solo si tipo = cajonera).',
    },
    proporciones: {
      type: 'ARRAY',
      items: { type: 'NUMBER' },
      description:
        'Alturas relativas de cada espacio o cajón, ordenadas DE ABAJO HACIA ARRIBA (por ejemplo [2, 1, 1] si el espacio inferior mide el doble que los dos superiores).',
    },
    relacionAnchoAlto: {
      type: 'NUMBER',
      description: 'Razón aproximada ancho / alto del mueble completo visto de frente (por ejemplo 0.5 si el alto es el doble del ancho).',
    },
    descripcion: {
      type: 'STRING',
      description: 'Resumen breve en español de lo identificado en la foto o croquis.',
    },
  },
  required: ['tipo', 'repisas', 'puertas', 'cajones', 'proporciones', 'relacionAnchoAlto', 'descripcion'],
};

const PROMPT_SISTEMA = `Analiza esta fotografía o croquis de un mueble de melamina.
Identifica:
1. Qué plantilla corresponde mejor:
   - "librero": estante o repisa abierta con divisiones horizontales.
   - "mueble_puertas": gabinete o mueble base cerrado con puertas batientes.
   - "cajonera": cómoda o velador con cajones apilados.
2. Cantidad de repisas interiores, puertas o cajones.
3. Proporciones relativas de altura de cada espacio (o de cada frente de cajón), ordenadas DE ABAJO HACIA ARRIBA.
   Si hay N repisas, deben venir N+1 números positivos. Si hay K cajones, deben venir K números positivos.
4. La relación aproximada ancho/alto del mueble en la imagen.
Devuelve únicamente el objeto JSON según el esquema.`;

const MODELOS_PREFERIDOS = [
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

async function elegirModeloDisponible(apiKey) {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
      headers: { 'X-goog-api-key': apiKey },
    });
    if (!r.ok) return MODELOS_PREFERIDOS[0];
    const data = await r.json();
    const nombres = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
    if (nombres.includes('gemini-flash-latest')) return 'gemini-flash-latest';
    const flash = nombres.find((n) => n.includes('flash') && !n.includes('8b') && !n.includes('tts'));
    return flash || nombres[0] || MODELOS_PREFERIDOS[0];
  } catch {
    return MODELOS_PREFERIDOS[0];
  }
}

/**
 * Analiza una imagen usando la API de Gemini Vision.
 * @param {{ base64: string, mimeType: string }} imagen
 * @param {string} apiKey
 */
export async function analizarConGemini(imagen, apiKey) {
  const modelo = await elegirModeloDisponible(apiKey);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
  const body = {
    contents: [
      {
        parts: [
          { text: PROMPT_SISTEMA },
          { inlineData: { mimeType: imagen.mimeType, data: imagen.base64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ESQUEMA_RESPUESTA,
      temperature: 0.1,
    },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errTxt = await resp.text();
    throw new Error(`Error de Gemini API (${resp.status}): ${errTxt.slice(0, 200)}`);
  }
  const json = await resp.json();
  const texto = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) throw new Error('La API no devolvió una respuesta estructurada.');
  const resultado = JSON.parse(texto);
  return normalizarResultadoIA(resultado, `Gemini (${modelo})`);
}

/**
 * Limpia y asegura la consistencia matemática del objeto devuelto por la IA.
 */
export function normalizarResultadoIA(raw, fuente = 'IA') {
  const tipo = ['librero', 'mueble_puertas', 'cajonera'].includes(raw.tipo) ? raw.tipo : 'librero';
  const repisas = Math.max(0, Math.min(10, Math.round(Number(raw.repisas) || 0)));
  const puertas = Math.max(1, Math.min(4, Math.round(Number(raw.puertas) || 2)));
  const cajones = Math.max(1, Math.min(8, Math.round(Number(raw.cajones) || 3)));
  const cantidadEspacios = tipo === 'cajonera' ? cajones : repisas + 1;

  let props = Array.isArray(raw.proporciones)
    ? raw.proporciones.map((n) => Number(n)).filter((n) => n > 0)
    : [];
  if (props.length !== cantidadEspacios) {
    props = Array.from({ length: cantidadEspacios }, () => 1);
  }
  const redondeadas = props.map((p) => Number(p.toFixed(2)));
  const relacionAnchoAlto = Number(raw.relacionAnchoAlto) > 0 ? Number(Number(raw.relacionAnchoAlto).toFixed(2)) : 0.6;

  return {
    tipo,
    repisas,
    puertas,
    cajones,
    proporciones: redondeadas,
    relacionAnchoAlto,
    descripcion: raw.descripcion || 'Parámetros estimados a partir de la imagen.',
    fuente,
  };
}

/**
 * Análisis geométrico local (sin API key) sobre un elemento Image o Canvas:
 * detecta los bordes del dibujo y busca líneas horizontales internas para
 * estimar divisiones y sus proporciones verticales.
 */
export function analizarImagenLocal(imgElement) {
  const W = 240;
  const H = Math.max(120, Math.round((imgElement.naturalHeight / Math.max(1, imgElement.naturalWidth)) * W));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgElement, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  // Magnitud de gradiente vertical para detectar líneas horizontales (repisas/cajones)
  const perfilFila = new Float32Array(H);
  let xMin = W, xMax = 0, yMin = H, yMax = 0;

  for (let y = 1; y < H - 1; y++) {
    let suma = 0;
    for (let x = 1; x < W - 1; x++) {
      const idx = (y * W + x) * 4;
      const idxUp = ((y - 1) * W + x) * 4;
      const idxDn = ((y + 1) * W + x) * 4;
      const lumUp = 0.299 * data[idxUp] + 0.587 * data[idxUp + 1] + 0.114 * data[idxUp + 2];
      const lumDn = 0.299 * data[idxDn] + 0.587 * data[idxDn + 1] + 0.114 * data[idxDn + 2];
      const gradY = Math.abs(lumDn - lumUp);
      suma += gradY;
      if (gradY > 35) {
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
    perfilFila[y] = suma / W;
  }

  if (xMax <= xMin + 20 || yMax <= yMin + 20) {
    xMin = Math.round(W * 0.1);
    xMax = Math.round(W * 0.9);
    yMin = Math.round(H * 0.1);
    yMax = Math.round(H * 0.9);
  }

  const altoCaja = Math.max(40, yMax - yMin);
  const anchoCaja = Math.max(40, xMax - xMin);
  const relacionAnchoAlto = Number((anchoCaja / altoCaja).toFixed(2));

  // Buscar picos internos en perfilFila entre yMin y yMax
  const margen = Math.round(altoCaja * 0.1);
  const media = perfilFila.slice(yMin + margen, yMax - margen).reduce((a, b) => a + b, 0)
    / Math.max(1, altoCaja - 2 * margen);
  const umbral = media * 1.45;
  const distMin = Math.max(10, Math.round(altoCaja * 0.12));

  const picos = [];
  for (let y = yMin + margen; y <= yMax - margen; y++) {
    if (perfilFila[y] > umbral && perfilFila[y] >= perfilFila[y - 1] && perfilFila[y] >= perfilFila[y + 1]) {
      if (!picos.length || y - picos[picos.length - 1] >= distMin) {
        picos.push(y);
      } else if (perfilFila[y] > perfilFila[picos[picos.length - 1]]) {
        picos[picos.length - 1] = y;
      }
    }
  }

  const cortes = [yMin, ...picos.slice(0, 6), yMax];
  // Alturas desde abajo (yMax) hacia arriba (yMin)
  const alturasAbajoArriba = [];
  for (let i = cortes.length - 1; i > 0; i--) {
    alturasAbajoArriba.push(cortes[i] - cortes[i - 1]);
  }
  const minAlt = Math.min(...alturasAbajoArriba);
  const proporciones = alturasAbajoArriba.map((a) => Number((a / Math.max(1, minAlt)).toFixed(1)));
  const repisas = Math.max(1, proporciones.length - 1);

  return normalizarResultadoIA(
    {
      tipo: 'librero',
      repisas,
      puertas: 2,
      cajones: Math.min(5, Math.max(2, proporciones.length)),
      proporciones,
      relacionAnchoAlto,
      descripcion: `Análisis geométrico local: se detectó una razón ancho/alto ≈ ${relacionAnchoAlto} y ${repisas} división(es) horizontal(es) con proporciones [${proporciones.join(', ')}] de abajo hacia arriba. Confirma o cambia el tipo de mueble abajo.`,
    },
    'Detector geométrico local (sin API key)',
  );
}

/**
 * Croquis de ejemplo integrados para probar el flujo completo con un clic.
 */
export const CROQUIS_EJEMPLO = Object.freeze([
  {
    id: 'librero_asimetrico',
    titulo: 'Croquis 1: Librero asimétrico (3 repisas)',
    subtitulo: 'Espacio inferior doble + 3 niveles superiores (proporciones 2 : 1 : 1 : 1)',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 360">
      <rect width="260" height="360" fill="#0f172a"/>
      <rect x="45" y="25" width="170" height="310" fill="#1e293b" stroke="#38bdf8" stroke-width="5"/>
      <line x1="45" y1="87" x2="215" y2="87" stroke="#38bdf8" stroke-width="4"/>
      <line x1="45" y1="149" x2="215" y2="149" stroke="#38bdf8" stroke-width="4"/>
      <line x1="45" y1="211" x2="215" y2="211" stroke="#38bdf8" stroke-width="4"/>
      <text x="130" y="62" fill="#94a3b8" font-size="13" text-anchor="middle" font-family="sans-serif">1x</text>
      <text x="130" y="124" fill="#94a3b8" font-size="13" text-anchor="middle" font-family="sans-serif">1x</text>
      <text x="130" y="185" fill="#94a3b8" font-size="13" text-anchor="middle" font-family="sans-serif">1x</text>
      <text x="130" y="278" fill="#38bdf8" font-size="15" font-weight="bold" text-anchor="middle" font-family="sans-serif">2x (alto doble)</text>
    </svg>`,
    resultado: {
      tipo: 'librero',
      repisas: 3,
      puertas: 2,
      cajones: 3,
      proporciones: [2, 1, 1, 1],
      relacionAnchoAlto: 0.45,
      descripcion: 'Croquis de librero con 3 repisas: el compartimento inferior tiene el doble de altura que los 3 superiores (proporción 2, 1, 1, 1 de abajo hacia arriba).',
      fuente: 'Croquis de referencia 1',
    },
  },
  {
    id: 'gabinete_dos_puertas',
    titulo: 'Croquis 2: Mueble base con 2 puertas',
    subtitulo: 'Gabinete cerrado con 2 puertas batientes y 1 repisa central',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 360">
      <rect width="260" height="360" fill="#0f172a"/>
      <rect x="30" y="65" width="200" height="230" fill="#1e293b" stroke="#34d399" stroke-width="5"/>
      <line x1="130" y1="65" x2="130" y2="295" stroke="#34d399" stroke-width="3"/>
      <line x1="35" y1="180" x2="225" y2="180" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6,6"/>
      <circle cx="116" cy="180" r="5" fill="#34d399"/>
      <circle cx="144" cy="180" r="5" fill="#34d399"/>
      <text x="130" y="325" fill="#94a3b8" font-size="13" text-anchor="middle" font-family="sans-serif">2 puertas · 1 repisa interior</text>
    </svg>`,
    resultado: {
      tipo: 'mueble_puertas',
      repisas: 1,
      puertas: 2,
      cajones: 2,
      proporciones: [1, 1],
      relacionAnchoAlto: 0.95,
      descripcion: 'Croquis de mueble base con 2 puertas batientes y 1 repisa interior a media altura (proporción 1, 1).',
      fuente: 'Croquis de referencia 2',
    },
  },
  {
    id: 'cajonera_4_niveles',
    titulo: 'Croquis 3: Cajonera de 4 cajones',
    subtitulo: 'Cajón inferior profundo + 3 cajones superiores (proporciones 1.5 : 1 : 1 : 1)',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 360">
      <rect width="260" height="360" fill="#0f172a"/>
      <rect x="45" y="40" width="170" height="280" fill="#1e293b" stroke="#f59e0b" stroke-width="5"/>
      <line x1="45" y1="102" x2="215" y2="102" stroke="#f59e0b" stroke-width="3"/>
      <line x1="45" y1="164" x2="215" y2="164" stroke="#f59e0b" stroke-width="3"/>
      <line x1="45" y1="226" x2="215" y2="226" stroke="#f59e0b" stroke-width="3"/>
      <rect x="110" y="67" width="40" height="6" rx="3" fill="#f59e0b"/>
      <rect x="110" y="129" width="40" height="6" rx="3" fill="#f59e0b"/>
      <rect x="110" y="191" width="40" height="6" rx="3" fill="#f59e0b"/>
      <rect x="110" y="268" width="40" height="6" rx="3" fill="#f59e0b"/>
    </svg>`,
    resultado: {
      tipo: 'cajonera',
      repisas: 0,
      puertas: 2,
      cajones: 4,
      proporciones: [1.5, 1, 1, 1],
      relacionAnchoAlto: 0.7,
      descripcion: 'Croquis de cajonera con 4 cajones: el cajón inferior es 1.5 veces más alto que los 3 superiores (proporciones 1.5, 1, 1, 1 de abajo hacia arriba).',
      fuente: 'Croquis de referencia 3',
    },
  },
]);
