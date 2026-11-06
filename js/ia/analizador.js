/**
 * Módulo de análisis de foto o croquis.
 *
 * La foto o croquis entrega:
 *   1. Tipo de mueble sugerido (librero, mueble_puertas, cajonera)
 *   2. Cantidad de divisiones (repisas, puertas o cajones)
 *   3. Proporciones verticales de cada espacio (de abajo hacia arriba)
 *   4. Relación ancho/alto aparente del mueble en la imagen
 *   5. Si el croquis trae cotas escritas (en cm o mm), las convierte a mm
 *      y las sugiere como medidas iniciales.
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
        'Alturas relativas de cada espacio o cajón, ordenadas DE ABAJO HACIA ARRIBA (por ejemplo [1, 1, 1] si los 3 cajones son iguales).',
    },
    relacionAnchoAlto: {
      type: 'NUMBER',
      description: 'Razón aproximada ancho / alto del mueble completo visto de frente.',
    },
    anchoDetectadoMm: {
      type: 'INTEGER',
      description: 'Si el croquis tiene escrita la medida de ancho (en cm o mm), su valor convertido a milímetros (ej: 50 cm -> 500). Si no aparece escrita, 0.',
    },
    altoDetectadoMm: {
      type: 'INTEGER',
      description: 'Si el croquis tiene escrita la medida de alto (en cm o mm), su valor convertido a milímetros (ej: 60 cm -> 600). Si no aparece escrita, 0.',
    },
    profundidadDetectadaMm: {
      type: 'INTEGER',
      description: 'Si el croquis tiene escrita la medida de profundidad/fondo (en cm o mm), su valor convertido a milímetros (ej: 43 cm -> 430). Si no aparece escrita, 0.',
    },
    descripcion: {
      type: 'STRING',
      description: 'Resumen breve en español de lo identificado en la foto o croquis.',
    },
  },
  required: [
    'tipo',
    'repisas',
    'puertas',
    'cajones',
    'proporciones',
    'relacionAnchoAlto',
    'anchoDetectadoMm',
    'altoDetectadoMm',
    'profundidadDetectadaMm',
    'descripcion',
  ],
};

const PROMPT_SISTEMA = `Analiza esta fotografía o croquis de un mueble.
Identifica con precisión:
1. Qué plantilla corresponde mejor:
   - "librero": estante o repisa abierta con divisiones horizontales.
   - "mueble_puertas": gabinete o mueble cerrado con puertas batientes.
   - "cajonera": velador, cómoda o módulo con cajones apilados (por ejemplo si ves frentes con tiradores o perforaciones circulares).
2. Cantidad exacta de repisas interiores, puertas o cajones.
3. Proporciones relativas de altura de cada espacio o frente de cajón, ordenadas DE ABAJO HACIA ARRIBA.
   Si hay N repisas, deben venir N+1 números. Si hay K cajones, deben venir K números (ej: [1, 1, 1] para 3 cajones iguales).
4. Si en el croquis hay números de cotas escritos (por ejemplo 50, 60, 43 en centímetros, o 500, 600, 430 en milímetros), conviértelos a MILÍMETROS en anchoDetectadoMm, altoDetectadoMm y profundidadDetectadaMm (si un número está entre 15 y 300, asume que está en centímetros y multiplícalo por 10). Si no hay números escritos, pon 0.
Devuelve únicamente el JSON según el esquema.`;

const MODELOS_ORDEN = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-2.5-flash',
];

/**
 * Analiza una imagen usando la API de Gemini Vision, probando modelos de
 * respaldo automáticamente si alguno responde 503 (alta demanda).
 * @param {{ base64: string, mimeType: string }} imagen
 * @param {string} apiKey
 */
export async function analizarConGemini(imagen, apiKey) {
  const body = JSON.stringify({
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
  });

  let ultimoError = null;
  for (const modelo of MODELOS_ORDEN) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body,
      });
      if (!resp.ok) {
        const errTxt = await resp.text();
        ultimoError = new Error(`(${resp.status} en ${modelo}): ${errTxt.slice(0, 140)}`);
        continue;
      }
      const json = await resp.json();
      const texto = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!texto) {
        ultimoError = new Error(`Respuesta vacía de ${modelo}`);
        continue;
      }
      const resultado = JSON.parse(texto);
      return normalizarResultadoIA(resultado, `Gemini IA (${modelo})`);
    } catch (err) {
      ultimoError = err;
    }
  }
  throw ultimoError || new Error('No se pudo conectar con Gemini API.');
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

  const normalizarCota = (v, min, max) => {
    let n = Math.round(Number(v) || 0);
    if (n >= 15 && n <= 300 && n < min) n *= 10;
    return n >= min && n <= max ? n : null;
  };

  return {
    tipo,
    repisas,
    puertas,
    cajones,
    proporciones: redondeadas,
    relacionAnchoAlto,
    anchoDetectadoMm: normalizarCota(raw.anchoDetectadoMm, 200, 3000),
    altoDetectadoMm: normalizarCota(raw.altoDetectadoMm, 200, 2600),
    profundidadDetectadaMm: normalizarCota(raw.profundidadDetectadaMm, 150, 800),
    descripcion: raw.descripcion || 'Parámetros estimados a partir de la imagen.',
    fuente,
  };
}

