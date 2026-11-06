/**
 * Controlador principal de la interfaz de SmartFurniture.
 *
 * Flujo lineal:
 *   1. Cargar foto o croquis → Preprocesamiento Canvas 2D + Gemini Vision IA
 *      reconoce las secciones del mueble (repisas abiertas, cajones, puertas,
 *      divisiones verticales y patas) y sus medidas base.
 *   2. Medidas base (W₀, H₀, D₀) → descomposición en piezas y matriz M.
 *   3. Escalar con el dedo en 3D mediante el factor k (f(x) = k·x) → actualiza
 *      en tiempo real las dimensiones del mueble, las medidas de cada pieza,
 *      el modelo 3D y el plano de corte en planchas de 2440×1220 mm.
 */
import { ESPESOR, PLANCHA, LIMITES } from '../core/constantes.js?v=16';
import { parsearProporciones, factorEscala, escalar } from '../core/escala.js?v=16';
import { calcularProyecto } from '../core/sistema.js?v=16';
import { tapacantoPorFila } from '../core/calculos.js?v=16';
import {
  analizarConGemini,
  analizarImagenLocal,
  normalizarResultadoIA,
  prepararImagenParaIA,
  extraerRasgosVisuales,
  CROQUIS_EJEMPLO,
} from '../ia/analizador.js?v=16';
import { mapaColoresPorFila } from './colores.js?v=16';
import { renderizarPlanosCorte } from './planoCorte.js?v=16';
import { Visor3D } from './visor3d.js?v=16';

const CLAVE_API_STORAGE = 'smartfurniture_gemini_api_key';

const estado = {
  relacionFoto: null,
  fuenteImagen: null,
  nombreMueble: 'Mueble',
  descripcionIA: '',
  subtipo: 'estandar',
  secciones: null,
  alturaPatasBase: 0,
  tieneFondo: true,
  imagenBase64: null,
  imagenMime: null,
  rasgosVisuales: null,
  tieneMedidasEscritas: false,
  textoMedidasLeidas: '',
  datosConfirmadosUsuario: false,
  imgOriginalDataUrl: null,
  imgMargenesDataUrl: null,
  mostrandoMargenes: false,
  visor: null,
  ultimoResultado: null,
};

const $ = (id) => document.getElementById(id);

const formatearM2 = (mm2) => (mm2 / 1e6).toFixed(2);
const formatearMetros = (mm) => (mm / 1000).toFixed(2);

