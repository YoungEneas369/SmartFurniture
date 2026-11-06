# SmartFurniture

Prototipo web interactivo para el proyecto **ABPro — Funciones y Matrices (MVFM01)**: diseño paramétrico, matriz de despiece y optimización de corte 2D de muebles en melamina de 18 mm.

**Integrantes:** Fernando A. Durán Leiva · Cristopher D. Figueroa Arthur · Francisco A. Lara Yevenes · Génesis T. Sepúlveda Muñoz

---

## Flujo de funcionamiento

1. **Foto o croquis de referencia (proporciones):**
   - El usuario elige un croquis de referencia o sube una fotografía/boceto de un mueble.
   - Una foto 2D entrega **proporciones relativas** y el tipo de estructura (o puede analizarse opcionalmente mediante la API de Gemini Vision ingresando una API key propia en el navegador).
2. **Confirmación y medidas reales del espacio (mm):**
   - El usuario confirma el tipo de mueble (`librero`, `mueble_puertas`, `cajonera`) e ingresa las medidas reales disponibles: Ancho $W$, Alto $H$ y Profundidad $D$ en milímetros.
3. **Núcleo matemático (`js/core/`):**
   - **Funciones afines y lineales:** El espesor de la melamina ($e = 18\text{ mm}$) se mantiene constante ($f(W) = W - 2e$), mientras que las alturas libres se reparten proporcionalmente mediante $g(f_i) = H_{\text{libre}} \cdot f_i$.
   - **Matriz de despiece $M$:** Agrupa las piezas iguales en filas $[\text{cantidad}, \text{largo}, \text{ancho}, \text{espesor}]$.
   - **Vectores 3D:** Cada pieza tiene su vector posición $\vec{p}_i = (x_i, y_i, z_i)$ y tamaño $\vec{t}_i = (\Delta x_i, \Delta y_i, \Delta z_i)$.
   - **Sumatorias:** Superficie útil ($\sum \text{cant}_i \cdot \text{largo}_i \cdot \text{ancho}_i$) y metros lineales de tapacanto considerando únicamente los **bordes visibles**.
   - **Optimización de corte 2D:** Heurística de corte en guillotina sobre tableros estándar de $2440 \times 1220\text{ mm}$, descontando $3\text{ mm}$ de espesor de sierra (*kerf*).

---

## Ejecución local y pruebas

```bash
# Ejecutar pruebas unitarias del motor matemático
node --test tests/motor.test.js

# Levantar servidor local en http://localhost:8080
python3 -m http.server 8080
```
