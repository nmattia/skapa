import type { Vec2, CrossSection, Manifold } from "manifold-3d";
import type { ManifoldToplevel } from "manifold-3d";
import init from "manifold-3d";
import manifold_wasm from "manifold-3d/manifold.wasm?url";

// NOTE: all values are in mm

// Load manifold 3d
class ManifoldModule {
  private static wasm: ManifoldToplevel | undefined = undefined;
  static async get(): Promise<ManifoldToplevel> {
    if (this.wasm !== undefined) {
      return this.wasm;
    }

    this.wasm = await init({ locateFile: () => manifold_wasm });

    await this.wasm.setup();
    return this.wasm;
  }
}

// Generates a CCW arc (quarter)
function generateArc({
  center,
  radius,
}: {
  center: Vec2;
  radius: number;
}): Vec2[] {
  // Number of segments (total points - 2)
  const N_SEGMENTS = 10;
  const N_POINTS = N_SEGMENTS + 2;

  const pts: Vec2[] = [];
  for (let i = 0; i < N_POINTS; i++) {
    const angle = (i * (Math.PI / 2)) / (N_POINTS - 1);

    pts.push([
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle),
    ]);
  }

  return pts;
}

// Rounded rect centered at (0,0)
async function roundedRectangle(
  size: Vec2,
  cornerRadius: number,
): Promise<CrossSection> {
  const { CrossSection } = await ManifoldModule.get();
  const w = size[0];
  const h = size[1];
  const basicArc = generateArc({
    center: [w / 2 - cornerRadius, h / 2 - cornerRadius],
    radius: cornerRadius,
  });

  // Reuse the basic arc and mirror & reverse as necessary for each corner of
  // the cube
  const topRight: Vec2[] = basicArc;
  const topLeft: Vec2[] = Array.from(basicArc.map(([x, y]) => [-x, y]));
  topLeft.reverse();
  const bottomLeft: Vec2[] = basicArc.map(([x, y]) => [-x, -y]);
  const bottomRight: Vec2[] = Array.from(basicArc.map(([x, y]) => [x, -y]));
  bottomRight.reverse();

  const vertices: Vec2[] = [
    ...topRight,
    ...topLeft,
    ...bottomLeft,
    ...bottomRight,
  ];

  return new CrossSection(vertices);
}

async function clipRCrossSection(): Promise<CrossSection> {
  const { CrossSection } = await ManifoldModule.get();

  const vertices: Vec2[] = [
    [0.95, 0],
    [2.45, 0],
    [2.45, 3.7],
    [3.05, 4.3],
    [3.05, 5.9],
    [2.45, 6.5],
    [0.95, 6.5],
    [0.95, 0],
  ];

  return new CrossSection(vertices).rotate(180);
}

// The skadis clips, starting at the origin and pointing in -Z
async function clips(): Promise<[Manifold, Manifold]> {
  const clipR = (await clipRCrossSection()).extrude(10);
  const clipL = (await clipRCrossSection()).mirror([1, 0]).extrude(10);

  return [clipR, clipL];
}

// The box (with clips), with origin where clips meet the box
export async function myModel(
  height: number,
  width: number,
  depth: number,
): Promise<Manifold> {
  const outerRadius = 5;
  const wallThickness = 2;
  const bottomThickness = 3;
  const innerRadius = Math.max(0, outerRadius - wallThickness);
  const base = (await roundedRectangle([width, depth], outerRadius)).extrude(
    height,
  );
  const innerNeg = (
    await roundedRectangle(
      [width - 2 * wallThickness, depth - 2 * wallThickness],
      innerRadius,
    )
  )
    .extrude(height - bottomThickness)
    .translate([0, 0, 5]);

  const box = base.subtract(innerNeg);

  let res = box;
  const [clipL, clipR] = await clips();

  res = res.add(clipL.translate(0, -depth / 2, 0));
  res = res.add(clipR.translate(0, -depth / 2, 0));

  return res;
}
