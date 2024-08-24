import "./style.css";

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { Manifold } from "manifold-3d";

import vertexShader from "./vert.glsl?raw";
import fragmentShader from "./frag.glsl?raw";

import { box, base, clips } from "./model";
import { exportManifold, mesh2geometry } from "./3mfExport";
import { Animate } from "./animate";

import { Dyn } from "./twrl";

// Download button
const link = document.querySelector("a")!;
link.innerText = "Download";
link.download = "skadis-box.3mf";

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

const canvas = document.querySelector("canvas")!;

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

// Overflow value (canvas overflowing outside of container)
// that seems to accomodate part overflow for most dimensions
const canvasOverflowPercent = 0.15;
canvas.style.setProperty("--overflow", canvasOverflowPercent * 100 + "%");

// Rendering setup
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas,
});

const renderTarget = new THREE.WebGLRenderTarget();
const composer = new EffectComposer(renderer, renderTarget);

// Render targets for depth & normals
const depthRenderTarget = new THREE.WebGLRenderTarget();
const normalRenderTarget = new THREE.WebGLRenderTarget();
const normalMaterial = new THREE.MeshNormalMaterial();

// Setup camera on front wall, looking at the back wall
const camera = new THREE.OrthographicCamera();

camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 300;

camera.lookAt(300, 300, 0);

// Scene & objects
const scene = new THREE.Scene();

const material = new THREE.MeshBasicMaterial({});

// The animated rotation
const rotation = new Animate(0);

let reloadModelNeeded = true;
const mesh: THREE.Mesh = new THREE.Mesh(
  new THREE.BoxGeometry(START_WIDTH, START_HEIGHT, START_DEPTH),
  material,
);

const MESH_ROTATION_DELTA = 0.15;
mesh.rotation.z = MESH_ROTATION_DELTA;

// When true, the back of the object should be shown
const showBack = new Dyn(false);
showBack.addListener((val) => rotation.startAnimationTo(val ? 1 : 0));

document.querySelector("#flip")!.addEventListener("click", () => {
  showBack.send(!showBack.latest);
});

scene.add(mesh);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const depthShader = {
  uniforms: {
    tDepth: { value: null },
    tNormal: { value: null },
    texelSize: { value: null },
  },
  vertexShader,
  fragmentShader,
};

const depthPass = new ShaderPass(depthShader);
composer.addPass(depthPass);

const container = document.querySelector("#canvas-container")!;

// The container width & height used in computations last time we resized
let lastContainerWidth = container.clientWidth;
let lastContainerHeight = container.clientHeight;

// By default, EffectComposer has an implicit rendering pass at the end.
// However here we perform the OutputPass explicitly so that we can
// add an FXAA pass _after_.
const outputPass = new OutputPass();
composer.addPass(outputPass);

const fxaaPass = new ShaderPass(FXAAShader);
composer.addPass(fxaaPass);

function resizeCanvas() {
  lastContainerWidth = container.clientWidth;
  lastContainerHeight = container.clientHeight;

  const containerWidth = lastContainerWidth;
  const containerHeight = lastContainerHeight;

  // Update global aspect ratio
  aspectRatio = containerWidth / containerHeight;

  renderer.setPixelRatio(window.devicePixelRatio);

  // this sets width= and height= in HTML
  renderer.setSize(containerWidth, containerHeight, false);

  // Set the sizes of the various render targets (taking pixel ratio into account)
  // (multiplying every by 2 to get better resolution and precision at the cost
  // of more work)
  composer.setSize(
    containerWidth * window.devicePixelRatio * 2,
    containerHeight * window.devicePixelRatio * 2,
  );
  depthRenderTarget.setSize(
    containerWidth * window.devicePixelRatio * 2,
    containerHeight * window.devicePixelRatio * 2,
  );
  normalRenderTarget.setSize(
    containerWidth * window.devicePixelRatio * 2,
    containerHeight * window.devicePixelRatio * 2,
  );
  fxaaPass.material.uniforms["resolution"].value.x =
    1 / (containerWidth * window.devicePixelRatio * 2);
  fxaaPass.material.uniforms["resolution"].value.y =
    1 / (containerHeight * window.devicePixelRatio * 2);

  // Texture used to carry depth data
  const texWidth = containerWidth * window.devicePixelRatio * 2;
  const texHeight = containerHeight * window.devicePixelRatio * 2;
  const depthTexture = new THREE.DepthTexture(texWidth, texHeight);
  depthRenderTarget.depthTexture = depthTexture;

  depthPass.uniforms.tNormal.value = normalRenderTarget.texture;
  depthPass.uniforms.tDepth.value = depthTexture;
  depthPass.uniforms.texelSize.value = new THREE.Vector2(
    1 / texWidth,
    1 / texHeight,
  );
}

