varying vec2 vUv; // (x,y) with x,y in [0,1]
uniform sampler2D tInput;
uniform vec2 texelSize;

// Distance in pixels (more or less) to a black pixel for this pixel to turn black
const int N_PIXELS = 4;

void main() {

    // True if the pixel is within a distance of ~N_PIXELS of a black pixel
    bool black = false;

    for (int i = -N_PIXELS/2; i < N_PIXELS/2; i++) {
        for (int j = -N_PIXELS/2; j < N_PIXELS/2; j++) {
            // If this pixel is futher away than N_PIXELS, skip
            if (i * i + j * j > N_PIXELS/2 * N_PIXELS/2) { continue; }

            vec2 xy = vec2(i,j);
            vec4 smpl = texture2D(tInput, vUv + xy * vec2(texelSize));

            // If a pixel in the vicinity is black, set this to black and return
            if (smpl == vec4(vec3(0.0), 1.0) ){
                gl_FragColor.rgba = vec4(vec3(0.0), 1.0);
                return;
            }
        }

    }

    gl_FragColor.rgba = texture2D(tInput, vUv);
}
