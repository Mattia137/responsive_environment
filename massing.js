/* =========================================================================
   ALLSPARK // IMPACT  ·  massing.js
   GLB loader + three.js custom layer + geo-anchoring
   --------------------------------------------------------------------------
   The critical coordinate trick: we do NOT scale the mesh. We scale the
   MapLibre Mercator projection matrix so that 1 mesh unit = 1 meter at the
   anchor latitude. This keeps mesh dimensions true meters and makes the
   geometry inspector trustworthy.
   ========================================================================= */

import { getMap } from './map.js';

let _threeLayer = null;       // the MapLibre custom layer instance
let _scene      = null;       // three.js scene
let _model      = null;       // the loaded GLB scene
let _camera     = null;
let _renderer   = null;
let _transform  = null;
let _modelBBox  = null;       // three.Box3 for the loaded mesh

/* Create the custom layer once on first load */
function ensureCustomLayer() {
  if (_threeLayer) return _threeLayer;
  const map = getMap();
  _threeLayer = {
    id: 'allspark-massing',
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      _camera   = new THREE.Camera();
      _scene    = new THREE.Scene();
      const light = new THREE.DirectionalLight(0xffffff, 0.9);
      light.position.set(0, -70, 100).normalize();
      _scene.add(light);
      const ambient = new THREE.AmbientLight(0xffffff, 0.35);
      _scene.add(ambient);

      _renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      _renderer.autoClear = false;
    },

    render(gl, matrix) {
      if (!_transform || !_model) return;
      const { anchor_lat, anchor_lon, rotation_deg, vertical_offset_m, uniform_scale } = _transform;

      const anchor = maplibregl.MercatorCoordinate.fromLngLat(
        [anchor_lon, anchor_lat],
        vertical_offset_m
      );
      const mercScale = anchor.meterInMercatorCoordinateUnits();

      // Build the model matrix
      const rotationX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1,0,0), Math.PI / 2);
      const rotationY = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0,1,0), rotation_deg * Math.PI / 180);
      const scale     = new THREE.Matrix4().makeScale(
        mercScale * uniform_scale,
        mercScale * uniform_scale,
        mercScale * uniform_scale
      );
      const translation = new THREE.Matrix4().makeTranslation(anchor.x, anchor.y, anchor.z);

      const m = new THREE.Matrix4()
        .multiplyMatrices(translation, scale)
        .multiply(rotationX)
        .multiply(rotationY);

      const mvp = new THREE.Matrix4().fromArray(matrix).multiply(m);
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
    const loader = new THREE.GLTFLoader();
    loader.load(url, (gltf) => {
      if (_model) _scene.remove(_model);
      _model = gltf.scene;

      // Apply a uniform material if desired (respect original otherwise)
      _model.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true; child.receiveShadow = true;
        }
      });

      // Center the model so its footprint origin lies at (0,0)
      _modelBBox = new THREE.Box3().setFromObject(_model);
      const center = new THREE.Vector3();
      _modelBBox.getCenter(center);
      _model.position.set(-center.x, -_modelBBox.min.y, -center.z);

      _scene.add(_model);
      getMap().triggerRepaint();

      const geometry = extractGeometry();
      resolve(geometry);
    }, undefined, reject);
  });
}

export function clearMassing() {
  if (_model && _scene) { _scene.remove(_model); _model = null; }
  _modelBBox = null;
  getMap()?.triggerRepaint();
}

export function updateMassingTransform(transform) {
  _transform = { ..._transform, ...transform };
  getMap()?.triggerRepaint();
}

/* Compute footprint_m2, height_m, volume_m3 from the loaded mesh */
export function extractGeometry() {
  if (!_model || !_modelBBox) return null;
  const size = new THREE.Vector3();
  _modelBBox.getSize(size);
  // Assume mesh units == meters.
  const width_m  = size.x;
  const depth_m  = size.z;
  const height_m = size.y;

  // Footprint: project all vertices to XZ plane, take convex hull area.
  // Uses a simple shoelace over a 2D convex hull of sampled vertices.
  const pts = [];
  _model.traverse(child => {
    if (child.isMesh && child.geometry) {
      const pos = child.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 2000)); // sample up to 2k verts
      for (let i = 0; i < pos.count; i += step) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        v.applyMatrix4(child.matrixWorld);
        pts.push([v.x, v.z]);
      }
    }
  });
  const hull = convexHull2D(pts);
  const footprint_m2 = polygonArea(hull);
  const volume_m3    = footprint_m2 * height_m;   // rough — acceptable for a massing
  const num_floors_est = Math.max(1, Math.round(height_m / 4.0));

  return { footprint_m2, height_m, volume_m3, num_floors_est, width_m, depth_m };
}

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
