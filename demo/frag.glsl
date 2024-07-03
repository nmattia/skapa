varying vec2 vUv;
uniform sampler2D tDepth;

void main() {
    float depth = texture2D(tDepth, vUv).x;
    gl_FragColor.rgb = 1.0 - vec3(depth);
    gl_FragColor.a = 1.0;
}
