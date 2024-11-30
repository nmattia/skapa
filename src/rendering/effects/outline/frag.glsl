varying vec2 vUv; // (x,y) with x,y in [0,1]
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 texelSize;

// Configuration values for edge detection
const float scale = 2.0;
const float halfScaleFloor = floor(scale * 0.5);
const float halfScaleCeil = ceil(scale * 0.5);
const float depthThreshold = 0.1;
const float normalThreshold = 0.4;

struct RobertsCross
{
    vec2 bottomLeftUV;
    vec2 topRightUV;
    vec2 bottomRightUV;
    vec2 topLeftUV;
};

RobertsCross makeCross() {
    return RobertsCross (
            vUv + texelSize * vec2(-1.0,-1.0) * halfScaleFloor,
            vUv + texelSize * vec2(1.0,1.0) * halfScaleCeil,
            vUv + texelSize * vec2(1.0,-1.0) * halfScaleFloor,
            vUv + texelSize * vec2(-1.0,1.0) * halfScaleCeil
            );
}

float computeEdgeDepth(RobertsCross cr) {
    float depth0 = texture2D(tDepth, cr.bottomLeftUV).x;
    float depth1 = texture2D(tDepth, cr.topRightUV).x;
    float depth2 = texture2D(tDepth, cr.bottomRightUV).x;
    float depth3 = texture2D(tDepth, cr.topLeftUV).x;

    float depthFiniteDifference0 = depth1 - depth0;
    float depthFiniteDifference1 = depth3 - depth2;

    float edgeDepth = sqrt( pow(depthFiniteDifference0, 2.0)+ pow(depthFiniteDifference1,2.0));

    return step(depthThreshold, edgeDepth);
}

float computeEdgeNormal(RobertsCross cr) {
    vec3 normal0 = texture2D(tNormal, cr.bottomLeftUV).rgb;
    vec3 normal1 = texture2D(tNormal, cr.topRightUV).rgb;
    vec3 normal2 = texture2D(tNormal, cr.bottomRightUV).rgb;
    vec3 normal3 = texture2D(tNormal, cr.topLeftUV).rgb;

    vec3 normalFiniteDifference0 = normal1 - normal0;
    vec3 normalFiniteDifference1 = normal3 - normal2;

    float edgeNormal = sqrt(dot(normalFiniteDifference0, normalFiniteDifference0) + dot(normalFiniteDifference1, normalFiniteDifference1));

    return step(normalThreshold, edgeNormal);
}

void main() {
    RobertsCross cr = makeCross();

    float edgeDepth = computeEdgeDepth(cr);
    float edgeNormal = computeEdgeNormal(cr);

    float edge = max(edgeDepth, edgeNormal);
    float depth = texture2D(tDepth, vUv).x;

    // Make alpha transparent if depth == 1 (hitting far plane) UNLESS
    // we are drawing an edge
    float alpha = 1.0 - step(1.0, depth) + edge;

    // Color which we premultiply with alpha
    gl_FragColor.rgb = (1.0 - vec3(edge)) * alpha;
    gl_FragColor.a = alpha;
}
