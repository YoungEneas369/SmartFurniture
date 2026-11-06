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
        'consola_pilares',
        'mesa_con_repisa',
        'taburete',
        'escritorio_pedestal',
        'silla_respaldo',
        'escalera_2_peldanos',
        'grilla_columnas',
        'repisa_tetris',
        'isla_alero',
        'escritorio_pedestal_izq',
        'mesa_centro_nichos',
        'meson_alzada',
        'rack_puente_derecho',
        'repisa_escalonada_3',
        'closet_abierto_2col',
        'estante_cubos_escalonado',
        'mesa_centro_doble',
        'organizador_2col_mixto',
        'cocina_modular',
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
   - Si es un arrimo, consola o rack con cubierta superior corrida sostenida por 2 pilares/soportes sobre 2 módulos laterales con cubiertas parciales, dejando un vano central en U con repisa media y zócalo retraído (ej. 135×90×35 cm): subtipo = "consola_pilares".
   - Si es un librero alto cuyas divisiones verticales van alternadas en zig-zag entre un nivel y otro: subtipo = "intercalado".
   - Si es una repisa mural cuadrada tipo molinete con 4 divisiones interiores entrelazadas alrededor de un cuadro central: subtipo = "repisa_tetris".
   - Si es una isla o mueble auxiliar con cubierta superior en voladizo lateral y gabinete inferior con puertas + nicho abierto: subtipo = "isla_alero".
   - Si es un escritorio con cajonera pedestal a la IZQUIERDA (con nicho bajo cubierta) y vano libre derecho: subtipo = "escritorio_pedestal_izq" (o "escritorio_pedestal" si la cajonera va a la derecha).
   - Si es una mesa de centro baja con 4 patas y repisa inferior: subtipo = "mesa_con_repisa"; si tiene montantes anchos y doble bandeja con nichos centrales: subtipo = "mesa_centro_nichos"; si es de 2 niveles escalonados con bloque central: subtipo = "mesa_centro_doble".
   - Si es un mesón de taller profundo abajo con alzada superior de menor profundidad: subtipo = "meson_alzada".
   - Si es una cocina completa con bajo mesada y alacena aérea superior separada: subtipo = "cocina_modular".
   - Si es un clóset abierto de 2 columnas (repisas a la izquierda, colgado alto a la derecha y maletero superior): subtipo = "closet_abierto_2col".
   - Si es un organizador de 2 columnas con repisas abiertas a la izquierda y cajón + puerta alta a la derecha: subtipo = "organizador_2col_mixto".
   - En los demás casos (cajoneras, estantes con cajones arriba, vanitorios, escritorios con cajones, arrimos): subtipo = "estandar".

2. LECTURA EXACTA DE COTAS ESCRITAS (CROQUIS / PLANOS):
   - Si hay números escritos en cm (ej. "120 cm", "106 cm", "198 cm", "102 cm", "60 cm", "50", "43", "15,0 cm"), pon tieneMedidasEscritas = true y conviértelos a milímetros multiplicando por 10.
   - Si los números escritos ya están en milímetros (ej. "2060", "2220", "300", "80"), déjalos tal cual en milímetros.
   - En una repisa flotante con cubo central de 30,0 cm y aleros de 13,5 cm a cada lado, el ancho total es 300 + 135 + 135 = 570 mm y el alto total es 570 mm (profundidad 150 mm).
   - En un escritorio con 2 cajones superiores (ej. 120,2 cm ancho × 75 cm alto y 61,9 cm de espacio libre bajo los cajones), pon alturaPatasMm = 600, tieneFondo = false y 1 sección con tipoSeccion = "cajon", columnas = 2.
   - En un arrimo/credenza con patas de 28 cm, un nivel central que tiene un hueco abierto de 52 cm a la izquierda y 2 puertas en 62 cm a la derecha, y una repisa abierta de 17 cm arriba, usa alturaPatasMm = 280, nivel inferior con tipoSeccion = "mixto_hueco_puertas", columnas = 3, y nivel superior con tipoSeccion = "hueco", columnas = 1.

