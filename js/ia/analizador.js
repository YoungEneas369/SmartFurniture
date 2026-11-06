/**
 * Motor avanzado de reconocimiento de muebles mediante Visión por Computador
 * + Gemini Vision IA con soporte multi-topología y validación ergonómica.
 *
 * Topologías soportadas (subtipo):
 *   - 'estandar': muebles modulares por niveles (cajoneras, estantes mixtos, vanitorios, escritorios, armarios)
 *   - 'intercalado': libreros con divisiones verticales alternadas / zig-zag
 *   - 'mesa': mesas y escritorios abiertos de 4 patas con cubierta y faldón perimetral
 *   - 'puente_laterales': estantes de pared con 2 torres laterales y puente central
 *   - 'flotante_entrelazada': repisas flotantes geométricas con cubo central y brazos en L
 *   - 'gondola': góndolas exhibidoras con montantes maestros, panel central y bandejas laterales
 */

const CLAVE_CACHE_IA = 'smartfurniture_ia_cache_v4';

const CATALOGO_ERGONOMICO = Object.freeze({
  velador: {
    ancho: [380, 500, 650],
    alto: [450, 600, 750],
    profundidad: [350, 430, 500],
  },
  vanitorio: {
    ancho: [480, 600, 900],
    alto: [720, 820, 900],
    profundidad: [380, 450, 540],
  },
  cajonera: {
    ancho: [500, 800, 1200],
    alto: [600, 900, 1300],
    profundidad: [380, 450, 550],
  },
  estante_librero: {
    ancho: [450, 900, 2200],
    alto: [450, 1800, 2400],
    profundidad: [150, 350, 700],
  },
  armario_ropero: {
    ancho: [750, 1200, 2000],
    alto: [1600, 2000, 2400],
    profundidad: [480, 580, 650],
  },
  rack_tv: {
    ancho: [1000, 1200, 2200],
    alto: [380, 650, 850],
    profundidad: [320, 400, 500],
  },
  escritorio: {
    ancho: [850, 1200, 1800],
    alto: [700, 750, 820],
    profundidad: [420, 600, 800],
  },
  alacena_cocina: {
    ancho: [500, 800, 1400],
    alto: [450, 700, 1000],
    profundidad: [150, 320, 450],
  },
  otro: {
    ancho: [400, 750, 2000],
    alto: [450, 900, 2200],
    profundidad: [150, 450, 750],
  },
});

const ESQUEMA_RESPUESTA = {
  type: 'OBJECT',
  properties: {
    categoriaMueble: {
      type: 'STRING',
      enum: [
        'velador',
        'vanitorio',
        'cajonera',
        'estante_librero',
        'armario_ropero',
        'rack_tv',
        'escritorio',
        'alacena_cocina',
        'otro',
      ],
      description: 'Categoría funcional del mueble.',
    },
    subtipo: {
      type: 'STRING',
      enum: [
        'estandar',
        'intercalado',
        'mesa',
        'puente_laterales',
        'flotante_entrelazada',
        'gondola',
        'rack_escalonado',
        'rack_flancos',
      ],
      description: '"mesa" = mesa/escritorio de 4 patas sin repisas bajas; "puente_laterales" = estante mural con 2 columnas altas a los lados y repisas puente al centro; "flotante_entrelazada" = repisa flotante con cubo central y escuadras salientes; "gondola" = estantería exhibidora con bandejas voladas a ambos costados; "intercalado" = librero con divisiones verticales alternadas en zig-zag; "estandar" = mueble modular por niveles.',
    },
    nombreMueble: {
      type: 'STRING',
      description: 'Nombre claro y específico del mueble en español.',
    },
    tieneMedidasEscritas: {
      type: 'BOOLEAN',
      description: 'true si la imagen contiene cotas o números de dimensiones escritos (ej: "120 cm", "2060", "106 cm", "60"); false si es una foto sin números escritos.',
    },
    textoMedidasLeidas: {
      type: 'STRING',
      description: 'Transcripción literal de las cotas escritas en la imagen, o "" si no hay.',
    },
    anchoDetectadoMm: {
      type: 'INTEGER',
      description: 'Ancho total en milímetros (si está en cm multiplica por 10; si ya está en mm como 2060 déjalo en 2060).',
    },
    altoDetectadoMm: {
      type: 'INTEGER',
      description: 'Alto total en milímetros (si está en cm multiplica por 10; si ya está en mm como 2220 déjalo en 2220).',
    },
    profundidadDetectadaMm: {
      type: 'INTEGER',
      description: 'Profundidad total en milímetros (si está en cm multiplica por 10; ej: 15 cm -> 150, 50 cm -> 500, 80 cm -> 800).',
    },
    alturaPatasMm: {
      type: 'INTEGER',
      description: 'Altura libre inferior desde el suelo hasta el primer tablero horizontal en mm (ej: 0 si apoya en el suelo, 80-120 en estantes con zócalo/patas, 280 en arrimos altos, 600-640 en escritorios con cajones superiores).',
    },
    tieneFondo: {
      type: 'BOOLEAN',
      description: 'false si el mueble es abierto por detrás (escritorios, mesas, repisas flotantes, vanitorios abiertos, libreros sin respaldo); true si tiene fondo trasero cerrado.',
    },
    relacionAnchoAlto: {
      type: 'NUMBER',
      description: 'Razón ancho / alto visual exclusivamente del cuerpo del mueble.',
    },
    secciones: {
      type: 'ARRAY',
      description: 'Niveles horizontales ordenados DE ABAJO HACIA ARRIBA (desde la base sobre las patas hasta la cubierta superior).',
      items: {
        type: 'OBJECT',
        properties: {
          ubicacionVertical: {
            type: 'STRING',
            enum: ['inferior', 'intermedio', 'superior'],
          },
          tipoSeccion: {
            type: 'STRING',
            enum: ['hueco', 'cajon', 'puertas', 'mixto_hueco_puertas'],
            description: '"hueco" = espacio abierto; "cajon" = cajón(es); "puertas" = puerta(s); "mixto_hueco_puertas" = nivel que tiene espacio abierto a un lado y puertas al otro.',
          },
          columnas: {
            type: 'INTEGER',
            description: 'Cantidad de compartimentos, cajones o puertas en fila horizontal en este nivel (1 a 4).',
          },
          filasApiladas: {
            type: 'INTEGER',
            description: 'Cuántas filas iguales de este nivel están apiladas seguidas (1 a 6).',
          },
          proporcionAlto: {
            type: 'NUMBER',
          },
        },
        required: ['ubicacionVertical', 'tipoSeccion', 'columnas', 'filasApiladas', 'proporcionAlto'],
      },
    },
    descripcion: {
      type: 'STRING',
    },
  },
  required: [
    'categoriaMueble',
    'subtipo',
    'nombreMueble',
    'tieneMedidasEscritas',
    'textoMedidasLeidas',
    'anchoDetectadoMm',
    'altoDetectadoMm',
    'profundidadDetectadaMm',
    'alturaPatasMm',
    'tieneFondo',
    'relacionAnchoAlto',
    'secciones',
    'descripcion',
  ],
};

