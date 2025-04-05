// Fragment shader that renders outlines, adapted from:
//   https://roystan.net/articles/outline-shader/

varying vec2 vUv; // (x,y) with x,y in [0,1]
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 texelSize;

/* Both the depth & normal checks use a Sobel operator, which
   is composed of two 3x3 kernels. For exact structure, see:
        https://en.wikipedia.org/wiki/Sobel_operator
*/


float computeEdgeDepth() {

    // Horizontal comparison
    // [m] for minus (negative components and [p] for plus
    float xm0 = texture(tDepth, vUv + texelSize * vec2(-1., +1.)).x;
    float xm1 = texture(tDepth, vUv + texelSize * vec2(-1.,  0.)).x;
    float xm2 = texture(tDepth, vUv + texelSize * vec2(-1., -1.)).x;

    float xp0 = texture(tDepth, vUv + texelSize * vec2(+1., +1.)).x;
    float xp1 = texture(tDepth, vUv + texelSize * vec2(+1.,  0.)).x;
    float xp2 = texture(tDepth, vUv + texelSize * vec2(+1., -1.)).x;

    // Vertical comparison
    float ym0 = texture(tDepth, vUv + texelSize * vec2(-1., 1.)).x;
    float ym1 = texture(tDepth, vUv + texelSize * vec2( 0., 1.)).x;
    float ym2 = texture(tDepth, vUv + texelSize * vec2(+1., 1.)).x;

    float yp0 = texture(tDepth, vUv + texelSize * vec2(-1., -1.)).x;
    float yp1 = texture(tDepth, vUv + texelSize * vec2( 0., -1.)).x;
    float yp2 = texture(tDepth, vUv + texelSize * vec2(+1., -1.)).x;

    // Build the local operator and apply to samples
    vec3 v121 = vec3(1., 2., 1.);

    // Compute the magnitude
    float Gx = dot(v121, vec3(xp0, xp1, xp2)) - dot(v121, vec3(xm0, xm1, xm2));
    float Gy = dot(v121, vec3(yp0, yp1, yp2)) - dot(v121, vec3(ym0, ym1, ym2));
    return sqrt(pow(Gx, 2.) + pow(Gy, 2.));
}

float computeEdgeNormal() {
    // Similar to Depth check, but using all three values for the normals

    vec3 xm0 = texture(tNormal, vUv + texelSize * vec2(-1., +1.)).rgb;
    vec3 xm1 = texture(tNormal, vUv + texelSize * vec2(-1.,  0.)).rgb;
    vec3 xm2 = texture(tNormal, vUv + texelSize * vec2(-1., -1.)).rgb;

    vec3 xp0 = texture(tNormal, vUv + texelSize * vec2(+1., +1.)).rgb;
    vec3 xp1 = texture(tNormal, vUv + texelSize * vec2(+1.,  0.)).rgb;
    vec3 xp2 = texture(tNormal, vUv + texelSize * vec2(+1., -1.)).rgb;

    vec3 ym0 = texture(tNormal, vUv + texelSize * vec2(-1., 1.)).rgb;
    vec3 ym1 = texture(tNormal, vUv + texelSize * vec2( 0., 1.)).rgb;
    vec3 ym2 = texture(tNormal, vUv + texelSize * vec2(+1., 1.)).rgb;

    vec3 yp0 = texture(tNormal, vUv + texelSize * vec2(-1., -1.)).rgb;
    vec3 yp1 = texture(tNormal, vUv + texelSize * vec2( 0., -1.)).rgb;
    vec3 yp2 = texture(tNormal, vUv + texelSize * vec2(+1., -1.)).rgb;

    vec3 v121 = vec3(1., 2., 1.);
    vec3 Gx = vec3( dot(v121, xp0), dot(v121, xp1), dot(v121, xp2))
        - vec3(dot(v121, xm0), dot(v121, xm1), dot(v121, xm2)                 );

    vec3 Gy = vec3( dot(v121, yp0), dot(v121, yp1), dot(v121, yp2))
        - vec3(dot(v121, ym0), dot(v121, ym1), dot(v121, ym2)                 );

    return sqrt(dot(Gx, Gx) + dot(Gy, Gy));
}

void main() {
    float edgeDepth = computeEdgeDepth();
    float edgeNormal = computeEdgeNormal();

    float edge = step(.25, max(edgeDepth, edgeNormal));
    float depth = texture(tDepth, vUv).x;

    // Make alpha transparent if depth == 1 (hitting far plane) UNLESS
    // we are drawing an edge
    float alpha = 1.0 - step(1.0, depth) + edge;

    // Color which we premultiply with alpha
    gl_FragColor.rgb = (1.0 - vec3(edge)) * alpha;
    gl_FragColor.a = alpha;
}