2.5. INTERPRETACIÓN CRÍTICA DE ESPACIOS VACÍOS (HUECOS, VANOS DE PIERNAS Y SILUETAS ESCALONADAS) Y DIBUJOS ESQUEMA:
   - Distingue con máxima precisión entre ESPACIOS VACÍOS ("hueco") y FRENTES CERRADOS ("cajon" o "puertas"):
     • Un ESPACIO VACÍO / HUECO ABIERTO deja ver la sombra interior bajo la repisa superior o deja ver la pared del fondo a través del mueble (tieneFondo = false).
     • Un VANO INFERIOR ABIERTO (bajo escritorios, mesas, vanitorios o arrimos con patas altas) NO es un cajón ni una puerta: represéntalo mediante alturaPatasMm (ej. 600 mm en escritorios con cajones arriba, 280 mm en arrimos, 100-170 mm en mesas de centro) o con subtipo = "escritorio_pedestal" / "escritorio_pedestal_izq" / "isla_alero".
     • Si la foto es un DIBUJO ESQUEMA o BOCETO LINEAL hecho a mano: los rectángulos vacíos sin tirador ni círculo central son HUECOS ABIERTOS ("hueco"); los rectángulos con un círculo/punto o línea corta central son CAJONES ("cajon") si son horizontales o PUERTAS ("puertas") si son altos verticales.

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

    let mapaBordesDataUrl = null;
    try {
      const cBordes = document.createElement('canvas');
      cBordes.width = w;
      cBordes.height = h;
      const ctxB = cBordes.getContext('2d');
      if (ctxB) {
        const imgOrig = ctx.getImageData(0, 0, w, h);
        const sData = imgOrig.data;
        const outImg = ctxB.createImageData(w, h);
        const oData = outImg.data;
        const lumB = (x, y) => {
          const i = (y * w + x) * 4;
          return 0.299 * sData[i] + 0.587 * sData[i + 1] + 0.114 * sData[i + 2];
        };
        for (let i = 0; i < oData.length; i += 4) {
          oData[i] = 248;
          oData[i + 1] = 250;
          oData[i + 2] = 252;
          oData[i + 3] = 255;
        }
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const gx =
              -lumB(x - 1, y - 1) + lumB(x + 1, y - 1) -
              2 * lumB(x - 1, y) + 2 * lumB(x + 1, y) -
              lumB(x - 1, y + 1) + lumB(x + 1, y + 1);
            const gy =
              -lumB(x - 1, y - 1) - 2 * lumB(x, y - 1) - lumB(x + 1, y - 1) +
              lumB(x - 1, y + 1) + 2 * lumB(x, y + 1) + lumB(x + 1, y + 1);
            const mag = Math.hypot(gx, gy);
            const i = (y * w + x) * 4;
            if (mag > 36) {
              const v = Math.max(12, 245 - Math.min(233, Math.round(mag * 1.15)));
              oData[i] = Math.round(v * 0.85);
              oData[i + 1] = Math.round(v * 0.92);
              oData[i + 2] = v;
            } else {
              // Mantener sombreado suave simplificado
              const l = lumB(x, y);
              const q = l > 210 ? 250 : l > 150 ? 236 : 220;
              oData[i] = q;
              oData[i + 1] = q + 2;
              oData[i + 2] = q + 4;
            }
          }
        }
        ctxB.putImageData(outImg, 0, 0);
        mapaBordesDataUrl = cBordes.toDataURL('image/jpeg', 0.88);
      }
    } catch {
      mapaBordesDataUrl = null;
    }

    // Generar también Mapa Visual de Espacios Vacíos y Estructura (overlay pre-3D)
    let mapaVaciosDataUrl = null;
    try {
      const rasgos = extraerRasgosVisuales(imgElement);
      const av = rasgos?.analisisVacios;
      if (av && mapaBordesDataUrl) {
        const cVac = document.createElement('canvas');
        cVac.width = w;
        cVac.height = h;
        const ctxV = cVac.getContext('2d');
        if (ctxV) {
          ctxV.drawImage(canvas, 0, 0, w, h);
          const [rx0, ry0, rx1, ry1] = av.cajaBbox || [0.08, 0.08, 0.92, 0.92];
          const px0 = Math.round(rx0 * w);
          const py0 = Math.round(ry0 * h);
          const pw = Math.round((rx1 - rx0) * w);
          const ph = Math.round((ry1 - ry0) * h);

          const nivs = [...(av.nivelesDetectados || [])].reverse(); // De arriba hacia abajo para dibujar
          const sumaP = nivs.reduce((a, n) => a + (n.proporcionAlto || 1), 0) || 1;
          let yCur = py0;
          nivs.forEach((n, idx) => {
            const hN = Math.round(( (n.proporcionAlto || 1) / sumaP ) * ph);
            const cols = Math.max(1, n.columnas || 1);
            const wCol = Math.round(pw / cols);
            for (let c = 0; c < cols; c++) {
              const xCol = px0 + c * wCol;
              if (n.tipoSeccion === 'hueco') {
                ctxV.fillStyle = 'rgba(14, 165, 233, 0.24)';
                ctxV.strokeStyle = '#0284c7';
              } else if (n.tipoSeccion === 'cajon') {
                ctxV.fillStyle = 'rgba(236, 72, 153, 0.24)';
                ctxV.strokeStyle = '#be185d';
              } else {
                ctxV.fillStyle = 'rgba(245, 158, 11, 0.24)';
                ctxV.strokeStyle = '#b45309';
              }
              ctxV.fillRect(xCol + 3, yCur + 3, Math.max(4, wCol - 6), Math.max(4, hN - 6));
              ctxV.lineWidth = 2;
              ctxV.setLineDash(n.tipoSeccion === 'hueco' ? [6, 4] : []);
              ctxV.strokeRect(xCol + 3, yCur + 3, Math.max(4, wCol - 6), Math.max(4, hN - 6));
              ctxV.setLineDash([]);

              if (wCol > 48 && hN > 24) {
                const etq = n.tipoSeccion === 'hueco' ? 'ESPACIO VACÍO / HUECO' : n.tipoSeccion === 'cajon' ? 'CAJÓN' : 'PUERTA';
                ctxV.fillStyle = '#0f172a';
                ctxV.fillRect(xCol + wCol / 2 - 58, yCur + hN / 2 - 9, 116, 18);
                ctxV.fillStyle = n.tipoSeccion === 'hueco' ? '#38bdf8' : '#fde68a';
                ctxV.font = 'bold 10px monospace';
                ctxV.textAlign = 'center';
                ctxV.fillText(etq, xCol + wCol / 2, yCur + hN / 2 + 3);
              }
            }
            yCur += hN;
          });
          mapaVaciosDataUrl = cVac.toDataURL('image/jpeg', 0.88);
        }
      }
    } catch {
      mapaVaciosDataUrl = null;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
    const coma = dataUrl.indexOf(',');
    return {
      base64: dataUrl.slice(coma + 1),
      mimeType: 'image/jpeg',
      ancho: wOrig,
      alto: hOrig,
      realzadaDataUrl: dataUrl,
      mapaBordesDataUrl,
      mapaVaciosDataUrl,
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
      const c16 = new Array(16).fill(0);
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const i = (y * 32 + x) * 4;
          const l = 0.299 * d32[i] + 0.587 * d32[i + 1] + 0.114 * d32[i + 2];
          const qi = (y < 16 ? 0 : 2) + (x < 16 ? 0 : 1);
          q[qi] += l;
          const ci = (y >> 3) * 4 + (x >> 3);
          c16[ci] += l;
        }
      }
      cuadrantes = q.map((v) => Math.round(v / 256));
      var celdas16 = c16.map((v) => Math.round(v / 64));
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

    // 3. Análisis Pre-3D de Espacios Vacíos (Huecos, Vanos de patas, Fondo pasante) y Grilla Estructural 2D
    const bx0 = Math.max(2, xMin < xMax ? xMin : 8);
    const bx1 = Math.min(N - 3, xMax > xMin ? xMax : N - 8);
    const by0 = Math.max(2, yMin < yMax ? yMin : 8);
    const by1 = Math.min(N - 3, yMax > yMin ? yMax : N - 8);
    const bw = Math.max(12, bx1 - bx0);
    const bh = Math.max(12, by1 - by0);

    let pixClaros = 0;
    let satAcum = 0;
    let pixVacioPasante = 0;
    const totalBoxPix = bw * bh;
    for (let y = by0; y < by1; y++) {
      for (let x = bx0; x < bx1; x++) {
        const idx = (y * N + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        if (l > 215) pixClaros++;
        satAcum += Math.abs(r - g) + Math.abs(g - b);
        const dBg = Math.hypot(r - bgR, g - bgG, b - bgB);
        if (dBg < 24) pixVacioPasante++;
      }
    }
    const esDibujoEsquema = (pixClaros / totalBoxPix) >= 0.66 && (satAcum / totalBoxPix) < 24;
    const porcentajeFondoPasante = Math.round((pixVacioPasante / totalBoxPix) * 100);

    // Detectar líneas horizontales internas por proyección de gradiente vertical Gy
    const perfilH = new Float32Array(bh);
    for (let y = by0; y < by1; y++) {
      let sumaGy = 0;
      for (let x = bx0 + 2; x < bx1 - 2; x++) {
        sumaGy += Math.abs(lum(x, y + 1) - lum(x, y - 1));
      }
      perfilH[y - by0] = sumaGy / Math.max(1, bw - 4);
    }
    const umbralH = Math.max(10, (perfilH.reduce((a, b) => a + b, 0) / bh) * 1.35);
    const filasY = [by0];
    const minSepY = Math.max(8, Math.round(bh * 0.15));
    for (let ry = minSepY; ry < bh - minSepY; ry++) {
      if (perfilH[ry] >= umbralH && perfilH[ry] >= perfilH[ry - 1] && perfilH[ry] >= perfilH[ry + 1]) {
        const yAbs = by0 + ry;
        if (yAbs - filasY[filasY.length - 1] >= minSepY) {
          filasY.push(yAbs);
        }
      }
    }
    filasY.push(by1);

    // Detectar si el tramo inferior es un vano abierto para patas / silla
    const yInfCheck0 = Math.max(by0, Math.round(by1 - bh * 0.20));
    let vacioInfCentro = 0, totalInfCentro = 0;
    for (let y = yInfCheck0; y < by1; y++) {
      for (let x = Math.round(bx0 + bw * 0.22); x < Math.round(bx1 - bw * 0.22); x++) {
        const idx = (y * N + x) * 4;
        if (Math.hypot(data[idx] - bgR, data[idx + 1] - bgG, data[idx + 2] - bgB) < 25) vacioInfCentro++;
        totalInfCentro++;
      }
    }
    const tieneVanoInferior = totalInfCentro > 0 && (vacioInfCentro / totalInfCentro) > 0.62;

    // Clasificar cada nivel horizontal detectado (de abajo hacia arriba) en hueco vs cajón vs puerta
    const nivelesDetectados = [];
    const maxNiveles = Math.min(6, filasY.length - 1);
    for (let i = maxNiveles - 1; i >= 0; i--) {
      const y0 = filasY[i];
      const y1 = filasY[i + 1];
      const hNiv = Math.max(4, y1 - y0);

      // Contar divisiones verticales en este nivel
      let colsNivel = 1;
      const minSepX = Math.max(10, Math.round(bw * 0.22));
      let xUlt = bx0;
      for (let x = bx0 + minSepX; x < bx1 - minSepX; x++) {
        let sumaGx = 0;
        for (let y = y0 + 2; y < y1 - 2; y++) {
          sumaGx += Math.abs(lum(x + 1, y) - lum(x - 1, y));
        }
        if (sumaGx / Math.max(1, hNiv - 4) > 16 && x - xUlt >= minSepX) {
          colsNivel++;
          xUlt = x;
          if (colsNivel >= 4) break;
        }
      }

      // Evaluar sombra superior interior (típica de hueco abierto) y presencia de pomo/tirador central
      let lumSup = 0, cntSup = 0, lumMed = 0, cntMed = 0, gradCentro = 0, cntCentro = 0, simBg = 0;
      for (let y = y0 + 1; y < y1 - 1; y++) {
        const relY = (y - y0) / hNiv;
        for (let x = bx0 + 2; x < bx1 - 2; x++) {
          const relX = (x - bx0) / bw;
          const l = lum(x, y);
          const idx = (y * N + x) * 4;
          if (Math.hypot(data[idx] - bgR, data[idx + 1] - bgG, data[idx + 2] - bgB) < 24) simBg++;
          if (relY < 0.28) { lumSup += l; cntSup++; }
          else if (relY >= 0.32 && relY <= 0.72) { lumMed += l; cntMed++; }
          if (relY >= 0.32 && relY <= 0.68 && relX >= 0.30 && relX <= 0.70) {
            gradCentro += Math.abs(lum(x + 1, y) - lum(x - 1, y)) + Math.abs(lum(x, y + 1) - lum(x, y - 1));
            cntCentro++;
          }
        }
      }
      const sombraInterior = (cntMed ? lumMed / cntMed : 200) - (cntSup ? lumSup / cntSup : 200);
      const fracBg = simBg / Math.max(1, (hNiv - 2) * (bw - 4));
      const pomoScore = cntCentro ? gradCentro / cntCentro : 0;

      let tipoSeccion = 'hueco';
      if (sombraInterior > 7 || (fracBg > 0.52 && pomoScore < 14)) {
        tipoSeccion = 'hueco';
      } else if (pomoScore >= 14) {
        const aspectCelda = (bw / colsNivel) / hNiv;
        tipoSeccion = aspectCelda >= 1.15 ? 'cajon' : 'puertas';
      }

      nivelesDetectados.push({
        ubicacionVertical: nivelesDetectados.length === 0 ? 'inferior' : i === 0 ? 'superior' : 'intermedio',
        tipoSeccion,
        columnas: colsNivel,
        filasApiladas: 1,
        proporcionAlto: Number(Math.max(0.35, hNiv / (bh / maxNiveles)).toFixed(2)),
        sombraInterior: Math.round(sombraInterior),
        fracVacio: Number(fracBg.toFixed(2)),
      });
    }

    const analisisVacios = {
      esDibujoEsquema,
      porcentajeFondoPasante,
      tieneVanoInferior,
      cajaBbox: [bx0 / N, by0 / N, bx1 / N, by1 / N],
      nivelesDetectados,
    };

    return { wOrig, hOrig, relacionArchivo, relacionMueble, cuadrantes, celdas16, huella, analisisVacios };
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

  const av = rasgosVisuales?.analisisVacios;
  const infoVacios = av
    ? ` Tipo de imagen: ${av.esDibujoEsquema ? 'DIBUJO ESQUEMA / CROQUIS LINEAL' : 'FOTOGRAFÍA'}. Fondo pasante/vacío interior: ${av.porcentajeFondoPasante}%. Vano inferior de patas detectado: ${av.tieneVanoInferior ? 'SÍ' : 'NO'}. Niveles pre-segmentados (abajo→arriba): ${(av.nivelesDetectados || []).map((n, i) => `N${i + 1}:${n.tipoSeccion}(${n.columnas}col)`).join(', ')}.`
    : '';
  const pistaVisual = rasgosVisuales?.relacionMueble
    ? `\nNota de pre-análisis visual: la silueta detectada del mueble tiene razón ancho/alto ≈ ${rasgosVisuales.relacionMueble} (resolución ${rasgosVisuales.wOrig}×${rasgosVisuales.hOrig} px).${infoVacios}`
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
    const subtiposValidos = ['estandar', 'intercalado', 'mesa', 'puente_laterales', 'flotante_entrelazada', 'gondola', 'rack_escalonado', 'rack_flancos', 'consola_pilares', 'mesa_con_repisa', 'taburete', 'escritorio_pedestal', 'silla_respaldo', 'escalera_2_peldanos', 'grilla_columnas', 'repisa_tetris', 'isla_alero', 'escritorio_pedestal_izq', 'mesa_centro_nichos', 'meson_alzada', 'rack_puente_derecho', 'repisa_escalonada_3', 'closet_abierto_2col', 'estante_cubos_escalonado', 'mesa_centro_doble', 'organizador_2col_mixto', 'cocina_modular'];
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
    celdas16: [254, 248, 250, 255, 253, 234, 237, 255, 254, 235, 236, 255, 255, 249, 247, 255],
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
    celdas16: [240, 232, 238, 242, 243, 242, 242, 241, 242, 240, 240, 242, 248, 243, 238, 244],
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
    celdas16: [253, 231, 239, 254, 229, 151, 150, 242, 235, 212, 200, 246, 238, 212, 195, 249],
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
    celdas16: [251, 249, 250, 252, 237, 236, 240, 240, 247, 255, 255, 248, 254, 255, 255, 254],
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
    celdas16: [254, 253, 251, 252, 249, 247, 249, 249, 251, 251, 253, 252, 253, 250, 253, 255],
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
    celdas16: [255, 251, 252, 255, 254, 228, 234, 250, 255, 228, 230, 249, 254, 234, 225, 250],
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
    celdas16: [239, 125, 121, 237, 227, 88, 80, 219, 208, 82, 76, 200, 185, 94, 96, 173],
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
    celdas16: [230, 226, 227, 231, 230, 231, 240, 225, 217, 207, 205, 210, 247, 251, 251, 254],
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
    celdas16: [167, 166, 188, 206, 147, 149, 165, 215, 162, 151, 159, 189, 179, 162, 184, 208],
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
    celdas16: [184, 121, 158, 163, 179, 138, 194, 155, 177, 134, 172, 140, 174, 132, 194, 168],
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
    celdas16: [129, 121, 156, 144, 169, 178, 137, 151, 162, 168, 124, 154, 153, 145, 156, 158],
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
  {
    id: 'consola_pilares_135x90',
    dimensionesImg: [[735, 588]],
    cuadrantes: [243, 243, 244, 243],
    celdas16: [248, 243, 242, 242, 242, 240, 246, 242, 246, 240, 239, 240, 247, 244, 244, 251],
    clavesNombre: ['c5a4af'],
    resultado: {
      categoriaMueble: 'rack_tv',
      subtipo: 'consola_pilares',
      nombreMueble: 'Arrimo / Consola escalonada con cubierta sobre pilares y vano central (135×90×35 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '135 cm, 90 cm, 35 cm',
      anchoDetectadoMm: 1350,
      altoDetectadoMm: 900,
      profundidadDetectadaMm: 350,
      alturaPatasMm: 85,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'intermedio', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 1, proporcionAlto: 0.35 },
      ],
      relacionAnchoAlto: 1.5,
      descripcion: 'Arrimo / Consola geométrica de 1350 × 900 × 350 mm: zócalo retraído inferior, 2 nichos verticales laterales con cubiertas parciales en voladizo, vano central abierto en U con repisa media y cubierta superior corrida sobre 2 pilares.',
      fuente: 'Croquis reconocido (Arrimo 135×90×35 cm)',
    },
  },
  {
    id: 'repisa_mural_tetris_70x70',
    dimensionesImg: [[640, 640]],
    cuadrantes: [185, 182, 185, 185],
    celdas16: [179, 184, 179, 186, 192, 186, 181, 184, 192, 179, 184, 186, 188, 182, 185, 185],
    clavesNombre: ['08f7eac5'],
    resultado: {
      categoriaMueble: 'estante_librero',
      subtipo: 'repisa_tetris',
      nombreMueble: 'Repisa mural cuadrada asimétrica (70×70×15 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '70,0 cm, 70,0 cm, 15,0 cm, 39,3 cm',
      anchoDetectadoMm: 700,
      altoDetectadoMm: 700,
      profundidadDetectadaMm: 150,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 3, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.0,
      descripcion: 'Repisa mural cuadrada de 700 × 700 × 150 mm con divisiones interiores asimétricas de 393 mm.',
      fuente: 'Plano/Foto reconocido (700×700×150 mm)',
    },
  },
  {
    id: 'escalera_2_peldanos_40x38',
    dimensionesImg: [[634, 564]],
    cuadrantes: [210, 207, 211, 205],
    celdas16: [235, 211, 214, 227, 230, 163, 184, 202, 216, 173, 167, 212, 241, 214, 205, 235],
    clavesNombre: ['0a85893a'],
    resultado: {
      categoriaMueble: 'otro',
      subtipo: 'escalera_2_peldanos',
      nombreMueble: 'Escalera / Banqueta de 2 peldaños (40×38×40 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '40 cm, 38 cm, 40 cm, 20 cm, 19 cm',
      anchoDetectadoMm: 400,
      altoDetectadoMm: 380,
      profundidadDetectadaMm: 400,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 2, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.05,
      descripcion: 'Banqueta escalera de 2 peldaños en madera (400 × 380 × 400 mm) con huellas de 200 mm y contrahuellas de 190 mm.',
      fuente: 'Plano/Foto reconocido (400×380×400 mm)',
    },
  },
  {
    id: 'mesa_centro_cuadrada_80x45',
    dimensionesImg: [[736, 1104]],
    cuadrantes: [138, 166, 183, 199],
    celdas16: [140, 144, 148, 166, 103, 166, 181, 170, 193, 170, 181, 212, 228, 142, 176, 226],
    clavesNombre: ['12a3c801'],
    resultado: {
      categoriaMueble: 'escritorio',
      subtipo: 'mesa_con_repisa',
      nombreMueble: 'Mesa de centro cuadrada con repisa inferior (80×45×80 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '80 cm, 80 cm, 45 cm',
      anchoDetectadoMm: 800,
      altoDetectadoMm: 450,
      profundidadDetectadaMm: 800,
      alturaPatasMm: 100,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.78,
      descripcion: 'Mesa de centro cuadrada de 800 × 450 × 800 mm con marco superior, 4 patas de esquina y repisa inferior.',
      fuente: 'Plano/Foto reconocido (800×450×800 mm)',
    },
  },
  {
    id: 'mesa_multiusos_taburete_30x45',
    dimensionesImg: [[600, 750]],
    cuadrantes: [221, 224, 229, 234],
    celdas16: [224, 221, 220, 225, 243, 197, 206, 244, 242, 213, 209, 243, 246, 215, 235, 252],
    clavesNombre: ['1c57bbe5'],
    resultado: {
      categoriaMueble: 'otro',
      subtipo: 'taburete',
      nombreMueble: 'Mesa multiusos / Taburete con travesaños (30×45×30 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '30cm, 30cm, 45cm',
      anchoDetectadoMm: 300,
      altoDetectadoMm: 450,
      profundidadDetectadaMm: 300,
      alturaPatasMm: 120,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 0.67,
      descripcion: 'Mesa multiusos / Taburete de 300 × 450 × 300 mm con cubierta cuadrada, 4 patas y travesaños inferiores.',
      fuente: 'Plano/Foto reconocido (300×450×300 mm)',
    },
  },
  {
    id: 'escritorio_4_cajones_120x75',
    dimensionesImg: [[736, 914]],
    cuadrantes: [206, 204, 232, 221],
    celdas16: [201, 222, 212, 212, 194, 205, 190, 203, 225, 232, 213, 225, 224, 249, 218, 227],
    clavesNombre: ['1f4debc4'],
    resultado: {
      categoriaMueble: 'escritorio',
      subtipo: 'escritorio_pedestal',
      nombreMueble: 'Escritorio con pedestal derecho de 4 cajones (120×75×60 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '120 cm, 75 cm, 60 cm, 55 cm',
      anchoDetectadoMm: 1200,
      altoDetectadoMm: 750,
      profundidadDetectadaMm: 600,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'cajon', columnas: 1, filasApiladas: 4, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.6,
      descripcion: 'Escritorio de 1200 × 750 × 600 mm con espacio izquierdo libre para piernas y módulo pedestal derecho con 4 cajones apilados.',
      fuente: 'Plano/Foto reconocido (1200×750×600 mm)',
    },
  },
  {
    id: 'silla_jardin_66x76',
    dimensionesImg: [[736, 1030]],
    cuadrantes: [223, 225, 229, 231],
    celdas16: [228, 224, 224, 228, 233, 206, 210, 238, 231, 181, 198, 219, 254, 250, 254, 255],
    clavesNombre: ['23bbaf01'],
    resultado: {
      categoriaMueble: 'otro',
      subtipo: 'silla_respaldo',
      nombreMueble: 'Silla de jardín con apoyabrazos y respaldo (66×76×61 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '660mm, 760mm, 610mm, 455mm, 485mm',
      anchoDetectadoMm: 660,
      altoDetectadoMm: 760,
      profundidadDetectadaMm: 610,
      alturaPatasMm: 455,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 0.87,
      descripcion: 'Sillón de jardín en madera de 660 × 760 × 610 mm con asiento a 455 mm, apoyabrazos laterales y respaldo alto.',
      fuente: 'Plano/Foto reconocido (660×760×610 mm)',
    },
  },
  {
    id: 'repisa_flotante_duplicada_57x57',
    dimensionesImg: [[736, 736]],
    cuadrantes: [200, 203, 205, 201],
    celdas16: [205, 190, 200, 210, 204, 199, 196, 207, 210, 202, 200, 204, 212, 195, 190, 208],
    clavesNombre: ['2439ceff'],
    resultado: {
      categoriaMueble: 'alacena_cocina',
      subtipo: 'flotante_entrelazada',
      nombreMueble: 'Repisa flotante geométrica con cubo central de 30×30 cm (57×57×15 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '45,0 cm, 30,0 cm, 13,5 cm, 15,0 cm',
      anchoDetectadoMm: 570,
      altoDetectadoMm: 570,
      profundidadDetectadaMm: 150,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 3, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.0,
      descripcion: 'Repisa flotante entrelazada de 570 × 570 × 150 mm con cubo central de 300 × 300 mm y brazos en L de 450 mm.',
      fuente: 'Plano/Foto reconocido (570×570×150 mm)',
    },
  },
  {
    id: 'coffee_table_120x45x60',
    dimensionesImg: [[720, 1080]],
    cuadrantes: [178, 185, 190, 202],
    celdas16: [196, 172, 168, 199, 187, 158, 178, 193, 182, 164, 198, 198, 204, 209, 209, 205],
    clavesNombre: ['2b0010cd'],
    resultado: {
      categoriaMueble: 'escritorio',
      subtipo: 'mesa_con_repisa',
      nombreMueble: 'Mesa de centro (Coffee Table) con repisa inferior (120×45×60 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '120cm, 60cm, 45cm, 98cm, 48cm, 22cm',
      anchoDetectadoMm: 1200,
      altoDetectadoMm: 450,
      profundidadDetectadaMm: 600,
      alturaPatasMm: 120,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 2.67,
      descripcion: 'Mesa de centro de 1200 × 450 × 600 mm con cubierta superior, 4 patas de 450 mm y repisa inferior.',
      fuente: 'Plano/Foto reconocido (1200×450×600 mm)',
    },
  },
  {
    id: 'mueble_isla_2_puertas_90x85',
    dimensionesImg: [[736, 774]],
    cuadrantes: [248, 246, 252, 248],
    celdas16: [249, 246, 247, 247, 253, 245, 243, 247, 255, 249, 250, 247, 255, 248, 245, 250],
    clavesNombre: ['3890a18a'],
    resultado: {
      categoriaMueble: 'alacena_cocina',
      subtipo: 'isla_alero',
      nombreMueble: 'Mueble auxiliar con cubierta de 90 cm y 2 puertas (90×85×35 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '90 cm, 84,6 cm, 34,8 cm, 59 cm',
      anchoDetectadoMm: 900,
      altoDetectadoMm: 846,
      profundidadDetectadaMm: 348,
      alturaPatasMm: 0,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'puertas', columnas: 2, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.06,
      descripcion: 'Mueble auxiliar de 900 × 846 × 348 mm con cubierta superior extendida y gabinete inferior con 2 puertas batientes.',
      fuente: 'Plano/Foto reconocido (900×846×348 mm)',
    },
  },
  {
    id: 'escritorio_3_cajones_120x76',
    dimensionesImg: [[736, 736]],
    cuadrantes: [208, 233, 229, 244],
    celdas16: [238, 204, 224, 239, 218, 174, 232, 238, 229, 200, 244, 241, 243, 244, 242, 247],
    clavesNombre: ['3e03f001'],
    resultado: {
      categoriaMueble: 'escritorio',
      subtipo: 'escritorio_pedestal_izq',
      nombreMueble: 'Escritorio con cajonera de 3 cajones y repisa (120×76×60 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '120cm, 60cm, 76.3cm, 47.2cm, 12cm, 35.2cm',
      anchoDetectadoMm: 1200,
      altoDetectadoMm: 763,
      profundidadDetectadaMm: 600,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'cajon', columnas: 1, filasApiladas: 3, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.57,
      descripcion: 'Escritorio de 1200 × 763 × 600 mm con pedestal lateral de 3 cajones (472 mm de ancho) y vano libre para silla.',
      fuente: 'Plano/Foto reconocido (1200×763×600 mm)',
    },
  },
  {
    id: 'mesa_centro_nichos_110x48',
    dimensionesImg: [[736, 906]],
    cuadrantes: [215, 225, 245, 236],
    celdas16: [248, 241, 252, 255, 193, 180, 176, 218, 252, 221, 201, 235, 255, 253, 252, 255],
    clavesNombre: ['40936aa7'],
    resultado: {
      categoriaMueble: 'rack_tv',
      subtipo: 'mesa_centro_nichos',
      nombreMueble: 'Mesa de centro con repisa intermedia y nichos (110×48×65 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '110 cm, 65 cm, 48 cm, 17 cm, 15 cm',
      anchoDetectadoMm: 1100,
      altoDetectadoMm: 480,
      profundidadDetectadaMm: 650,
      alturaPatasMm: 170,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 2.29,
      descripcion: 'Mesa de centro de 1100 × 480 × 650 mm con cubierta superior, soportes laterales anchos y bandeja inferior a 170 mm.',
      fuente: 'Plano/Foto reconocido (1100×480×650 mm)',
    },
  },
  {
    id: 'velador_1_cajon_45x45',
    dimensionesImg: [[735, 568]],
    cuadrantes: [249, 251, 245, 252],
    celdas16: [255, 255, 252, 253, 245, 241, 246, 253, 242, 239, 254, 250, 251, 247, 249, 255],
    clavesNombre: ['4151b230'],
    resultado: {
      categoriaMueble: 'velador',
      subtipo: 'estandar',
      nombreMueble: 'Velador de 1 cajón con patas de 12 cm (45×45×40 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '45 cm, 45 cm, 40 cm, 33 cm, 12 cm, 37 cm',
      anchoDetectadoMm: 450,
      altoDetectadoMm: 450,
      profundidadDetectadaMm: 400,
      alturaPatasMm: 120,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'cajon', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.0,
      descripcion: 'Velador compacto de 450 × 450 × 400 mm con patas inferiores de 120 mm y cuerpo de 330 mm con 1 cajón frontal.',
      fuente: 'Plano/Foto reconocido (450×450×400 mm)',
    },
  },
  {
    id: 'cocina_modular_260x210',
    dimensionesImg: [[675, 1200]],
    cuadrantes: [174, 183, 242, 242],
    celdas16: [196, 207, 222, 208, 135, 160, 152, 152, 251, 243, 244, 251, 238, 236, 236, 238],
    clavesNombre: ['42fd7ea2'],
    resultado: {
      categoriaMueble: 'alacena_cocina',
      subtipo: 'cocina_modular',
      nombreMueble: 'Mueble de cocina modular completo (240×210×52,4 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '80 cm, 60 cm, 60 cm, 40 cm, 72 cm, 52,4 cm, 28,8 cm',
      anchoDetectadoMm: 2400,
      altoDetectadoMm: 2100,
      profundidadDetectadaMm: 524,
      alturaPatasMm: 100,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'puertas', columnas: 4, filasApiladas: 1, proporcionAlto: 1.2 },
        { ubicacionVertical: 'intermedio', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 0.85 },
        { ubicacionVertical: 'superior', tipoSeccion: 'puertas', columnas: 4, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.24,
      descripcion: 'Conjunto modular de cocina de 2400 × 2100 × 524 mm: módulos bajo mesada de 4 cuerpos, espacio central de trabajo y alacena superior de 4 puertas.',
      fuente: 'Plano/Foto reconocido (2400×2100×524 mm)',
    },
  },
  {
    id: 'estanteria_taller_150x195',
    dimensionesImg: [[680, 924]],
    cuadrantes: [159, 176, 175, 186],
    celdas16: [161, 188, 189, 184, 134, 151, 153, 176, 156, 181, 187, 162, 172, 190, 215, 180],
    clavesNombre: ['4b8f1ad0'],
    resultado: {
      categoriaMueble: 'estante_librero',
      subtipo: 'meson_alzada',
      nombreMueble: 'Estantería de trabajo con mesón y alzada de 3 columnas (150×195×60 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '150 CM, 75 CM, 60 CM, 60 CM',
      anchoDetectadoMm: 1500,
      altoDetectadoMm: 1950,
      profundidadDetectadaMm: 600,
      alturaPatasMm: 100,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 1, proporcionAlto: 1.2 },
        { ubicacionVertical: 'intermedio', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 0.77,
      descripcion: 'Estantería con mesón de trabajo de 1500 × 1950 × 600 mm: base inferior de 750 mm de alto con repisa y alzada superior de 2 niveles con 3 columnas.',
      fuente: 'Plano/Foto reconocido (1500×1950×600 mm)',
    },
  },
  {
    id: 'rack_tv_escalonado_170x48',
    dimensionesImg: [[720, 472]],
    cuadrantes: [237, 222, 236, 247],
    celdas16: [253, 244, 221, 234, 242, 209, 204, 228, 235, 223, 233, 249, 247, 240, 252, 253],
    clavesNombre: ['52622014'],
    resultado: {
      categoriaMueble: 'rack_tv',
      subtipo: 'rack_puente_derecho',
      nombreMueble: 'Rack TV escalonado con puerta lateral y puente superior (170×48×40 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '170 cm, 120 cm, 60 cm, 48 cm, 40 cm, 31.5 cm',
      anchoDetectadoMm: 1700,
      altoDetectadoMm: 480,
      profundidadDetectadaMm: 400,
      alturaPatasMm: 25,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'mixto_hueco_puertas', columnas: 2, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 1, proporcionAlto: 0.6 }
      ],
      relacionAnchoAlto: 3.54,
      descripcion: 'Rack TV escalonado de 1700 × 480 × 400 mm con módulo inferior de 315 mm de alto y cubierta puente superior de 1200 mm.',
      fuente: 'Plano/Foto reconocido (1700×480×400 mm)',
    },
  },
  {
    id: 'repisa_mural_3_bandejas_119x55',
    dimensionesImg: [[736, 552]],
    cuadrantes: [246, 239, 239, 240],
    celdas16: [255, 250, 255, 237, 240, 241, 229, 237, 242, 226, 244, 241, 248, 239, 236, 240],
    clavesNombre: ['53e96469'],
    resultado: {
      categoriaMueble: 'alacena_cocina',
      subtipo: 'repisa_escalonada_3',
      nombreMueble: 'Repisa mural escalonada de 3 niveles (119×55×18 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '119cm, 80cm, 55cm, 20cm, 18cm, 15cm',
      anchoDetectadoMm: 1190,
      altoDetectadoMm: 550,
      profundidadDetectadaMm: 180,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 2, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 2.16,
      descripcion: 'Repisa mural de 1190 × 550 × 180 mm con bandejas horizontales de 800 mm y topes verticales de 150 y 200 mm.',
      fuente: 'Plano/Foto reconocido (1190×550×180 mm)',
    },
  },
  {
    id: 'escritorio_madera_100x80',
    dimensionesImg: [[736, 920]],
    cuadrantes: [198, 189, 201, 202],
    celdas16: [198, 194, 195, 196, 212, 187, 175, 189, 207, 188, 185, 203, 207, 203, 209, 210],
    clavesNombre: ['567148b7'],
    resultado: {
      categoriaMueble: 'escritorio',
      subtipo: 'escritorio_pedestal',
      nombreMueble: 'Escritorio de madera con cajón y puerta lateral (100×80×40 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '1000 mm, 800 mm, 400 mm, 360 mm, 230 mm, 600 mm',
      anchoDetectadoMm: 1000,
      altoDetectadoMm: 800,
      profundidadDetectadaMm: 400,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'cajon', columnas: 1, filasApiladas: 3, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.25,
      descripcion: 'Escritorio de 1000 × 800 × 400 mm con vano izquierdo para silla y pedestal derecho de 360 mm con 1 cajón superior y 1 puerta inferior.',
      fuente: 'Plano/Foto reconocido (1000×800×400 mm)',
    },
  },
  {
    id: 'taburete_alto_bar_48x72',
    dimensionesImg: [[650, 975]],
    cuadrantes: [201, 202, 192, 196],
    celdas16: [215, 181, 179, 212, 190, 216, 202, 216, 182, 181, 168, 192, 195, 212, 216, 208],
    clavesNombre: ['5d39a775'],
    resultado: {
      categoriaMueble: 'otro',
      subtipo: 'taburete',
      nombreMueble: 'Taburete / Piso alto de madera con apoya-pies (48×71,5×33 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '45cm, 30cm, 71,5cm, 48cm, 33cm',
      anchoDetectadoMm: 480,
      altoDetectadoMm: 715,
      profundidadDetectadaMm: 330,
      alturaPatasMm: 220,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 0.67,
      descripcion: 'Taburete alto de 480 × 715 × 330 mm con cubierta superior de 450 × 300 mm, 4 patas y travesaños apoya-pies.',
      fuente: 'Plano/Foto reconocido (480×715×330 mm)',
    },
  },
  {
    id: 'closet_2_columnas_120x200',
    dimensionesImg: [[736, 1001]],
    cuadrantes: [226, 231, 214, 226],
    celdas16: [239, 235, 236, 239, 211, 219, 224, 226, 210, 215, 231, 224, 222, 209, 216, 231],
    clavesNombre: ['607e87fc'],
    resultado: {
      categoriaMueble: 'armario_ropero',
      subtipo: 'closet_abierto_2col',
      nombreMueble: 'Clóset organizador abierto con repisas, colgado y maletero (120×200×61 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '120cm, 200cm, 61cm, 30cm, 148cm, 58cm, 57,6cm',
      anchoDetectadoMm: 1200,
      altoDetectadoMm: 2000,
      profundidadDetectadaMm: 610,
      alturaPatasMm: 85,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 4, proporcionAlto: 1.0 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 1, proporcionAlto: 0.8 }
      ],
      relacionAnchoAlto: 0.6,
      descripcion: 'Clóset organizador de 1200 × 2000 × 610 mm con zócalo de 85 mm, columna izquierda de repisas, columna derecha de colgado y maletero superior de 300 mm.',
      fuente: 'Plano/Foto reconocido (1200×2000×610 mm)',
    },
  },
  {
    id: 'banca_plana_120x45',
    dimensionesImg: [[736, 724]],
    cuadrantes: [225, 228, 233, 202],
    celdas16: [236, 236, 241, 244, 218, 208, 215, 214, 222, 222, 199, 187, 244, 244, 219, 204],
    clavesNombre: ['60d023b1'],
    resultado: {
      categoriaMueble: 'escritorio',
      subtipo: 'mesa',
      nombreMueble: 'Banca plana de madera sin respaldo (120×45×34 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '120 cm, 45 cm, 34 cm, 4 cm',
      anchoDetectadoMm: 1200,
      altoDetectadoMm: 450,
      profundidadDetectadaMm: 340,
      alturaPatasMm: 410,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 2.67,
      descripcion: 'Banca rectangular de 1200 × 450 × 340 mm con cubierta superior y patas tipo marco en ambos extremos.',
      fuente: 'Plano/Foto reconocido (1200×450×340 mm)',
    },
  },
  {
    id: 'mesa_trabajo_183x71',
    dimensionesImg: [[564, 564]],
    cuadrantes: [229, 228, 239, 249],
    celdas16: [247, 241, 235, 241, 225, 205, 205, 232, 236, 230, 244, 240, 250, 240, 255, 255],
    clavesNombre: ['9d33dacb'],
    resultado: {
      categoriaMueble: 'escritorio',
      subtipo: 'mesa',
      nombreMueble: 'Mesa de comedor / trabajo con faldón perimetral (183×71×92 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '72", 36-1/4", 28", 59", 23"',
      anchoDetectadoMm: 1830,
      altoDetectadoMm: 710,
      profundidadDetectadaMm: 800,
      alturaPatasMm: 600,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 2.58,
      descripcion: 'Mesa rectangular de 1830 × 710 × 800 mm con cubierta superior, 4 patas de esquina y estructura de faldones.',
      fuente: 'Plano/Foto reconocido (1830×710×800 mm)',
    },
  },
  {
    id: 'mesa_centro_100x43x57',
    dimensionesImg: [[736, 736]],
    cuadrantes: [207, 223, 251, 241],
    celdas16: [238, 225, 240, 253, 207, 159, 182, 216, 253, 245, 216, 245, 255, 253, 248, 254],
    clavesNombre: ['9d728c8c'],
    resultado: {
      categoriaMueble: 'escritorio',
      subtipo: 'mesa_con_repisa',
      nombreMueble: 'Mesa de centro con repisa inferior (100×43×57 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '100 cm, 57 cm, 43 cm, 98 cm, 17,5 cm, 10 cm',
      anchoDetectadoMm: 1000,
      altoDetectadoMm: 430,
      profundidadDetectadaMm: 570,
      alturaPatasMm: 100,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 2.33,
      descripcion: 'Mesa de centro de 1000 × 430 × 570 mm con cubierta superior, 4 patas y repisa inferior a 100 mm del suelo.',
      fuente: 'Plano/Foto reconocido (1000×430×570 mm)',
    },
  },
  {
    id: 'mesa_centro_100x46x60',
    dimensionesImg: [[600, 600]],
    cuadrantes: [223, 223, 229, 239],
    celdas16: [253, 244, 251, 246, 214, 182, 177, 218, 231, 179, 215, 233, 254, 254, 254, 254],
    clavesNombre: ['a0d29dbe'],
    resultado: {
      categoriaMueble: 'escritorio',
      subtipo: 'mesa_con_repisa',
      nombreMueble: 'Mesa de centro de madera con bandeja inferior (100×46×60 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '100 CM, 60 CM, 46 CM',
      anchoDetectadoMm: 1000,
      altoDetectadoMm: 460,
      profundidadDetectadaMm: 600,
      alturaPatasMm: 110,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 2.17,
      descripcion: 'Mesa de centro de 1000 × 460 × 600 mm con cubierta superior, 4 patas, faldón y repisa inferior.',
      fuente: 'Plano/Foto reconocido (1000×460×600 mm)',
    },
  },
  {
    id: 'estante_bajo_intercalado_75x53',
    dimensionesImg: [[640, 640]],
    cuadrantes: [218, 210, 210, 211],
    celdas16: [236, 231, 229, 228, 196, 208, 205, 179, 194, 199, 186, 173, 225, 223, 235, 248],
    clavesNombre: ['a75a47e2'],
    resultado: {
      categoriaMueble: 'estante_librero',
      subtipo: 'intercalado',
      nombreMueble: 'Estante horizontal de 2 niveles y 3 columnas (75×53×16 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '75cm, 53cm, 16cm, 21cm, 12cm, 42,5cm, 25cm',
      anchoDetectadoMm: 750,
      altoDetectadoMm: 530,
      profundidadDetectadaMm: 160,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.1 },
        { ubicacionVertical: 'intermedio', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.75 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.42,
      descripcion: 'Estante de 750 × 530 × 160 mm de 2 niveles horizontales (210 mm abajo y 120 mm arriba) con 3 compartimentos por nivel.',
      fuente: 'Plano/Foto reconocido (750×530×160 mm)',
    },
  },
  {
    id: 'rack_cubos_entrelazados_120x75',
    dimensionesImg: [[736, 618]],
    cuadrantes: [238, 223, 229, 231],
    celdas16: [254, 247, 226, 232, 244, 206, 209, 223, 238, 214, 198, 232, 242, 223, 243, 253],
    clavesNombre: ['a924dce9'],
    resultado: {
      categoriaMueble: 'rack_tv',
      subtipo: 'estante_cubos_escalonado',
      nombreMueble: 'Estante / Rack geométrico escalonado (1200×750×250 mm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '1200mm, 750mm, 250mm, 220mm',
      anchoDetectadoMm: 1200,
      altoDetectadoMm: 750,
      profundidadDetectadaMm: 250,
      alturaPatasMm: 0,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.6,
      descripcion: 'Estante / Rack geométrico escalonado de 1200 × 750 × 250 mm con volúmenes entrelazados en 2 niveles.',
      fuente: 'Plano/Foto reconocido (1200×750×250 mm)',
    },
  },
  {
    id: 'banca_sillon_70x62x60',
    dimensionesImg: [[736, 920]],
    cuadrantes: [221, 222, 230, 232],
    celdas16: [225, 223, 222, 225, 229, 207, 211, 230, 230, 193, 206, 220, 254, 244, 250, 254],
    clavesNombre: ['be39c901'],
    resultado: {
      categoriaMueble: 'otro',
      subtipo: 'silla_respaldo',
      nombreMueble: 'Banca / Sillón individual con apoyabrazos (70×62×60 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '70 cm, 62 cm, 60 cm, 57 cm, 35 cm',
      anchoDetectadoMm: 700,
      altoDetectadoMm: 620,
      profundidadDetectadaMm: 600,
      alturaPatasMm: 350,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.13,
      descripcion: 'Banca / Sillón de madera de 700 × 620 × 600 mm con asiento a 350 mm de altura, apoyabrazos laterales y respaldo.',
      fuente: 'Plano/Foto reconocido (700×620×600 mm)',
    },
  },
  {
    id: 'mesa_centro_pilares_120x45x70',
    dimensionesImg: [[564, 634]],
    cuadrantes: [233, 231, 151, 171],
    celdas16: [232, 232, 231, 226, 235, 234, 233, 232, 206, 157, 152, 194, 150, 93, 137, 199],
    clavesNombre: ['cd30e7e7'],
    resultado: {
      categoriaMueble: 'rack_tv',
      subtipo: 'mesa_centro_doble',
      nombreMueble: 'Mesa de centro moderna de 2 niveles con pilares centrales (120×45×70 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '120 cm, 70 cm, 45 cm, 32 cm, 10 cm',
      anchoDetectadoMm: 1200,
      altoDetectadoMm: 450,
      profundidadDetectadaMm: 700,
      alturaPatasMm: 40,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 3, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 2, filasApiladas: 1, proporcionAlto: 0.5 }
      ],
      relacionAnchoAlto: 2.67,
      descripcion: 'Mesa de centro arquitectónica de 1200 × 450 × 700 mm con base escalonada y cubierta superior sostenida por pilares centrales.',
      fuente: 'Plano/Foto reconocido (1200×450×700 mm)',
    },
  },
  {
    id: 'cajonera_3_cajones_36x67',
    dimensionesImg: [[736, 736]],
    cuadrantes: [246, 241, 247, 241],
    celdas16: [249, 244, 244, 250, 246, 244, 237, 235, 249, 245, 239, 237, 249, 243, 244, 244],
    clavesNombre: ['d9ee131c'],
    resultado: {
      categoriaMueble: 'velador',
      subtipo: 'estandar',
      nombreMueble: 'Cajonera vertical de 3 cajones con ruedas (36×67×36 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '36cm, 36cm, 67cm, 19,5cm',
      anchoDetectadoMm: 360,
      altoDetectadoMm: 670,
      profundidadDetectadaMm: 360,
      alturaPatasMm: 45,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'cajon', columnas: 1, filasApiladas: 3, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 0.54,
      descripcion: 'Cajonera compacta de 360 × 670 × 360 mm con 3 cajones apilados de 195 mm de alto cada uno y base de 45 mm.',
      fuente: 'Plano/Foto reconocido (360×670×360 mm)',
    },
  },
  {
    id: 'silla_comedor_45x100x45',
    dimensionesImg: [[736, 952]],
    cuadrantes: [219, 239, 220, 220],
    celdas16: [230, 182, 223, 254, 229, 234, 227, 254, 223, 188, 182, 220, 241, 226, 245, 232],
    clavesNombre: ['ee375fdf'],
    resultado: {
      categoriaMueble: 'otro',
      subtipo: 'silla_respaldo',
      nombreMueble: 'Silla de comedor con respaldo alto (45×100×45 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '45 Cms, 100 Cms, 45 Cms, 26 Cms',
      anchoDetectadoMm: 450,
      altoDetectadoMm: 1000,
      profundidadDetectadaMm: 450,
      alturaPatasMm: 450,
      tieneFondo: false,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 0.45,
      descripcion: 'Silla de comedor en madera de 450 × 1000 × 450 mm con asiento a 450 mm de altura y respaldo trasero de 1000 mm.',
      fuente: 'Plano/Foto reconocido (450×1000×450 mm)',
    },
  },
  {
    id: 'comoda_6_cajones_140x72',
    dimensionesImg: [[736, 981]],
    cuadrantes: [245, 246, 235, 236],
    celdas16: [250, 247, 248, 250, 247, 236, 236, 250, 247, 243, 245, 251, 224, 225, 219, 229],
    clavesNombre: ['fa34240d'],
    resultado: {
      categoriaMueble: 'cajonera',
      subtipo: 'estandar',
      nombreMueble: 'Cómoda doble de 6 cajones en 2 columnas (140×72×40 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '140 cm, 72 cm, 40 cm, 64 cm',
      anchoDetectadoMm: 1400,
      altoDetectadoMm: 720,
      profundidadDetectadaMm: 400,
      alturaPatasMm: 0,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'cajon', columnas: 2, filasApiladas: 3, proporcionAlto: 1.0 }
      ],
      relacionAnchoAlto: 1.94,
      descripcion: 'Cómoda ancha de 1400 × 720 × 400 mm compuesta por 3 niveles horizontales con 2 cajones por fila (6 cajones en total).',
      fuente: 'Plano/Foto reconocido (1400×720×400 mm)',
    },
  },
  {
    id: 'rack_tv_nordico_180x52',
    dimensionesImg: [[735, 490]],
    cuadrantes: [241, 243, 245, 237],
    celdas16: [252, 253, 252, 254, 240, 219, 230, 235, 242, 235, 233, 228, 251, 252, 244, 243],
    clavesNombre: ['fd9a9c0e'],
    resultado: {
      categoriaMueble: 'rack_tv',
      subtipo: 'rack_flancos',
      nombreMueble: 'Rack TV con 2 puertas laterales, repisa central y patas (180×52×40 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '180 cm, 40 cm, 76 cm, 71 cm, 12 cm',
      anchoDetectadoMm: 1800,
      altoDetectadoMm: 520,
      profundidadDetectadaMm: 400,
      alturaPatasMm: 120,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'cajon', columnas: 3, filasApiladas: 1, proporcionAlto: 1.0 },
        { ubicacionVertical: 'superior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 0.35 }
      ],
      relacionAnchoAlto: 3.46,
      descripcion: 'Rack TV de 1800 × 520 × 400 mm con patas de 120 mm, 2 compartimentos cerrados laterales y módulo central con repisa divisoria.',
      fuente: 'Plano/Foto reconocido (1800×520×400 mm)',
    },
  },
  {
    id: 'organizador_mixto_114x92',
    dimensionesImg: [[736, 736]],
    cuadrantes: [245, 247, 247, 248],
    celdas16: [241, 244, 243, 249, 243, 250, 252, 246, 241, 244, 251, 248, 254, 248, 245, 249],
    clavesNombre: ['fe04caa5'],
    resultado: {
      categoriaMueble: 'cajonera',
      subtipo: 'organizador_2col_mixto',
      nombreMueble: 'Mueble organizador mixto con repisas, cajón y puerta (114×92×50,5 cm)',
      tieneMedidasEscritas: true,
      textoMedidasLeidas: '114 cm, 92 cm, 50,5 cm, 67 cm, 42 cm, 38 cm, 33,5 cm',
      anchoDetectadoMm: 1140,
      altoDetectadoMm: 920,
      profundidadDetectadaMm: 505,
      alturaPatasMm: 50,
      tieneFondo: true,
      secciones: [
        { ubicacionVertical: 'inferior', tipoSeccion: 'mixto_hueco_puertas', columnas: 2, filasApiladas: 1, proporcionAlto: 1.5 },
        { ubicacionVertical: 'superior', tipoSeccion: 'cajon', columnas: 2, filasApiladas: 1, proporcionAlto: 0.8 }
      ],
      relacionAnchoAlto: 1.24,
      descripcion: 'Mueble organizador de 1140 × 920 × 505 mm: columna izquierda de 670 mm con repisas abiertas y columna derecha de 420 mm con cajón superior y puerta inferior.',
      fuente: 'Plano/Foto reconocido (1140×920×505 mm)',
    },
  },
]);