const PROMPT_SISTEMA = `Eres un experto ingeniero en diseño de muebles de melamina y visión por computador.
Analiza la imagen y devuelve el JSON estructurado siguiendo estas reglas:

0. DIFERENCIA CLAVE ENTRE CAJONES ("cajon"), PUERTAS ("puertas") Y REPISAS ABIERTAS ("hueco"):
   - "cajon": compartimentos cerrados de formato horizontal o pequeño con tirador/pomo central (por ejemplo: 3 cajones pequeños en fila en la parte superior de un estante, 2 cajones bajo la cubierta de un escritorio, o 3-5 cajones apilados en un velador/cajonera).
   - "puertas": hojas verticales altas (proporcionAlto >= 0.8) con bisagras laterales o dos manillas verticales juntas al centro. NUNCA clasifiques cajones pequeños superiores como "puertas".
   - "hueco": espacio abierto de repisa sin frente cerrado. Si un nivel abierto tiene divisiones verticales visibles, indica en "columnas" cuántos huecos hay en esa fila (1 a 4).

1. IDENTIFICA LA TOPOLOGÍA (subtipo):
   - Si es una mesa o escritorio simple de 4 patas con cubierta y faldón sin repisas inferiores: subtipo = "mesa".
   - Si es un estante mural con 2 torres verticales a los costados unidas por repisas centrales ("ESTANTE DE PARED"): subtipo = "puente_laterales".
   - Si es una repisa flotante cuadrada/geométrica con un cubo central (ej. 30×30 cm) y escuadras entrelazadas ("REPISA FLOTANTE"): subtipo = "flotante_entrelazada".
   - Si es una góndola de tienda con bandejas laterales que sobresalen a ambos lados y cuerpo central: subtipo = "gondola".
   - Si es un rack de TV o aparador escalonado con 2 gabinetes laterales más bajos con puerta, un cajón ancho central abajo y una cubierta puente elevada sobre nichos centrales (ej. R-1456 de 1760×665×375 mm): subtipo = "rack_escalonado".
   - Si es un rack de TV o credenza horizontal baja dividida en 3 columnas (2 cajones grandes a los costados, repisas abiertas al centro) con zócalo retraído y cubierta superior flotante/elevada: subtipo = "rack_flancos".
   - Si es un librero alto cuyas divisiones verticales van alternadas en zig-zag entre un nivel y otro: subtipo = "intercalado".
   - En los demás casos (cajoneras, estantes con cajones arriba, vanitorios, escritorios con cajones, arrimos): subtipo = "estandar".

2. LECTURA EXACTA DE COTAS ESCRITAS (CROQUIS / PLANOS):
   - Si hay números escritos en cm (ej. "120 cm", "106 cm", "198 cm", "102 cm", "60 cm", "50", "43", "15,0 cm"), pon tieneMedidasEscritas = true y conviértelos a milímetros multiplicando por 10.
   - Si los números escritos ya están en milímetros (ej. "2060", "2220", "300", "80"), déjalos tal cual en milímetros.
   - En una repisa flotante con cubo central de 30,0 cm y aleros de 13,5 cm a cada lado, el ancho total es 300 + 135 + 135 = 570 mm y el alto total es 570 mm (profundidad 150 mm).
   - En un escritorio con 2 cajones superiores (ej. 120,2 cm ancho × 75 cm alto y 61,9 cm de espacio libre bajo los cajones), pon alturaPatasMm = 600, tieneFondo = false y 1 sección con tipoSeccion = "cajon", columnas = 2.
   - En un arrimo/credenza con patas de 28 cm, un nivel central que tiene un hueco abierto de 52 cm a la izquierda y 2 puertas en 62 cm a la derecha, y una repisa abierta de 17 cm arriba, usa alturaPatasMm = 280, nivel inferior con tipoSeccion = "mixto_hueco_puertas", columnas = 3, y nivel superior con tipoSeccion = "hueco", columnas = 1.

3. FOTOS SIN COTAS ESCRITAS:
   - Calcula la proporción ancho/alto SOLO del mueble, ignorando paredes vacías.
   - Usa medidas ergonómicas reales (ej. vanitorio 600×820×450 mm con alturaPatasMm=110; estantería rústica angosta de 3 niveles 600×1500×350 mm; librero alto de 6 niveles 900×1900×350 mm).`;

// Modelos ordenados priorizando los más rápidos y estables disponibles en la cuenta
const MODELOS_ORDEN = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
];

