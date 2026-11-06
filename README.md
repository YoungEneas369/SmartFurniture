# 🪑 SmartFurniture — Reconocimiento por Visión IA, Despiece Matricial y Escalamiento 3D (`v20`)

🔗 **Aplicación Web en Vivo (GitHub Pages / PWA):** [https://youngeneas369.github.io/SmartFurniture/](https://youngeneas369.github.io/SmartFurniture/)  
📦 **Repositorio Oficial:** [https://github.com/YoungEneas369/SmartFurniture](https://github.com/YoungEneas369/SmartFurniture)

Proyecto desarrollado para la asignatura **Funciones y Matrices (MVFM01)** — metodología **ABPro**.
* **Integrantes:** Fernando A. Durán Leiva · Cristopher D. Figueroa Arthur · Francisco A. Lara Yevenes · Génesis T. Sepúlveda Muñoz
* **Docente:** Marco Antonio Troncoso Soto

---

## 🎯 Propósito y Flujo de Usuario (Instrucciones de Diseño)

El sistema resuelve el problema real de transformar una **foto o croquis de un mueble** en su **despiece exacto de fabricación en melamina**, permitiendo además **agrandar o achicar el mueble con el dedo en 3D mediante un factor de escala $k$** para adaptarlo al espacio disponible del usuario, recalculando instantáneamente las medidas de cada pieza, los herrajes, el presupuesto y el plano de corte en planchas de $2440 \times 1220\text{ mm}$.

### Flujo Lineal en 3 Pasos (Sin selectores manuales previos innecesarios)

1. **Paso 1 — Cargar Imagen o Croquis y Preprocesamiento de Márgenes:**
   - El usuario sube una foto o croquis desde su galería (o selecciona uno de los croquis integrados).
   - **Preprocesamiento 2D (`prepararImagenParaIA` y `extraerRasgosVisuales`):**
     - Aplica un filtro bidireccional **Sobel $3\times 3$ ($G = \sqrt{G_x^2 + G_y^2}$)** que recalca y simplifica los márgenes de tableros, uniones de puertas/cajones y números de cotas (con botón en pantalla **`✏️ Recalcar márgenes / Simplificar bordes`** para visualizar el mapa de contornos).
     - Extrae la caja delimitadora 2D del mueble, la firma espacial de luminancia de **16 celdas ($4\times 4$, `celdas16`)** y la huella perceptual de 64 bits (`aHash`).
   - **Reconocimiento Multimodal (`analizador.js`):**
     - Identifica automáticamente cuál de las **15 topologías estructurales 3D** corresponde al mueble, lee las cotas escritas en `cm` o `mm` (convirtiéndolas a milímetros) y descompone los niveles, columnas, puertas, cajones, repisas, patas y fondo trasero usando **Gemini Vision IA (`gemini-3.1-flash-lite` / `gemini-3.5-flash-lite`)** + catálogo verificado de 45 diseños de prueba.

2. **Paso 2 — Solicitud de Datos Faltantes, Aviso de Estimación IA y Descomposición Matricial ($M$):**
   - **Validación de Datos Faltantes y Enunciado de Estimación:**
     - Si la imagen subida **no contiene medidas escritas** (o faltan datos complementarios como la profundidad $D_0$), el sistema solicita explícitamente los datos faltantes ($W_0, H_0, D_0$) y muestra un **enunciado de advertencia**:
       > *«Si no agregas o confirmas las medidas reales, el resultado NO será exacto y la IA realizará una estimación aproximada según la proporción visual de la foto.»*
     - Cada medida base ($W_0, H_0, D_0$) indica su estado mediante etiquetas visuales: `Estimado IA` (ámbar), `Leído croquis` (azul) o `✓ Confirmado` (verde).
   - **Descomposición en Componentes (Matriz $M$) y Quincallería (BOM):**
     - Genera la tabla completa de piezas con sus dimensiones exactas de corte, espesor ($18\text{ mm}$ melamina / $3\text{ mm}$ fondo HDF) y bordes de tapacanto.
     - Calcula automáticamente la **Quincallería / Herrajes requeridos (BOM)** al estilo *Polyboard* (bisagras cazoleta $35\text{ mm}$, pares de correderas telescópicas según profundidad, tiradores, tornillos soberbios $4\times 50\text{ mm}$, tarugos de $8\text{ mm}$, clavos de fondo y patines) y el **Presupuesto Estimado en Pesos Chilenos ($ CLP)**.
     - Incluye botones de exportación directa a **CSV (compatible con CutList Optimizer / Excel)** e **Impresión / Ficha PDF de Taller**.

3. **Paso 3 — Visor 3D Interactivo + Escalamiento Táctil con Factor $k$ ($f(x) = k \cdot x$):**
   - Renderiza el mueble en 3D con **Three.js (`OrbitControls`)**, vista explosiva e **Inspector Táctil de Piezas (`THREE.Raycaster`)**: al tocar cualquier tabla en el modelo 3D, se ilumina y muestra en pantalla su código, medida de corte ($L \times A \times e$) y vector de posición $\vec{p}_i = (x_i, y_i, z_i) \in \mathbb{R}^3$.
   - **Control táctil del Factor de Escala $k$ ($0.50\times$ a $2.00\times$):**
     - Mientras el usuario desliza el dedo para agrandar o achicar el mueble, las medidas exteriores escalan linealmente ($W = k \cdot W_0, H = k \cdot H_0, D = k \cdot D_0$), mientras que las piezas interiores se ajustan mediante **funciones afines** manteniendo fijo el espesor de la melamina $e = 18\text{ mm}$:
       $$f_{\text{interior}}(W) = k \cdot W_0 - 2e$$
     - Actualiza en vivo el modelo 3D, la tabla de partes, el presupuesto y los **planos de corte 2D en planchas de $2440 \times 1220\text{ mm}$**.

---

## 🏗️ Las 15 Topologías Estructurales 3D Soportadas (`js/core/plantillas.js`)

El motor paramétrico 3D soporta tanto estructuras por filas como por columnas independientes y geometrías especiales:

1. `estandar`: Muebles modulares por niveles horizontales (cajoneras, veladores, estantes mixtos con cajones superiores, vanitorios, clósets, alacenas).
2. `grilla_columnas`: **Motor universal por columnas verticales independientes (`Izquierda | Centro | Derecha`)**, donde cada columna tiene sus propias repisas, cajones o puertas sin forzar que las repisas crucen las columnas vecinas.
3. `consola_pilares`: Arrimos y consolas con zócalo retraído inferior, módulos laterales con cubiertas parciales en voladizo, vano central abierto en "U" con repisa media y **cubierta superior corrida sostenida por 2 pilares verticales** (ej. `135×90×35 cm`).
4. `rack_escalonado`: Racks de TV de 3 cuerpos escalonados con gabinetes laterales más bajos con puerta, cajón central inferior, nichos subdivididos y cubierta puente elevada (ej. `R-1456` de `1760×665×375 mm`).
5. `rack_flancos`: Racks de TV horizontales con placa base a piso, zócalo retraído, 3 columnas (2 cajones laterales + 2 repisas centrales abiertas) y cubierta superior flotante (ej. `1800×520×420 mm`).
6. `escritorio_pedestal`: Escritorios con vano libre para piernas en un costado y módulo pedestal de cajones/puerta en el otro (ej. `120×75×60 cm`, `100×80×40 cm`).
7. `mesa`: Mesas y escritorios abiertos de 4 patas de esquina con cubierta superior y faldón perimetral (ej. `120×80×76 cm`, `183×71×80 cm`).
8. `mesa_con_repisa`: *Coffee tables* / mesas de centro con cubierta superior, 4 patas, faldones y bandeja/repisa inferior (ej. `120×45×60 cm`, `80×45×80 cm`).
9. `taburete`: Taburetes y mesas multiusos altas con cubierta, 4 patas, faldón superior y 4 travesaños apoya-pies (ej. `30×45×30 cm`, `48×71,5×33 cm`).
10. `silla_respaldo`: Sillas de comedor, sillones de jardín y bancas con respaldo alto y apoyabrazos laterales (ej. `66×76×61 cm`, `70×62×60 cm`, `45×100×45 cm`).
11. `escalera_2_peldanos`: Banquetas escalonadas de 2 peldaños con huellas, contrahuellas y laterales escalonados (ej. `40×38×40 cm`).
12. `puente_laterales`: Estantes murales con 2 torres verticales laterales unidas por repisas puente centrales (ej. `102×60×22 cm`).
13. `flotante_entrelazada`: Repisas flotantes geométricas con cubo central y escuadras en L entrelazadas (ej. `57×57×15 cm`).
14. `intercalado`: Libreros y repisas con divisiones verticales alternadas en zig-zag (ej. `90×190×35 cm`, `70×70×15 cm`).
15. `gondola`: Góndolas exhibidoras con montantes maestros, panel central y bandejas laterales en voladizo (ej. `196×150×70 cm`).

---

## 🧮 Optimizador de Corte 2D Guillotine (`js/core/corte.js`)

Basado en la formulación de **Jukka Jylänki (*A Thousand Ways to Pack the Bin*)**:
- Evalúa en paralelo **48 combinaciones heurísticas** por ejecución (4 órdenes de clasificación $\times$ 3 criterios de encaje `BAF`, `BSSF`, `BLSF` $\times$ 4 reglas de partición de guillotina `SLAS`, `LLAS`, `SAS`, `MAXAS`) con rotación de $90^\circ$ permitida.
- Incluye un paso de **desfragmentación y fusión de rectángulos libres adyacentes (`fusionarRectangulosLibres`)** después de cada corte y descuenta exactamente el espesor de sierra (*kerf* $= 3\text{ mm}$).

---

## 📂 Estructura del Repositorio

```text
SmartFurniture/
├── index.html                        # Interfaz principal PWA (3 pasos lineales)
├── SmartFurniture_Ejecutable.html    # Versión portable autocontenida
├── manifest.json / sw.js             # Configuración Progressive Web App (offline)
├── css/
│   └── estilos.css                   # Estilos responsivos mobile-first
├── js/
│   ├── core/
│   │   ├── constantes.js             # Constantes físicas (plancha 2440×1220, espesor 18 mm, kerf 3 mm)
│   │   ├── escala.js                 # Funciones lineales/afines y factor de escala k
│   │   ├── validacion.js             # Validaciones geométricas y alertas de luz máxima de repisa
│   │   ├── plantillas.js             # Constructores paramétricos 3D (15 topologías estructurales)
│   │   ├── despiece.js               # Agrupación en Matriz de Despiece M y piezas para corte
│   │   ├── corte.js                  # Optimizador 2D Guillotine Bin Packing (48 heurísticas + merge)
│   │   ├── calculos.js               # Sumatorias de área, tapacanto, quincallería (BOM) y costos CLP
│   │   └── sistema.js                # Orquestador del núcleo matemático (calcularProyecto)
│   ├── ia/
│   │   └── analizador.js             # Preprocesamiento Sobel 2D, firma 4×4, Gemini Vision IA y catálogo (45 diseños)
│   └── ui/
│       ├── app.js                    # Controlador de interfaz, eventos, avisos de estimación IA y exportación CSV/PDF
│       ├── visor3d.js                # Visor Three.js + OrbitControls + Raycaster táctil + respaldo SVG
│       ├── planoCorte.js             # Renderizador SVG de planchas 2440×1220 mm
│       └── colores.js                # Paleta cromática consistente entre tabla, 3D y planos 2D
├── tests/
│   ├── motor.test.js                 # Suite principal de pruebas unitarias
│   ├── ia.test.js                    # Pruebas de normalización y validación ergonómica IA
│   └── ui.test.js                    # Pruebas integrales de los 45 muebles (0 colisiones 3D + corte 2D válido)
├── docs/                             # Diagramas de arquitectura y flujo del sistema
├── CONTEXTO_Y_ARQUITECTURA.md        # Contexto completo, decisiones de diseño y guía de validación
└── CHANGELOG.md                      # Historial detallado de versiones (v1 a v20)
```

---

## 🧪 Cómo Ejecutar y Validar Localmente

```bash
# 1. Ejecutar las 20 pruebas automatizadas (incluye 300 casos aleatorios de corte y los 45 muebles reales)
node --test tests/motor.test.js

# 2. Levantar el servidor web local en http://localhost:8080
python3 -m http.server 8080
```
