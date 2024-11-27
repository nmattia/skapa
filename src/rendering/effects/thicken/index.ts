import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import vertexShader from "./vert.glsl?raw";
import fragmentShader from "./frag.glsl?raw";

/// A rendering pass that thickens black pixels.
export class ThickenPass extends Pass {
  private fsQuad: FullScreenQuad;

  private thickenMaterial: THREE.ShaderMaterial;

  constructor(width: number, height: number) {
    super();
    this.fsQuad = new FullScreenQuad();

    this.thickenMaterial = new THREE.ShaderMaterial({
      name: "thicken shader",
      uniforms: {
        tInput: { value: null },
        texelSize: { value: null },
        thickness: { value: 0 },
      },
      vertexShader,
      fragmentShader,
    });

    this.fsQuad.material = this.thickenMaterial;
    this.setSize(width, height);
  }

  setSize(width: number, height: number) {
    this.thickenMaterial.uniforms.texelSize.value = new THREE.Vector2(
      1 / width,
      1 / height,
    );
  }

  setThickness(w: number) {
    this.thickenMaterial.uniforms.thickness.value = w;
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ) {
    renderer.setRenderTarget(writeBuffer);

    this.thickenMaterial.uniforms.tInput.value = readBuffer.texture;
    this.fsQuad.render(renderer);
  }

  dispose() {
    this.fsQuad.dispose();
    this.thickenMaterial.dispose();
  }
}
