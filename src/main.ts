import "./style.css";

import * as THREE from "three";
import { Renderer } from "./rendering/renderer";

import { box } from "./model/manifold";
import { mesh2geometry } from "./model/export";
import { TMFLoader } from "./model/load";
import { Animate } from "./animate";

import { Dyn } from "./twrl";

/// CONSTANTS

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
const START_WIDTH = 80;
const START_DEPTH = 33;
const START_RADIUS = 6;
const START_WALL = 2;
const START_BOTTOM = 3;

/// MODEL

// Dimensions of the model (outer, where applicable).
// There are the dimensions of the 3MF file, as well as
// the _target_ dimensions for the animations, though may
// be (ephemerally) different from the animation values.
const modelDimensions = {
  height: new Dyn(START_HEIGHT),
  width: new Dyn(START_WIDTH),
  depth: new Dyn(START_DEPTH),
  radius: new Dyn(START_RADIUS),
  wall: new Dyn(START_WALL),
  bottom: new Dyn(START_BOTTOM),
};

const tmfLoader = new TMFLoader();

// Reloads the model seen on page
async function reloadModel(
  height: number,
  width: number,
  depth: number,
  radius: number,
  wall: number,
  bottom: number,
) {
  const model = await box(height, width, depth, radius, wall, bottom);
  const geometry = mesh2geometry(model);
  geometry.computeVertexNormals(); // Make sure the geometry has normals
  mesh.geometry = geometry;
  mesh.clear(); // Remove all children
}

// when target dimensions are changed, update the model to download
Dyn.sequence([
  modelDimensions["height"],
  modelDimensions["width"],
  modelDimensions["depth"],
  modelDimensions["radius"],
  modelDimensions["wall"],
  modelDimensions["bottom"],
] as const).addListener(([h, w, d, r, wa, bo]) => {
  tmfLoader.load(box(h, w, d, r, wa, bo));
});

/// RENDER

// Set to 'true' whenever the camera needs to be centered again
let centerCameraNeeded = true;

// The mesh, updated in place when the geometry needs to change
const mesh: THREE.Mesh = new THREE.Mesh(
  new THREE.BoxGeometry(START_WIDTH, START_HEIGHT, START_DEPTH),
  new THREE.Material(),
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

/// ANIMATIONS

// The animated dimensions
const animations = {
  height: new Animate(START_HEIGHT),
  width: new Animate(START_WIDTH),
  depth: new Animate(START_DEPTH),
  radius: new Animate(START_RADIUS),
  wall: new Animate(START_WALL),
  bottom: new Animate(START_BOTTOM),
};

/// DOM

// Download button
const link = document.querySelector("a")!;
link.innerText = "Download";
link.download = "skadis-box.3mf";

// The dimension inputs
const inputs = {
  height: document.querySelector("#height")! as HTMLInputElement,
  width: document.querySelector("#width")! as HTMLInputElement,
  depth: document.querySelector("#depth")! as HTMLInputElement,
  radius: document.querySelector("#radius")! as HTMLInputElement,
  wall: document.querySelector("#wall")! as HTMLInputElement,
  bottom: document.querySelector("#bottom")! as HTMLInputElement,
} as const;

// Add change events to all dimension inputs
inputs.height.addEventListener("change", () => {
  const delta = -1 * modelDimensions.bottom.latest;
  const value = parseInt(inputs.height.value);
  if (!Number.isNaN(value)) modelDimensions.height.send(value - delta);
});

(["width", "depth", "radius"] as const).forEach((dim) => {
  inputs[dim].addEventListener("change", () => {
    const delta = -1 * modelDimensions.wall.latest;
    const value = parseInt(inputs[dim].value);
    if (!Number.isNaN(value)) modelDimensions[dim].send(value - delta);
  });
});
(["wall", "bottom"] as const).forEach((dim) => {
  inputs[dim].addEventListener("change", () => {
    const value = parseInt(inputs[dim].value);
    if (!Number.isNaN(value)) modelDimensions[dim].send(value);
  });
});

// Bind range (should be previous sibling) to this input element
// and return the range.
// By "bind" we mean that the slider sets the value of the specified
// element and sends a "change" even.
const bindRange = (e: HTMLInputElement): HTMLInputElement => {
  const range = e.previousElementSibling;

  if (!(range instanceof HTMLInputElement)) {
    console.error("Could not bind range", range, e);
    throw new Error("Could not bind range");
  }
  range.min = e.min;
  range.max = range.getAttribute("max") ?? "";
  range.value = e.value;
  range.addEventListener("input", () => {
    e.value = range.value;
    e.dispatchEvent(new Event("change"));
  });

  return range;
};

// Set initial values for each input and bind ranges
(["height"] as const).forEach((dim) => {
  const delta = -1 * modelDimensions.bottom.latest;
  inputs[dim].value = modelDimensions[dim].latest + delta + "";

  const range = bindRange(inputs[dim]);
  modelDimensions[dim].addListener((v) => {
    range.value = v + delta + "";
  });
});

(["width", "depth", "radius"] as const).forEach((dim) => {
  const delta = -1 * 2 * modelDimensions.wall.latest;
  inputs[dim].value = modelDimensions[dim].latest + delta + "";

  const range = bindRange(inputs[dim]);
  modelDimensions[dim].addListener((v) => {
    range.value = v + delta + "";
  });
});

(["wall", "bottom"] as const).forEach((dim) => {
  inputs[dim].value = modelDimensions[dim].latest + "";
});

DIMENSIONS.forEach((dim) =>
  modelDimensions[dim].addListener((val) => {
    animations[dim].startAnimationTo(val);
  }),
);

document.querySelector("#flip")!.addEventListener("click", () => {
  showBack.send(!showBack.latest);
});

/// LOOP

// Set to current frame's timestamp when a model starts loading, and set
// to undefined when the model has finished loading
let modelLoadStarted: undefined | DOMHighResTimeStamp;

function loop(nowMillis: DOMHighResTimeStamp) {
  requestAnimationFrame(loop);

  // Reload 3mf if necessary
  const newTmf = tmfLoader.take();
  if (newTmf !== undefined) {
    // Update the download link
    link.href = URL.createObjectURL(newTmf);
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

// performance.now() is equivalent to the timestamp supplied by
// requestAnimationFrame
//
// https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
loop(performance.now());