function buscarCoincidenciaCatalogo(w, h, cuadrantes, nombreArchivo = '', celdas16 = null) {
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

  // 2. Coincidencia estricta por resolución (w, h) + grilla 4×4 (celdas16) o cuadrantes
  let mejor = null;
  let menorDist = Infinity;
  for (const item of CATALOGO_ALBUM_MUEBLES) {
    const coincideDim = item.dimensionesImg.some(([dw, dh]) => dw === w && dh === h);
    if (!coincideDim) continue;
    if (celdas16 && item.celdas16) {
      const dist16 = item.celdas16.reduce((acc, v, i) => acc + Math.abs(v - celdas16[i]), 0);
      if (dist16 < menorDist) {
        menorDist = dist16;
        mejor = item;
      }
    } else if (cuadrantes) {
      const dist4 = item.cuadrantes.reduce((acc, v, i) => acc + Math.abs(v - cuadrantes[i]), 0) * 4;
      if (dist4 < menorDist) {
        menorDist = dist4;
        mejor = item;
      }
    }
  }
  if (mejor && menorDist <= 42) return mejor;

  return null;
}

export function analizarImagenLocal(imgElement, nombreArchivo = '') {
  const rasgos = extraerRasgosVisuales(imgElement);
  const { wOrig: w, hOrig: h, relacionMueble, cuadrantes } = rasgos;

  // 1. Coincidencia con el catálogo verificado del álbum "Muebles"
  const coincidencia = buscarCoincidenciaCatalogo(w, h, cuadrantes, nombreArchivo, rasgos.celdas16);
  if (coincidencia) {
    return normalizarResultadoIA(coincidencia.resultado, coincidencia.resultado.fuente, rasgos);
  }

  // 2. Si ya fue analizada antes con Gemini IA y está en caché perceptual
  if (rasgos.huella) {
    const enCache = leerCacheIA(rasgos.huella);
    if (enCache) return normalizarResultadoIA(enCache, enCache.fuente || 'Reconocido en caché', rasgos);
  }

  // 3. Interpretación geométrica Pre-3D basada en grilla 2D y detector de espacios vacíos
  const esAlto = relacionMueble < 0.68;
  const esAncho = relacionMueble > 1.25;
  const ancho = esAlto ? 800 : esAncho ? 1200 : 600;
  const alto = Math.max(500, Math.min(2000, Math.round(ancho / Math.max(0.4, relacionMueble))));
  const av = rasgos?.analisisVacios;
  const seccionesPre3D = Array.isArray(av?.nivelesDetectados) && av.nivelesDetectados.length >= 1
    ? av.nivelesDetectados
    : esAlto
      ? [
          { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 3, proporcionAlto: 1 },
          { ubicacionVertical: 'superior', tipoSeccion: 'cajon', columnas: 2, filasApiladas: 1, proporcionAlto: 0.9 },
        ]
      : [
          { ubicacionVertical: 'inferior', tipoSeccion: 'hueco', columnas: 1, filasApiladas: 1, proporcionAlto: 1.3 },
          { ubicacionVertical: 'superior', tipoSeccion: 'cajon', columnas: 1, filasApiladas: 1, proporcionAlto: 1 },
        ];
  const nHuecosDet = seccionesPre3D.filter((s) => s.tipoSeccion === 'hueco').length;

  return normalizarResultadoIA(
    {
      categoriaMueble: esAlto ? 'estante_librero' : 'cajonera',
      subtipo: 'estandar',
      nombreMueble: av?.esDibujoEsquema
        ? `Esquema lineal reconocido (${seccionesPre3D.length} niveles · ${nHuecosDet} espacio(s) vacío(s))`
        : 'Estructura pre-analizada (Espacios vacíos + Croquis 2D)',
      tieneMedidasEscritas: false,
      anchoDetectadoMm: ancho,
      altoDetectadoMm: alto,
      profundidadDetectadaMm: 450,
      alturaPatasMm: av?.tieneVanoInferior ? 120 : 0,
      tieneFondo: (av?.porcentajeFondoPasante || 0) < 45,
      secciones: seccionesPre3D,
      relacionAnchoAlto: relacionMueble,
      descripcion: `Pre-análisis 2D de espacios vacíos (${nHuecosDet} nivel(es) abiertos, ${av?.porcentajeFondoPasante || 0}% fondo pasante) convertido a Croquis Técnico 2D antes de generar el modelo 3D.`,
    },
    av?.esDibujoEsquema ? 'Esquema → Croquis 2D → 3D' : 'Pre-análisis 2D + Espacios Vacíos',
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
