# 📋 Contexto Completo del Proyecto, Instrucciones del Usuario y Guía de Validación Técnica

Este documento reúne todo el contexto funcional, matemático y de ingeniería de **SmartFurniture**, incluyendo las instrucciones exactas definidas durante su desarrollo, para facilitar su revisión, validación y mejora continua.

---

## 1. Instrucciones y Requerimientos Clave Definidos por el Usuario

1. **Flujo directo y natural centrado en la imagen y el escalamiento táctil:**
   - *Requerimiento:* No pedir al usuario que modifique manualmente el mueble a "cajonera" o "armario" antes de empezar. Primero se carga la foto/croquis, luego se verifican o ingresan las medidas base para hacer los cálculos, se descompone el mueble mostrando sus componentes y medidas, y finalmente con el dedo —además de ver el modelo en 3D— se achica o agranda el mueble según el espacio disponible mediante un **factor de escala $k$**, viendo cómo se actualizan en tiempo real las medidas del mueble y de cada una de sus partes.
2. **Solicitud de datos faltantes y Enunciado de Estimación de la IA:**
   - *Requerimiento:* Cuando se sube una imagen que no tiene todas las medidas escritas, el sistema debe pedir los datos que faltan ($W_0, H_0, D_0$, patas, fondo) y mostrar un enunciado claro advirtiendo que **si no se agregan esos datos, el cálculo no será exacto y la IA realizará una estimación aproximada**.
3. **Simplificación y realce de márgenes para mejorar el reconocimiento:**
   - *Requerimiento:* Aplicar preprocesamiento visual para recalcar márgenes y uniones de tableros antes de analizar la foto, permitiendo además visualizar los bordes simplificados en pantalla.
4. **Reconocimiento robusto en los álbumes de prueba (`Muebles` y `Muebles2` — 45 diseños) y fotos nuevas:**
   - *Requerimiento:* Soportar tanto muebles modulares por filas como muebles divididos por **columnas independientes** (Racks de TV escalonados, consolas con cubierta sobre pilares y vano en "U", escritorios con pedestal lateral, mesas de centro con repisa, taburetes, sillas con respaldo, escaleras de 2 peldaños, góndolas y repisas flotantes entrelazadas).
5. **Comparación e integración de funciones de software profesional (Polyboard / CutList Optimizer / Moblo 3D):**
   - Cálculo automático de **Quincallería / Herrajes (BOM)** y **Presupuesto en CLP ($)**.
   - **Inspección táctil en 3D (`Raycaster`)** al tocar cualquier pieza del mueble.
   - **Exportación a CSV (CutList Optimizer / Excel)** e impresión de orden de corte en PDF.

---

## 2. Modelo Matemático Implementado (Funciones y Matrices — MVFM01)

### A. Función Lineal de Escalamiento y Función Afín de Despiece
Dado un mueble con dimensiones originales $(W_0, H_0, D_0)$ y un factor de escala $k \in [0.50, 2.00]$ (o factores por eje $k_w, k_h, k_d$):
- **Dimensiones exteriores escaladas (Función Lineal):**
  $$g(x) = k \cdot x \implies W = k_w W_0, \quad H = k_h H_0, \quad D = k_d D_0$$
- **Piezas horizontales interiores (Función Afín con espesor constante $e = 18\text{ mm}$):**
  $$f(W) = W - 2e = k_w W_0 - 36\text{ mm}$$
  Esto garantiza que al agrandar o achicar el mueble con el dedo, la estructura geométrica se escale proporcionalmente pero los tableros conserven el espesor comercial real de la melamina ($18\text{ mm}$).

### B. Matriz de Despiece $M$ y Vectores en $\mathbb{R}^3$
- Cada mueble de $N$ piezas individuales se agrupa por piezas idénticas en una **Matriz de Despiece $M \in \mathbb{N}^{m \times 4}$**, donde cada fila $i$ representa un tipo de componente:
  $$M_i = \begin{bmatrix} \text{Cantidad}_i & \text{Largo}_i & \text{Ancho}_i & \text{Espesor}_i \end{bmatrix}$$
- Para el renderizado 3D y la verificación de no-colisión, cada pieza $j \in \{1,\dots,N\}$ se define mediante dos vectores en $\mathbb{R}^3$:
  - **Vector de posición (esquina inferior-izquierda-trasera):** $\vec{p}_j = (x_j, y_j, z_j)$
  - **Vector de dimensiones:** $\vec{t}_j = (\Delta x_j, \Delta y_j, \Delta z_j)$
  - **Invariante verificada por test unitario:** Para todo par $j \neq l$, las cajas abiertas $(x_j, x_j+\Delta x_j) \times (y_j, y_j+\Delta y_j) \times (z_j, z_j+\Delta z_j)$ tienen intersección vacía ($\text{colisiones} = 0$) y están íntegramente contenidas en $[0, W] \times [0, H] \times [0, D]$.

---

## 3. Guía para Revisión y Posibles Mejoras Futuras (Para Validación Técnica)

Si deseas auditar el código o proponer mejoras adicionales, estos son los puntos clave del sistema:

1. **Verificación automática de integridad (`tests/motor.test.js` y `tests/ui.test.js`):**
   - Ejecutando `node --test tests/motor.test.js` se validan automáticamente:
     - 300 casos aleatorios de empaquetamiento 2D Guillotine (verificando que ninguna pieza se salga de la plancha de $2440\times 1220\text{ mm}$, que no se solapen y que respeten el *kerf* de $3\text{ mm}$).
     - Los **45 diseños completos** del catálogo (`Muebles` y `Muebles2`), comprobando que ninguno tenga superposición de tableros en 3D.
2. **Oportunidades de expansión futura:**
   - **Selector de espesor de tablero ($15\text{ mm}, 18\text{ mm}, 25\text{ mm}$) y dirección de veta (Grain Matching):** Permitir bloquear la rotación de $90^\circ$ en `corte.js` cuando se use melamina con diseño de veta maderada.
   - **Editor interactivo de celdas 2D (`[columna][fila]`):** Actualmente el usuario puede personalizar los niveles desde el desplegable `🛠️ Corregir o personalizar niveles detectados`; podría extenderse a un editor visual por columnas.
   - **Backend proxy opcional para la API Key de Gemini:** En `localhost:8080` se lee `js/ia/clave_local.json` automáticamente; en GitHub Pages (`https://youngeneas369.github.io/SmartFurniture/`), como el repositorio es público, la API Key se ingresa una vez en la interfaz y se persiste en `localStorage`.
