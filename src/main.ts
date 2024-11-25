import "./style.css";

import * as THREE from "three";
import { Renderer } from "./rendering/renderer";
import type { Manifold } from "manifold-3d";

import { box, base, clips } from "./model";
import { exportManifold, mesh2geometry } from "./3mfExport";
import { Animate } from "./animate";

import { Dyn } from "./twrl";

// Download button
const link = document.querySelector("a")!;
link.innerText = "Download";
link.download = "skadis-box.3mf";

// Align axes with 3D printer
THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

const DIMENSIONS = [
  "height",
  "width",
  "depth",
  "radius",
  "wall",
  "bottom",
] as const;

const START_HEIGHT = 23;
const START_WIDTH = 43;
const START_DEPTH = 33;
const START_RADIUS = 6;
const START_WALL = 2;
const START_BOTTOM = 3;

// The positions of the clips, as X/Y on the side of the box
const CLIPS_POSITIONS: Array<[number, number]> = [[0, 0]];

// A 3MF loader, that loads the Manifold and makes it available as a 3MF Blob when ready
class TMFLoader {
  // The exported manifold, when reading
  private tmf: undefined | Blob;

  constructor(manifold: Promise<Manifold>) {
    manifold.then((manifold) => {
      this.tmf = exportManifold(manifold);
    });
  }

  get(): undefined | Blob {
    return this.tmf;
  }
}

let tmfLoader: undefined | TMFLoader;

// We don't actually use the material but three needs it
const material = new THREE.Material();
const mesh: THREE.Mesh = new THREE.Mesh(
  new THREE.BoxGeometry(START_WIDTH, START_HEIGHT, START_DEPTH),
  material,
);

const MESH_ROTATION_DELTA = 0.15;
mesh.rotation.z = MESH_ROTATION_DELTA;

const renderer = new Renderer(document.querySelector("canvas")!, mesh);

let reloadModelNeeded = true;

// The animated rotation
const rotation = new Animate(0);

// When true, the back of the object should be shown
const showBack = new Dyn(false);
showBack.addListener((val) => rotation.startAnimationTo(val ? 1 : 0));

document.querySelector("#flip")!.addEventListener("click", () => {
  showBack.send(!showBack.latest);
});

// The animated dimensions
const animations = {
  height: new Animate(START_HEIGHT),
  width: new Animate(START_WIDTH),
  depth: new Animate(START_DEPTH),
  radius: new Animate(START_RADIUS),
  wall: new Animate(START_WALL),
  bottom: new Animate(START_BOTTOM),
};

function animate(nowMillis: DOMHighResTimeStamp) {
  requestAnimationFrame(animate);

  // Reload 3mf if necessary
  if (tmfLoader !== undefined) {
    const newTmf = tmfLoader.get();
    if (newTmf !== undefined) {
      // Ensure we load the object only once
      tmfLoader = undefined;

      // Update the download link
      link.href = URL.createObjectURL(newTmf);
    }
  }

  // Handle rotation animation
  const rotationUpdated = rotation.update();
  if (rotationUpdated) {
    mesh.rotation.z = rotation.current * Math.PI + MESH_ROTATION_DELTA;
  }

  // Handle dimensions animation
  const dimensionsUpdated = DIMENSIONS.reduce(
    (acc, dim) => animations[dim].update() || acc,
    false,
  );

  if (dimensionsUpdated) {
    reloadModelNeeded = true;
  }

  // Whether we should start loading a new model on this frame
  // True if (1) model needs reloading and (2) no model is currently loading (or
  // if loading seems stuck)
  const reloadModelNow =
    reloadModelNeeded &&
    (modelLoadStarted === undefined || nowMillis - modelLoadStarted > 100);

  if (reloadModelNow) {
    modelLoadStarted = nowMillis;
    reloadModelNeeded = false;
    reloadModel(
      animations["height"].current,
      animations["width"].current,
      animations["depth"].current,
      animations["radius"].current,
      animations["wall"].current,
      animations["bottom"].current,
    ).then(() => {
      modelLoadStarted = undefined;
      centerCameraNeeded = true;
    });
  }

  const canvasResized = renderer.resizeCanvas();

  if (canvasResized) {
    centerCameraNeeded = true;
  }

  if (centerCameraNeeded) {
    renderer.centerCamera();
    centerCameraNeeded = false;
  }

  renderer.render();
}