let resizeCanvasNeeded = true;

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
    reloadModelNeeded = false;
  }

  // Sanity check
  if (container.firstElementChild !== renderer.domElement) {
    console.error("Container does not contain renderer element");
  }

  // If the DOM container was resized, recompute
  if (
    container.clientWidth !== lastContainerWidth ||
    container.clientHeight !== lastContainerHeight
  ) {
    resizeCanvasNeeded = true;
  }

  // Resize if necessary
  if (resizeCanvasNeeded) {
    resizeCanvas();
    resizeCanvasNeeded = false;
    centerCameraNeeded = true; // aspect ratio might have been updated
  }

  if (centerCameraNeeded) {
    centerCamera();
    centerCameraNeeded = false;
  }

  // Render once for depth
  renderer.setRenderTarget(depthRenderTarget);
  renderer.render(scene, camera);

  // Render once for normals

  // Temporarily swap all materials for the normal material
  const oldMat = scene.overrideMaterial;
  scene.overrideMaterial = normalMaterial;

  renderer.setRenderTarget(normalRenderTarget);
  renderer.render(scene, camera);

  // Revert override
  scene.overrideMaterial = oldMat;

  // Render to screen
  composer.render();
}

// Initialize state
const dimensionType = new Dyn<"inner" | "outer">("inner");

// OUTER dimensions
const dimensions = {
  height: new Dyn(START_HEIGHT),
  width: new Dyn(START_WIDTH),
  depth: new Dyn(START_DEPTH),
  radius: new Dyn(START_RADIUS),
  wall: new Dyn(START_WALL),
  bottom: new Dyn(START_BOTTOM),
};

// Initialize inputs
(["inner", "outer"] as const).forEach((dity) => {
  const selectors = { inner: "#inner", outer: "#outer" } as const;
  const radio: HTMLInputElement = document.querySelector(selectors[dity])!;

  // NOTE: on radio elements, 'change' triggers only when element is checked which explains
  // why we don't have to read '.checked'
  radio.addEventListener("change", () => {
    dimensionType.send(dity);
  });

  // initial checked value
  const checked = ({ inner: true, outer: false } as const)[dity];
  radio.checked = checked;
});

// The dimension inputs
const inputs = {
  height: document.querySelector("#height")! as HTMLInputElement,
  width: document.querySelector("#width")! as HTMLInputElement,
  depth: document.querySelector("#depth")! as HTMLInputElement,
  radius: document.querySelector("#radius")! as HTMLInputElement,
  wall: document.querySelector("#wall")! as HTMLInputElement,
  bottom: document.querySelector("#bottom")! as HTMLInputElement,
} as const;

// When dimensions type is updated, update the inputs that depend on the dim type
dimensionType.addListener((dity) => {
  (["height"] as const).forEach((dim) => {
    const delta = ({ inner: -1 * dimensions.bottom.latest, outer: 0 } as const)[
      dity
    ];
    inputs[dim].value = dimensions[dim].latest + delta + "";
  });

  (["width", "depth", "radius"] as const).forEach((dim) => {
    const delta = ({ inner: -1 * dimensions.wall.latest, outer: 0 } as const)[
      dity
    ];
    inputs[dim].value = dimensions[dim].latest + delta + "";
  });

  (["wall", "bottom"] as const).forEach((dim) => {
    inputs[dim].value = dimensions[dim].latest + "";
  });
});