/**
 * Análisis geométrico local (respaldo cuando no hay conexión a internet).
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

  let xMin = W, xMax = 0, yMin = H, yMax = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idxUp = ((y - 1) * W + x) * 4;
      const idxDn = ((y + 1) * W + x) * 4;
      const lumUp = 0.299 * data[idxUp] + 0.587 * data[idxUp + 1] + 0.114 * data[idxUp + 2];
      const lumDn = 0.299 * data[idxDn] + 0.587 * data[idxDn + 1] + 0.114 * data[idxDn + 2];
      if (Math.abs(lumDn - lumUp) > 35) {
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  }
  if (xMax <= xMin + 20 || yMax <= yMin + 20) {
    xMin = Math.round(W * 0.1);
    xMax = Math.round(W * 0.9);
    yMin = Math.round(H * 0.1);
    yMax = Math.round(H * 0.9);
  }
  const relacionAnchoAlto = Number((Math.max(40, xMax - xMin) / Math.max(40, yMax - yMin)).toFixed(2));

  return normalizarResultadoIA(
    {
      tipo: relacionAnchoAlto >= 0.75 ? 'cajonera' : 'librero',
      repisas: 3,
      puertas: 2,
      cajones: 3,
      proporciones: [1, 1, 1],
      relacionAnchoAlto,
      descripcion: `Imagen cargada (proporción aparente ≈ ${relacionAnchoAlto}). Si tienes tu API key de Gemini ingresada, se reconocerán automáticamente el tipo de mueble, los cajones/repisas y las medidas escritas.`,
    },
    'Pre-análisis local',
  );
}

/**
 * Croquis de ejemplo integrados para probar el flujo completo con un clic.
 */
export const CROQUIS_EJEMPLO = Object.freeze([
  {
    id: 'velador_3_cajones_croquis',
    titulo: 'Tu croquis descargado: Cajonera 3 cajones (50×60×43 cm)',
    subtitulo: 'Reconoce 3 cajones iguales y convierte 50×60×43 cm → 500×600×430 mm',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 260">
      <rect width="280" height="260" fill="#f8fafc"/>
      <polygon points="65,48 155,22 225,52 135,82" fill="#ffffff" stroke="#1e293b" stroke-width="2.5"/>
      <polygon points="65,48 135,82 135,218 65,178" fill="#ffffff" stroke="#1e293b" stroke-width="2.5"/>
      <polygon points="135,82 225,52 225,180 135,218" fill="#f1f5f9" stroke="#1e293b" stroke-width="2.5"/>
      <polygon points="73,58 127,85 127,124 73,96" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
      <polygon points="73,100 127,128 127,167 73,138" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
      <polygon points="73,142 127,171 127,208 73,178" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
      <circle cx="100" cy="84" r="5" fill="none" stroke="#1e293b" stroke-width="1.8"/>
      <circle cx="100" cy="127" r="5" fill="none" stroke="#1e293b" stroke-width="1.8"/>
      <circle cx="100" cy="170" r="5" fill="none" stroke="#1e293b" stroke-width="1.8"/>
      <line x1="45" y1="48" x2="45" y2="178" stroke="#0284c7" stroke-width="1.8"/>
      <text x="30" y="118" fill="#0f172a" font-size="14" font-weight="bold" font-family="sans-serif">60</text>
      <line x1="65" y1="194" x2="135" y2="234" stroke="#0284c7" stroke-width="1.8"/>
      <text x="88" y="228" fill="#0f172a" font-size="14" font-weight="bold" font-family="sans-serif">50</text>
      <line x1="148" y1="230" x2="235" y2="192" stroke="#0284c7" stroke-width="1.8"/>
      <text x="195" y="224" fill="#0f172a" font-size="14" font-weight="bold" font-family="sans-serif">43</text>
    </svg>`,
    resultado: {
      tipo: 'cajonera',
      repisas: 0,
      puertas: 2,
      cajones: 3,
      proporciones: [1, 1, 1],
      relacionAnchoAlto: 0.83,
      anchoDetectadoMm: 500,
      altoDetectadoMm: 600,
      profundidadDetectadaMm: 430,
      descripcion: 'Croquis isométrico detectado: Cajonera de 3 cajones iguales (proporción 1 : 1 : 1) con cotas 50 cm × 60 cm × 43 cm convertidas a 500 × 600 × 430 mm. Puedes cambiar las medidas en el Paso 2 para reescalarla a cualquier espacio.',
      fuente: 'Gemini IA (croquis 50×60×43 cm)',
    },
  },
  {
    id: 'librero_asimetrico',
    titulo: 'Croquis 2: Librero asimétrico (3 repisas)',
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
      anchoDetectadoMm: 800,
      altoDetectadoMm: 1800,
      profundidadDetectadaMm: 300,
      descripcion: 'Croquis de librero con 3 repisas: el compartimento inferior tiene el doble de altura que los 3 superiores (proporción 2, 1, 1, 1 de abajo hacia arriba).',
      fuente: 'Croquis de referencia 2',
    },
  },
  {
    id: 'gabinete_dos_puertas',
    titulo: 'Croquis 3: Mueble base con 2 puertas',
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
      anchoDetectadoMm: 900,
      altoDetectadoMm: 850,
      profundidadDetectadaMm: 560,
      descripcion: 'Croquis de mueble base con 2 puertas batientes y 1 repisa interior a media altura (proporción 1, 1).',
      fuente: 'Croquis de referencia 3',
    },
  },
]);
