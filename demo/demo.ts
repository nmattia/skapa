/* Renders a box 300 x 300 x 300 (assumed mm)
 * Camera in the middle of the front wall and looking at the middle of the back wall
 * Origin is at the bottom left of the front wall
 * Right: X
 * Back: Y
 * Up: Z
 * */

import * as THREE from "three";

document.body.style.margin = "0";

THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

const scene = new THREE.Scene();

scene.background = new THREE.Color(0xddbb96);

const camera = new THREE.OrthographicCamera();

camera.near = 0;
camera.far = 300;

camera.position.x = 150;
camera.position.y = 0;
camera.position.z = 150;

camera.lookAt(150, 300, 150);

const geometry = new THREE.SphereGeometry(100, 64, 32);
const material = new THREE.MeshBasicMaterial({ color: 0xdddddd });
const sphere = new THREE.Mesh(geometry, material);
sphere.position.x = 150;
sphere.position.y = 150;
sphere.position.z = 150;
scene.add(sphere);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

function resizeCanvasToDisplaySize(always = false) {
  const container = window;

  // aspect ratio as per HTML (i.e. HTML width= & height= attributes)
  const aspectRatio = container.innerWidth / container.innerHeight;
  const aspectRatioOld = renderer.domElement.width / renderer.domElement.height;

  if (!always && Math.abs(aspectRatio - aspectRatioOld) < 0.01) {
    return;
  }

  // this sets width= and height= in HTML and then updates the style
  // to account for pixel ratio (updateStyle = true by default)
  renderer.setSize(container.innerWidth, container.innerHeight);

  // View height & width, in world coordinates
  const viewHeight = 300;
  const viewWidth = aspectRatio * viewHeight;

  camera.right = viewWidth / 2;
  camera.left = viewWidth / -2;
  camera.top = viewHeight / 2;
  camera.bottom = viewHeight / -2;
  camera.updateProjectionMatrix();
}

resizeCanvasToDisplaySize(true);

function animate() {
  requestAnimationFrame(animate);
  resizeCanvasToDisplaySize();

  renderer.render(scene, camera);
}

animate();
