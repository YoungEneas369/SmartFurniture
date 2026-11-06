/**
 * Controlador principal de la interfaz de SmartFurniture.
 */
import { ESPESOR, PLANCHA } from '../core/constantes.js';
import { parsearProporciones } from '../core/escala.js';
import { calcularProyecto } from '../core/sistema.js';
import { tapacantoPorFila } from '../core/calculos.js';
import { analizarConGemini, analizarImagenLocal, CROQUIS_EJEMPLO } from '../ia/analizador.js';
import { mapaColoresPorFila } from './colores.js';
import { renderizarPlanosCorte } from './planoCorte.js';
import { Visor3D } from './visor3d.js';

const CLAVE_API_STORAGE = 'smartfurniture_gemini_api_key';

const estado = {
  relacionFoto: null,
  fuenteImagen: null,
  imagenBase64: null,
  imagenMime: null,
  visor: null,
  ultimoResultado: null,
};

const $ = (id) => document.getElementById(id);

function formatearM2(mm2) {
  return (mm2 / 1e6).toFixed(2);
}

function formatearMetros(mm) {
  return (mm / 1000).toFixed(2);
}

function actualizarVisibilidadCamposTipo() {
  const tipo = $('select-tipo').value;
  $('grupo-repisas').hidden = tipo === 'cajonera';
  $('grupo-puertas').hidden = tipo !== 'mueble_puertas';
  $('grupo-cajones').hidden = tipo !== 'cajonera';

  const nEspacios = tipo === 'cajonera'
    ? Number($('input-cajones').value) || 3
    : (Number($('input-repisas').value) || 0) + 1;
  $('ayuda-proporciones').textContent = tipo === 'cajonera'
    ? `${nEspacios} valores (de abajo hacia arriba, uno por frente de cajón). Vacío = todos iguales.`
    : `${nEspacios} valores (de abajo hacia arriba, uno por espacio entre repisas). Vacío = partes iguales.`;
}

function ajustarCantidadProporcionesSegunDivisiones() {
  const texto = $('input-proporciones').value.trim();
  if (!texto) return;
  const tipo = $('select-tipo').value;
  const esperado = tipo === 'cajonera'
    ? Number($('input-cajones').value) || 1
    : (Number($('input-repisas').value) || 0) + 1;
  const actual = parsearProporciones(texto);
  if (actual.length === esperado) return;
  const ajustado = Array.from({ length: esperado }, (_, i) => actual[i] ?? 1);
  $('input-proporciones').value = ajustado.join(', ');
}

function aplicarResultadoIA(res) {
  $('select-tipo').value = res.tipo;
  $('input-repisas').value = res.repisas;
  $('input-puertas').value = res.puertas;
  $('input-cajones').value = res.cajones;
  $('input-proporciones').value = (res.proporciones || []).join(', ');
  estado.relacionFoto = res.relacionAnchoAlto || null;
  estado.fuenteImagen = res.fuente || 'Imagen';

  const caja = $('resultado-ia');
  caja.hidden = false;
  caja.innerHTML = `
    <div class="ia-cabecera">
      <span class="badge-ia">${res.fuente}</span>
      <span>Razón ancho/alto en imagen: <strong>${res.relacionAnchoAlto}</strong></span>
    </div>
    <p>${res.descripcion}</p>
  `;
  actualizarVisibilidadCamposTipo();
  recalcular();
}

function seleccionarCroquisEjemplo(id) {
  const item = CROQUIS_EJEMPLO.find((c) => c.id === id);
  if (!item) return;
  document.querySelectorAll('.btn-croquis').forEach((b) => {
    b.classList.toggle('activo', b.dataset.croquis === id);
  });
  $('vista-previa-contenedor').hidden = false;
  $('vista-previa-svg').innerHTML = item.svg;
  $('vista-previa-img').hidden = true;
  $('vista-previa-svg').hidden = false;
  $('btn-analizar-ia').hidden = true;
  aplicarResultadoIA(item.resultado);
}

async function manejarArchivoImagen(archivo) {
  if (!archivo) return;
  document.querySelectorAll('.btn-croquis').forEach((b) => b.classList.remove('activo'));

  const lector = new FileReader();
  lector.onload = () => {
    const dataUrl = String(lector.result);
    const coma = dataUrl.indexOf(',');
    estado.imagenBase64 = dataUrl.slice(coma + 1);
    estado.imagenMime = archivo.type || 'image/jpeg';

    const img = $('vista-previa-img');
    img.onload = () => {
      $('vista-previa-contenedor').hidden = false;
      $('vista-previa-svg').hidden = true;
      img.hidden = false;
      $('btn-analizar-ia').hidden = false;
      // Ejecuta análisis geométrico inmediato y si hay API key permite o lanza Gemini
      const local = analizarImagenLocal(img);
      aplicarResultadoIA(local);
      const apiKey = $('input-api-key').value.trim();
      if (apiKey) ejecutarAnalisisGemini();
    };
    img.src = dataUrl;
  };
  lector.readAsDataURL(archivo);
}

