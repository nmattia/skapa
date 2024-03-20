import "./style.css";

import * as THREE from "three";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { myModel } from "./model";
import { exportManifold, mesh2geometry } from "./3mfExport";

THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

const scene = new THREE.Scene();

scene.background = new THREE.Color(0xddbb96);

const camera = new THREE.OrthographicCamera(
  window.innerWidth / -10,
  window.innerWidth / 10,
  window.innerHeight / 10,
  window.innerHeight / -10,
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

const material = new THREE.MeshToonMaterial({
  color: 0xc54e89,
});

const geom1 = mesh2geometry(await myModel());
geom1.computeVertexNormals();
const mesh1 = new THREE.Mesh(geom1, material);
mesh1.position.x = -20;
scene.add(mesh1);

const geom2 = new THREE.BoxGeometry(20, 20, 20);
const mesh2 = new THREE.Mesh(geom2, material);
mesh2.position.x = 20;
mesh2.position.y = 10;
mesh2.position.z = 10;
scene.add(mesh2);

const light = new THREE.AmbientLight(0x404040); // soft white light
scene.add(light);

const light2 = new THREE.DirectionalLight(0xffffff, 3);
light2.position.set(0, 0, 200).normalize();
scene.add(light2);

const light3 = new THREE.DirectionalLight(0xdddddd, 0.7);
light3.position.set(0, 0, -600).normalize();
scene.add(light3);

const light4 = new THREE.DirectionalLight(0xdddddd, 0.4);
light4.position.set(0, 100, 0).normalize();
scene.add(light4);

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
