# 📜 Historial de Versiones y Actualizaciones (Changelog `v1` → `v20`)

## Versión `v20` (Actual — Comparativa con Polyboard / CutList Optimizer / Moblo 3D)
- **Quincallería y Herrajes Automáticos (`calcularHerrajesYCostos` en `js/core/calculos.js`):** Cálculo en tiempo real de bisagras cazoleta $35\text{ mm}$ (2, 3 o 4 por puerta según altura), pares de correderas telescópicas según profundidad, tiradores, tornillos soberbios $4\times 50\text{ mm}$, tarugos de $8\text{ mm}$, clavos de fondo y patines a piso.
- **Presupuesto Estimado en CLP ($):** Cálculo automático del costo de planchas de melamina, fondo HDF $3\text{ mm}$, metros de tapacanto PVC y kit de herrajes en Pesos Chilenos.
- **Inspector Táctil 3D con `THREE.Raycaster` (`js/ui/visor3d.js`):** Al tocar cualquier pieza en el visor 3D se resalta y muestra su código, medida exacta de corte y vector de posición $\vec{p}_i \in \mathbb{R}^3$.
- **Exportación a Taller (`js/ui/app.js`):** Botones para descargar el despiece en **CSV compatible con CutList Optimizer / Excel** e imprimir la ficha técnica en **PDF**.

## Versiones `v17` – `v19` (Soporte Completo Álbum `Muebles2` — 45 Diseños y Firma Espacial 4×4)
- Análisis e incorporación de las **32 fotos nuevas del álbum `Muebles2`** (total 45 diseños verificados sin colisiones 3D).
- **5 nuevas topologías paramétricas 3D en `js/core/plantillas.js`:**
  - `construirEscritorioPedestal` (`escritorio_pedestal`): Escritorios con vano libre para silla y pedestal lateral de cajones/puerta.
  - `construirMesaConRepisa` (`mesa_con_repisa`): Mesas de centro con cubierta, 4 patas, faldón y bandeja inferior.
  - `construirTaburete` (`taburete`): Taburetes y mesas altas multiusos con travesaños apoya-pies.
  - `construirSillaRespaldo` (`silla_respaldo`): Sillas de comedor, sillones de jardín y bancas con respaldo y apoyabrazos.
  - `construirEscaleraPeldanos` (`escalera_2_peldanos`): Banquetas escalera de 2 peldaños.
- **Firma espacial de 16 celdas (`4×4`, `celdas16`)** en `extraerRasgosVisuales()` para distinguir sin ambigüedad imágenes que comparten la misma resolución (ej. `736×736`).
- Sincronización global de caché de módulos ES (`?v=19` / `?v=20`) en todos los archivos `.js` y `.html`.

## Versiones `v15` – `v16` (Datos Faltantes, Enunciado de Estimación IA, Realce de Márgenes y Columnas Independientes)
- **Panel de Datos Faltantes y Enunciado de Estimación IA (`js/ui/app.js`):** Advierte explícitamente cuando una foto no trae medidas escritas que, si no se ingresan los datos faltantes, el resultado no será exacto y la IA realizará una estimación aproximada.
- **Filtro Sobel de Realce y Simplificación de Márgenes (`prepararImagenParaIA`):** Remarca los bordes estructurales antes de enviar a la IA e incluye el botón **`✏️ Recalcar márgenes / Simplificar bordes`** debajo de la vista previa.
- **Motor Composicional por Columnas Independientes (`construirGrillaColumnas`) y Consola con Pilares (`construirConsolaPilares`):** Soporte para muebles con zócalo retraído, techos parciales con vano central en "U", repisas por columna independiente y cubierta superior sobre pilares (ej. Arrimo `135×90×35 cm`).

## Versión `v14` (Racks de TV por Columnas y Cubierta Flotante)
- Constructores 3D `construirRackEscalonado` (ej. Rack TV `R-1456` de `1760×665×375 mm` con 2 gabinetes laterales bajos y puente central elevado) y `construirRackFlancos` (Rack TV de 3 columnas con 2 cajones laterales, 2 repisas centrales y cubierta flotante).

## Versiones `v10` – `v13` (Álbum `Muebles`, Guillotine 48 Heurísticas y Corrección de Vista Previa)
- Soporte completo para las 12 fotos iniciales del álbum `Muebles` (`mesa`, `puente_laterales`, `flotante_entrelazada`, `gondola`, `intercalado`, `mixto_hueco_puertas`).
- Actualización del optimizador de corte 2D (`js/core/corte.js`) al algoritmo multi-heurístico de Jukka Jylänki (48 heurísticas + desfragmentación de rectángulos libres).
- Corrección de especificidad CSS (`[hidden] { display: none !important; }`) para evitar que al subir una foto se superponga con el croquis anterior.

## Versiones `v1` – `v9` (Prototipo Inicial y Flujo de Escalamiento con Factor $k$)
- Implementación del flujo en 3 pasos: carga de imagen $\rightarrow$ despiece matricial $M$ $\rightarrow$ escalamiento táctil 3D con factor $k$ ($f(x) = k \cdot x$).