async function ejecutarAnalisisGemini() {
  const apiKey = $('input-api-key').value.trim();
  if (!apiKey) {
    $('detalles-api').open = true;
    $('input-api-key').focus();
    return;
  }
  if (!estado.imagenBase64) return;
  const btn = $('btn-analizar-ia');
  const txtOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Analizando imagen con Gemini...';
  try {
    localStorage.setItem(CLAVE_API_STORAGE, apiKey);
    const res = await analizarConGemini(
      { base64: estado.imagenBase64, mimeType: estado.imagenMime },
      apiKey,
    );
    aplicarResultadoIA(res);
  } catch (err) {
    const caja = $('resultado-ia');
    caja.hidden = false;
    caja.innerHTML = `<p class="alerta-error">No se pudo consultar Gemini API: ${err.message}. Se mantiene la estimación local.</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = txtOriginal;
  }
}

function renderizarTablaDespiece(despiece) {
  const colores = mapaColoresPorFila(despiece.filas);
  const filasHtml = despiece.filas.map((f) => {
    const color = colores.get(f.id);
    const tcMm = tapacantoPorFila(f);
    const detalleTc = f.tapacanto.largo || f.tapacanto.ancho
      ? `${f.tapacanto.largo}L + ${f.tapacanto.ancho}A (${formatearMetros(tcMm)} m)`
      : 'Sin tapacanto';
    return `
      <tr>
        <td><span class="etiqueta-pieza" style="background:${color}22;border-color:${color};color:${color}">${f.id}</span></td>
        <td><strong>${f.nombre}</strong><br><small class="texto-suave">${f.material}</small></td>
        <td class="num">${f.cant}</td>
        <td class="num">${f.largo} × ${f.ancho}</td>
        <td class="num">${f.espesor}</td>
        <td class="num">${formatearM2(f.cant * f.largo * f.ancho)} m²</td>
        <td>${detalleTc}</td>
      </tr>`;
  }).join('');
  $('tbody-despiece').innerHTML = filasHtml;

  // Representación explícita de la matriz M
  const filasMatriz = despiece.M
    .map((fila, i) => `  [${fila.map((n) => String(n).padStart(4, ' ')).join(', ')}]  ← ${despiece.filas[i].id}: ${despiece.filas[i].nombre}`)
    .join('\n');
  $('bloque-matriz-m').textContent = `M (filas = tipos de pieza, columnas = [Cant, Largo, Ancho, Espesor en mm]):\n[\n${filasMatriz}\n]`;

  // Tabla de vectores posición 3D
  const filasVectores = despiece.piezas.map((p, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${p.idFila} · ${p.nombre}</td>
      <td class="num">(${p.pos.map((n) => Math.round(n)).join(', ')})</td>
      <td class="num">(${p.tam.map((n) => Math.round(n)).join(', ')})</td>
    </tr>`).join('');
  $('tbody-vectores').innerHTML = filasVectores;
}

