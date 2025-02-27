import "./style.css";

import * as THREE from "three";
import { Renderer } from "./rendering/renderer";

import { CLIP_HEIGHT, box } from "./model/manifold";
import { mesh2geometry } from "./model/export";
import { TMFLoader } from "./model/load";
import { Animate, immediate } from "./animate";

import { Dyn } from "./twrl";

/// CONSTANTS

// Align axes with 3D printer
THREE.Object3D.DEFAULT_UP = new THREE.Vector3(0, 0, 1);

const DIMENSIONS = [
  "height",
  "width",
  "depth",
  "radius",
  "wall",
  "bottom",
] as const;

// constants, all in outer dimensions (when applicable)

// actual constants
const START_RADIUS = 6;
const START_WALL = 2;
const START_BOTTOM = 3;

const START_HEIGHT = 52; /* calculated manually from START_LEVELS */
const START_LEVELS = 2;
const MIN_LEVELS = 1;
const MAX_LEVELS = 5;

const START_WIDTH = 80;
const MIN_WIDTH = 10 + 2 * START_RADIUS;

const START_DEPTH = 60;
const MIN_DEPTH = 20;

/// STATE

// Dimensions of the model (outer, where applicable).
// These are the dimensions of the 3MF file, as well as
// the _target_ dimensions for the animations, though may
// be (ephemerally) different from the animation values.

const levels = new Dyn(START_LEVELS); /* number of clip levels */

const modelDimensions = {
  height: levels.map((x) => x * CLIP_HEIGHT + (x - 1) * (40 - CLIP_HEIGHT)),
  width: new Dyn(START_WIDTH),
  depth: new Dyn(START_DEPTH),
  radius: new Dyn(START_RADIUS),
  wall: new Dyn(START_WALL),
  bottom: new Dyn(START_BOTTOM),
};

const innerWidth = Dyn.sequence([
  modelDimensions.wall,
  modelDimensions.width,
] as const).map(([wall, width]) => width - 2 * wall);

const innerDepth = Dyn.sequence([
  modelDimensions.wall,
  modelDimensions.depth,
] as const).map(([wall, depth]) => depth - 2 * wall);

// Current state of part positioning
type PartPositionStatic = Extract<PartPosition, { tag: "static" }>;
type PartPosition =
  | {
      tag: "static";
      position: -1 | 0 | 1;
    } /* no current mouse interaction. -1 and +1 are different as they represent different ways of showing the back of the part (CW or CCW) */
  | {
      tag: "will-move";
      startRot: number;
      startX: number;
      clock: THREE.Clock;
      was: Extract<PartPosition, { tag: "static" }>;
    } /* mouse was down but hasn't moved yet */
  | {
      tag: "moving";
      was: Extract<PartPosition, { tag: "will-move" }>;
      x: number;
    } /* mouse is moving */;
const partPositioning = new Dyn<PartPosition>({ tag: "static", position: 0 });

/// MODEL

const tmfLoader = new TMFLoader();

// Reloads the model seen on page
async function reloadModel(
  height: number,
  width: number,
  depth: number,
  radius: number,
  wall: number,
  bottom: number,
) {
  const model = await box(height, width, depth, radius, wall, bottom);
  const geometry = mesh2geometry(model);
  geometry.computeVertexNormals(); // Make sure the geometry has normals
  mesh.geometry = geometry;
  mesh.clear(); // Remove all children
}

// when target dimensions are changed, update the model to download
Dyn.sequence([
  modelDimensions.height,
  modelDimensions.width,
  modelDimensions.depth,
  modelDimensions.radius,
  modelDimensions.wall,
  modelDimensions.bottom,
] as const).addListener(([h, w, d, r, wa, bo]) => {
  tmfLoader.load(box(h, w, d, r, wa, bo));
});

/// RENDER

// Set to 'true' whenever the camera needs to be centered again
let centerCameraNeeded = true;

// The mesh, updated in place when the geometry needs to change
const mesh: THREE.Mesh = new THREE.Mesh(
  new THREE.BoxGeometry(
    modelDimensions.width.latest,
    modelDimensions.height.latest,
    modelDimensions.depth.latest,
  ),
  new THREE.Material(),
);

