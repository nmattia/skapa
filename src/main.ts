import "./style.css";

import * as THREE from "three";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { myModel } from "./model";
import { exportManifold, mesh2geometry } from "./3mfExport";

THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

const scene = new THREE.Scene();

scene.background = new THREE.Color(0xddbb96);

const camera = new THREE.OrthographicCamera(
  window.innerWidth / -20,
  window.innerWidth / 20,
  window.innerHeight / 20,
  window.innerHeight / -20,
  0.1,
  1000,
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(0.7 * window.innerWidth, 0.7 * window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

const model = await myModel();

const geometry = mesh2geometry(model);

geometry.computeVertexNormals();
var material = new THREE.MeshToonMaterial({
  color: 0xdd8888,
  polygonOffset: true,
  polygonOffsetFactor: 1, // positive value pushes polygon further away
  polygonOffsetUnits: 1,
});
var mesh = new THREE.Mesh(geometry, material);
const back = mesh.clone();

back.setRotationFromEuler(new THREE.Euler(0, 0, Math.PI / 2, "XYZ"));
back.position.x = -25;
back.position.y = 50;
scene.add(mesh);
scene.add(back);

// Add basic geometry outline
function addEdges(msh: THREE.Mesh) {
  const geo = new THREE.EdgesGeometry(msh.geometry, 25);
  const mat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 20 });
  msh.add(new THREE.LineSegments(geo, mat));
}

addEdges(mesh);
addEdges(back);

scene.add(new THREE.AmbientLight(0xffffff, 1));

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.target = mesh;
scene.add(directionalLight);

camera.position.x = 200;
camera.position.y = 200;
camera.position.z = 200;

camera.lookAt(100, 100, 0);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

const stlBlob = exportManifold(model);
const stlUrl = URL.createObjectURL(stlBlob);

const link = document.createElement("a");
link.innerText = "Download";
link.href = stlUrl;
link.download = "skadis-box.3mf";

document.body.appendChild(link);

const button = document.createElement("button");
button.innerText = "Reset";
button.addEventListener("click", () => {
  camera.position.x = 200;
  camera.position.y = 200;
  camera.position.z = 200;
});

document.body.appendChild(button);