DIMENSIONS.forEach((dim) =>
  dimensions[dim].addListener((val) => animations[dim].startAnimationTo(val)),
);

Dyn.sequence([
  dimensions["height"],
  dimensions["width"],
  dimensions["depth"],
  dimensions["radius"],
  dimensions["wall"],
  dimensions["bottom"],
] as const).addListener(([h, w, d, r, wa, bo]) => {
  tmfLoader = new TMFLoader(box(h, w, d, r, wa, bo, CLIPS_POSITIONS));
});

// Add change events to all dimension inputs
inputs.height.addEventListener("change", () => {
  const dity = dimensionType.latest;
  const inner = -1 * dimensions.bottom.latest;
  const delta = ({ inner, outer: 0 } as const)[dity];
  const value = parseInt(inputs.height.value);
  if (!Number.isNaN(value)) dimensions.height.send(value - delta);
});
(["width", "depth", "radius"] as const).forEach((dim) => {
  inputs[dim].addEventListener("change", () => {
    const dity = dimensionType.latest;
    const inner = -1 * dimensions.wall.latest;
    const delta = ({ inner, outer: 0 } as const)[dity];
    const value = parseInt(inputs[dim].value);
    if (!Number.isNaN(value)) dimensions[dim].send(value - delta);
  });
});
(["wall", "bottom"] as const).forEach((dim) => {
  inputs[dim].addEventListener("change", () => {
    const value = parseInt(inputs[dim].value);
    if (!Number.isNaN(value)) dimensions[dim].send(value);
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

// Compute min & max of the verticies' projection onto the camera plane (coordinates in the
// camera's coordinates)
const computeProjectedBounds = (
  verticies: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  matrixWorld: THREE.Matrix4 /* the world matrix */,
): {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
} => {
  const vertex = new THREE.Vector3();

  // NOTE: the camera has X to the right, Y to the top, meaning NEGATIVE Z
  // to the far. For that reason some calculations for far & near are flipped.
  let [left, right] = [Infinity, -Infinity];
  let [top, bottom] = [-Infinity, Infinity];
  let [near, far] = [Infinity, -Infinity];

  // Iterate over all verticies in the model, keeping track of the min/max values of
  // projection (onto camera plane)
  for (let i = 0; i < verticies.count; i++) {
    // Load vertex & move to world coordinates (position & rotation)
    vertex.fromArray(verticies.array, i * verticies.itemSize);
    vertex.applyMatrix4(matrixWorld);

    // Look at the vertex from the camera's perspective
    const v = camera.worldToLocal(vertex);

    // Update mins & maxs
    left = Math.min(left, v.x);
    right = Math.max(right, v.x);
    top = Math.max(top, v.y);
    bottom = Math.min(bottom, v.y);
    near = Math.min(near, -v.z);
    far = Math.max(far, -v.z);
  }

  return { left, right, top, bottom, near, far };
};

let aspectRatio = 1;
let centerCameraNeeded = true;

const centerCamera = () => {
  const geometry = mesh.geometry;
  const geometryVerticies = geometry.getAttribute("position");

  const { left, top, bottom, far, near } = computeProjectedBounds(
    geometryVerticies,
    mesh.matrixWorld,
  );

  // Calculate a new viewHeight so that the part fits vertically (plus overflow)
  // View height/width in camera coordinates, exluding overflow
  const viewHeight = top - bottom;
  const viewWidth = aspectRatio * viewHeight;

  // Adjust camera to view height & width, plus some overflow
  camera.left = left - canvasOverflowPercent * viewWidth;
  camera.right = left + (1 + canvasOverflowPercent) * viewWidth;
  camera.top = bottom + (1 + canvasOverflowPercent) * viewHeight;
  camera.bottom = bottom - canvasOverflowPercent * viewHeight;
  camera.far = far + 1;
  camera.near = near - 1;

  camera.updateProjectionMatrix();
};

// performance.now() is equivalent to the timestamp supplied by
// requestAnimationFrame
//
// https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
animate(performance.now());