// Center the camera around the mesh
async function centerCamera() {
  // Create a "world" matrix which only includes the part rotation (we don't use the actual
  // world matrix to avoid rotation animation messing with the centering)
  const mat = new THREE.Matrix4();
  mat.makeRotationAxis(new THREE.Vector3(0, 0, 1), MESH_ROTATION_DELTA);
  renderer.centerCameraAround(mesh, mat);
}

const MESH_ROTATION_DELTA = 0.15;
mesh.rotation.z = MESH_ROTATION_DELTA;

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = new Renderer(canvas, mesh);

let reloadModelNeeded = true;

// The animated rotation, between -1 and 1
const rotation = new Animate(0);

/* Bound the number betweek lo & hi (modulo) */
const bound = (v: number, [lo, hi]: [number, number]): number =>
  ((v - lo) % (hi - lo)) + lo;

partPositioning.addListener((val) => {
  if (val.tag === "static") {
    rotation.startAnimationTo(val.position);
  } else if (val.tag === "moving") {
    /* the delta of width (between -1 and 1, so 2) per delta of (horizontal, CSS) pixel */
    const dwdx = 2 / renderer.canvasWidth;
    const v = (val.x - val.was.startX) * dwdx - val.was.startRot;
    rotation.startAnimationTo(bound(v, [-1, 1]), immediate);
  } else {
    val.tag satisfies "will-move";
    /* not movement yet, so not need to move */
  }
});

/// ANIMATIONS

// The animated dimensions
const animations = {
  height: new Animate(START_HEIGHT),
  width: new Animate(START_WIDTH),
  depth: new Animate(START_DEPTH),
  radius: new Animate(START_RADIUS),
  wall: new Animate(START_WALL),
  bottom: new Animate(START_BOTTOM),
};

DIMENSIONS.forEach((dim) =>
  modelDimensions[dim].addListener((val) => {
    animations[dim].startAnimationTo(val);
  }),
);

/// DOM

// Download button
const link = document.querySelector("a")!;
link.download = "skapa.3mf";

// The dimension inputs
const inputs = {
  levels: document.querySelector("#levels")! as HTMLInputElement,
  levelsPlus: document.querySelector("#levels-plus")! as HTMLButtonElement,
  levelsMinus: document.querySelector("#levels-minus")! as HTMLButtonElement,
  width: document.querySelector("#width")! as HTMLInputElement,
  widthRange: document.querySelector("#width-range")! as HTMLInputElement,
  depth: document.querySelector("#depth")! as HTMLInputElement,
  depthRange: document.querySelector("#depth-range")! as HTMLInputElement,
} as const;

// Add change events to all dimension inputs

// height/levels
([[inputs.levels, "change"]] as const).forEach(([input, evnt]) => {
  levels.addListener((levels) => {
    input.value = `${levels}`;
  });
  input.addEventListener(evnt, () => {
    const n = parseInt(input.value);
    if (!Number.isNaN(n))
      /* Clamp between min & max (currently synced manually with HTML) */
      levels.send(Math.max(MIN_LEVELS, Math.min(n, MAX_LEVELS)));
  });
});

inputs.levelsPlus.addEventListener("click", () => {
  const n = levels.latest + 1;
  levels.send(Math.max(MIN_LEVELS, Math.min(n, MAX_LEVELS)));
});
levels.addListener((n) => {
  inputs.levelsPlus.disabled = MAX_LEVELS <= n;
  inputs.levelsMinus.disabled = n <= MIN_LEVELS;
});

inputs.levelsMinus.addEventListener("click", () => {
  const n = levels.latest - 1;
  levels.send(Math.max(1, Math.min(n, 5)));
});

// width
(
  [
    [inputs.width, "change"],
    [inputs.widthRange, "input"],
  ] as const
).forEach(([input, evnt]) => {
  innerWidth.addListener((width) => {
    input.value = `${width}`;
  });
  input.addEventListener(evnt, () => {
    const outer = parseInt(input.value) + 2 * modelDimensions.wall.latest;
    if (!Number.isNaN(outer))
      modelDimensions.width.send(Math.max(outer, MIN_WIDTH));
  });
});

