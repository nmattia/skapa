import "./style.css";

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import vertexShader from "./vert.glsl?raw";
import fragmentShader from "./frag.glsl?raw";

import { myModel } from "./model";
import { exportManifold, mesh2geometry } from "./3mfExport";
import { Animate } from "./animate";

import { Dyn } from "./twrl";

// Download button
const link = document.querySelector("a")!;
link.innerText = "Download";
link.download = "skadis-box.3mf";

THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

const DIMENSIONS = ["height", "width", "depth"] as const;

const START_HEIGHT = 20;
const START_WIDTH = 40;
const START_DEPTH = 30;

// Rendering setup
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas: document.querySelector("canvas")!,
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

// The animated rotation
const rotation = new Animate(0);

// The animated dimensions
const animations = {
  height: new Animate(START_HEIGHT),
  width: new Animate(START_WIDTH),
  depth: new Animate(START_DEPTH),
};

function animate(nowMillis: DOMHighResTimeStamp) {
  requestAnimationFrame(animate);

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

const dimensionsInner = {
  height: new Dyn(START_HEIGHT),
  width: new Dyn(START_WIDTH),
  depth: new Dyn(START_DEPTH),
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
} as const;

dimensionType.addListener((dity) => {
  const delta = ({ inner: 0, outer: 3 } as const)[dity];

  DIMENSIONS.forEach((dim) => {
    inputs[dim].value = dimensionsInner[dim].latest + delta + "";
  });
});
dimensionType.send(dimensionType.latest); // Need to trigger the initial value

DIMENSIONS.forEach((dim) =>
  dimensionsInner[dim].addListener((val) =>
    animations[dim].startAnimationTo(val),
  ),
);

// Add change events to all dimension inputs
DIMENSIONS.forEach((dim) => {
  inputs[dim].addEventListener("change", () => {
    const dity = dimensionType.latest;
    const delta = ({ inner: 0, outer: 3 } as const)[dity];
    const value = parseInt(inputs[dim].value);
    if (!Number.isNaN(value)) dimensionsInner[dim].send(value - delta);
  });
});

// Set to current frame's timestamp when a model starts loading, and set
// to undefined when the model has finished loading
let modelLoadStarted: undefined | DOMHighResTimeStamp;

async function reloadModel(height: number, width: number, depth: number) {
  const model = await myModel(height, width, depth);
  const geometry = mesh2geometry(model);
  geometry.computeVertexNormals(); // Make sure the geometry has normals
  mesh.geometry = geometry;
  const stlBlob = exportManifold(model);
  const stlUrl = URL.createObjectURL(stlBlob);
  link.href = stlUrl;
}

let aspectRatio = 1;
let centerCameraNeeded = true;

const centerCamera = () => {
  const geometryVerticies = mesh.geometry.getAttribute("position");
  const vertex = new THREE.Vector3();

  // NOTE: the camera has X to the right, Y to the top, meaning NEGATIVE Z
  // to the far. For that reason some calculations for far & near are flipped.
  let left = Infinity;
  let right = -Infinity;
  let top = -Infinity;
  let bottom = Infinity;
  let far = -Infinity;
  let near = Infinity;

  // Iterate over all verticies in the model, keeping track of the min/max values of
  // projection (onto camera plane)
  for (
    let i = 0;
    i < geometryVerticies.count / geometryVerticies.itemSize;
    i++
  ) {
    // Load vertex & move to world coordinates
    vertex.fromArray(geometryVerticies.array, i * geometryVerticies.itemSize);
    vertex.add(mesh.position);

    // Look at the vertex from the camera's perspective
    const v = camera.worldToLocal(vertex);

    // Update mins & maxs
    left = Math.min(left, v.x);
    right = Math.max(right, v.x);
    top = Math.max(top, v.y);
    bottom = Math.min(bottom, v.y);
    far = Math.max(far, -v.z);
    near = Math.min(near, -v.z);
  }

  // Calculate a new viewHeight so that the part fits vertically (plus padding)
  const paddingV = 5;
  const viewHeight = top - bottom + 2 * paddingV;
  const viewWidth = aspectRatio * viewHeight;
  const paddingH = paddingV * aspectRatio;

  camera.left = left - paddingH;
  camera.right = left + viewWidth + paddingH;
  camera.top = bottom + viewHeight + paddingV;
  camera.bottom = bottom - paddingV;
  camera.far = far + 1;
  camera.near = near - 1;

  camera.updateProjectionMatrix();
};

// performance.now() is equivalent to the timestamp supplied by
// requestAnimationFrame
//
// https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
animate(performance.now());
