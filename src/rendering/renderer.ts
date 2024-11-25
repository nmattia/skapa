import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";

import { RenderOutlinePass } from "./effects/outline";
import { ThickenPass } from "./effects/thicken";
import { FXAAPass } from "./effects/antialiasing";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Overflow value (canvas overflowing outside of container)
// that seems to accomodate part overflow for most dimensions
const CANVAS_OVERFLOW_PERCENT = 0.15;

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

  constructor(canvas: HTMLCanvasElement, mesh: THREE.Mesh) {
    this.canvas = canvas;
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    this.mesh = mesh;
    this.canvas.style.setProperty(
      "--overflow",
      CANVAS_OVERFLOW_PERCENT * 100 + "%",
    );

    // Setup camera on front wall, looking at the back wall
    this.camera = new THREE.OrthographicCamera();

    this.camera.position.x = 0;
    this.camera.position.y = 0;
    this.camera.position.z = 300;

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
    this.composer.renderer.setSize(
      this.canvasWidth,
      this.canvasHeight,
      false,
    );

    return true;
  }

  centerCamera() {
    const geometry = this.mesh.geometry;
    const geometryVerticies = geometry.getAttribute("position");

    const { left, top, bottom, far, near } = computeProjectedBounds(
      this.camera,
      geometryVerticies,
      this.mesh.matrixWorld,
    );

    // Calculate a new viewHeight so that the part fits vertically (plus overflow)
    // View height/width in camera coordinates, exluding overflow
    const viewHeight = top - bottom;
    const aspectRatio = this.canvas.clientWidth / this.canvas.clientHeight;
    const viewWidth = aspectRatio * viewHeight;

    // Adjust camera to view height & width, plus some overflow
    this.camera.left = left - CANVAS_OVERFLOW_PERCENT * viewWidth;
    this.camera.right = left + (1 + CANVAS_OVERFLOW_PERCENT) * viewWidth;
    this.camera.top = bottom + (1 + CANVAS_OVERFLOW_PERCENT) * viewHeight;
    this.camera.bottom = bottom - CANVAS_OVERFLOW_PERCENT * viewHeight;
    this.camera.far = far + 1;
    this.camera.near = near - 1;

    this.camera.updateProjectionMatrix();
  }

  render() {
    this.composer.render();
  }
}

// Compute min & max of the verticies' projection onto the camera plane (coordinates in the
// camera's coordinates)
const computeProjectedBounds = (
  camera: THREE.Camera,
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