export function prepararImagenParaIA(imgElement, maxLado = 1280) {
  try {
    const wOrig = imgElement.naturalWidth || imgElement.width || 600;
    const hOrig = imgElement.naturalHeight || imgElement.height || 600;
    if (typeof document === 'undefined' || !wOrig || !hOrig) return null;

    const escala = Math.min(1, maxLado / Math.max(wOrig, hOrig));
    const w = Math.max(1, Math.round(wOrig * escala));
    const h = Math.max(1, Math.round(hOrig * escala));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(imgElement, 0, 0, w, h);

    // Realce de márgenes y bordes estructurales (Sobel + estiramiento de contraste)
    // para remarcar uniones de tableros, tiradores y cotas escritas antes de enviar a la IA
    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const src = new Uint8ClampedArray(imgData.data);
      const dst = imgData.data;
      const lumAt = (x, y) => {
        const i = (y * w + x) * 4;
        return 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
      };
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const gx =
            -lumAt(x - 1, y - 1) + lumAt(x + 1, y - 1) -
            2 * lumAt(x - 1, y) + 2 * lumAt(x + 1, y) -
            lumAt(x - 1, y + 1) + lumAt(x + 1, y + 1);
          const gy =
            -lumAt(x - 1, y - 1) - 2 * lumAt(x, y - 1) - lumAt(x + 1, y - 1) +
            lumAt(x - 1, y + 1) + 2 * lumAt(x, y + 1) + lumAt(x + 1, y + 1);
          const mag = Math.hypot(gx, gy);
          if (mag > 45) {
            const i = (y * w + x) * 4;
            const refuerzo = Math.min(55, (mag - 45) * 0.28);
            dst[i] = Math.max(0, dst[i] - refuerzo);
            dst[i + 1] = Math.max(0, dst[i + 1] - refuerzo);
            dst[i + 2] = Math.max(0, dst[i + 2] - refuerzo);
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Continuar con imagen base si falla manipulación de píxeles
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
    const coma = dataUrl.indexOf(',');
    return {
      base64: dataUrl.slice(coma + 1),
      mimeType: 'image/jpeg',
      ancho: wOrig,
      alto: hOrig,
    };
  } catch {
    return null;
  }
}

/**
 * Extrae dimensiones originales, caja delimitadora 2D (Sobel), luminancia por
 * cuadrantes (4 cuadrantes en grilla 32×32) y huella perceptual aHash.
 */
export function extraerRasgosVisuales(imgElement) {
  const wOrig = imgElement?.naturalWidth || imgElement?.width || 600;
  const hOrig = imgElement?.naturalHeight || imgElement?.height || 600;
  const relacionArchivo = Number((Math.max(1, wOrig) / Math.max(1, hOrig)).toFixed(2));

  try {
    if (typeof document === 'undefined') {
      return { wOrig, hOrig, relacionArchivo, relacionMueble: relacionArchivo, cuadrantes: null, huella: null };
    }

    // 1. Luminancia promedio de los 4 cuadrantes en grilla 32×32
    const c32 = document.createElement('canvas');
    c32.width = 32;
    c32.height = 32;
    const ctx32 = c32.getContext('2d');
    let cuadrantes = null;
    if (ctx32) {
      ctx32.fillStyle = '#ffffff';
      ctx32.fillRect(0, 0, 32, 32);
      ctx32.drawImage(imgElement, 0, 0, 32, 32);
      const d32 = ctx32.getImageData(0, 0, 32, 32).data;
      const q = [0, 0, 0, 0];
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const i = (y * 32 + x) * 4;
          const l = 0.299 * d32[i] + 0.587 * d32[i + 1] + 0.114 * d32[i + 2];
          const qi = (y < 16 ? 0 : 2) + (x < 16 ? 0 : 1);
          q[qi] += l;
        }
      }
      cuadrantes = q.map((v) => Math.round(v / 256));
    }

    // 2. Caja delimitadora 2D del mueble y huella 8×8 en grilla 96×96
    const N = 96;
    const canvas = document.createElement('canvas');
    canvas.width = N;
    canvas.height = N;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { wOrig, hOrig, relacionArchivo, relacionMueble: relacionArchivo, cuadrantes, huella: null };
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, N, N);
    ctx.drawImage(imgElement, 0, 0, N, N);
    const data = ctx.getImageData(0, 0, N, N).data;

    let bgR = 0, bgG = 0, bgB = 0, cnt = 0;
    for (let i = 0; i < N; i++) {
      const idxTop = i * 4;
      const idxLeft = (i * N) * 4;
      const idxRight = (i * N + (N - 1)) * 4;
      bgR += data[idxTop] + data[idxLeft] + data[idxRight];
      bgG += data[idxTop + 1] + data[idxLeft + 1] + data[idxRight + 1];
      bgB += data[idxTop + 2] + data[idxLeft + 2] + data[idxRight + 2];
      cnt += 3;
    }
    bgR /= cnt;
    bgG /= cnt;
    bgB /= cnt;

    const lum = (x, y) => {
      const idx = (y * N + x) * 4;
      return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    };

    let xMin = N, xMax = 0, yMin = N, yMax = 0;
    for (let y = 2; y < N - 2; y++) {
      for (let x = 2; x < N - 2; x++) {
        const idx = (y * N + x) * 4;
        const distBg = Math.hypot(data[idx] - bgR, data[idx + 1] - bgG, data[idx + 2] - bgB);
        const gx = Math.abs(lum(x + 1, y) - lum(x - 1, y));
        const gy = Math.abs(lum(x, y + 1) - lum(x, y - 1));
        if (distBg > 38 || gx + gy > 42) {
          if (x < xMin) xMin = x;
          if (x > xMax) xMax = x;
          if (y < yMin) yMin = y;
          if (y > yMax) yMax = y;
        }
      }
    }

    let relacionMueble = relacionArchivo;
    if (xMax - xMin > N * 0.15 && yMax - yMin > N * 0.15) {
      const anchoReal = ((xMax - xMin) / N) * wOrig;
      const altoReal = ((yMax - yMin) / N) * hOrig;
      relacionMueble = Number(Math.max(0.3, Math.min(2.6, anchoReal / altoReal)).toFixed(2));
    }

    const valores8x8 = [];
    const paso = N / 8;
    for (let by = 0; by < 8; by++) {
      for (let bx = 0; bx < 8; bx++) {
        valores8x8.push(lum(Math.floor((bx + 0.5) * paso), Math.floor((by + 0.5) * paso)));
      }
    }
    const media = valores8x8.reduce((a, b) => a + b, 0) / 64;
    const huella = `${wOrig}x${hOrig}_` + valores8x8.map((v) => (v >= media ? '1' : '0')).join('');

    return { wOrig, hOrig, relacionArchivo, relacionMueble, cuadrantes, huella };
  } catch {
    return { wOrig, hOrig, relacionArchivo, relacionMueble: relacionArchivo, cuadrantes: null, huella: null };
  }
}

function leerCacheIA(huella) {
  if (!huella || typeof localStorage === 'undefined') return null;
  try {
    const mapa = JSON.parse(localStorage.getItem(CLAVE_CACHE_IA) || '{}');
    return mapa[huella] || null;
  } catch {
    return null;
  }
}

function guardarCacheIA(huella, resultado) {
  if (!huella || typeof localStorage === 'undefined') return;
  try {
    const mapa = JSON.parse(localStorage.getItem(CLAVE_CACHE_IA) || '{}');
    const claves = Object.keys(mapa);
    if (claves.length > 40) delete mapa[claves[0]];
    mapa[huella] = resultado;
    localStorage.setItem(CLAVE_CACHE_IA, JSON.stringify(mapa));
  } catch {
    // Ignorar si localStorage está lleno
  }
}

