import { WAVES } from "./world";

function waveBody(): string {
  return WAVES.map((w) => {
    const dx = w.x.toFixed(5);
    const dz = w.z.toFixed(5);
    const k = w.k.toFixed(6);
    const amp = w.amp.toFixed(4);
    const len = ((Math.PI * 2) / w.k).toFixed(3);
    const speedK = (w.speed * w.k).toFixed(6);
    return `
      {
        float vis = 1.0 - smoothstep(${len} * 0.05, ${len} * 0.28, px);
        float phase = dot(xz, vec2(${dx}, ${dz})) * ${k} - uTime * ${speedK};
        float s = sin(phase);
        float c = cos(phase);
        h += s * ${amp} * ampScale * vis;
        float slope = c * ${amp} * ampScale * ${k} * vis;
        dhx += slope * ${dx};
        dhz += slope * ${dz};
        crest = max(crest, smoothstep(0.55, 0.98, c) * ${amp} * vis * 4.0);
      }`;
  }).join("\n");
}

export function waterVertexShader(): string {
  return /* glsl */ `
    varying vec3 vWorld;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `;
}

export const waterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uMask;
  uniform vec3 uSunDir;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uFog;
  varying vec3 vWorld;
  void main() {
    vec2 xz = vWorld.xz;
    vec2 uv = xz / 1400.0 + 0.5;
    vec3 mask = texture2D(uMask, uv).rgb;
    float lagoon = mask.r;
    float shore = mask.g;
    float reef = mask.b;
    float ampScale = mix(1.0, 0.28, lagoon);
    float px = max(fwidth(xz.x), fwidth(xz.y));
    float h = 0.0;
    float dhx = 0.0;
    float dhz = 0.0;
    float crest = 0.0;
    ${waveBody()}
    dhx *= 0.35;
    dhz *= 0.35;
    vec3 Nrip = normalize(vec3(-dhx, 1.0, -dhz));
    vec3 N = normalize(mix(vec3(0.0, 1.0, 0.0), Nrip, 0.4 * smoothstep(3.5, 0.25, px)));
    vec3 deep = vec3(0.03, 0.14, 0.26);
    vec3 lagoonCol = vec3(0.06, 0.58, 0.62);
    vec3 shallow = vec3(0.42, 0.84, 0.74);
    vec3 water = mix(deep, lagoonCol, lagoon);
    water = mix(water, shallow, clamp(shore * 1.15, 0.0, 1.0));
    float glitter = 0.5 + 0.5 * sin(xz.x * 0.31 + xz.y * 0.22 + uTime * 0.6);
    water += vec3(0.03, 0.07, 0.06) * lagoon * glitter;

    vec3 V = normalize(cameraPosition - vWorld);
    vec3 H = normalize(V + uSunDir);
    float spec = pow(max(dot(N, H), 0.0), mix(80.0, 260.0, lagoon));
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    vec3 R = reflect(-V, N);
    float skyH = clamp(R.y, 0.0, 1.0);
    vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, skyH));
    float sunGlint = pow(max(dot(R, uSunDir), 0.0), 360.0);
    sky += vec3(1.0, 0.86, 0.58) * sunGlint * 1.35;

    vec3 col = mix(water, sky, fres * mix(0.7, 0.48, lagoon) + 0.05);
    col += vec3(1.0, 0.95, 0.82) * spec * mix(0.5, 0.18, shore);
    float cau = sin(xz.x * 0.85 + uTime * 1.3) * sin(xz.y * 0.72 - uTime * 1.1);
    col += vec3(0.16, 0.28, 0.24) * lagoon * shore * cau * cau * 0.22;

    float foam = shore * (0.2 + 0.35 * crest);
    foam += reef * 0.72;
    col = mix(col, vec3(0.94, 0.97, 0.96), clamp(foam, 0.0, 0.8));

    float dist = length(cameraPosition - vWorld);
    col = mix(col, uFog, smoothstep(180.0, 1100.0, dist));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const skyVertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vDir = world.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const skyFragmentShader = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.62, h));
    vec3 below = vec3(0.45, 0.62, 0.66);
    col = mix(below, col, smoothstep(-0.18, 0.04, h));
    float glow = pow(max(dot(d, uSunDir), 0.0), 6.0);
    float disk = pow(max(dot(d, uSunDir), 0.0), 900.0);
    col += vec3(1.0, 0.62, 0.32) * glow * 0.42;
    col += vec3(1.0, 0.93, 0.75) * disk * 1.8;
    float haze = pow(1.0 - max(h, 0.0), 3.0);
    col = mix(col, uHorizon, haze * 0.35);
    gl_FragColor = vec4(col, 1.0);
  }
`;
