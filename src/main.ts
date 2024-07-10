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

THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

// Rendering setup
const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

renderer.setPixelRatio(window.devicePixelRatio);
document.querySelector("section")?.appendChild(renderer.domElement);

const renderTarget = new THREE.WebGLRenderTarget();
const composer = new EffectComposer(renderer, renderTarget);

// Render targets for depth & normals
const depthRenderTarget = new THREE.WebGLRenderTarget();
const normalRenderTarget = new THREE.WebGLRenderTarget();
const normalMaterial = new THREE.MeshNormalMaterial();

// Setup camera on front wall, looking at the back wall
const camera = new THREE.OrthographicCamera();

camera.near = 0;
camera.far = Math.sqrt(3) * 300; // Formula for cube diagonal

camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 300;

camera.lookAt(300, 300, 0);

// Scene & objects
const scene = new THREE.Scene();

const material = new THREE.MeshBasicMaterial({});

const model = await myModel();
const geometry = mesh2geometry(model);

geometry.computeVertexNormals(); // Make sure the geometry has normals
const mesh = new THREE.Mesh(geometry, material);
mesh.position.x = 80;
mesh.position.y = 150;
mesh.position.z = 150;
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

// By default, EffectComposer has an implicit rendering pass at the end.
// However here we perform the OutputPass explicitly so that we can
// add an FXAA pass _after_.
const outputPass = new OutputPass();
composer.addPass(outputPass);

const fxaaPass = new ShaderPass(FXAAShader);
composer.addPass(fxaaPass);

function resizeCanvasToDisplaySize(force = false) {
  const container = window;

  // actual element aspect ratio
  const aspectRatio = container.innerWidth / container.innerHeight;
  // previously set HTML width= & height= attributes
  const aspectRatioOld = renderer.domElement.width / renderer.domElement.height;

  // if the aspect ratio matches, skip
  if (!force && Math.abs(aspectRatio - aspectRatioOld) < 0.01) {
    return;
  }

  // this sets width= and height= in HTML
  renderer.setSize(container.innerWidth, container.innerHeight, false);
  composer.setSize(container.innerWidth, container.innerHeight);
  depthRenderTarget.setSize(container.innerWidth, container.innerHeight);
  normalRenderTarget.setSize(container.innerWidth, container.innerHeight);
  const pixelRatio = renderer.getPixelRatio();
  fxaaPass.material.uniforms["resolution"].value.x =
    1 / (container.innerWidth * pixelRatio);
  fxaaPass.material.uniforms["resolution"].value.y =
    1 / (container.innerHeight * pixelRatio);

  // Texture used to carry depth data
  const texWidth = container.innerWidth * window.devicePixelRatio;
  const texHeight = container.innerHeight * window.devicePixelRatio;
  const depthTexture = new THREE.DepthTexture(texWidth, texHeight);
  depthRenderTarget.depthTexture = depthTexture;

  // View height & width, in world coordinates
  const viewHeight = 300;
  const viewWidth = aspectRatio * viewHeight;

  camera.right = viewWidth / 2;
  camera.left = viewWidth / -2;
  camera.top = viewHeight / 2;
  camera.bottom = viewHeight / -2;
  camera.updateProjectionMatrix();

  depthPass.uniforms.tNormal.value = normalRenderTarget.texture;
  depthPass.uniforms.tDepth.value = depthTexture;
  depthPass.uniforms.texelSize.value = new THREE.Vector2(
    1 / texWidth,
    1 / texHeight,
  );
}

resizeCanvasToDisplaySize(true);

function animate() {
  requestAnimationFrame(animate);

  // Resize if necessary
  resizeCanvasToDisplaySize();

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

animate();

// Download button

const stlBlob = exportManifold(model);
const stlUrl = URL.createObjectURL(stlBlob);

const link = document.createElement("a");
link.innerText = "Download";
link.href = stlUrl;
link.download = "skadis-box.3mf";

document.body.appendChild(link);
