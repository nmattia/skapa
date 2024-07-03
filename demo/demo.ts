/* Renders a box 300 x 300 x 300 (assumed mm)
 * Camera in the middle of the front wall and looking at the middle of the back wall
 * Origin is at the bottom left of the front wall
 * Right: X
 * Back: Y
 * Up: Z
 * */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

import vertexShader from "./vert.glsl?raw";
import fragmentShader from "./frag.glsl?raw";

document.body.style.margin = "0";

THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

// Rendering setup
const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const depthRenderTarget = new THREE.WebGLRenderTarget();
const composer = new EffectComposer(renderer, depthRenderTarget);

// Render target for normals
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
scene.background = new THREE.Color(0xddbb96);

const material = new THREE.MeshBasicMaterial({ color: 0xdddddd });

const sphereGeo = new THREE.SphereGeometry(40, 12, 8);
const sphere = new THREE.Mesh(sphereGeo, material);
sphere.position.x = 80;
sphere.position.y = 150;
sphere.position.z = 150;
scene.add(sphere);

const torusGeo = new THREE.TorusGeometry(30, 10, 16, 100);
const torus = new THREE.Mesh(torusGeo, material);
torus.position.x = 200;
torus.position.y = 60;
torus.position.z = 150;
scene.add(torus);

const cubeGeo = new THREE.BoxGeometry(40, 64, 32);
const cube = new THREE.Mesh(cubeGeo, material);
cube.position.x = 200;
cube.position.y = 150;
cube.position.z = 180;
scene.add(cube);

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

  // this sets width= and height= in HTML and then updates the style
  // to account for pixel ratio (updateStyle = true by default)
  renderer.setSize(container.innerWidth, container.innerHeight);
  composer.setSize(container.innerWidth, container.innerHeight);
  depthRenderTarget.setSize(container.innerWidth, container.innerHeight);
  normalRenderTarget.setSize(container.innerWidth, container.innerHeight);

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
  resizeCanvasToDisplaySize();
  cube.rotation.z += 0.01;
  sphere.rotation.z += 0.01;
  torus.rotation.y += 0.01;

  const oldMat = scene.overrideMaterial;
  scene.overrideMaterial = normalMaterial;

  renderer.setRenderTarget(normalRenderTarget);
  renderer.render(scene, camera);

  scene.overrideMaterial = oldMat;

  composer.render();
}

animate();