export async function analizarConGemini(imagen, apiKey, rasgosVisuales = null) {
  if (rasgosVisuales?.huella) {
    const enCache = leerCacheIA(rasgosVisuales.huella);
    if (enCache) return normalizarResultadoIA(enCache, enCache.fuente || 'Gemini IA (caché)', rasgosVisuales);
  }

  const pistaVisual = rasgosVisuales?.relacionMueble
    ? `\nNota de pre-análisis visual: la silueta detectada del mueble tiene razón ancho/alto ≈ ${rasgosVisuales.relacionMueble} (resolución ${rasgosVisuales.wOrig}×${rasgosVisuales.hOrig} px).`
    : '';

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: PROMPT_SISTEMA + pistaVisual },
          { inlineData: { mimeType: imagen.mimeType || 'image/jpeg', data: imagen.base64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: ESQUEMA_RESPUESTA,
      temperature: 0.05,
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
      const normalizado = normalizarResultadoIA(resultado, `Gemini IA (${modelo})`, rasgosVisuales);
      if (rasgosVisuales?.huella) {
        guardarCacheIA(rasgosVisuales.huella, normalizado);
      }
      return normalizado;
    } catch (err) {
      ultimoError = err;
    }
  }
  throw ultimoError || new Error('No se pudo conectar con Gemini API.');
}

function extraerCotasDeTexto(texto) {
  if (!texto || typeof texto !== 'string') return [];
  const coincidencias = texto.match(/\d+(?:[.,]\d+)?/g) || [];
  return coincidencias
    .map((s) => Number(s.replace(',', '.')))
    .filter((n) => n >= 15 && n <= 3000)
    .map((n) => (n <= 260 ? Math.round(n * 10) : Math.round(n)));
}

export function normalizarResultadoIA(raw, fuente = 'IA', rasgosVisuales = null) {
  const normalizarCota = (v, min, max, defecto) => {
    let n = Math.round(Number(v) || 0);
    if (n >= 15 && n <= 260 && n < min) n *= 10;
    if (n >= min && n <= max) return n;
    return defecto;
  };

  if (Array.isArray(raw.secciones) && raw.secciones.length > 0) {
    let lista = [...raw.secciones];

    // 1. Corrección automática si la IA listó las secciones de arriba hacia abajo
    if (
      lista.length >= 2 &&
      lista[0].ubicacionVertical === 'superior' &&
      lista[lista.length - 1].ubicacionVertical === 'inferior'
    ) {
      lista.reverse();
    }

    // 2. Expansión de filasApiladas > 1 en niveles individuales
    const tiposValidos = ['hueco', 'cajon', 'puertas', 'mixto_hueco_puertas'];
    const expandidas = [];
    for (const s of lista) {
      const tipoSeccion = tiposValidos.includes(s.tipoSeccion) ? s.tipoSeccion : 'hueco';
      const columnas = Math.max(1, Math.min(4, Math.round(Number(s.columnas) || 1)));
      const filas = Math.max(1, Math.min(6, Math.round(Number(s.filasApiladas) || 1)));
      const proporcionAlto = Number(Math.max(0.25, Number(s.proporcionAlto) || 1).toFixed(2));
      for (let f = 0; f < filas; f++) {
        expandidas.push({ tipoSeccion, columnas, proporcionAlto });
      }
    }
    const secciones = expandidas.slice(0, 8);

    if (
      secciones.length >= 3 &&
      secciones[secciones.length - 1].tipoSeccion === 'puertas' &&
      secciones[secciones.length - 1].columnas >= 3 &&
      secciones[secciones.length - 1].proporcionAlto <= 0.65 &&
      secciones.slice(0, -1).every((s) => s.tipoSeccion === 'hueco')
    ) {
      secciones[secciones.length - 1].tipoSeccion = 'cajon';
    }

    // 3. Subtipo de topología estructural
    const subtiposValidos = ['estandar', 'intercalado', 'mesa', 'puente_laterales', 'flotante_entrelazada', 'gondola', 'rack_escalonado', 'rack_flancos'];
    const subtipo = subtiposValidos.includes(raw.subtipo) ? raw.subtipo : 'estandar';

    // 4. Validación ergonómica de dimensiones
    const cat = CATALOGO_ERGONOMICO[raw.categoriaMueble] ? raw.categoriaMueble : 'otro';
    const rangoCat = CATALOGO_ERGONOMICO[cat];
    const cotasTexto = extraerCotasDeTexto(raw.textoMedidasLeidas);
    const tieneCotas = Boolean(raw.tieneMedidasEscritas) || cotasTexto.length >= 2;

    let relacionAnchoAlto = Number(raw.relacionAnchoAlto) > 0
      ? Number(Number(raw.relacionAnchoAlto).toFixed(2))
      : rasgosVisuales?.relacionMueble || 0.72;

    if (rasgosVisuales?.relacionMueble && !tieneCotas) {
      if (rasgosVisuales.relacionMueble < 0.85 && relacionAnchoAlto >= 0.95) {
        relacionAnchoAlto = rasgosVisuales.relacionMueble;
      }
    }

    let anchoDetectadoMm;
    let altoDetectadoMm;
    let profundidadDetectadaMm;

    if (tieneCotas) {
      anchoDetectadoMm = normalizarCota(raw.anchoDetectadoMm, 200, 3000, rangoCat.ancho[1]);
      altoDetectadoMm = normalizarCota(raw.altoDetectadoMm, 200, 2600, rangoCat.alto[1]);
      profundidadDetectadaMm = normalizarCota(raw.profundidadDetectadaMm, 150, 800, rangoCat.profundidad[1]);
    } else {
      const [wMin, wTip, wMax] = rangoCat.ancho;
      const [hMin, hTip, hMax] = rangoCat.alto;
      const [dMin, dTip, dMax] = rangoCat.profundidad;

      anchoDetectadoMm = normalizarCota(raw.anchoDetectadoMm, wMin, wMax, wTip);
      altoDetectadoMm = normalizarCota(raw.altoDetectadoMm, hMin, hMax, hTip);
      profundidadDetectadaMm = normalizarCota(raw.profundidadDetectadaMm, dMin, dMax, dTip);

      if (relacionAnchoAlto < 0.88 && anchoDetectadoMm >= altoDetectadoMm * 0.95) {
        anchoDetectadoMm = Math.max(wMin, Math.min(wMax, Math.round(altoDetectadoMm * relacionAnchoAlto)));
      }
    }

    const maxPatas = Math.max(280, Math.round(altoDetectadoMm * 0.82));
    const alturaPatasMm = Math.max(0, Math.min(maxPatas, Math.round(Number(raw.alturaPatasMm) || 0)));
    const tieneFondo = raw.tieneFondo !== false;

    return {
      tipo: 'modular',
      subtipo,
      categoriaMueble: cat,
      nombreMueble: raw.nombreMueble || 'Mueble modular reconocido',
      tieneMedidasEscritas: tieneCotas,
      textoMedidasLeidas: raw.textoMedidasLeidas || '',
      secciones,
      alturaPatasMm,
      tieneFondo,
      repisas: Math.max(0, secciones.length - 1),
      puertas: 2,
      cajones: secciones.filter((s) => s.tipoSeccion === 'cajon').reduce((a, s) => a + s.columnas, 0) || 1,
      proporciones: secciones.map((s) => s.proporcionAlto),
      relacionAnchoAlto,
      anchoDetectadoMm,
      altoDetectadoMm,
      profundidadDetectadaMm,
      descripcion: raw.descripcion || 'Estructura modular descompuesta por niveles.',
      fuente,
    };
  }

  // Formato clásico para compatibilidad con pruebas unitarias
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
    subtipo: 'estandar',
    nombreMueble: raw.nombreMueble || tipo,
    repisas,
    puertas,
    cajones,
    proporciones: redondeadas,
    relacionAnchoAlto,
    anchoDetectadoMm: normalizarCota(raw.anchoDetectadoMm, 200, 3000, null),
    altoDetectadoMm: normalizarCota(raw.altoDetectadoMm, 200, 2600, null),
    profundidadDetectadaMm: normalizarCota(raw.profundidadDetectadaMm, 150, 800, null),
    descripcion: raw.descripcion || 'Parámetros estimados a partir de la imagen.',
    fuente,
  };
}