function limitar(val, [min, max]) {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function aplicarFactorEscalaGeneral(k) {
  const w0 = Number($('input-base-ancho').value) || 500;
  const h0 = Number($('input-base-alto').value) || 600;
  const d0 = Number($('input-base-prof').value) || 430;

  $('input-ancho').value = limitar(escalar(w0, k), LIMITES.ancho);
  $('input-alto').value = limitar(escalar(h0, k), LIMITES.alto);
  $('input-profundidad').value = limitar(escalar(d0, k), LIMITES.profundidad);
  $('etiqueta-factor-k').textContent = `k = ${Number(k).toFixed(2)}× (${Math.round(k * 100)}%)`;
  recalcular();
}

function actualizarFormulaEscalaVivo() {
  const w0 = Number($('input-base-ancho').value) || 500;
  const h0 = Number($('input-base-alto').value) || 600;
  const d0 = Number($('input-base-prof').value) || 430;
  const W = Number($('input-ancho').value) || w0;
  const H = Number($('input-alto').value) || h0;
  const D = Number($('input-profundidad').value) || d0;

  const kw = factorEscala(W, w0);
  const kh = factorEscala(H, h0);
  const kd = factorEscala(D, d0);

  $('tag-kw').textContent = `k_w=${kw.toFixed(2)}`;
  $('tag-kh').textContent = `k_h=${kh.toFixed(2)}`;
  $('tag-kd').textContent = `k_d=${kd.toFixed(2)}`;

  $('formula-escala-vivo').textContent =
    `Función de escalamiento f(x) = k · x  (espesor melamina e = 18 mm fijo):\n` +
    `  • Ancho W       = ${w0} mm × ${kw.toFixed(2)} = ${W} mm   (piezas horizontales: W − 2e = ${W - 36} mm)\n` +
    `  • Alto H        = ${h0} mm × ${kh.toFixed(2)} = ${H} mm\n` +
    `  • Profundidad D = ${d0} mm × ${kd.toFixed(2)} = ${D} mm`;
}

function resumenSeccionesTexto(secciones) {
  if (!Array.isArray(secciones) || !secciones.length) return '';
  const etiquetas = secciones.map((s, i) => {
    const nom = s.tipoSeccion === 'cajon'
      ? `${s.columnas} cajón(es)`
      : s.tipoSeccion === 'puertas'
        ? `${s.columnas} puerta(s)`
        : s.tipoSeccion === 'mixto_hueco_puertas'
          ? `hueco + ${Math.max(1, s.columnas - 1)} puerta(s)`
          : s.columnas > 1 ? `${s.columnas} huecos` : 'repisa abierta';
    return `Nivel ${i + 1}: ${nom}`;
  });
  return etiquetas.join(' → ');
}

function renderizarPanelDatosFaltantes() {
  const panel = $('panel-datos-faltantes');
  if (!panel) return;

  const w0 = $('input-base-ancho')?.value || 500;
  const h0 = $('input-base-alto')?.value || 600;
  const d0 = $('input-base-prof')?.value || 430;

  const bw = $('badge-estado-w0');
  const bh = $('badge-estado-h0');
  const bd = $('badge-estado-d0');

  if (estado.datosConfirmadosUsuario) {
    if (bw) { bw.className = 'badge-dato badge-confirmado'; bw.textContent = '✓ Confirmado'; }
    if (bh) { bh.className = 'badge-dato badge-confirmado'; bh.textContent = '✓ Confirmado'; }
    if (bd) { bd.className = 'badge-dato badge-confirmado'; bd.textContent = '✓ Confirmado'; }

    panel.innerHTML = `
      <div class="caja-aviso-confirmado">
        ✅ <strong>Datos confirmados para cálculo exacto:</strong>
        Medidas base fijadas en <strong>${w0} × ${h0} × ${d0} mm</strong>. El despiece y el plano de corte reflejan tus dimensiones exactas.
      </div>
    `;
    return;
  }

  if (!estado.tieneMedidasEscritas) {
    if (bw) { bw.className = 'badge-dato badge-estimado'; bw.textContent = 'Estimado IA'; }
    if (bh) { bh.className = 'badge-dato badge-estimado'; bh.textContent = 'Estimado IA'; }
    if (bd) { bd.className = 'badge-dato badge-estimado'; bd.textContent = 'Estimado IA'; }

    panel.innerHTML = `
      <div class="caja-aviso-estimacion">
        <div style="font-weight:700;color:#fbbf24;margin-bottom:4px">
          ⚠️ Faltan datos de medidas en la foto —Ingresa las medidas reales o se usará una estimación de la IA
        </div>
        <p style="margin:4px 0">
          La imagen subida <strong>no tiene medidas escritas</strong>. Para que el despiece sea exacto, ingresa abajo los <strong>datos que faltan</strong>:
          <strong>Ancho W₀, Alto H₀ y Profundidad D₀ (en mm)</strong>.
        </p>
        <p style="margin:6px 0 8px;padding:6px 8px;background:rgba(0,0,0,0.25);border-radius:6px;color:#fde68a">
          📌 <strong>Aviso importante:</strong> Si no agregas las medidas reales, <strong>el resultado NO será exacto y la IA realizará una estimación aproximada</strong> (actualmente <strong>${w0} × ${h0} × ${d0} mm</strong> según la proporción visual de la foto).
        </p>
        <button type="button" id="btn-confirmar-medidas" class="btn-secundario" style="font-size:0.8rem;padding:5px 12px;border-color:#fbbf24;color:#fef3c7">
          ✅ Confirmar estas medidas (${w0} × ${h0} × ${d0} mm) como exactas
        </button>
      </div>
    `;
  } else {
    const numCotas = (estado.textoMedidasLeidas.match(/\d+/g) || []).length;
    if (bw) { bw.className = 'badge-dato badge-leido'; bw.textContent = 'Leído croquis'; }
    if (bh) { bh.className = 'badge-dato badge-leido'; bh.textContent = 'Leído croquis'; }
    if (bd) {
      bd.className = numCotas >= 3 ? 'badge-dato badge-leido' : 'badge-dato badge-estimado';
      bd.textContent = numCotas >= 3 ? 'Leído croquis' : 'Estimado IA';
    }

    panel.innerHTML = `
      <div class="caja-aviso-estimacion">
        <div style="font-weight:700;color:#38bdf8;margin-bottom:4px">
          📐 Cotas detectadas en la imagen (${estado.textoMedidasLeidas || `${w0}×${h0}×${d0} mm`}) — Verifica datos faltantes
        </div>
        <p style="margin:4px 0">
          Se leyeron medidas del plano, pero cualquier dato técnico que no aparezca escrito en la imagen (como profundidad, altura de patas o fondo trasero) <strong>es estimado por la IA</strong>.
          <strong>Si no completas o confirmas los datos faltantes abajo, el cálculo no será 100% exacto y usará la estimación de la IA.</strong>
        </p>
        <button type="button" id="btn-confirmar-medidas" class="btn-secundario" style="margin-top:4px;font-size:0.8rem;padding:5px 12px">
          ✅ Confirmar medidas (${w0} × ${h0} × ${d0} mm) como exactas
        </button>
      </div>
    `;
  }

  $('btn-confirmar-medidas')?.addEventListener('click', () => {
    estado.datosConfirmadosUsuario = true;
    renderizarPanelDatosFaltantes();
    renderizarCajaResultadoIA();
  });
}

function renderizarCajaResultadoIA() {
  const caja = $('resultado-ia');
  if (!caja) return;
  caja.hidden = false;

  const tot = estado.ultimoResultado?.totales;
  const numPiezas = estado.ultimoResultado?.despiece?.piezas?.length || 0;
  const NivelesTxt = estado.secciones
    ? `<div style="margin-top:6px;font-size:0.83rem;color:#93c5fd">📐 <strong>Niveles (abajo → arriba):</strong> ${resumenSeccionesTexto(estado.secciones)}</div>`
    : '';

  // Editor rápido de niveles (mostrado de arriba hacia abajo como se ve el mueble)
  let editorHtml = '';
  if (Array.isArray(estado.secciones) && estado.secciones.length) {
    const filasEditor = [...estado.secciones]
      .map((sec, idxReal) => ({ sec, idxReal }))
      .reverse()
      .map(({ sec, idxReal }, posVisual, arr) => {
        const etq = posVisual === 0
          ? 'Superior'
          : posVisual === arr.length - 1
            ? 'Inferior'
            : `Medio ${arr.length - posVisual}`;
        return `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;font-size:0.8rem">
            <span style="min-width:68px;color:#cbd5e1;font-weight:600">${etq}:</span>
            <select data-idx="${idxReal}" class="sel-sec-tipo" style="padding:4px 6px;border-radius:6px;background:#0f172a;color:#f1f5f9;border:1px solid #26354d">
              <option value="hueco" ${sec.tipoSeccion === 'hueco' ? 'selected' : ''}>Repisa abierta</option>
              <option value="cajon" ${sec.tipoSeccion === 'cajon' ? 'selected' : ''}>Cajón(es)</option>
              <option value="puertas" ${sec.tipoSeccion === 'puertas' ? 'selected' : ''}>Puerta(s)</option>
              <option value="mixto_hueco_puertas" ${sec.tipoSeccion === 'mixto_hueco_puertas' ? 'selected' : ''}>Hueco + Puerta(s)</option>
            </select>
            <select data-idx="${idxReal}" class="sel-sec-cols" style="padding:4px 6px;border-radius:6px;background:#0f172a;color:#f1f5f9;border:1px solid #26354d">
              <option value="1" ${sec.columnas === 1 ? 'selected' : ''}>1 en fila</option>
              <option value="2" ${sec.columnas === 2 ? 'selected' : ''}>2 en fila</option>
              <option value="3" ${sec.columnas === 3 ? 'selected' : ''}>3 en fila</option>
              <option value="4" ${sec.columnas === 4 ? 'selected' : ''}>4 en fila</option>
            </select>
            ${arr.length > 1 ? `<button type="button" data-idx="${idxReal}" class="btn-quitar-sec btn-secundario" style="padding:2px 8px;font-size:0.75rem">✕</button>` : ''}
          </div>
        `;
      })
      .join('');

    editorHtml = `
      <details style="margin-top:8px;font-size:0.82rem">
        <summary style="cursor:pointer;color:#38bdf8;font-weight:600">
          🛠️ Corregir o personalizar niveles detectados (opcional)
        </summary>
        <div style="margin-top:8px;padding:8px;background:#0b1120;border:1px solid #26354d;border-radius:8px">
          ${filasEditor}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
            <button type="button" id="btn-add-sec-arriba" class="btn-secundario" style="padding:4px 10px;font-size:0.78rem">
              + Nivel arriba
            </button>
            <button type="button" id="btn-add-sec-abajo" class="btn-secundario" style="padding:4px 10px;font-size:0.78rem">
              + Nivel abajo
            </button>
            <label style="display:inline-flex;align-items:center;gap:4px;font-size:0.78rem;color:#cbd5e1">
              <input type="checkbox" id="chk-sec-patas" ${estado.alturaPatasBase > 0 ? 'checked' : ''}>
              Con patas (${estado.alturaPatasBase || 110} mm)
            </label>
            <label style="display:inline-flex;align-items:center;gap:4px;font-size:0.78rem;color:#cbd5e1">
              <input type="checkbox" id="chk-sec-fondo" ${estado.tieneFondo ? 'checked' : ''}>
              Con fondo 3 mm
            </label>
          </div>
        </div>
      </details>
    `;
  }

  caja.innerHTML = `
    <div class="ia-cabecera">
      <span class="badge-ia">${estado.fuenteImagen}</span>
      <strong>${estado.nombreMueble}</strong>
    </div>
    <p style="margin:6px 0">${estado.descripcionIA}</p>
    ${NivelesTxt}
    <div style="margin-top:8px;padding:8px 10px;background:#05966922;border:1px solid #34d399;border-radius:8px;color:#ecfdf5">
      ✅ <strong>Descompuesto en ${numPiezas} piezas</strong> (${$('input-base-ancho').value}×${$('input-base-alto').value}×${$('input-base-prof').value} mm)
      ${tot ? `· <strong>${tot.planchas} plancha(s)</strong> · ${tot.aprovechamiento.toFixed(1)}% aprovechamiento` : ''}
    </div>
    ${
      !estado.datosConfirmadosUsuario
        ? `<div style="margin-top:8px;padding:8px 10px;background:rgba(245,158,11,0.14);border:1px solid #f59e0b;border-radius:8px;color:#fef3c7;font-size:0.81rem">
            ⚠️ <strong>${estado.tieneMedidasEscritas ? 'Verifica los datos complementarios en el Paso 2:' : 'Faltan medidas reales en la foto:'}</strong>
            Si no ingresas los datos faltantes en el <strong>Paso 2</strong> (Ancho, Alto, Profundidad), <strong>el cálculo no será exacto y la IA realizará una estimación aproximada</strong>.
          </div>`
        : ''
    }
    ${editorHtml}
  `;

  // Eventos del editor rápido de secciones
  caja.querySelectorAll('.sel-sec-tipo').forEach((sel) => {
    sel.addEventListener('change', (ev) => {
      const idx = Number(ev.target.dataset.idx);
      if (estado.secciones?.[idx]) {
        estado.secciones[idx].tipoSeccion = ev.target.value;
        recalcular();
        renderizarCajaResultadoIA();
      }
    });
  });
  caja.querySelectorAll('.sel-sec-cols').forEach((sel) => {
    sel.addEventListener('change', (ev) => {
      const idx = Number(ev.target.dataset.idx);
      if (estado.secciones?.[idx]) {
        estado.secciones[idx].columnas = Number(ev.target.value) || 1;
        recalcular();
        renderizarCajaResultadoIA();
      }
    });
  });
  caja.querySelectorAll('.btn-quitar-sec').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      const idx = Number(ev.currentTarget.dataset.idx);
      if (estado.secciones && estado.secciones.length > 1) {
        estado.secciones.splice(idx, 1);
        recalcular();
        renderizarCajaResultadoIA();
      }
    });
  });
  $('btn-add-sec-arriba')?.addEventListener('click', () => {
    if (estado.secciones && estado.secciones.length < 8) {
      estado.secciones.push({ tipoSeccion: 'cajon', columnas: 1, proporcionAlto: 1 });
      recalcular();
      renderizarCajaResultadoIA();
    }
  });
  $('btn-add-sec-abajo')?.addEventListener('click', () => {
    if (estado.secciones && estado.secciones.length < 8) {
      estado.secciones.unshift({ tipoSeccion: 'hueco', columnas: 1, proporcionAlto: 1 });
      recalcular();
      renderizarCajaResultadoIA();
    }
  });
  $('chk-sec-patas')?.addEventListener('change', (ev) => {
    estado.alturaPatasBase = ev.target.checked ? 110 : 0;
    recalcular();
    renderizarCajaResultadoIA();
  });
  $('chk-sec-fondo')?.addEventListener('change', (ev) => {
    estado.tieneFondo = ev.target.checked;
    recalcular();
    renderizarCajaResultadoIA();
  });
}