// Initialize state

// OUTER dimensions (target)
const targetDimensions = {
  height: new Dyn(START_HEIGHT),
  width: new Dyn(START_WIDTH),
  depth: new Dyn(START_DEPTH),
  radius: new Dyn(START_RADIUS),
  wall: new Dyn(START_WALL),
  bottom: new Dyn(START_BOTTOM),
};

// The dimension inputs
const inputs = {
  height: document.querySelector("#height")! as HTMLInputElement,
  width: document.querySelector("#width")! as HTMLInputElement,
  depth: document.querySelector("#depth")! as HTMLInputElement,
  radius: document.querySelector("#radius")! as HTMLInputElement,
  wall: document.querySelector("#wall")! as HTMLInputElement,
  bottom: document.querySelector("#bottom")! as HTMLInputElement,
} as const;

// Set initial values for each input
(["height"] as const).forEach((dim) => {
  const delta = -1 * targetDimensions.bottom.latest;
  inputs[dim].value = targetDimensions[dim].latest + delta + "";
});

(["width", "depth", "radius"] as const).forEach((dim) => {
  const delta = -1 * targetDimensions.wall.latest;
  inputs[dim].value = targetDimensions[dim].latest + delta + "";
});

(["wall", "bottom"] as const).forEach((dim) => {
  inputs[dim].value = targetDimensions[dim].latest + "";
});

DIMENSIONS.forEach((dim) =>
  targetDimensions[dim].addListener((val) => {
    animations[dim].startAnimationTo(val);
  }),
);

// when target dimensions are changed, update the model to download
Dyn.sequence([
  targetDimensions["height"],
  targetDimensions["width"],
  targetDimensions["depth"],
  targetDimensions["radius"],
  targetDimensions["wall"],
  targetDimensions["bottom"],
] as const).addListener(([h, w, d, r, wa, bo]) => {
  tmfLoader = new TMFLoader(box(h, w, d, r, wa, bo, CLIPS_POSITIONS));
});

// Add change events to all dimension inputs
inputs.height.addEventListener("change", () => {
  const delta = -1 * targetDimensions.bottom.latest;
  const value = parseInt(inputs.height.value);
  if (!Number.isNaN(value)) targetDimensions.height.send(value - delta);
});

(["width", "depth", "radius"] as const).forEach((dim) => {
  inputs[dim].addEventListener("change", () => {
    const delta = -1 * targetDimensions.wall.latest;
    const value = parseInt(inputs[dim].value);
    if (!Number.isNaN(value)) targetDimensions[dim].send(value - delta);
  });
});
(["wall", "bottom"] as const).forEach((dim) => {
  inputs[dim].addEventListener("change", () => {
    const value = parseInt(inputs[dim].value);
    if (!Number.isNaN(value)) targetDimensions[dim].send(value);
  });
});

// Set to current frame's timestamp when a model starts loading, and set
// to undefined when the model has finished loading
let modelLoadStarted: undefined | DOMHighResTimeStamp;

// Reloads the model seen on page
async function reloadModel(
  height: number,
  width: number,
  depth: number,
  radius: number,
  wall: number,
  bottom: number,
) {
  const model = await base(height, width, depth, radius, wall, bottom);
  const geometry = mesh2geometry(model);
  geometry.computeVertexNormals(); // Make sure the geometry has normals
  mesh.geometry = geometry;
  mesh.clear(); // Remove all children

  // Add the 2 clips (left & right)
  const lr = await clips();
  for (const clip of lr) {
    const g = mesh2geometry(clip);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.position.y = -depth / 2;
    mesh.add(m);
  }
}

let centerCameraNeeded = true;

// performance.now() is equivalent to the timestamp supplied by
// requestAnimationFrame
//
// https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
animate(performance.now());