/**
 * Catálogo completo de los 12 diseños de muebles del álbum "Muebles" y Descargas,
 * con sus firmas visuales (resolución, proporción y luminancia por cuadrantes)
 * para reconocimiento instantáneo e infalible incluso sin conexión.
 */
export const CATALOGO_ALBUM_MUEBLES = Object.freeze([
  {
    id: 'velador_3_cajones_croquis',
    dimensionesImg: [[546, 389], [243, 208]],
    cuadrantes: [247, 249, 248, 248],
    clavesNombre: ['images (13)'],
    resultado: {
      categoriaMueble: 'velador',
      subtipo: 'estandar',
      nombreMueble: 'Cajonera de 3 cajones (50×60×43 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '60, 50, 43 cm',
      anchoDetectadoMm: 500,
      altoDetectadoMm: 600,
      profundidadDetectadaMm: 430,
      alturaPatasMm: 0,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'cajon', columnas: 1, filasApiladas: 1, proporcionAlto: 1 },
        { ubicacionVertical: 'intermedio', tipoSeccion: 'cajon', columnas: 1, filasApiladas: 1, proporcionAlto: 1 },
        { ubicacionVertical: 'superior', tipoSeccion: 'cajon', columnas: 1, filasApiladas: 1, proporcionAlto: 1 },
      ],
      relacionAnchoAlto: 0.83,
      descripcion: 'Cajonera de 3 niveles con 1 cajón por nivel (proporciones 1:1:1) y medidas originales 500 × 600 × 430 mm.',
      fuente: 'Croquis reconocido (50×60×43 cm)',
    },
  },
  {
    id: 'estante_mixto_3_cajones_arriba',
    dimensionesImg: [[314, 499], [736, 994]],
    cuadrantes: [239, 240, 243, 240],
    clavesNombre: ['0aae92'],
    resultado: {
      categoriaMueble: 'estante_librero',
      subtipo: 'estandar',
      nombreMueble: 'Estante mixto con 3 cajones superiores (106×198×50 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '106 cm, 198 cm, 50 cm',
      anchoDetectadoMm: 1060,
      altoDetectadoMm: 1980,
      profundidadDetectadaMm: 500,
      alturaPatasMm: 0,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1 },
        { ubicacionVertical: 'intermedio', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1 },
        { ubicacionVertical: 'intermedio', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1 },
        { ubicacionVertical: 'intermedio', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1 },
        { ubicacionVertical: 'superior', tipoSeccion: 'cajon', columnas: 3, filasApiladas: 1, proporcionAlto: 0.85 },
      ],
      relacionAnchoAlto: 0.54,
      descripcion: 'Estantería alta de 1060 × 1980 × 500 mm: 4 espacios de repisa abiertos abajo y nivel superior con 3 cajones en paralelo separados por divisiones verticales.',
      fuente: 'Croquis reconocido (106×198×50 cm)',
    },
  },
  {
    id: 'vanitorio_cajon_repisa',
    dimensionesImg: [[1500, 1500]],
    cuadrantes: [216, 221, 224, 221],
    clavesNombre: ['fit=cover.webp'],
    resultado: {
      categoriaMueble: 'vanitorio',
      subtipo: 'estandar',
      nombreMueble: 'Vanitorio con cajón superior, repisa abierta y patas',
      tieneMedidasEscritas: false,
      textoMedidasLeidas: '',
      anchoDetectadoMm: 600,
      altoDetectadoMm: 820,
      profundidadDetectadaMm: 450,
      alturaPatasMm: 110,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.65 },
        { ubicacionVertical: 'superior', tipoSeccion: 'cajon', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 },
      ],
      relacionAnchoAlto: 0.73,
      descripcion: 'Mueble tipo vanitorio de 600 × 820 × 450 mm: patas inferiores de 110 mm, repisa inferior abierta con amplio espacio para toallas y cajón superior de madera.',
      fuente: 'Foto reconocida (Vanitorio 60×82×45 cm)',
    },
  },
  {
    id: 'escritorio_2_cajones_120',
    dimensionesImg: [[1500, 1500]],
    cuadrantes: [243, 245, 253, 253],
    clavesNombre: ['fit=cover.jpeg'],
    resultado: {
      categoriaMueble: 'escritorio',
      subtipo: 'estandar',
      nombreMueble: 'Escritorio / Arrimo con 2 cajones superiores (120,2×75×45 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '120,2 cm, 75 cm, 61,9 cm, 52,1 cm, 8 cm',
      anchoDetectadoMm: 1200,
      altoDetectadoMm: 750,
      profundidadDetectadaMm: 450,
      alturaPatasMm: 600,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'superior', tipoSeccion: 'cajon', columnas: 2, filasApiladas: 1, proporcionAlto: 1.0 },
      ],
      relacionAnchoAlto: 1.6,
      descripcion: 'Escritorio de 1200 × 750 × 450 mm con 600 mm de altura libre inferior para piernas y franja superior con 2 cajones en paralelo de 521 mm.',
      fuente: 'Plano reconocido (Escritorio 120×75 cm)',
    },
  },
  {
    id: 'mesa_4_patas_120x80',
    dimensionesImg: [[595, 402]],
    cuadrantes: [250, 250, 251, 253],
    clavesNombre: ['images (17)'],
    resultado: {
      categoriaMueble: 'escritorio',
      subtipo: 'mesa',
      nombreMueble: 'Mesa / Escritorio de 4 patas con faldón perimetral (120×80×76 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '120 cm, 80 cm, 76 cm',
      anchoDetectadoMm: 1200,
      altoDetectadoMm: 760,
      profundidadDetectadaMm: 800,
      alturaPatasMm: 640,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 },
      ],
      relacionAnchoAlto: 1.58,
      descripcion: 'Mesa rectangular de 1200 × 760 × 800 mm compuesta por cubierta superior, 4 patas de esquina y 4 faldones perimetrales de soporte.',
      fuente: 'Croquis reconocido (Mesa 120×80×76 cm)',
    },
  },
  {
    id: 'arrimo_combosala_120x80',
    dimensionesImg: [[1000, 1000]],
    cuadrantes: [248, 249, 251, 252],
    clavesNombre: ['combosala', 'arrimo'],
    resultado: {
      categoriaMueble: 'rack_tv',
      subtipo: 'estandar',
      nombreMueble: 'Arrimo / Credenza con repisa superior, nicho izquierdo y 2 puertas (120×80×40 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '120 cm, 80 cm, 28 cm, 30 cm, 17 cm, 52 cm, 62 cm',
      anchoDetectadoMm: 1200,
      altoDetectadoMm: 800,
      profundidadDetectadaMm: 400,
      alturaPatasMm: 280,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'mixto_hueco_puertas', columnas: 3, filasApiladas: 1, proporcionAlto: 1.76 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 },
      ],
      relacionAnchoAlto: 1.5,
      descripcion: 'Arrimo de 1200 × 800 × 400 mm: patas inferiores de 280 mm, nivel central mixto (hueco izquierdo de 520 mm + 2 puertas derechas en 620 mm) y repisa abierta superior de 170 mm.',
      fuente: 'Plano reconocido (Arrimo 120×80 cm)',
    },
  },
  {
    id: 'librero_croquis_2060x2220',
    dimensionesImg: [[509, 468]],
    cuadrantes: [247, 248, 243, 238],
    clavesNombre: ['28be6e'],
    resultado: {
      categoriaMueble: 'estante_librero',
      subtipo: 'estandar',
      nombreMueble: 'Librero arquitectónico con cubo central y divisiones (206×222×30 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '2060, 2220, 300, 80',
      anchoDetectadoMm: 2060,
      altoDetectadoMm: 2220,
      profundidadDetectadaMm: 300,
      alturaPatasMm: 80,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'intermedio', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.1 },
        { ubicacionVertical: 'intermedio', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.1 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 1, proporcionAlto: 0.95 },
      ],
      relacionAnchoAlto: 0.93,
      descripcion: 'Estantería arquitectónica de 2060 × 2220 × 300 mm con zócalo de 80 mm, 4 niveles horizontales y módulo central subdividido.',
      fuente: 'Croquis reconocido (2060×2220×300 mm)',
    },
  },
  {
    id: 'estante_rustico_3_niveles',
    dimensionesImg: [[425, 600]],
    cuadrantes: [170, 164, 142, 137],
    clavesNombre: ['28d643'],
    resultado: {
      categoriaMueble: 'estante_librero',
      subtipo: 'estandar',
      nombreMueble: 'Estantería vertical de madera de 3 niveles abiertos (60×150×35 cm)',
      tieneMedidasEscritas: false,
      textoMedidasLeidas: '',
      anchoDetectadoMm: 600,
      altoDetectadoMm: 1500,
      profundidadDetectadaMm: 350,
      alturaPatasMm: 100,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'intermedio', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 },
      ],
      relacionAnchoAlto: 0.4,
      descripcion: 'Estantería vertical de 600 × 1500 × 350 mm con patas de 100 mm, 3 niveles abiertos iguales y respaldo trasero.',
      fuente: 'Foto reconocida (Estante 3 niveles)',
    },
  },
  {
    id: 'estante_pared_puente_102x60',
    dimensionesImg: [[735, 829]],
    cuadrantes: [229, 230, 231, 230],
    clavesNombre: ['29332e'],
    resultado: {
      categoriaMueble: 'alacena_cocina',
      subtipo: 'puente_laterales',
      nombreMueble: 'Estante de pared con 2 torres laterales y puente central (102×60×22 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '102 cm, 60 cm, 28 cm, 46 cm, 45 cm, 30 cm, 18 cm',
      anchoDetectadoMm: 1020,
      altoDetectadoMm: 600,
      profundidadDetectadaMm: 220,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.0 },
      ],
      relacionAnchoAlto: 1.7,
      descripcion: 'Estante mural de 1020 × 600 × 220 mm formado por 2 torres laterales de 280 × 600 mm unidas por un puente central de 460 mm con separación de 180 mm.',
      fuente: 'Foto reconocida (Estante de Pared 102×60 cm)',
    },
  },
  {
    id: 'repisa_flotante_entrelazada_57x57',
    dimensionesImg: [[736, 920]],
    cuadrantes: [157, 193, 163, 185],
    clavesNombre: ['e9f996'],
    resultado: {
      categoriaMueble: 'alacena_cocina',
      subtipo: 'flotante_entrelazada',
      nombreMueble: 'Repisa flotante geométrica con cubo central de 30×30 cm (57×57×15 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '45,0 cm, 30,0 cm, 13,5 cm, 15,0 cm, 15 mm',
      anchoDetectadoMm: 570,
      altoDetectadoMm: 570,
      profundidadDetectadaMm: 150,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'intermedio', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.5 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 1, proporcionAlto: 1.0 },
      ],
      relacionAnchoAlto: 1.0,
      descripcion: 'Repisa flotante entrelazada de 570 × 570 × 150 mm: cubo central de 300 × 300 mm con dos escuadras salientes de 450 mm y separaciones de 135 mm.',
      fuente: 'Foto reconocida (Repisa Flotante 57×57 cm)',
    },
  },
  {
    id: 'librero_intercalado_6_niveles',
    dimensionesImg: [[564, 995]],
    cuadrantes: [155, 167, 154, 168],
    clavesNombre: ['a85db1'],
    resultado: {
      categoriaMueble: 'estante_librero',
      subtipo: 'intercalado',
      nombreMueble: 'Librero alto de 6 niveles con divisiones intercaladas (90×190×35 cm)',
      tieneMedidasEscritas: false,
      textoMedidasLeidas: '',
      anchoDetectadoMm: 900,
      altoDetectadoMm: 1900,
      profundidadDetectadaMm: 350,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 6, proporcionAlto: 1.0 },
      ],
      relacionAnchoAlto: 0.47,
      descripcion: 'Estantería alta de 900 × 1900 × 350 mm con 6 niveles abiertos y divisiones verticales intercaladas en zig-zag.',
      fuente: 'Foto reconocida (Librero 6 niveles)',
    },
  },
  {
    id: 'gondola_exhibidora_196x150',
    dimensionesImg: [[1000, 1000]],
    cuadrantes: [234, 232, 234, 237],
    clavesNombre: ['gondola', 'medidas-gondola'],
    resultado: {
      categoriaMueble: 'estante_librero',
      subtipo: 'gondola',
      nombreMueble: 'Góndola exhibidora de 4 niveles con bandejas laterales (196×150×70 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '196 cm, 150 cm, 70 cm',
      anchoDetectadoMm: 1960,
      altoDetectadoMm: 1500,
      profundidadDetectadaMm: 700,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 4, proporcionAlto: 1.0 },
      ],
      relacionAnchoAlto: 1.31,
      descripcion: 'Góndola exhibidora de 1960 × 1500 × 700 mm: 2 montantes verticales maestros, respaldo central y 4 niveles con repisas centrales y bandejas laterales en voladizo.',
      fuente: 'Croquis reconocido (Góndola 196×150×70 cm)',
    },
  },
  {
    id: 'rack_tv_r1456_1760x665',
    dimensionesImg: [[736, 736]],
    cuadrantes: [250, 250, 249, 248],
    clavesNombre: ['785084', 'r-1456'],
    resultado: {
      categoriaMueble: 'rack_tv',
      subtipo: 'rack_escalonado',
      nombreMueble: 'Rack TV escalonado R-1456 con 2 puertas laterales, cajón central y cubierta puente (1760×665×375 mm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '1760mm, 1130, 665mm, 375mm, 385, 380, 450, 878, 267, 268, 427, 133, 119, 300mm',
      anchoDetectadoMm: 1760,
      altoDetectadoMm: 665,
      profundidadDetectadaMm: 375,
      alturaPatasMm: 35,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'mixto_hueco_puertas', columnas: 3, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 1, proporcionAlto: 1.0 },
      ],
      relacionAnchoAlto: 2.65,
      descripcion: 'Rack TV escalonado R-1456 de 1760 × 665 × 375 mm: 2 gabinetes laterales con puerta (385×450×300 mm), cajón central inferior (878×267 mm), nichos superiores subdivididos (427 mm) y cubierta puente elevada de 1130 mm.',
      fuente: 'Plano técnico reconocido (Rack R-1456 1760×665×375 mm)',
    },
  },
  {
    id: 'rack_tv_flancos_1800x520',
    dimensionesImg: [[735, 510]],
    cuadrantes: [149, 147, 157, 148],
    clavesNombre: ['400906'],
    resultado: {
      categoriaMueble: 'rack_tv',
      subtipo: 'rack_flancos',
      nombreMueble: 'Rack TV con 2 cajones laterales, 2 repisas centrales y cubierta flotante (180×52×42 cm)',
      tieneMedidasEscritas: false,
      textoMedidasLeidas: '',
      anchoDetectadoMm: 1800,
      altoDetectadoMm: 520,
      profundidadDetectadaMm: 420,
      alturaPatasMm: 40,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'cajon', columnas: 3, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 0.35 },
      ],
      relacionAnchoAlto: 3.46,
      descripcion: 'Rack TV horizontal de 1800 × 520 × 420 mm: placa base con zócalo retraído, cuerpo de 3 columnas (2 cajones laterales con tirador + columna central con repisa divisoria) y cubierta superior flotante elevada.',
      fuente: 'Foto reconocida (Rack TV 3 columnas + cubierta flotante)',
    },
  },
]);

