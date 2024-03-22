import "./style.css";

import * as THREE from "three";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { myModel } from "./model";
import { exportManifold, mesh2geometry } from "./3mfExport";

THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

const scene = new THREE.Scene();

scene.background = new THREE.Color(0xddbb96);

const camera = new THREE.OrthographicCamera(
  window.innerWidth / -30,
  window.innerWidth / 30,
  window.innerHeight / 30,
  window.innerHeight / -30,
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

const material = new THREE.MeshPhongMaterial({
  color: 0xc54e89,
});

const geom1 = mesh2geometry(await myModel());
geom1.computeVertexNormals();
const mesh1 = new THREE.Mesh(geom1, material);
scene.add(mesh1);

scene.add(new THREE.AmbientLight(0x404040, 1));

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.target = mesh1;
scene.add(directionalLight);

camera.position.x = 200;
camera.position.y = 200;
camera.position.z = 200;

camera.lookAt(0, 0, 0);

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
