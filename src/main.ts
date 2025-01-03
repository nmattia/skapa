import "./style.css";

import * as THREE from "three";
import { Renderer } from "./rendering/renderer";

import { CLIP_HEIGHT, box } from "./model/manifold";
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

// constants, all in outer dimensions (when applicable)

// actual constants
const START_RADIUS = 6;
const START_WALL = 2;
const START_BOTTOM = 3;

const START_HEIGHT = 52;
const MIN_HEIGHT = CLIP_HEIGHT; // height of a set of clips

const START_WIDTH = 80;
const MIN_WIDTH = 10 + 2 * START_RADIUS;

const START_DEPTH = 60;
const MIN_DEPTH = 20;

/// STATE

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

const innerHeight = Dyn.sequence([
  modelDimensions.bottom,
  modelDimensions.height,
] as const).map(([bottom, height]) => height - bottom);

const innerWidth = Dyn.sequence([
  modelDimensions.wall,
  modelDimensions.width,
] as const).map(([wall, width]) => width - 2 * wall);

const innerDepth = Dyn.sequence([
  modelDimensions.wall,
  modelDimensions.depth,
] as const).map(([wall, depth]) => depth - 2 * wall);

// When true, the back of the object should be shown
const showBack = new Dyn(false);

/// MODEL

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
  modelDimensions.height,
  modelDimensions.width,
  modelDimensions.depth,
  modelDimensions.radius,
  modelDimensions.wall,
  modelDimensions.bottom,
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

DIMENSIONS.forEach((dim) =>
  modelDimensions[dim].addListener((val) => {
    animations[dim].startAnimationTo(val);
  }),
);

/// DOM

// Download button
const link = document.querySelector("a")!;
link.download = "skapa.3mf";

// The dimension inputs
const inputs = {
  height: document.querySelector("#height")! as HTMLInputElement,
  heightRange: document.querySelector("#height-range")! as HTMLInputElement,
  width: document.querySelector("#width")! as HTMLInputElement,
  widthRange: document.querySelector("#width-range")! as HTMLInputElement,
  depth: document.querySelector("#depth")! as HTMLInputElement,
  depthRange: document.querySelector("#depth-range")! as HTMLInputElement,
} as const;

// Add change events to all dimension inputs

// height
(
  [
    [inputs.height, "change"],
    [inputs.heightRange, "input"],
  ] as const
).forEach(([input, evnt]) => {
  innerHeight.addListener((height) => {
    input.value = `${height}`;
  });
  input.addEventListener(evnt, () => {
    const outer = parseInt(input.value) + modelDimensions.bottom.latest;
    if (!Number.isNaN(outer))
      modelDimensions.height.send(Math.max(outer, MIN_HEIGHT));
  });
});

// width
(
  [
    [inputs.width, "change"],
    [inputs.widthRange, "input"],
  ] as const
).forEach(([input, evnt]) => {
  innerWidth.addListener((width) => {
    input.value = `${width}`;
  });
  input.addEventListener(evnt, () => {
    const outer = parseInt(input.value) + 2 * modelDimensions.wall.latest;
    if (!Number.isNaN(outer))
      modelDimensions.width.send(Math.max(outer, MIN_WIDTH));
  });
});

// depth
(
  [
    [inputs.depth, "change"],
    [inputs.depthRange, "input"],
  ] as const
).forEach(([input, evnt]) => {
  innerDepth.addListener((depth) => {
    input.value = `${depth}`;
  });
  input.addEventListener(evnt, () => {
    const outer = parseInt(input.value) + 2 * modelDimensions.wall.latest;
    if (!Number.isNaN(outer))
      modelDimensions.depth.send(Math.max(outer, MIN_DEPTH));
  });
});

// Add select-all on input click
(["height", "width", "depth"] as const).forEach((dim) => {
  const input = inputs[dim];
  input.addEventListener("focus", () => {
    input.select();
  });
});

document.querySelector("#canvas-container")!.addEventListener("click", () => {
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
