import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";

import { RenderOutlinePass } from "./effects/outline";
import { ThickenPass } from "./effects/thicken";
import { FXAAPass } from "./effects/antialiasing";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export class Renderer {
  public camera: THREE.OrthographicCamera;
  public mesh: THREE.Mesh;
  public canvas: HTMLCanvasElement;
  public scene: THREE.Scene = new THREE.Scene();

  public renderer: THREE.WebGLRenderer;
  public composer: EffectComposer;

  // The canvas width & height used in computations last time we resized
  public canvasWidth: number;
  public canvasHeight: number;

  public thickenPass: ThickenPass;

  /* Get the pixel color at position (input should be element's offsetX/Y coords) */
  getCanvasPixelColor(pos: [number, number]): [number, number, number, number] {
    const rt = this.composer.writeBuffer;
    const [x, y] = [
      pos[0] * window.devicePixelRatio,
      pos[1] * window.devicePixelRatio,
    ];

    const buf = new Uint8Array(4);
    /* since the input is offsetX/Y with origin in top-left, we invert Y */
    this.renderer.readRenderTargetPixels(rt, x, rt.height - y, 1, 1, buf);
    return [buf[0], buf[1], buf[2], buf[3]];
  }

  constructor(canvas: HTMLCanvasElement, mesh: THREE.Mesh) {
    this.canvas = canvas;
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    this.mesh = mesh;

    // Setup camera on front wall, looking at the back wall
    this.camera = new THREE.OrthographicCamera();

    this.camera.position.x = 0;
    this.camera.position.y = 0;
    this.camera.position.z = 230;

    this.camera.lookAt(300, 300, 0);

    this.scene.add(this.mesh);

    // Rendering setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas,
    });

    const renderTarget = new THREE.WebGLRenderTarget();
    this.composer = new EffectComposer(this.renderer, renderTarget);

    // Passes

    const renderOutlinePass = new RenderOutlinePass(
      this.scene,
      this.camera,
      canvas.clientWidth,
      canvas.clientHeight,
    );
    this.composer.addPass(renderOutlinePass);

    const thickenPass = new ThickenPass(
      canvas.clientWidth,
      canvas.clientHeight,
    );
    this.thickenPass = thickenPass;
    this.composer.addPass(thickenPass);

    // By default, EffectComposer has an implicit rendering pass at the end.
    // However here we perform the OutputPass explicitly so that we can
    // add an FXAA pass _after_.
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    const fxaaPass = new FXAAPass();
    this.composer.addPass(fxaaPass);
  }

  resizeCanvas(): boolean {
    // If the DOM element's dimensions haven't changed, don't resize
    // NOTE: the canvas element's HTML dimensions are set by the CSS based on the
    // canvas container's dimensions
    if (
      this.canvas.clientWidth === this.canvasWidth &&
      this.canvas.clientHeight === this.canvasHeight
    ) {
      return false;
    }

    this.canvasWidth = this.canvas.clientWidth;
    this.canvasHeight = this.canvas.clientHeight;

    // Set the sizes of the various render targets (taking pixel ratio into account)
    // (multiplying everything by 2 to get better resolution and precision at the cost
    // of more work)
    this.composer.setPixelRatio(window.devicePixelRatio);
    this.composer.setSize(this.canvasWidth, this.canvasHeight);

    // this sets width= and height= in HTML
    // NOTE: the HTML dimensions are set via CSS width & height. Here by setting the HTML
    // width & height we effectively set the resolution.
    this.composer.renderer.setPixelRatio(window.devicePixelRatio);
    this.composer.renderer.setSize(this.canvasWidth, this.canvasHeight, false);

    return true;
  }

  centerCameraAround(target: THREE.Mesh, mat: THREE.Matrix4) {
    const geometry = target.geometry;
    const geometryVerticies = geometry.getAttribute("position");

    // Here we compute the overflow of the canvas relative to its parent element. The parent (container)
    // and canvas sizes are set by the CSS.
    //
    // The overflow is used to scale the image down so that it appears to fit in the container (aligned with
    // other elements) though can overflow (e.g. when rotation a part).
    const canvasParent = this.canvas.parentElement!;
    const overflowX =
      (0.5 * (this.canvas.clientWidth - canvasParent.clientWidth)) /
      canvasParent.clientWidth;
    const overflowY =
      (0.5 * (this.canvas.clientHeight - canvasParent.clientHeight)) /
      canvasParent.clientHeight;

    const { left, right, top, bottom, far, near } = computeProjectedBounds(
      this.camera,
      geometryVerticies,
      mat,
    );

    // Calculate a new viewHeight so that the part fits vertically (plus overflow)
    // View height/width in camera coordinates, exluding overflow
    const canvasAspectRatio =
      this.canvas.clientWidth / this.canvas.clientHeight;

    const containerAspectRatio =
      canvasParent.clientWidth / canvasParent.clientHeight;
    const sceneAspectRatio = (right - left) / (top - bottom);

    if (sceneAspectRatio > containerAspectRatio) {
      // The scene is wider than the canvas, so we make the scene fit the canvas' width and
      // center it vertically.

      // The width of the part (AND the container) in camera coordinates
      const width = right - left;

      this.camera.left = left - width * overflowX;
      this.camera.right = right + width * overflowX;

      // The height of the container in camera coordinates
      const height = width / containerAspectRatio;

      // The height of the part on the canvas
      const heightScene = width / sceneAspectRatio;
      const heightDelta = height - heightScene;

      this.camera.bottom = bottom - height * overflowY - heightDelta / 2;
      this.camera.top = top + height * overflowY + heightDelta / 2;
    } else {
      // The scene is taller than the canvas, so we make the scene fit the canvas' height
      // and align it to the left.

      // The height of the container in camera coordinates
      const height = top - bottom;

      this.camera.top = top + height * overflowY;
      this.camera.bottom = bottom - height * overflowY;

      // The width of the container in camera coordinates
      const width = height * canvasAspectRatio;

      this.camera.left = left - width * overflowX;
      this.camera.right = left + width + width * overflowX;
    }

    this.camera.near = near;
    this.camera.far = far;

    this.camera.updateProjectionMatrix();

    const width = right - left;
    const height = top - bottom;
    const maxDim = Math.sqrt(width * width + height * height);
    // The camera was moved/updated, so recompute the thickness of the outline
    this.thickenPass.setThickness((150 * window.devicePixelRatio) / maxDim);
  }

  render() {
    this.composer.render();
  }
}