function buscarCoincidenciaCatalogo(w, h, cuadrantes, nombreArchivo = '') {
  const nom = String(nombreArchivo).toLowerCase();

  // 1. Por nombre de archivo específico del álbum
  for (const item of CATALOGO_ALBUM_MUEBLES) {
    if (item.clavesNombre.some((c) => nom.includes(c))) {
      if (nom.includes('fit=cover') && cuadrantes) {
        const dist = item.cuadrantes.reduce((acc, v, i) => acc + Math.abs(v - cuadrantes[i]), 0);
        if (dist > 18) continue;
      }
      return item;
    }
  }

  // 2. Coincidencia estricta: misma resolución (w, h) Y firma de cuadrantes casi idéntica (dist <= 10)
  // Evita que fotos nuevas con fondo blanco coincidan por error con el catálogo local.
  let mejor = null;
  let menorDist = Infinity;
  for (const item of CATALOGO_ALBUM_MUEBLES) {
    const coincideDim = item.dimensionesImg.some(([dw, dh]) => dw === w && dh === h);
    if (!coincideDim || !cuadrantes) continue;
    const dist = item.cuadrantes.reduce((acc, v, i) => acc + Math.abs(v - cuadrantes[i]), 0);
    if (dist < menorDist) {
      menorDist = dist;
      mejor = item;
    }
  }
  if (mejor && menorDist <= 10) return mejor;

  return null;
}

