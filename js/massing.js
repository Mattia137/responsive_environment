/* =========================================================================
   ALLSPARK // IMPACT  ·  js/massing.js
   GLB loader + three.js custom layer + geo-anchoring.
   --------------------------------------------------------------------------
   Uses the EXACT same transform as the reference site (2GBX_environment-2)
   to ensure the massing sits in the correct position on the map.
   ========================================================================= */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from '../config.js';
import { getMap, onStyleLoad } from './map.js';

let _threeLayer = null;
let _scene      = null;
let _model      = null;
let _camera     = null;
let _renderer   = null;
let _modelBBox  = null;

// Transform state — allows user fine-tuning on top of the fixed GLB_ORIGIN
let _userTransform = {
  anchor_lat:       CONFIG.GLB_ORIGIN.lat,
  anchor_lon:       CONFIG.GLB_ORIGIN.lng,
  rotation_deg:     0,
  vertical_offset_m: 0,
  uniform_scale:    1,
};

/* Create the custom layer once on first load */
function ensureCustomLayer() {
  if (_threeLayer) return _threeLayer;
  const map = getMap();
  if (!map) return null;

  _threeLayer = {
    id: 'allspark-massing',
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      _camera   = new THREE.Camera();
      _scene    = new THREE.Scene();

      // Lighting — match reference site
      const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
      dirLight.position.set(0, -70, 100).normalize();
      _scene.add(dirLight);

      const ambLight = new THREE.AmbientLight(0xffffff, 0.35);
      _scene.add(ambLight);

      // Add a secondary fill light
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
      fillLight.position.set(-50, 30, 80).normalize();
      _scene.add(fillLight);

      _renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      _renderer.autoClear = false;
    },

    render(gl, matrix) {
      if (!_model) return;

      const { anchor_lon, anchor_lat, rotation_deg, vertical_offset_m, uniform_scale } = _userTransform;

      // Reference site transform: fromLngLat → makeTranslation → scale(mScale, -mScale, mScale) → rotateX(PI/2)
      const mc = maptilersdk.MercatorCoordinate.fromLngLat(
        [anchor_lon, anchor_lat],
        vertical_offset_m
      );
      const mScale = mc.meterInMercatorCoordinateUnits();

      // Build model matrix — matching the reference site's approach exactly
      const l = new THREE.Matrix4()
        .makeTranslation(mc.x, mc.y, mc.z)
        .scale(new THREE.Vector3(
          mScale * uniform_scale,
          -mScale * uniform_scale,   // negative Y — critical for correct orientation
          mScale * uniform_scale
        ))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

      // Apply user rotation on top
      if (rotation_deg !== 0) {
        l.multiply(new THREE.Matrix4().makeRotationY(rotation_deg * Math.PI / 180));
      }

      // Final MVP
      const mvp = new THREE.Matrix4().fromArray(matrix).multiply(l);
      _camera.projectionMatrix = mvp;

      _renderer.resetState();
      _renderer.render(_scene, _camera);
      getMap().triggerRepaint();
    },
  };

  map.addLayer(_threeLayer);
  return _threeLayer;
}

/* --- Public API --- */

export async function loadGLB(fileOrUrl) {
  ensureCustomLayer();
  const url = (fileOrUrl instanceof File) ? URL.createObjectURL(fileOrUrl) : fileOrUrl;

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
      if (_model) _scene.remove(_model);
      _model = gltf.scene;

      // Initialize bounding box (CRITICAL BUG FIX)
      _modelBBox = new THREE.Box3().setFromObject(_model);

      // Traverse meshes for shadow support and matrix locking (exact match to 2GBX)
      _model.traverse(child => {
        if (child.isMesh) {
          child.updateMatrixWorld(true);
          child.matrixAutoUpdate = false;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      _scene.add(_model);
      getMap().triggerRepaint();

      const geometry = extractGeometry();
      resolve(geometry);
    }, undefined, (err) => {
      console.error('[massing] GLB load failed:', err);
      reject(err);
    });
  });
}

export function clearMassing() {
  if (_model && _scene) { _scene.remove(_model); _model = null; }
  _modelBBox = null;
  getMap()?.triggerRepaint();
}

export function updateMassingTransform(transform) {
  _userTransform = { ..._userTransform, ...transform };
  getMap()?.triggerRepaint();
}

export function getMassingTransform() {
  return { ..._userTransform };
}

/* Compute footprint_m2, height_m, volume_m3 from the loaded mesh */
export function extractGeometry() {
  if (!_model || !_modelBBox) return null;
  const size = new THREE.Vector3();
  _modelBBox.getSize(size);
  const width_m  = size.x;
  const depth_m  = size.z;
  const height_m = size.y;

  // Footprint: project all vertices to XZ plane, take convex hull area.
  const pts = [];
  _model.traverse(child => {
    if (child.isMesh && child.geometry) {
      const pos = child.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 2000));
      for (let i = 0; i < pos.count; i += step) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        v.applyMatrix4(child.matrixWorld);
        pts.push([v.x, v.z]);
      }
    }
  });
  const hull = convexHull2D(pts);
  const footprint_m2 = polygonArea(hull);
  const volume_m3    = footprint_m2 * height_m;
  const num_floors_est = Math.max(1, Math.round(height_m / 4.0));

  return { footprint_m2, height_m, volume_m3, num_floors_est, width_m, depth_m };
}

/* Re-attach three.js layer after a MapTiler style reload (style swap removes all layers) */
onStyleLoad(() => {
  if (!_threeLayer) return;
  const map = getMap();
  if (!map || map.getLayer('allspark-massing')) return;
  map.addLayer(_threeLayer);
  map.triggerRepaint();
});

/* --- 2D convex hull (monotone chain) --- */
function convexHull2D(points) {
  if (points.length < 3) return points.slice();
  const p = points.slice().sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const cross = (o,a,b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
  const lower = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function polygonArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1,y1] = pts[i], [x2,y2] = pts[(i+1)%n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}