function aplicarResultadoIA(res) {
  const norm = normalizarResultadoIA(res, res.fuente || 'IA', estado.rasgosVisuales);
  $('select-tipo').value = norm.tipo;
  $('input-repisas').value = norm.repisas;
  $('input-puertas').value = norm.puertas;
  $('input-cajones').value = norm.cajones;
  $('input-proporciones').value = (norm.proporciones || []).join(', ');

  estado.nombreMueble = norm.nombreMueble || 'Mueble reconocido';
  estado.descripcionIA = norm.descripcion || '';
  estado.subtipo = norm.subtipo || 'estandar';
  estado.secciones = norm.secciones ? norm.secciones.map((s) => ({ ...s })) : null;
  estado.alturaPatasBase = norm.alturaPatasMm || 0;
  estado.tieneFondo = norm.tieneFondo !== false;
  estado.relacionFoto = norm.relacionAnchoAlto || null;
  estado.fuenteImagen = norm.fuente || 'Imagen';
  estado.tieneMedidasEscritas = Boolean(norm.tieneMedidasEscritas);
  estado.textoMedidasLeidas = norm.textoMedidasLeidas || '';
  estado.datosConfirmadosUsuario = false;

  if (norm.anchoDetectadoMm) $('input-base-ancho').value = norm.anchoDetectadoMm;
  if (norm.altoDetectadoMm) $('input-base-alto').value = norm.altoDetectadoMm;
  if (norm.profundidadDetectadaMm) $('input-base-prof').value = norm.profundidadDetectadaMm;

  $('slider-escala-k').value = '1.00';
  aplicarFactorEscalaGeneral(1.0);
  renderizarPanelDatosFaltantes();
  renderizarCajaResultadoIA();
}