// depth
(
  [
    [inputs.depth, "change"],
    [inputs.depthRange, "input"],
  ] as const
).forEach(([input, evnt]) => {
  innerDepth.addListener((depth) => {
    input.value = `${depth}`;
  });
  input.addEventListener(evnt, () => {
    const outer = parseInt(input.value) + 2 * modelDimensions.wall.latest;
    if (!Number.isNaN(outer))
      modelDimensions.depth.send(Math.max(outer, MIN_DEPTH));
  });
});

// Add select-all on input click
(["levels", "width", "depth"] as const).forEach((dim) => {
  const input = inputs[dim];
  input.addEventListener("focus", () => {
    input.select();
  });
});

const canvasContainer = document.querySelector(
  "#canvas-container",
) as HTMLDivElement;

/* Start tracking mouse mouvement across the window */
const trackMouseTarget = window;
const trackMouseEvent = "mousemove";
const trackMouse = (e: MouseEvent) => {
  partPositioning.update((was) => {
    if (was.tag === "will-move") {
      return { tag: "moving", was, x: e.screenX };
    } else if (was.tag === "moving") {
      return { tag: "moving", was: was.was, x: e.screenX };
    }

    // This is technically not possible
    was.tag satisfies "static";
    return was;
  });
};

const readyMouseTarget = canvasContainer;
const readyMouseEvent = "mousedown";
const readyMouse = (e: MouseEvent) => {
  partPositioning.update((was) => {
    if (was.tag === "will-move" || was.tag === "moving") {
      return was;
    } else {
      const clock = new THREE.Clock();
      clock.start();
      return {
        tag: "will-move",
        startRot: rotation.current,
        startX: e.screenX,
        clock,
        was,
      };
    }
  });

  trackMouseTarget.addEventListener(trackMouseEvent, trackMouse);
  forgetMouseTarget.addEventListener(forgetMouseEvent, forgetMouse);
};

readyMouseTarget.addEventListener(readyMouseEvent, readyMouse);

const forgetMouseTarget = window;
const forgetMouseEvent = "mouseup";
const forgetMouse = () => {
  trackMouseTarget.removeEventListener(trackMouseEvent, trackMouse);
  forgetMouseTarget.removeEventListener(forgetMouseEvent, forgetMouse);

  /* toggle static positioning between front & back */
  const toggle = (p: PartPositionStatic): PartPositionStatic =>
    ({
      [-1]: { tag: "static", position: 0 } as const,
      [0]: { tag: "static", position: 1 } as const,
      [1]: { tag: "static", position: 0 } as const,
    })[p.position];

  partPositioning.update((was) => {
    if (was.tag === "will-move") {
      // Mouse was down but didn't move, assume toggle
      return toggle(was.was);
    } else if (was.tag === "static") {
      // Mouse was down and up, i.e. "clicked", toggle
      return toggle(was);
    } else {
      // Mouse has moved
      was.tag satisfies "moving";

      // If the move was too short, assume toggle (jerk)
      const elapsed = was.was.clock.getElapsedTime();
      if (elapsed < 0.3) {
        return toggle(was.was.was);
      }

      // Snap part to one of the static positions
      const rounded = Math.round(bound(rotation.current, [-1, 1]));
      if (rounded <= -1) {
        return { tag: "static", position: -1 };
      } else if (1 <= rounded) {
        return { tag: "static", position: 1 };
      } else {
        return { tag: "static", position: 0 };
      }
    }
  });
};

/// LOOP

// Set to current frame's timestamp when a model starts loading, and set
// to undefined when the model has finished loading
let modelLoadStarted: undefined | DOMHighResTimeStamp;

function loop(nowMillis: DOMHighResTimeStamp) {
  requestAnimationFrame(loop);

  // Reload 3mf if necessary
  const newTmf = tmfLoader.take();
  if (newTmf !== undefined) {
    // Update the download link
    link.href = URL.createObjectURL(newTmf);
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
    reloadModelNeeded = false;
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
  }

  const canvasResized = renderer.resizeCanvas();

  if (canvasResized) {
    centerCameraNeeded = true;
  }

  if (centerCameraNeeded) {
    centerCamera();
    centerCameraNeeded = false;
  }

  renderer.render();
}

// performance.now() is equivalent to the timestamp supplied by
// requestAnimationFrame
//
// https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
loop(performance.now());