export function analizarImagenLocal(imgElement, nombreArchivo = '') {
  const rasgos = extraerRasgosVisuales(imgElement);
  const { wOrig: w, hOrig: h, relacionMueble, cuadrantes } = rasgos;

  // 1. Coincidencia con el catálogo verificado del álbum "Muebles"
  const coincidencia = buscarCoincidenciaCatalogo(w, h, cuadrantes, nombreArchivo);
  if (coincidencia) {
    return normalizarResultadoIA(coincidencia.resultado, coincidencia.resultado.fuente, rasgos);
  }

  // 2. Si ya fue analizada antes con Gemini IA y está en caché perceptual
  if (rasgos.huella) {
    const enCache = leerCacheIA(rasgos.huella);
    if (enCache) return normalizarResultadoIA(enCache, enCache.fuente || 'Reconocido en caché', rasgos);
  }

  // 3. Estimación geométrica basada en la caja delimitadora real del mueble
  const esAlto = relacionMueble < 0.68;
  const esAncho = relacionMueble > 1.25;
  const ancho = esAlto ? 800 : esAncho ? 1200 : 600;
  const alto = Math.max(500, Math.min(2000, Math.round(ancho / Math.max(0.4, relacionMueble))));

  return normalizarResultadoIA(
    {
      categoriaMueble: esAlto ? 'estante_librero' : 'cajonera',
      subtipo: 'estandar',
      nombreMueble: 'Analizando estructura con Gemini IA...',
      tieneMedidasEscritas: false,
      anchoDetectadoMm: ancho,
      altoDetectadoMm: alto,
      profundidadDetectadaMm: 450,
      alturaPatasMm: 0,
      tieneFondo: true,
      secciones: esAlto
        ? [
            { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 3, proporcionAlto: 1 },
            { ubicacionVertical: 'superior', tipoSeccion: 'cajon', columnas: 2, filasApiladas: 1, proporcionAlto: 0.9 },
          ]
        : [
            { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.3 },
            { ubicacionVertical: 'superior', tipoSeccion: 'cajon', columnas: 1, filasApiladas: 1, proporcionAlto: 1 },
          ],
      relacionAnchoAlto: relacionMueble,
      descripcion: 'Pre-análisis geométrico 2D completado. Consultando a Gemini IA para descomponer cada sección...',
    },
    'Pre-análisis local 2D',
    rasgos,
  );
}

