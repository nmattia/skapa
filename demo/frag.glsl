
varying vec2 vUv; // (x,y) with x,y in [0,1]
uniform sampler2D tNormal; // Normal passed from vertex shader
uniform sampler2D tDepth;
uniform vec2 texelSize;

const float scale = 5.0;
const float halfScaleFloor = floor(scale * 0.5);
const float halfScaleCeil = ceil(scale * 0.5);
const float depthThreshold = 0.2;
const float normalThreshold = 0.4;

float computeEdgeDepth() {
    vec2 bottomLeftUV = vUv + texelSize * vec2(-1.0,-1.0) * halfScaleFloor;
    vec2 topRightUV = vUv + texelSize * vec2(1.0,1.0) * halfScaleCeil;
    vec2 bottomRightUV = vUv + texelSize * vec2(1.0,-1.0) * halfScaleFloor;
    vec2 topLeftUV = vUv + texelSize * vec2(-1.0,1.0) * halfScaleCeil;

    float depth0 = texture2D(tDepth, bottomLeftUV).x;
    float depth1 = texture2D(tDepth, topRightUV).x;
    float depth2 = texture2D(tDepth, bottomRightUV).x;
    float depth3 = texture2D(tDepth, topLeftUV).x;

    float depthFiniteDifference0 = depth1 - depth0;
    float depthFiniteDifference1 = depth3 - depth2;

    float edgeDepth = sqrt( pow(depthFiniteDifference0, 2.0)+ pow(depthFiniteDifference1,2.0));

    return step(depthThreshold, edgeDepth);
}

float computeEdgeNormal() {
    vec2 bottomLeftUV = vUv + texelSize * vec2(-1.0,-1.0) * halfScaleFloor;
    vec2 topRightUV = vUv + texelSize * vec2(1.0,1.0) * halfScaleCeil;
    vec2 bottomRightUV = vUv + texelSize * vec2(1.0,-1.0) * halfScaleFloor;
    vec2 topLeftUV = vUv + texelSize * vec2(-1.0,1.0) * halfScaleCeil;

    vec3 normal0 = texture2D(tNormal, bottomLeftUV).rgb;
    vec3 normal1 = texture2D(tNormal, topRightUV).rgb;
    vec3 normal2 = texture2D(tNormal, bottomRightUV).rgb;
    vec3 normal3 = texture2D(tNormal, topLeftUV).rgb;

    vec3 normalFiniteDifference0 = normal1 - normal0;
    vec3 normalFiniteDifference1 = normal3 - normal2;

    float edgeNormal = sqrt(dot(normalFiniteDifference0, normalFiniteDifference0) + dot(normalFiniteDifference1, normalFiniteDifference1));

    return step(normalThreshold, edgeNormal);
}

void main() {


    float edgeDepth = computeEdgeDepth();
    float edgeNormal = computeEdgeNormal();

    float edge = max(edgeDepth, edgeNormal);

    gl_FragColor.rgb = 1.0 - vec3(edge);
    gl_FragColor.a = 1.0;
}
