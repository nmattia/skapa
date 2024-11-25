import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import vertexShader from "./vert.glsl?raw";
import fragmentShader from "./frag.glsl?raw";

export class RenderOutlinePass extends Pass {
  private normalMaterial: THREE.MeshNormalMaterial;
  private fsQuad: FullScreenQuad;

  private outlineMaterial: THREE.ShaderMaterial;
  private normalRenderTarget = new THREE.WebGLRenderTarget();

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    width: number,
    height: number,
  ) {
    super();
    this.normalMaterial = new THREE.MeshNormalMaterial();
    this.fsQuad = new FullScreenQuad();

    this.outlineMaterial = new THREE.ShaderMaterial({
      name: "outline shader",
      uniforms: {
        tDepth: { value: null },
        tNormal: { value: null },
        texelSize: { value: null },
      },
      vertexShader,
      fragmentShader,
    });

    this.fsQuad.material = this.outlineMaterial;
    this.setSize(width, height);
  }

  setSize(width: number, height: number) {
    this.normalRenderTarget.depthTexture?.dispose();
    const depthTexture = new THREE.DepthTexture(width, height);

    this.normalRenderTarget.setSize(width, height);
    this.normalRenderTarget.depthTexture = depthTexture;

    this.outlineMaterial.uniforms.tDepth.value = depthTexture;
    this.outlineMaterial.uniforms.tNormal.value =
      this.normalRenderTarget.texture;
    this.outlineMaterial.uniforms.texelSize.value = new THREE.Vector2(
      1 / width,
      1 / height,
    );
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget) {
    /// Render once for normals & depth

    // Temporarily swap all materials for the normal material
    const oldMat = this.scene.overrideMaterial;
    this.scene.overrideMaterial = this.normalMaterial;

    renderer.setRenderTarget(this.normalRenderTarget);
    renderer.render(this.scene, this.camera);

    // Revert override
    this.scene.overrideMaterial = oldMat;

    /// Render outline
    renderer.setRenderTarget(writeBuffer);

    this.fsQuad.render(renderer);
  }

  dispose() {
    this.normalMaterial.dispose();
    this.fsQuad.dispose();
    this.outlineMaterial.dispose();
    this.normalRenderTarget.dispose();
  }
}