function seleccionarCroquisEjemplo(id) {
  const item = CROQUIS_EJEMPLO.find((c) => c.id === id);
  if (!item) return;
  document.querySelectorAll('.btn-croquis').forEach((b) => {
    b.classList.toggle('activo', b.dataset.croquis === id);
  });
  estado.rasgosVisuales = null;
  $('vista-previa-contenedor').hidden = false;
  $('vista-previa-img').hidden = true;
  $('vista-previa-img').removeAttribute('src');
  if ($('barra-herramientas-img')) $('barra-herramientas-img').hidden = true;
  if ($('input-archivo')) $('input-archivo').value = '';
  $('vista-previa-svg').innerHTML = item.svg;
  $('vista-previa-svg').hidden = false;
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
      $('vista-previa-svg').innerHTML = '';
      $('vista-previa-svg').hidden = true;
      img.hidden = false;

      if (img.dataset.modoMargenes === '1') return;
      estado.imgOriginalDataUrl = dataUrl;
      estado.mostrandoMargenes = false;

      // Preprocesar imagen en Canvas (realce de márgenes Sobel + fondo limpio) y extraer silueta 2D
      estado.rasgosVisuales = extraerRasgosVisuales(img);
      const optimizada = prepararImagenParaIA(img);
      if (optimizada) {
        estado.imagenBase64 = optimizada.base64;
        estado.imagenMime = optimizada.mimeType;
        estado.imgMargenesDataUrl = optimizada.mapaBordesDataUrl || optimizada.realzadaDataUrl || null;
      }
      if ($('barra-herramientas-img')) {
        $('barra-herramientas-img').hidden = !estado.imgMargenesDataUrl;
      }
      if ($('btn-toggle-margenes')) {
        $('btn-toggle-margenes').textContent = '✏️ Recalcar márgenes / Simplificar bordes';
      }

      const local = analizarImagenLocal(img, archivo.name);
      aplicarResultadoIA(local);
      estado.visor.reiniciarCamara();

      const esReconocidoExacto = local.fuente && !local.fuente.includes('Pre-análisis');
      const apiKey = $('input-api-key').value.trim();
      if (apiKey && !esReconocidoExacto) ejecutarAnalisisGemini();
    };
    img.src = dataUrl;
  };
  lector.readAsDataURL(archivo);
}

