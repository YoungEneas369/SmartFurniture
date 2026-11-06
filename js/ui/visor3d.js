/**
 * Visor 3D del mueble usando Three.js + OrbitControls.
 *
 * Cada pieza se posiciona usando su vector p = (x, y, z) y su vector de
 * tamaño t = (dx, dy, dz). Incluye vista explosiva para separar las tablas y
 * ver el ensamble interior.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mapaColoresPorFila } from './colores.js?v=23';
import { calcularUnionesYTornillos } from './croquis2d.js?v=23';

export class Visor3D {
  constructor(contenedor) {
    this.contenedor = contenedor;
    this.explosion = 0;
    this.transparentarFrentes = false;
    this.mostrarTornillos = true;
    this.ultimoEstado = null;
    this.webglDisponible = false;
    this.iniciar();
  }

  iniciar() {
    try {
      const ancho = this.contenedor.clientWidth || 600;
      const alto = this.contenedor.clientHeight || 420;
      this.escena = new THREE.Scene();
      this.escena.background = new THREE.Color(0x0b1220);

      this.camara = new THREE.PerspectiveCamera(42, ancho / alto, 1, 20000);
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(ancho, alto);
      this.contenedor.innerHTML = '';
      this.contenedor.appendChild(this.renderer.domElement);

      this.controles = new OrbitControls(this.camara, this.renderer.domElement);
      this.controles.enableDamping = true;
      this.controles.dampingFactor = 0.08;

      const amb = new THREE.AmbientLight(0xffffff, 0.78);
      const dir1 = new THREE.DirectionalLight(0xffffff, 0.75);
      dir1.position.set(1800, 2600, 2400);
      const dir2 = new THREE.DirectionalLight(0x93c5fd, 0.35);
      dir2.position.set(-1600, 1200, -1400);
      this.escena.add(amb, dir1, dir2);

      this.grupoMueble = new THREE.Group();
      this.escena.add(this.grupoMueble);
      this.raycaster = new THREE.Raycaster();
      this.puntero = new THREE.Vector2();
      this.mallaSeleccionada = null;
      this.webglDisponible = true;

      // HUD flotante para mostrar medidas al tocar una pieza en 3D
      this.hud = document.createElement('div');
      this.hud.style.cssText =
        'position:absolute;bottom:10px;left:10px;right:10px;padding:7px 11px;background:rgba(15,23,42,0.88);' +
        'border:1px solid #38bdf8;border-radius:8px;color:#f1f5f9;font-size:0.8rem;pointer-events:none;z-index:5;';
      this.hud.innerHTML = '👆 <strong>Toca cualquier pieza en el modelo 3D</strong> para inspeccionar su medida de corte y posición ℝ³.';
      if (getComputedStyle(this.contenedor).position === 'static') {
        this.contenedor.style.position = 'relative';
      }
      this.contenedor.appendChild(this.hud);

      let downX = 0, downY = 0;
      const dom = this.renderer.domElement;
      dom.addEventListener('pointerdown', (ev) => {
        downX = ev.clientX;
        downY = ev.clientY;
      });
      dom.addEventListener('pointerup', (ev) => {
        if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 6) return;
        const rect = dom.getBoundingClientRect();
        this.puntero.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        this.puntero.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.puntero, this.camara);
        const mallas = this.grupoMueble.children.filter((c) => c.isMesh && c.userData?.pieza);
        const hits = this.raycaster.intersectObjects(mallas, false);
        if (this.mallaSeleccionada?.material?.emissive) {
          this.mallaSeleccionada.material.emissive.setHex(0x000000);
        }
        if (hits.length > 0) {
          const m = hits[0].object;
          this.mallaSeleccionada = m;
          if (m.material?.emissive) m.material.emissive.setHex(0x0284c7);
          const pz = m.userData.pieza;
          this.hud.innerHTML =
            `🔩 <strong>[${pz.idFila}] ${pz.nombre}:</strong> Corte <strong>${pz.largo} × ${pz.ancho} × ${pz.espesor} mm</strong> ` +
            `· Vector pos ℝ³: (${pz.pos.map((n) => Math.round(n)).join(', ')})`;
        } else {
          this.mallaSeleccionada = null;
          this.hud.innerHTML = '👆 <strong>Toca cualquier pieza en el modelo 3D</strong> para inspeccionar su medida de corte y posición ℝ³.';
        }
      });

      const animar = () => {
        requestAnimationFrame(animar);
        this.controles.update();
        this.renderer.render(this.escena, this.camara);
      };
      animar();

      window.addEventListener('resize', () => this.redimensionar());
    } catch {
      this.webglDisponible = false;
    }
  }

  redimensionar() {
    if (!this.webglDisponible) return;
    const ancho = this.contenedor.clientWidth || 600;
    const alto = this.contenedor.clientHeight || 420;
    this.camara.aspect = ancho / alto;
    this.camara.updateProjectionMatrix();
    this.renderer.setSize(ancho, alto);
  }

  setExplosion(valor) {
    this.explosion = Number(valor) || 0;
    if (this.ultimoEstado) this.actualizar(this.ultimoEstado.mueble, this.ultimoEstado.despiece, false);
  }

  setTransparentarFrentes(activo) {
    this.transparentarFrentes = Boolean(activo);
    if (this.ultimoEstado) this.actualizar(this.ultimoEstado.mueble, this.ultimoEstado.despiece, false);
  }

  setMostrarTornillos(activo) {
    this.mostrarTornillos = Boolean(activo);
    if (this.ultimoEstado) this.actualizar(this.ultimoEstado.mueble, this.ultimoEstado.despiece, false);
  }

  reiniciarCamara() {
    if (!this.ultimoEstado || !this.webglDisponible) return;
    const { ancho: W, alto: H, profundidad: D } = this.ultimoEstado.mueble.params;
    const diag = Math.hypot(W, H, D);
    this.camara.position.set(W * 0.85, H * 0.45, diag * 1.35);
    this.controles.target.set(0, 0, 0);
    this.controles.update();
  }

  actualizar(mueble, despiece, reencuadrar = true) {
    this.ultimoEstado = { mueble, despiece };
    const colores = mapaColoresPorFila(despiece.filas);
    const { ancho: W, alto: H, profundidad: D } = mueble.params;

    if (!this.webglDisponible) {
      this.dibujarIsometricoSVG(despiece.piezas, colores, { W, H, D });
      return;
    }

    while (this.grupoMueble.children.length) {
      const obj = this.grupoMueble.children.pop();
      obj.geometry?.dispose?.();
      obj.material?.dispose?.();
    }

    const centroMueble = [W / 2, H / 2, D / 2];

    for (const p of despiece.piezas) {
      const [dx, dy, dz] = p.tam;
      const [px, py, pz] = p.pos;
      // Centro de la pieza relativo al centro del mueble
      const cx = px + dx / 2 - centroMueble[0];
      const cy = py + dy / 2 - centroMueble[1];
      const cz = pz + dz / 2 - centroMueble[2];

      // Vector desplazamiento para la vista explosiva
      const kExp = this.explosion * 0.38;
      const ex = cx * kExp;
      const ey = cy * kExp;
      const ez = cz * kExp;

      const geom = new THREE.BoxGeometry(dx, dy, dz);
      const colorHex = colores.get(p.idFila) || '#38bdf8';
      const esFrente = p.grupo === 'puerta' || p.grupo === 'frente';
      const opacidad = esFrente && this.transparentarFrentes ? 0.28 : p.grupo === 'fondo' ? 0.65 : 0.94;

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        roughness: 0.55,
        metalness: 0.05,
        transparent: opacidad < 1,
        opacity: opacidad,
      });

      const malla = new THREE.Mesh(geom, mat);
      malla.userData.pieza = p;
      malla.position.set(cx + ex, cy + ey, cz + ez);

      const bordes = new THREE.LineSegments(
        new THREE.EdgesGeometry(geom),
        new THREE.LineBasicMaterial({ color: 0x0f172a }),
      );
      malla.add(bordes);
      this.grupoMueble.add(malla);
    }

    // Renderizar Tornillos Soberbio 4×50 mm y Bisagras Cazoleta 35 mm en 3D si está activo
    if (this.mostrarTornillos) {
      const { puntos } = calcularUnionesYTornillos(mueble);
      const kExpT = this.explosion * 0.42;
      const matTornillo = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.55, roughness: 0.3 });
      const matBisagra = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.65, roughness: 0.25 });
      const matCorredera = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.35 });

      for (const pt of puntos) {
        const [tx, ty, tz] = pt.pos;
        const cx = tx - centroMueble[0];
        const cy = ty - centroMueble[1];
        const cz = tz - centroMueble[2];

        let meshPt;
        if (pt.tipo === 'bisagra') {
          const gBis = new THREE.CylinderGeometry(16, 16, 8, 16);
          gBis.rotateX(Math.PI / 2);
          meshPt = new THREE.Mesh(gBis, matBisagra);
        } else if (pt.tipo === 'corredera') {
          const gCor = new THREE.BoxGeometry(8, 14, 90);
          meshPt = new THREE.Mesh(gCor, matCorredera);
        } else {
          // Tornillo Soberbio 4×50 mm con cabeza visible
          const gTor = new THREE.CylinderGeometry(5.5, 3.2, 34, 12);
          if (pt.eje === 'X') gTor.rotateZ(Math.PI / 2);
          else if (pt.eje === 'Z') gTor.rotateX(Math.PI / 2);
          meshPt = new THREE.Mesh(gTor, matTornillo);
        }
        meshPt.position.set(cx * (1 + kExpT), cy * (1 + kExpT), cz * (1 + kExpT));
        this.grupoMueble.add(meshPt);
      }
    }

    // Grilla base de referencia bajo el mueble
    const tamGrilla = Math.max(W, D) * 1.8;
    const grilla = new THREE.GridHelper(tamGrilla, 12, 0x38bdf8, 0x1e293b);
    grilla.position.y = -H / 2 - 2;
    this.grupoMueble.add(grilla);

    if (reencuadrar) this.reiniciarCamara();
  }

  /**
   * Respaldo isométrico en SVG cuando el entorno no expone aceleración WebGL.
   */
  dibujarIsometricoSVG(piezas, colores, { W, H, D }) {
    const kExp = this.explosion * 0.3;
    const proy = (x, y, z) => [
      (x - z) * 0.866,
      (x + z) * 0.5 - y,
    ];
    // Ordenar de atrás hacia adelante y de abajo hacia arriba (algoritmo del pintor)
    const ordenadas = [...piezas].sort(
      (a, b) => a.pos[2] + a.pos[1] * 0.3 + a.pos[0] * 0.2 - (b.pos[2] + b.pos[1] * 0.3 + b.pos[0] * 0.2),
    );
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const caras = [];

    for (const p of ordenadas) {
      const [dx, dy, dz] = p.tam;
      const cx = p.pos[0] + dx / 2 - W / 2;
      const cy = p.pos[1] + dy / 2 - H / 2;
      const cz = p.pos[2] + dz / 2 - D / 2;
      const x0 = p.pos[0] + cx * kExp;
      const y0 = p.pos[1] + cy * kExp;
      const z0 = p.pos[2] + cz * kExp;
      const x1 = x0 + dx, y1 = y0 + dy, z1 = z0 + dz;

      const v = {
        fbl: proy(x0, y0, z1), fbr: proy(x1, y0, z1), ftl: proy(x0, y1, z1), ftr: proy(x1, y1, z1),
        bbl: proy(x0, y0, z0), bbr: proy(x1, y0, z0), btl: proy(x0, y1, z0), btr: proy(x1, y1, z0),
      };
      Object.values(v).forEach(([px, py]) => {
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      });
      const col = colores.get(p.idFila) || '#38bdf8';
      const op = (p.grupo === 'puerta' || p.grupo === 'frente') && this.transparentarFrentes ? 0.28 : 0.88;
      const poly = (pts, opMul) =>
        `<polygon points="${pts.map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="${col}" fill-opacity="${(op * opMul).toFixed(2)}" stroke="#0f172a" stroke-width="2"/>`;
      caras.push(
        poly([v.ftl, v.ftr, v.btr, v.btl], 1.0),   // cara superior
        poly([v.fbl, v.fbr, v.ftr, v.ftl], 0.85),  // cara frontal
        poly([v.fbr, v.bbr, v.btr, v.ftr], 0.68),  // cara lateral derecha
      );
    }

    const pad = 60;
    const vw = Math.max(200, maxX - minX + pad * 2);
    const vh = Math.max(200, maxY - minY + pad * 2);
    this.contenedor.innerHTML = `
      <svg viewBox="${(minX - pad).toFixed(0)} ${(minY - pad).toFixed(0)} ${vw.toFixed(0)} ${vh.toFixed(0)}"
           style="width:100%;height:100%;background:#0b1220;display:block" role="img" aria-label="Modelo 3D isométrico del mueble">
        ${caras.join('')}
      </svg>`;
  }
}
