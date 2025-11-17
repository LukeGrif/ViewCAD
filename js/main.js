// js/main.js
import { MODELS } from "./config.js";
import { CadViewer } from "./viewer.js";

// ----- DOM references -----
const canvas = document.getElementById("viewer-canvas");
const viewerPanel = document.querySelector(".viewer-panel");

const statusText = document.getElementById("statusText");
const fileNameEl = document.getElementById("fileName");
const boundsLabel = document.getElementById("boundsLabel");
const trianglesLabel = document.getElementById("trianglesLabel");
const polyCountEl = document.getElementById("polyCount");
const errorText = document.getElementById("errorText");
const envLabel = document.getElementById("envLabel");
const modelTitleEl = document.getElementById("modelTitle");
const modelButtonsContainer = document.getElementById("modelButtons");
const sidebarEl = document.getElementById("sidebar");
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
const sidebarToggleIcon = document.getElementById("sidebarToggleIcon");

// ----- Viewer instance -----
const viewer = new CadViewer(canvas, viewerPanel, {
  onStatusChange: (msg, isError) => {
    statusText.textContent = msg;
    errorText.style.display = isError ? "block" : "none";
    errorText.textContent = isError ? msg : "";
  },
  onStatsChange: ({ triangles, polygons }) => {
    trianglesLabel.textContent = triangles.toLocaleString();
    polyCountEl.textContent = polygons.toLocaleString();
  },
  onModelChange: ({ name, src, bounds }) => {
    modelTitleEl.textContent = "Design: " + name;
    fileNameEl.textContent = src;

    if (bounds && bounds.size) {
      const s = bounds.size;
      boundsLabel.textContent =
        `${s.x.toFixed(1)} × ${s.y.toFixed(1)} × ${s.z.toFixed(1)}`;
    } else {
      boundsLabel.textContent = "-";
    }
  },
  onEnvironmentChange: ({ label }) => {
    envLabel.textContent = label;
  }
});

// ----- Model menu -----
let activeModelId = null;

function initModelMenu() {
  modelButtonsContainer.innerHTML = "";
  MODELS.forEach((m) => {
    const btn = document.createElement("button");
    btn.textContent = m.label;
    btn.dataset.modelId = m.id;
    btn.addEventListener("click", () => loadModelFromMenu(m));
    modelButtonsContainer.appendChild(btn);
  });
}

function clearModelButtonActive() {
  const buttons = modelButtonsContainer.querySelectorAll("button");
  buttons.forEach((b) => b.classList.remove("active"));
}

function setModelButtonActive(modelId) {
  activeModelId = modelId;
  clearModelButtonActive();
  const btn = modelButtonsContainer.querySelector(
    `button[data-model-id="${modelId}"]`
  );
  if (btn) btn.classList.add("active");
}

function loadModelFromMenu(modelDef) {
  viewer.setAutoRotate(false);
  document.getElementById("autoRotateBtn").classList.remove("active");
  viewer.loadModel(modelDef.path, modelDef.label);
  setModelButtonActive(modelDef.id);
}

// ----- UI bindings -----

// File input
document.getElementById("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.name.match(/\.(glb|gltf)$/i)) {
    statusText.textContent = "Only .glb / .gltf supported";
    errorText.style.display = "block";
    errorText.textContent = "Only .glb / .gltf supported";
    return;
  }

  const url = URL.createObjectURL(file);
  viewer.setAutoRotate(false);
  document.getElementById("autoRotateBtn").classList.remove("active");
  viewer.loadModel(url, file.name);
});

// Reset view
document.getElementById("resetViewBtn").addEventListener("click", () => {
  viewer.resetView();
});

// Auto rotate
document.getElementById("autoRotateBtn").addEventListener("click", (e) => {
  const enabled = !e.target.classList.contains("active");
  viewer.setAutoRotate(enabled);
  e.target.classList.toggle("active", enabled);
});

// Wireframe
document.getElementById("wireframeBtn").addEventListener("click", (e) => {
  viewer.toggleWireframe();
  e.target.classList.toggle("active");
});

// Background
document.getElementById("bgToggleBtn").addEventListener("click", () => {
  viewer.toggleBackground();
});

// Grid
document.getElementById("gridToggle").addEventListener("change", (e) => {
  viewer.setGridVisible(e.target.checked);
});

// Shadows
document.getElementById("shadowToggle").addEventListener("change", (e) => {
  viewer.setShadowsEnabled(e.target.checked);
});

// Sidebar toggle
sidebarToggleBtn.addEventListener("click", () => {
  const isCollapsed = sidebarEl.classList.toggle("collapsed");
  sidebarToggleBtn.setAttribute("aria-expanded", (!isCollapsed).toString());
  sidebarToggleIcon.textContent = isCollapsed ? "▶" : "☰";
});

// ----- Init -----
initModelMenu();
if (MODELS.length > 0) {
  loadModelFromMenu(MODELS[0]);
}