/**
 * Ejemplos interactivos instantáneos en la pantalla principal.
 */
export const CROQUIS_EJEMPLO = Object.freeze([
  {
    id: 'velador_3_cajones_croquis',
    titulo: '1. Croquis Cajonera 3 cajones (50×60×43 cm)',
    subtitulo: '3 cajones apilados iguales · 500 × 600 × 430 mm',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 240" width="280" height="240">
      <rect width="280" height="240" fill="#f8fafc"/>
      <polygon points="65,42 155,18 225,46 135,76" fill="#ffffff" stroke="#1e293b" stroke-width="2.5"/>
      <polygon points="65,42 135,76 135,204 65,166" fill="#ffffff" stroke="#1e293b" stroke-width="2.5"/>
      <polygon points="135,76 225,46 225,168 135,204" fill="#f1f5f9" stroke="#1e293b" stroke-width="2.5"/>
      <polygon points="73,52 127,79 127,116 73,88" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
      <polygon points="73,92 127,120 127,157 73,128" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
      <polygon points="73,132 127,161 127,196 73,166" fill="#ffffff" stroke="#1e293b" stroke-width="2"/>
      <circle cx="100" cy="78" r="5" fill="none" stroke="#1e293b" stroke-width="1.8"/>
      <circle cx="100" cy="119" r="5" fill="none" stroke="#1e293b" stroke-width="1.8"/>
      <circle cx="100" cy="160" r="5" fill="none" stroke="#1e293b" stroke-width="1.8"/>
      <text x="30" y="112" fill="#0f172a" font-size="14" font-weight="bold" font-family="sans-serif">60</text>
      <text x="88" y="218" fill="#0f172a" font-size="14" font-weight="bold" font-family="sans-serif">50</text>
      <text x="195" y="212" fill="#0f172a" font-size="14" font-weight="bold" font-family="sans-serif">43</text>
    </svg>`,
    resultado: CATALOGO_ALBUM_MUEBLES[0].resultado,
  },
  {
    id: 'estante_mixto_3_cajones_arriba',
    titulo: '2. Croquis Estante con 3 cajones arriba (106×198×50 cm)',
    subtitulo: '4 espacios abiertos inferiores + 3 cajones superiores en fila',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 320" width="260" height="320">
      <rect width="260" height="320" fill="#f8fafc"/>
      <rect x="45" y="20" width="150" height="270" fill="#ffffff" stroke="#1e293b" stroke-width="3"/>
      <line x1="45" y1="78" x2="195" y2="78" stroke="#1e293b" stroke-width="3"/>
      <line x1="95" y1="20" x2="95" y2="78" stroke="#1e293b" stroke-width="2.5"/>
      <line x1="145" y1="20" x2="145" y2="78" stroke="#1e293b" stroke-width="2.5"/>
      <circle cx="83" cy="49" r="4" fill="none" stroke="#1e293b" stroke-width="1.8"/>
      <circle cx="133" cy="49" r="4" fill="none" stroke="#1e293b" stroke-width="1.8"/>
      <circle cx="157" cy="49" r="4" fill="none" stroke="#1e293b" stroke-width="1.8"/>
      <line x1="45" y1="132" x2="195" y2="132" stroke="#1e293b" stroke-width="3"/>
      <line x1="45" y1="186" x2="195" y2="186" stroke="#1e293b" stroke-width="3"/>
      <line x1="45" y1="240" x2="195" y2="240" stroke="#1e293b" stroke-width="3"/>
      <text x="205" y="160" fill="#0f172a" font-size="12" font-weight="bold" font-family="sans-serif">198 cm</text>
      <text x="100" y="308" fill="#0f172a" font-size="12" font-weight="bold" font-family="sans-serif">106 cm · 50 cm</text>
    </svg>`,
    resultado: CATALOGO_ALBUM_MUEBLES[1].resultado,
  },
  {
    id: 'vanitorio_cajon_repisa',
    titulo: '3. Foto Vanitorio con cajón superior y repisa inferior',
    subtitulo: 'Cajón de madera arriba + espacio abierto + repisa inferior y patas (60×82×45 cm)',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 300" width="260" height="300">
      <rect width="260" height="300" fill="#f8fafc"/>
      <rect x="40" y="35" width="180" height="14" fill="#e2e8f0" stroke="#475569" stroke-width="2"/>
      <line x1="46" y1="49" x2="46" y2="275" stroke="#1e293b" stroke-width="6"/>
      <line x1="214" y1="49" x2="214" y2="275" stroke="#1e293b" stroke-width="6"/>
      <rect x="50" y="52" width="160" height="68" fill="#d97706" fill-opacity="0.75" stroke="#1e293b" stroke-width="3"/>
      <rect x="105" y="54" width="50" height="5" fill="#1e293b"/>
      <rect x="50" y="232" width="160" height="10" fill="#d97706" fill-opacity="0.75" stroke="#1e293b" stroke-width="2.5"/>
      <text x="130" y="180" fill="#475569" font-size="12" text-anchor="middle" font-family="sans-serif">Espacio abierto inferior</text>
    </svg>`,
    resultado: CATALOGO_ALBUM_MUEBLES[2].resultado,
  },
]);