// Compute min & max of the verticies' projection onto the camera plane (coordinates in the
// camera's coordinates). The near/far (depth) is calculated such that the verticies can rotate 360 deg
// around the Z axis and still be seen.
const computeProjectedBounds = (
  camera: THREE.Camera,
  verticies: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  mat: THREE.Matrix4 /* "World" matrix to apply to vertices */,
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
  // NOTE: The camera looks down the NEGATIVE Z axis!
  let [left, right] = [Infinity, -Infinity];
  let [bottom, top] = [Infinity, -Infinity];
  let [near, far] = [Infinity, -Infinity];

  // See https://github.com/nmattia/skapa/wiki/Camera-centering
  const c = camera.position;
  const n = new THREE.Vector3();
  camera.getWorldDirection(n);
  const b = c.x * n.x + c.y * n.y + c.z * n.z;

  // Iterate over all verticies in the model, keeping track of the min/max values of
  // projection (onto camera plane)
  for (let i = 0; i < verticies.count; i++) {
    // Load vertex & move to world coordinates (position & rotation)
    vertex.fromArray(verticies.array, i * verticies.itemSize);
    vertex.applyMatrix4(mat); // Apply matrix to position vertex within world

    // Distance to rotation axis
    const r = Math.sqrt(vertex.x * vertex.x + vertex.y * vertex.y);
    // The part that actually changes from vertex to vertex
    const x = r * Math.sqrt(1 - n.z * n.z);

    // The 2 extrema
    const vz_1 = b - vertex.z * n.z + x;
    const vz_2 = b - vertex.z * n.z - x;

    // Look at the vertex from the camera's perspective
    const v = camera.worldToLocal(vertex);

    // Update mins & maxs
    left = Math.min(left, v.x);
    right = Math.max(right, v.x);
    bottom = Math.min(bottom, v.y);
    top = Math.max(top, v.y);
    near = Math.min(near, -vz_1, -vz_2);
    far = Math.max(far, -vz_1, -vz_2);
  }

  return { left, right, top, bottom, near, far };
};