function renderizarExplicacionMatematica(resultado) {
  const { mueble, despiece, totales } = resultado;
  const { ancho: W, alto: H, profundidad: D } = mueble.params;
  const interior = W - 2 * ESPESOR;
  const det = mueble.detalle;

  let bloqueEscala = '';
  if (det.espacios) {
    const fracs = det.fracciones.map((f) => f.toFixed(3)).join(', ');
    const espMm = det.espacios.map((h) => `${h.toFixed(1)} mm`).join(', ');
    bloqueEscala = `
      <li><strong>Altura libre interior:</strong> <code>H_libre = H − (n + 2)·e = ${H} − (${mueble.params.repisas} + 2)·${ESPESOR} = ${det.hLibre} mm</code></li>
      <li><strong>Fracciones normalizadas (suman 1):</strong> <code>f = [${fracs}]</code></li>
      <li><strong>Escalamiento lineal <code>g(fᵢ) = H_libre · fᵢ</code>:</strong> alturas de cada espacio = <code>[${espMm}]</code></li>`;
  } else if (det.altos) {
    const fracs = det.fracciones.map((f) => f.toFixed(3)).join(', ');
    const altosMm = det.altos.map((h) => `${h} mm`).join(', ');
    bloqueEscala = `
      <li><strong>Altura disponible para frentes:</strong> <code>H_frentes = ${det.altoTotal} mm</code></li>
      <li><strong>Fracciones normalizadas:</strong> <code>f = [${fracs}]</code></li>
      <li><strong>Escalamiento lineal <code>g(fᵢ) = H_frentes · fᵢ</code>:</strong> alto de cada frente = <code>[${altosMm}]</code></li>`;
  }

  $('contenedor-matematicas').innerHTML = `
    <div class="grid-matematicas">
      <article class="card-mate">
        <h4>1. Funciones afines vs. lineales</h4>
        <p>El espesor de la melamina (<code>e = ${ESPESOR} mm</code>) es constante y <strong>no se escala</strong>. Por eso el largo de base, techo y repisas es una <strong>función afín</strong> del ancho total:</p>
        <pre class="formula">f(W) = W − 2·e = ${W} − 2·${ESPESOR} = ${interior} mm</pre>
        <ul>${bloqueEscala}</ul>
      </article>

      <article class="card-mate">
        <h4>2. Matriz de despiece M y Vectores 3D</h4>
        <p>El mueble tiene <strong>${despiece.piezas.length} piezas</strong> agrupadas en una matriz <code>M</code> de <strong>${despiece.M.length} × 4</strong>. Cada pieza <em>i</em> se ubica en el espacio mediante su vector posición y su vector tamaño:</p>
        <pre class="formula">p⃗ᵢ = (xᵢ, yᵢ, zᵢ) ∈ ℝ³   ;   t⃗ᵢ = (Δxᵢ, Δyᵢ, Δzᵢ) ∈ ℝ³</pre>
        <p class="texto-suave">Restricción geométrica verificada: ninguna pieza sale de <code>[0, ${W}] × [0, ${H}] × [0, ${D}]</code> ni intersecta a otra.</p>
      </article>

      <article class="card-mate">
        <h4>3. Sumatorias de área y tapacanto</h4>
        <p>Área útil de melamina de 18 mm:</p>
        <pre class="formula">A_útil = Σ (cantᵢ · largoᵢ · anchoᵢ) = ${totales.areaUtil.toLocaleString('es-CL')} mm² (${formatearM2(totales.areaUtil)} m²)</pre>
        <p>Tapacanto (solo bordes visibles de cada pieza):</p>
        <pre class="formula">L_tapacanto = Σ cantᵢ · (nLᵢ·largoᵢ + nAᵢ·anchoᵢ) = ${totales.tapacanto.toLocaleString('es-CL')} mm (${formatearMetros(totales.tapacanto)} m)</pre>
      </article>

      <article class="card-mate">
        <h4>4. Optimización de corte (Cutting Stock 2D)</h4>
        <p>Cada plancha mide <code>${PLANCHA.largo} × ${PLANCHA.ancho} mm</code> (<code>${formatearM2(totales.areaPlancha)} m²</code>). La cota inferior teórica es:</p>
        <pre class="formula">N_mín = ⌈ A_útil / A_plancha ⌉ = ⌈ ${formatearM2(totales.areaUtil)} / ${formatearM2(totales.areaPlancha)} ⌉ = ${totales.cotaInferior} plancha(s)</pre>
        <p>La heurística de corte en guillotina (descontando <code>3 mm</code> de sierra) ubicó todas las piezas en <strong>${totales.planchas} plancha(s)</strong>:</p>
        <pre class="formula">Aprovechamiento = ${totales.aprovechamiento.toFixed(1)}%   |   Desperdicio = ${totales.desperdicio.toFixed(1)}%</pre>
      </article>
    </div>
  `;
}

