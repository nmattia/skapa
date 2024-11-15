import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

export class FXAAPass extends ShaderPass {
  constructor() {
    super(FXAAShader);
  }

  setSize(width: number, height: number) {
    this.material.uniforms["resolution"].value.x = 1 / width;
    this.material.uniforms["resolution"].value.y = 1 / height;
  }
}
