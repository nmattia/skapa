varying vec2 vUv; // (x,y) with x,y in [0,1]
uniform sampler2D tInput;
uniform vec2 texelSize;

// Distance in pixels (more or less) to a black pixel for this pixel to turn black
uniform int thickness;

void main() {
    vec4 base = texture2D(tInput, vUv);
    vec4 black = vec4(vec3(0.), 1.);

    int thickness2 = thickness*thickness;

    // Becomes true if any pixel within a disc of radius "thickness" is black
    bool is_black = false;

    for (int i = -thickness/2; i < thickness/2; i++) {
        int i2 = i * i;
        for (int j = -thickness/2; j < thickness/2; j++) {
            vec4 smpl = texture2D(tInput, vUv + vec2(i,j) * texelSize);
            is_black = is_black || i2 + j * j < thickness2 && smpl == black;
        }
    }

    gl_FragColor.rgba = is_black ? black : base;
}