async function ejecutarAnalisisGemini() {
  const apiKey = $('input-api-key').value.trim();
  if (!apiKey || !estado.imagenBase64) return;
  const caja = $('resultado-ia');
  caja.hidden = false;
  caja.innerHTML = `<div class="badge-ia">⏳ Analizando foto/croquis con Gemini IA y descomponiendo secciones...</div>`;
  try {
    localStorage.setItem(CLAVE_API_STORAGE, apiKey);
    const res = await analizarConGemini(
      { base64: estado.imagenBase64, mimeType: estado.imagenMime },
      apiKey,
      estado.rasgosVisuales,
    );
    aplicarResultadoIA(res);
    estado.visor.reiniciarCamara();
  } catch (err) {
    renderizarCajaResultadoIA();
    caja.insertAdjacentHTML(
      'beforeend',
      `<p class="alerta-aviso" style="margin-top:8px">Aviso Gemini API: ${err.message}. Se mantiene el reconocimiento geométrico local.</p>`,
    );
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
        <td class="num"><strong>${f.largo} × ${f.ancho} mm</strong></td>
        <td class="num">${f.espesor} mm</td>
        <td>${detalleTc}</td>
      </tr>`;
  }).join('');
  $('tbody-despiece').innerHTML = filasHtml;

  const filasMatriz = despiece.M
    .map((fila, i) => `  [${fila.map((n) => String(n).padStart(4, ' ')).join(', ')}]  ← ${despiece.filas[i].id}: ${despiece.filas[i].nombre}`)
    .join('\n');
  $('bloque-matriz-m').textContent = `Matriz de despiece M (filas = componentes, columnas = [Cantidad, Largo, Ancho, Espesor en mm]):\n[\n${filasMatriz}\n]`;

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

  $('contenedor-matematicas').innerHTML = `
    <div class="grid-matematicas">
      <article class="card-mate">
        <h4>1. Función de Escalamiento y Función Afín</h4>
        <p>Al escalar el mueble con el factor <code>k</code>, las medidas exteriores cambian con <code>g(x) = k · x</code>, pero el espesor <code>e = ${ESPESOR} mm</code> permanece constante:</p>
        <pre class="formula">f(W) = W − 2·e = ${W} − 2·${ESPESOR} = ${interior} mm</pre>
      </article>

      <article class="card-mate">
        <h4>2. Matriz M y Vectores en ℝ³</h4>
        <p>El mueble se descompone en <strong>${despiece.piezas.length} piezas</strong> agrupadas en <strong>${despiece.M.length} filas</strong> de la matriz <code>M</code>. Cada pieza se posiciona en el visor 3D con:</p>
        <pre class="formula">p⃗ᵢ = (xᵢ, yᵢ, zᵢ) ∈ [0, ${W}] × [0, ${H}] × [0, ${D}]</pre>
      </article>

      <article class="card-mate">
        <h4>3. Sumatorias (Área y Tapacanto)</h4>
        <pre class="formula">A_útil = Σ (cantᵢ · Lᵢ · Aᵢ) = ${formatearM2(totales.areaUtil)} m²\nTapacanto = ${formatearMetros(totales.tapacanto)} m</pre>
      </article>

      <article class="card-mate">
        <h4>4. Optimización en Plancha 2440×1220 mm</h4>
        <pre class="formula">N_mín = ⌈A_útil / A_plancha⌉ = ${totales.cotaInferior}  →  Usadas: ${totales.planchas}\nAprovechamiento: ${totales.aprovechamiento.toFixed(1)}%  |  Desperdicio: ${totales.desperdicio.toFixed(1)}%</pre>
      </article>
    </div>
  `;
}

function recalcular() {
  const cajaError = $('caja-errores');
  const cajaAvisos = $('caja-advertencias');
  cajaError.hidden = true;
  cajaAvisos.hidden = true;

  actualizarFormulaEscalaVivo();

  try {
    const tipo = estado.secciones ? 'modular' : $('select-tipo').value;
    const h0 = Number($('input-base-alto').value) || 600;
    const H = Number($('input-alto').value) || h0;
    const kh = factorEscala(H, h0);

    const proporciones = parsearProporciones($('input-proporciones').value);
    const params = {
      ancho: Number($('input-ancho').value),
      alto: H,
      profundidad: Number($('input-profundidad').value),
      repisas: Number($('input-repisas').value),
      puertas: Number($('input-puertas').value),
      cajones: Number($('input-cajones').value),
      proporciones,
      subtipo: estado.subtipo || 'estandar',
      secciones: estado.secciones,
      alturaPatasMm: Math.round(estado.alturaPatasBase * kh),
      tieneFondo: estado.tieneFondo,
    };

    const resultado = calcularProyecto(tipo, params, { relacionFoto: estado.relacionFoto });
    estado.ultimoResultado = resultado;

    $('kpi-planchas').textContent = String(resultado.totales.planchas);
    $('kpi-planchas-sub').textContent = `Mínimo teórico: ${resultado.totales.cotaInferior} · Plancha 2440×1220`;
    $('kpi-aprovechamiento').textContent = `${resultado.totales.aprovechamiento.toFixed(1)}%`;
    $('kpi-desperdicio').textContent = `Desperdicio: ${resultado.totales.desperdicio.toFixed(1)}%`;
    $('kpi-tapacanto').textContent = `${formatearMetros(resultado.totales.tapacanto)} m`;
    $('kpi-tapacanto-sub').textContent = `${resultado.totales.tapacanto.toLocaleString('es-CL')} mm en bordes visibles`;
    $('kpi-area').textContent = `${formatearM2(resultado.totales.areaUtil)} m²`;
    $('kpi-area-sub').textContent = `Fondo 3 mm: ${formatearM2(resultado.totales.areaFondo)} m²`;

    if (resultado.advertencias.length) {
      cajaAvisos.hidden = false;
      cajaAvisos.innerHTML = resultado.advertencias.map((a) => `<div>⚠️ ${a}</div>`).join('');
    }
    $('lista-supuestos').innerHTML = resultado.mueble.supuestos.map((s) => `<li>${s}</li>`).join('');

    estado.visor.actualizar(resultado.mueble, resultado.despiece, false);
    renderizarPlanosCorte($('contenedor-planos'), resultado.corte, resultado.despiece.filas);
    renderizarTablaDespiece(resultado.despiece);
    renderizarExplicacionMatematica(resultado);
  } catch (err) {
    cajaError.hidden = false;
    cajaError.textContent = err.message;
  }
}

function inicializarEventos() {
  const contCroquis = $('botones-croquis');
  contCroquis.innerHTML = CROQUIS_EJEMPLO.map((c) => `
    <button type="button" class="btn-croquis" data-croquis="${c.id}">
      <strong>${c.titulo}</strong>
      <span>${c.subtitulo}</span>
    </button>
  `).join('');
  contCroquis.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.btn-croquis');
    if (btn) {
      seleccionarCroquisEjemplo(btn.dataset.croquis);
      estado.visor.reiniciarCamara();
    }
  });

  $('input-archivo').addEventListener('change', (ev) => {
    const archivo = ev.target.files?.[0];
    if (archivo) manejarArchivoImagen(archivo);
  });

  const apiGuardada = localStorage.getItem(CLAVE_API_STORAGE) || window.SMARTFURNITURE_DEFAULT_API_KEY || '';
  if (apiGuardada) {
    $('input-api-key').value = apiGuardada;
  } else {
    fetch('./js/ia/clave_local.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.apiKey && !$('input-api-key').value) $('input-api-key').value = d.apiKey;
      })
      .catch(() => {});
  }

  $('btn-analizar-ia').addEventListener('click', ejecutarAnalisisGemini);
  $('input-api-key').addEventListener('input', () => {
    const val = $('input-api-key').value.trim();
    if (val.length > 20) {
      localStorage.setItem(CLAVE_API_STORAGE, val);
      if (estado.imagenBase64) ejecutarAnalisisGemini();
    }
  });

  $('btn-toggle-margenes')?.addEventListener('click', () => {
    const img = $('vista-previa-img');
    if (!img || !estado.imgMargenesDataUrl || !estado.imgOriginalDataUrl) return;
    estado.mostrandoMargenes = !estado.mostrandoMargenes;
    img.dataset.modoMargenes = '1';
    img.src = estado.mostrandoMargenes ? estado.imgMargenesDataUrl : estado.imgOriginalDataUrl;
    $('btn-toggle-margenes').textContent = estado.mostrandoMargenes
      ? '📷 Ver foto original'
      : '✏️ Recalcar márgenes / Simplificar bordes';
    setTimeout(() => { delete img.dataset.modoMargenes; }, 60);
  });

  ['input-base-ancho', 'input-base-alto', 'input-base-prof'].forEach((id) => {
    $(id).addEventListener('input', () => {
      estado.datosConfirmadosUsuario = true;
      const k = Number($('slider-escala-k').value) || 1;
      aplicarFactorEscalaGeneral(k);
      renderizarPanelDatosFaltantes();
      renderizarCajaResultadoIA();
    });
  });

  $('slider-escala-k').addEventListener('input', (ev) => {
    aplicarFactorEscalaGeneral(Number(ev.target.value));
  });

  $('btn-reset-escala').addEventListener('click', () => {
    $('slider-escala-k').value = '1.00';
    aplicarFactorEscalaGeneral(1.0);
    estado.visor.reiniciarCamara();
  });

  ['input-ancho', 'input-alto', 'input-profundidad'].forEach((id) => {
    $(id).addEventListener('input', recalcular);
  });

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
  seleccionarCroquisEjemplo(CROQUIS_EJEMPLO[0].id);
  estado.visor.reiniciarCamara();
});
