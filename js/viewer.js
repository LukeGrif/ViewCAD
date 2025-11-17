// js/viewer.js
import * as THREE from "three";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js";

export class CadViewer {
  constructor(canvas, viewerPanelEl, callbacks = {}) {
    this.canvas = canvas;
    this.viewerPanelEl = viewerPanelEl;

    this.onStatusChange = callbacks.onStatusChange || null;
    this.onStatsChange = callbacks.onStatsChange || null;
    this.onModelChange = callbacks.onModelChange || null;
    this.onEnvironmentChange = callbacks.onEnvironmentChange || null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.model = null;
    this.gridHelper = null;
    this.floorMesh = null;
    this.dirLight = null;

    this.autoRotate = false;
    this.wireframeEnabled = false;
    this.darkBg = false;

    this._initScene();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);

    this._handleResize = this._handleResize.bind(this);
    window.addEventListener("resize", this._handleResize);
  }

  // ------------ Public API ------------

  loadModel(src, displayName = null) {
    this._setStatus("Loading model…");
    this._clearModel();

    const loader = new GLTFLoader();
    loader.load(
      src,
      (gltf) => this._onModelLoaded(gltf, src, displayName),
      undefined,
      (err) => {
        console.error(err);
        this._setStatus("Failed to load model", true);
      }
    );
  }

  resetView() {
    if (!this.model) return;
    this.autoRotate = false;
    this._fitCameraToObject(this.model);
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
  }

  toggleWireframe() {
    this.wireframeEnabled = !this.wireframeEnabled;
    if (!this.model) return;

    this.model.traverse((child) => {
      if (!child.isMesh) return;

      const original = child.material;
      const mats = Array.isArray(original) ? original : [original];

      const fixedMats = mats.map((m) => {
        if (!m) return m;

        let r = m.color?.r ?? 0;
        let g = m.color?.g ?? 0;
        let b = m.color?.b ?? 0;

        const isVeryDark = (r + g + b) < 0.15;
        const isPBRMetal =
          (m.metalness !== undefined && m.metalness > 0.4) ||
          (m.roughness !== undefined && m.roughness < 0.25);
        const isGlossWorkflow =
          m.specular !== undefined || m.glossiness !== undefined;

        const broken = isVeryDark || isPBRMetal || isGlossWorkflow;

        if (broken) {
          return new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.78, 0.78, 0.83),
            metalness: 0.85,
            roughness: 0.25,
            side: THREE.DoubleSide
          });
        }

        m.side = THREE.DoubleSide;
        m.needsUpdate = true;
        return m;
      });

      child.material = Array.isArray(original) ? fixedMats : fixedMats[0];
    });
  }

  toggleBackground() {
    this.darkBg = !this.darkBg;
    this._applyBackground();
  }

  setGridVisible(visible) {
    if (this.gridHelper) this.gridHelper.visible = visible;
  }

  setShadowsEnabled(enabled) {
    if (!this.dirLight || !this.renderer || !this.floorMesh) return;
    this.dirLight.castShadow = enabled;
    this.renderer.shadowMap.enabled = enabled;
    this.floorMesh.receiveShadow = enabled;
  }

  // ------------ Internal setup ------------

  _initScene() {
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 5000);
    this.camera.position.set(150, 120, 150);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = false;

    const amb = new THREE.AmbientLight(0xffffff, 1.8);
    this.scene.add(amb);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.2);
    hemi.position.set(0, 1, 0);
    this.scene.add(hemi);

    const DIR_INTENSITY = 0.35;
    const dirs = [
      [1, 1, 1],
      [-1, 1, 1],
      [1, 1, -1],
      [-1, 1, -1],
      [1, -1, 1],
      [-1, -1, 1],
      [1, -1, -1],
      [-1, -1, -1]
    ];

    dirs.forEach(([x, y, z]) => {
      const dl = new THREE.DirectionalLight(0xffffff, DIR_INTENSITY);
      dl.position.set(x, y, z);
      this.scene.add(dl);
    });

    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    this.dirLight.position.set(2, 3, 2);
    this.dirLight.castShadow = false;
    this.scene.add(this.dirLight);

    const floorGeo = new THREE.PlaneGeometry(1000, 1000);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.0 });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.receiveShadow = false;
    this.scene.add(this.floorMesh);

    this.gridHelper = new THREE.GridHelper(600, 60, 0x777777, 0xcccccc);
    this.gridHelper.visible = false;
    this.scene.add(this.gridHelper);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 1.5;
    this.controls.target.set(0, 60, 0);

    this._applyBackground();
  }

  _applyBackground() {
    if (!this.viewerPanelEl) return;

    if (this.darkBg) {
      this.viewerPanelEl.style.background =
        "radial-gradient(circle at top, #171c3b 0, #050713 45%, #02030a 100%)";
      if (this.onEnvironmentChange) {
        this.onEnvironmentChange({ label: "Studio", isDark: true });
      }
    } else {
      this.viewerPanelEl.style.background =
        "radial-gradient(circle at top, #fafcff 0, #dfe4ee 40%, #c7ced9 100%)";
      if (this.onEnvironmentChange) {
        this.onEnvironmentChange({ label: "Daylight", isDark: false });
      }
    }
  }

  _animate() {
    requestAnimationFrame(this._animate);
    if (this.controls) {
      this.controls.autoRotate = this.autoRotate;
      this.controls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  _handleResize() {
    if (!this.camera || !this.renderer) return;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  _clearModel() {
    if (!this.model || !this.scene) return;
    this.scene.remove(this.model);
    this.model = null;
  }

  _fitCameraToObject(object, offset = 1.4) {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const cameraZ = Math.abs((maxDim / 2) / Math.tan(fov / 2)) * offset;

    this.camera.position.set(
      center.x + cameraZ,
      center.y + cameraZ * 0.6,
      center.z + cameraZ
    );
    this.controls.target.copy(center);

    return { box, size, center };
  }

  _updateStats(object) {
    let count = 0;
    object.traverse((child) => {
      if (child.isMesh) {
        const geom = child.geometry;
        if (geom.index) count += geom.index.count / 3;
        else count += geom.attributes.position.count / 3;
      }
    });

    if (this.onStatsChange) {
      this.onStatsChange({
        triangles: count,
        polygons: count
      });
    }
  }

  _onModelLoaded(gltf, src, displayName) {
    this.model = gltf.scene;

    this.model.traverse((child) => {
      if (child.isMesh) {
        const geom = child.geometry;
        if (geom && geom.computeVertexNormals) {
          geom.computeVertexNormals();
        }

        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];

        mats.forEach((m) => {
          if (!m) return;
          m.side = THREE.DoubleSide;
          m.needsUpdate = true;
        });
      }
    });

    this.scene.add(this.model);

    const nameLabel = displayName || src;
    const { box, size } = this._fitCameraToObject(this.model);
    this._updateStats(this.model);

    if (this.onModelChange) {
      this.onModelChange({
        name: nameLabel,
        src,
        bounds: {
          min: box.min.clone(),
          max: box.max.clone(),
          size
        }
      });
    }

    this._setStatus("Loaded");
  }

  _setStatus(msg, isError = false) {
    if (this.onStatusChange) {
      this.onStatusChange(msg, isError);
    }
  }
}