function recalcular() {
  const cajaError = $('caja-errores');
  const cajaAvisos = $('caja-advertencias');
  cajaError.hidden = true;
  cajaAvisos.hidden = true;

  try {
    const tipo = $('select-tipo').value;
    const proporciones = parsearProporciones($('input-proporciones').value);
    const params = {
      ancho: Number($('input-ancho').value),
      alto: Number($('input-alto').value),
      profundidad: Number($('input-profundidad').value),
      repisas: Number($('input-repisas').value),
      puertas: Number($('input-puertas').value),
      cajones: Number($('input-cajones').value),
      proporciones,
    };

    const resultado = calcularProyecto(tipo, params, { relacionFoto: estado.relacionFoto });
    estado.ultimoResultado = resultado;

    // Indicadores principales
    $('kpi-planchas').textContent = String(resultado.totales.planchas);
    $('kpi-planchas-sub').textContent = `Mínimo teórico: ${resultado.totales.cotaInferior} · Plancha 2440×1220`;
    $('kpi-aprovechamiento').textContent = `${resultado.totales.aprovechamiento.toFixed(1)}%`;
    $('kpi-desperdicio').textContent = `Desperdicio: ${resultado.totales.desperdicio.toFixed(1)}%`;
    $('kpi-tapacanto').textContent = `${formatearMetros(resultado.totales.tapacanto)} m`;
    $('kpi-tapacanto-sub').textContent = `${resultado.totales.tapacanto.toLocaleString('es-CL')} mm en bordes visibles`;
    $('kpi-area').textContent = `${formatearM2(resultado.totales.areaUtil)} m²`;
    $('kpi-area-sub').textContent = `Fondo 3 mm: ${formatearM2(resultado.totales.areaFondo)} m²`;

    // Advertencias y supuestos
    if (resultado.advertencias.length) {
      cajaAvisos.hidden = false;
      cajaAvisos.innerHTML = resultado.advertencias.map((a) => `<div>⚠️ ${a}</div>`).join('');
    }
    $('lista-supuestos').innerHTML = resultado.mueble.supuestos.map((s) => `<li>${s}</li>`).join('');

    // Visor 3D, planos de corte, matriz y matemáticas
    estado.visor.actualizar(resultado.mueble, resultado.despiece);
    renderizarPlanosCorte($('contenedor-planos'), resultado.corte, resultado.despiece.filas);
    renderizarTablaDespiece(resultado.despiece);
    renderizarExplicacionMatematica(resultado);
  } catch (err) {
    cajaError.hidden = false;
    cajaError.textContent = err.message;
  }
}

function inicializarEventos() {
  // Botones de croquis de ejemplo
  const contCroquis = $('botones-croquis');
  contCroquis.innerHTML = CROQUIS_EJEMPLO.map((c) => `
    <button type="button" class="btn-croquis" data-croquis="${c.id}">
      <strong>${c.titulo}</strong>
      <span>${c.subtitulo}</span>
    </button>
  `).join('');
  contCroquis.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.btn-croquis');
    if (btn) seleccionarCroquisEjemplo(btn.dataset.croquis);
  });

  // Subida de archivo de imagen
  $('input-archivo').addEventListener('change', (ev) => {
    const archivo = ev.target.files?.[0];
    if (archivo) manejarArchivoImagen(archivo);
  });

  // API key de Gemini guardada localmente
  const apiGuardada = localStorage.getItem(CLAVE_API_STORAGE);
  if (apiGuardada) $('input-api-key').value = apiGuardada;
  $('btn-analizar-ia').addEventListener('click', ejecutarAnalisisGemini);

  // Cambios de tipo y medidas
  $('select-tipo').addEventListener('change', () => {
    actualizarVisibilidadCamposTipo();
    ajustarCantidadProporcionesSegunDivisiones();
    recalcular();
  });

  ['input-repisas', 'input-cajones'].forEach((id) => {
    $(id).addEventListener('input', () => {
      actualizarVisibilidadCamposTipo();
      ajustarCantidadProporcionesSegunDivisiones();
      recalcular();
    });
  });

  ['input-ancho', 'input-alto', 'input-profundidad', 'input-puertas', 'input-proporciones'].forEach((id) => {
    $(id).addEventListener('input', recalcular);
  });

  // Botones de medidas rápidas
  document.querySelectorAll('[data-preset-medidas]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [w, h, d] = btn.dataset.presetMedidas.split(',').map(Number);
      $('input-ancho').value = w;
      $('input-alto').value = h;
      $('input-profundidad').value = d;
      recalcular();
    });
  });

  // Controles del visor 3D
  $('slider-explosion').addEventListener('input', (ev) => {
    estado.visor.setExplosion(ev.target.value);
  });
  $('check-transparentar').addEventListener('change', (ev) => {
    estado.visor.setTransparentarFrentes(ev.target.checked);
  });
  $('btn-centrar-3d').addEventListener('click', () => {
    estado.visor.reiniciarCamara();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  estado.visor = new Visor3D($('lienzo-3d'));
  inicializarEventos();
  actualizarVisibilidadCamposTipo();
  // Cargar por defecto el primer croquis de referencia para que todo se vea vivo al abrir
  seleccionarCroquisEjemplo(CROQUIS_EJEMPLO[0].id);
});
