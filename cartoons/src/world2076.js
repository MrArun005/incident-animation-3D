// "The World in 2076": a 25 second three.js motion piece. A year counter runs 2026 -> 2076, then Earth from
// orbit (city lights on the night side, deserts turning green, a solar ring, maglev arcs drawing between
// cities), a dive through the clouds into a floating coastal megacity at golden hour (hex districts on the sea,
// towers with vertical-forest bands, offshore wind, solar fields, maglev lines, air-taxi swarms), up the space
// elevator, back out to Earth, the ring and a lit Moon base, and the title. Bloom + ACES. 1920x1080, 30 fps.
const W = 1920, H = 1080, FPS = 30, DURATION = 25;
await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/three-r147.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
const T = window.THREE;
const V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const seg = (t, a, b) => ease(clamp((t - a) / (b - a), 0, 1));
const win = (t, a, b, f = 0.5) => seg(t, a, a + f) * (1 - seg(t, b - f, b));
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// the year on screen; the score's ticks use the same curve (tools/audio-world2076.mjs)
export const yearAt = (t) => 2026 + Math.floor(50 * Math.pow(clamp(t / 2.8, 0, 1), 2.2) + 1e-6);

// ---- renderer and post ------------------------------------------------------------------------------------
const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
const renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputEncoding = T.LinearEncoding; renderer.toneMapping = T.NoToneMapping;
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(38, W / H, 0.05, 6000);
const rt = new T.WebGLRenderTarget(W, H, { type: T.HalfFloatType, samples: 4 });
const composer = new T.EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new T.RenderPass(scene, camera));
const bloom = new T.UnrealBloomPass(new T.Vector2(W, H), 0.85, 0.55, 0.9); composer.addPass(bloom);
[bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical].forEach((t) => { t.texture.type = T.HalfFloatType; t.dispose(); });
const Final = new T.ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 0 }, uFlash: { value: 0 }, uExposure: { value: 1 }, uWarm: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uFade, uFlash, uExposure, uWarm; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float ca = 0.0022 * length(d) * 2.0;
      vec3 c = vec3(texture2D(tDiffuse, vUv + d*ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d*ca).b);
      c = aces(c * uExposure);
      c *= 1.0 - 0.42 * smoothstep(0.35, 0.95, length(d * vec2(1.0, 0.85)) * 1.25);
      c = pow(c, vec3(1.0/2.2));
      c = mix(c, c * vec3(1.06, 1.0, 0.9), uWarm);
      c += (hash(vUv * 1920.0 + fract(uTime * 7.1)) - 0.5) * 0.025;
      c = mix(c, vec3(1.0, 0.98, 0.95), uFlash);
      gl_FragColor = vec4(c * (1.0 - uFade), 1.0); }`,
});
composer.addPass(Final);
const hudScene = new T.Scene(), hudCam = new T.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -1, 1);
const capCanvas = document.createElement('canvas'); capCanvas.width = W; capCanvas.height = H;
const cx = capCanvas.getContext('2d'), capTex = new T.CanvasTexture(capCanvas);
hudScene.add(new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshBasicMaterial({ map: capTex, transparent: true, depthTest: false })));

// ---- assets ------------------------------------------------------------------------------------------------
const texL = new T.TextureLoader();
const ltex = (f) => new Promise((res) => texL.load(`assets/comingup/${f}`, (t) => { t.encoding = T.sRGBEncoding; res(t); }, undefined, () => res(null)));
const [skyTex, earthTex] = await Promise.all([ltex('sky-2k.jpg'), ltex('planet-earth.jpg')]);
earthTex.anisotropy = 8;

// shared GLSL: value noise
const NOISE = `
  float h3(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
`;

// =============================================================================================================
// SPACE: Earth, atmosphere, clouds, the orbital solar ring, maglev arcs, the Moon and its base, the elevator.
// =============================================================================================================
const space = new T.Group(); scene.add(space);
const R = 10;
const SUN = V3(0.62, 0.22, 0.75).normalize();          // world-space sun direction for the space shots
const latlon = (lat, lon, r = R) => { const ph = (lon + 180) / 360 * Math.PI * 2, th = (90 - lat) / 180 * Math.PI;
  return V3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)).multiplyScalar(r); };
const starDome = new T.Mesh(new T.SphereGeometry(3000, 48, 24), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, color: 0x8a8fa8 }));
space.add(starDome);
const earth = new T.Group(); space.add(earth);
const earthU = { map: { value: earthTex }, sunDir: { value: SUN.clone() }, uGreen: { value: 0 }, uLights: { value: 1 }, uTime: { value: 0 } };
const earthMesh = new T.Mesh(new T.SphereGeometry(R, 128, 64), new T.ShaderMaterial({
  uniforms: earthU,
  vertexShader: `varying vec2 vUv; varying vec3 vN, vW, vP;
    void main(){ vUv = uv; vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform sampler2D map; uniform vec3 sunDir; uniform float uGreen, uLights, uTime; varying vec2 vUv; varying vec3 vN, vW, vP;
    ${NOISE}
    float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
      vec3 day = pow(texture2D(map, vUv).rgb, vec3(2.2));
      float ocean = smoothstep(-0.005, 0.03, day.b - max(day.r, day.g) * 0.9);
      float land = 1.0 - ocean;
      // a greener planet: dry land (red over green) shifts toward green
      float dry = smoothstep(0.0, 0.08, day.r - day.g) * land;
      vec3 green = vec3(day.g * 0.55, day.g * 1.15 + 0.012, day.g * 0.4);
      day = mix(day, green, dry * uGreen * 0.85);
      float d = dot(n, sunDir);
      float lit = smoothstep(-0.08, 0.35, d);
      vec3 col = day * (lit * 1.6 + 0.012);
      // ocean glint
      vec3 r = reflect(-sunDir, n); col += ocean * pow(max(dot(r, v), 0.0), 60.0) * vec3(1.6, 1.3, 0.9) * lit;
      // city lights on the night side: clustered dots on land, warm with a few cyan grids (it is 2076)
      vec2 g = vUv * vec2(900.0, 450.0); vec2 cell = floor(g);
      float cl = smoothstep(0.52, 0.78, fbm(vP * 0.9)) ;
      float dots = step(0.86 - cl * 0.35, hash2(cell)) * smoothstep(0.5, 0.1, length(fract(g) - 0.5));
      float glow = cl * 0.25;
      float night = smoothstep(0.12, -0.25, d);
      vec3 lc = mix(vec3(1.0, 0.62, 0.28), vec3(0.35, 0.85, 1.0), step(0.8, hash2(cell + 7.0)));
      col += land * night * uLights * (dots * 2.6 + glow * 0.5) * lc * (0.4 + cl);
      // atmosphere rim from inside
      float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
      col += fr * vec3(0.25, 0.5, 1.2) * (smoothstep(-0.3, 0.4, d) * 1.2 + 0.05);
      gl_FragColor = vec4(col, 1.0); }`,
}));
earth.add(earthMesh);
const cloudMesh = new T.Mesh(new T.SphereGeometry(R * 1.012, 96, 48), new T.ShaderMaterial({
  uniforms: { sunDir: earthU.sunDir, uTime: earthU.uTime }, transparent: true, depthWrite: false,
  vertexShader: `varying vec3 vN, vW, vP; void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 sunDir; uniform float uTime; varying vec3 vN, vW, vP; ${NOISE}
    void main(){ vec3 n = normalize(vN); float d = dot(n, sunDir);
      float c = fbm(vP * 0.42 + vec3(uTime * 0.01, 0.0, 0.0)); c = smoothstep(0.5, 0.78, c);
      float a = c * 0.85 * smoothstep(-0.25, 0.1, d);
      gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * (smoothstep(-0.1, 0.5, d) * 1.4 + 0.02), a); }`,
}));
earth.add(cloudMesh);
const atmo = new T.Mesh(new T.SphereGeometry(R * 1.06, 96, 48), new T.ShaderMaterial({
  uniforms: { sunDir: earthU.sunDir }, transparent: true, depthWrite: false, side: T.BackSide, blending: T.AdditiveBlending,
  vertexShader: `varying vec3 vN, vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 sunDir; varying vec3 vN, vW;
    void main(){ vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
      float rim = pow(clamp(1.0 + dot(n, v) * 1.0, 0.0, 1.0), 0.0) ; float f = pow(max(-dot(n, v), 0.0), 1.0);
      float k = smoothstep(0.0, 0.5, f) * (1.0 - smoothstep(0.5, 1.0, f) * 0.6);
      float s = smoothstep(-0.35, 0.5, dot(n, sunDir));
      gl_FragColor = vec4(vec3(0.3, 0.6, 1.4) * k * (0.08 + s * 1.3) * rim, 1.0); }`,
}));
earth.add(atmo);
// Earth spins so the shot has India/Arabian Sea near the terminator, sun from the east
earth.rotation.y = -0.4;
earth.updateMatrixWorld(true);
const onEarth = (lat, lon, r = R) => latlon(lat, lon, r).applyMatrix4(earth.matrixWorld);

// the orbital solar ring: a glowing band, thousands of collector panels, a few stations
const RING_R = 13.2, ringTilt = new T.Group(); ringTilt.rotation.set(0.38, 0, -0.22); space.add(ringTilt);
const ringSpin = new T.Group(); ringTilt.add(ringSpin);
ringSpin.add(new T.Mesh(new T.TorusGeometry(RING_R, 0.025, 8, 360), new T.MeshBasicMaterial({ color: new T.Color(0.4, 1.6, 2.4) })));
ringSpin.add(new T.Mesh(new T.TorusGeometry(RING_R + 0.18, 0.008, 6, 360), new T.MeshBasicMaterial({ color: new T.Color(1.2, 0.9, 0.5) })));
ringSpin.add(new T.Mesh(new T.TorusGeometry(RING_R - 0.18, 0.008, 6, 360), new T.MeshBasicMaterial({ color: new T.Color(1.2, 0.9, 0.5) })));
const sunLightS = new T.DirectionalLight(0xfff2e0, 3.2); sunLightS.position.copy(SUN).multiplyScalar(100); space.add(sunLightS);
space.add(new T.AmbientLight(0x223355, 0.35));
{
  const N = 900, panel = new T.InstancedMesh(new T.BoxGeometry(0.16, 0.012, 0.3), new T.MeshStandardMaterial({ color: 0x1b2f6a, metalness: 0.7, roughness: 0.22, emissive: 0x0a1630, emissiveIntensity: 0.6 }), N);
  const m = new T.Matrix4(), q = new T.Quaternion(), r = rng(5);
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, side = i % 2 ? 0.2 : -0.2;
    q.setFromEuler(new T.Euler(0.5 + r() * 0.1, -a, 0)); m.compose(V3(Math.cos(a) * RING_R, Math.sin(a) * RING_R, side).applyAxisAngle(V3(1, 0, 0), 0), q, V3(1, 1, 1));
    // the torus lies in the XY plane: put panels there
    m.compose(V3(Math.cos(a) * (RING_R + side), Math.sin(a) * (RING_R + side), 0), new T.Quaternion().setFromEuler(new T.Euler(0, 0.6 + r() * 0.15, a)), V3(1, 1, 1));
    panel.setMatrixAt(i, m); }
  ringSpin.add(panel);
  const stMat = new T.MeshStandardMaterial({ color: 0xdfe6f0, metalness: 0.4, roughness: 0.35, emissive: 0x335577, emissiveIntensity: 0.3 });
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, st = new T.Group();
    st.add(new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 0.7, 16), stMat));
    st.add(new T.Mesh(new T.TorusGeometry(0.32, 0.04, 8, 32), stMat));
    const beacon = new T.Mesh(new T.SphereGeometry(0.05, 8, 8), new T.MeshBasicMaterial({ color: new T.Color(3, 2.2, 1.2) })); beacon.position.y = 0.4; st.add(beacon);
    st.position.set(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0); st.rotation.z = a; ringSpin.add(st); }
}
// maglev / hyperloop arcs between cities, drawn on progressively
const CITIES = [[19.1, 72.9], [28.6, 77.2], [25.2, 55.3], [30.0, 31.2], [-1.3, 36.8], [6.5, 3.4], [51.5, -0.1], [48.9, 2.35], [41.0, 29.0], [55.7, 37.6], [1.35, 103.8], [13.7, 100.5], [22.3, 114.2], [31.2, 121.5], [35.7, 139.7], [-33.9, 18.4], [40.7, -74.0], [-23.5, -46.6], [-33.9, 151.2], [39.9, 116.4]];
const LINKS = [[0, 1], [0, 2], [2, 3], [3, 8], [8, 9], [6, 7], [7, 8], [2, 4], [4, 15], [5, 3], [0, 10], [10, 11], [11, 12], [12, 13], [13, 14], [13, 19], [6, 16], [16, 17], [10, 18], [1, 19], [5, 15], [9, 19]];
const arcs = LINKS.map(([a, b], i) => {
  const A = latlon(...CITIES[a]).normalize(), Bv = latlon(...CITIES[b]).normalize(), ang = A.angleTo(Bv), pts = [];
  for (let k = 0; k <= 48; k++) { const s = k / 48, p = A.clone().lerp(Bv, s).normalize(); pts.push(p.multiplyScalar(R * (1.006 + 0.11 * ang * Math.sin(Math.PI * s)))); }
  const geo = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 64, 0.018, 5, false);
  const col = i % 3 === 0 ? new T.Color(2.6, 0.9, 2.2) : new T.Color(0.5, 2.0, 2.8);
  const mesh = new T.Mesh(geo, new T.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false }));
  mesh.userData = { count: geo.index.count, delay: (i % 11) * 0.17 + Math.floor(i / 11) * 0.25 };
  earth.add(mesh); return mesh;
});
const cityDots = new T.InstancedMesh(new T.SphereGeometry(0.045, 8, 6), new T.MeshBasicMaterial({ color: new T.Color(3, 2.4, 1.6) }), CITIES.length);
CITIES.forEach((c, i) => cityDots.setMatrixAt(i, new T.Matrix4().makeTranslation(...latlon(...c, R * 1.004).toArray()))); earth.add(cityDots);
// the space elevator from the Mumbai megacity (lat 19.1, lon 72.9) up through the ring to a counterweight station
const MUM = latlon(19.1, 72.9).normalize();
const tether = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 7.5, 6, 1, true), new T.MeshBasicMaterial({ color: new T.Color(1.6, 1.8, 2.2) }));
tether.position.copy(MUM.clone().multiplyScalar(R + 3.75)); tether.quaternion.setFromUnitVectors(V3(0, 1, 0), MUM); earth.add(tether);
const counter = new T.Mesh(new T.OctahedronGeometry(0.16, 0), new T.MeshStandardMaterial({ color: 0xe8edf5, metalness: 0.5, roughness: 0.3, emissive: 0x4488aa, emissiveIntensity: 0.6 }));
counter.position.copy(MUM.clone().multiplyScalar(R + 7.5)); earth.add(counter);
const climbers = Array.from({ length: 3 }, () => { const c = new T.Mesh(new T.SphereGeometry(0.03, 8, 6), new T.MeshBasicMaterial({ color: new T.Color(3, 2.6, 1.8) })); earth.add(c); return c; });
// the Moon, with a lit base
const MOON_POS = V3(-9.5, 3.6, 26);
const moon = new T.Mesh(new T.SphereGeometry(2.7, 96, 48), new T.ShaderMaterial({
  uniforms: { sunDir: earthU.sunDir, uOn: { value: 0 }, uBase: { value: V3(1, 0, 0) } },
  vertexShader: `varying vec3 vN, vW, vP; void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 sunDir; uniform float uOn; uniform vec3 uBase; varying vec3 vN, vW, vP; ${NOISE}
    float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){ vec3 n = normalize(vN); float d = dot(n, sunDir);
      float m = fbm(vP * 1.6); float mare = smoothstep(0.42, 0.62, fbm(vP * 0.5 + 3.0));
      vec3 alb = vec3(0.2, 0.197, 0.193) * (0.75 + 0.5 * m - 0.45 * mare);
      vec3 col = alb * (smoothstep(-0.05, 0.6, d) * 1.5 + 0.004);
      // a base: lit domes and grid lines near the terminator, on the side facing the camera
      float bd = acos(clamp(dot(n, normalize(uBase)), -1.0, 1.0));
      vec2 g = vec2(atan(vP.z, vP.x), asin(clamp(vP.y / 2.7, -1.0, 1.0))) * 70.0;
      float dots = step(0.84, hash2(floor(g))) * smoothstep(0.45, 0.1, length(fract(g) - 0.5));
      float base = smoothstep(0.45, 0.05, bd);
      float lines = (smoothstep(0.08, 0.0, abs(fract(g.x / 6.0) - 0.5) - 0.42) + smoothstep(0.08, 0.0, abs(fract(g.y / 6.0) - 0.5) - 0.42)) * smoothstep(0.22, 0.0, bd);
      col += uOn * (0.35 + 0.65 * smoothstep(0.25, -0.2, d)) * (base * dots * 3.0 * vec3(1.0, 0.75, 0.45) + lines * 0.5 * vec3(0.4, 0.9, 1.3) + smoothstep(0.09, 0.0, bd) * vec3(2.4, 1.8, 1.2));
      float fr = pow(1.0 - max(dot(n, normalize(cameraPosition - vW)), 0.0), 4.0); col += fr * 0.02;
      gl_FragColor = vec4(col, 1.0); }`,
}));
moon.position.copy(MOON_POS); moon.rotation.y = 2.2; space.add(moon); moon.updateMatrixWorld(true);
moon.material.uniforms.uBase.value.copy(V3(-2, 7, 42).sub(MOON_POS).normalize().add(SUN.clone().multiplyScalar(-0.25)).normalize());

// =============================================================================================================
// CITY: a floating coastal megacity at golden hour.
// =============================================================================================================
const city = new T.Group(); scene.add(city);
const CSUN = V3(-0.55, 0.13, -0.82).normalize();
const SKY_GLSL = `
  vec3 skyCol(vec3 d, vec3 sunD){
    float y = d.y;
    vec3 hor = vec3(0.82, 0.42, 0.24), mid = vec3(0.36, 0.30, 0.46), zen = vec3(0.05, 0.09, 0.24);
    vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, y)); c = mix(c, zen, smoothstep(0.12, 0.7, y));
    c = mix(c, vec3(0.22, 0.16, 0.2), smoothstep(0.0, -0.2, y));
    float s = max(dot(d, sunD), 0.0);
    c += vec3(1.6, 0.7, 0.3) * pow(s, 24.0) * 0.25 + vec3(2.0, 1.2, 0.6) * pow(s, 160.0) * 0.9 + vec3(30.0, 20.0, 12.0) * smoothstep(0.99965, 0.9999, s);
    return c; }`;
const FOG_GLSL = `vec3 fogIt(vec3 c, vec3 w){ float dist = length(w - cameraPosition); vec3 d = normalize(w - cameraPosition);
    float f = 1.0 - exp(-dist * 0.0009); vec3 fc = skyCol(normalize(vec3(d.x, max(d.y, 0.0) * 0.4 + 0.015, d.z)), uSun); return mix(c, fc * 0.72, f * 0.85); }`;
const cityU = { uSun: { value: CSUN }, uTime: { value: 0 } };
city.add(new T.Mesh(new T.SphereGeometry(5000, 48, 24), new T.ShaderMaterial({
  uniforms: cityU, side: T.BackSide, depthWrite: false,
  vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 uSun; uniform float uTime; varying vec3 vD; ${SKY_GLSL} ${NOISE}
    void main(){ vec3 d = normalize(vD); vec3 c = skyCol(d, uSun);
      // high streaky clouds lit from below
      vec2 p = d.xz / max(d.y + 0.08, 0.02); float cl = smoothstep(0.55, 0.85, fbm(vec3(p * vec2(0.6, 2.2) + vec2(uTime * 0.01, 0.0), 1.0)));
      c = mix(c, vec3(1.4, 0.75, 0.55) * (0.6 + 0.6 * pow(max(dot(d, uSun), 0.0), 3.0)), cl * smoothstep(0.02, 0.15, d.y) * 0.55);
      gl_FragColor = vec4(c, 1.0); }`,
})));
const sea = new T.Mesh(new T.PlaneGeometry(9000, 9000, 1, 1).rotateX(-Math.PI / 2), new T.ShaderMaterial({
  uniforms: cityU,
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 uSun; uniform float uTime; varying vec3 vW; ${SKY_GLSL} ${FOG_GLSL}
    vec2 wv(vec2 p, vec2 dir, float k, float a, float sp){ float ph = dot(p, dir) * k + uTime * sp; return dir * (a * k * cos(ph)); }
    void main(){ vec2 p = vW.xz; vec2 g = vec2(0.0);
      g += wv(p, normalize(vec2(0.8, 0.6)), 0.08, 0.35, 1.3); g += wv(p, normalize(vec2(-0.3, 1.0)), 0.17, 0.12, 1.9);
      g += wv(p, normalize(vec2(1.0, -0.2)), 0.41, 0.04, 2.7); g += wv(p, normalize(vec2(0.2, 0.9)), 0.93, 0.016, 3.9);
      g += wv(p, normalize(vec2(-0.9, 0.4)), 2.1, 0.006, 5.3);
      vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
      vec3 v = normalize(cameraPosition - vW); vec3 r = reflect(-v, n); r.y = abs(r.y);
      float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
      vec3 deep = vec3(0.015, 0.05, 0.075);
      vec3 c = mix(deep, skyCol(r, uSun), fres);
      c += vec3(3.0, 1.7, 0.8) * pow(max(dot(r, uSun), 0.0), 220.0) * 3.0;
      gl_FragColor = vec4(fogIt(c, vW), 1.0); }`,
}));
city.add(sea);

// layout: one central hex district with the elevator, six around it, a mainland skyline behind
const PLATS = [{ x: 0, z: 0, r: 52 }];
for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3, d = k % 2 ? 128 : 118; PLATS.push({ x: Math.cos(a) * d, z: Math.sin(a) * d - 10, r: k % 2 ? 36 : 42 }); }
// the camera path is defined first so the layout can leave a clear corridor for it
// keyframes at equal time steps (9, 10.67 ... 19 s), sampled by knot (getPoint), not arc length
const CPATH = new T.CatmullRomCurve3([V3(70, 95, 440), V3(38, 66, 260), V3(14, 46, 150), V3(-8, 40, 80), V3(-16, 42, 30), V3(-2, 75, 16), V3(30, 330, 120)], false, 'catmullrom', 0.5);
const CLOOK = new T.CatmullRomCurve3([V3(0, 50, -50), V3(-6, 50, -40), V3(-14, 46, -40), V3(-26, 46, -60), V3(-34, 52, -70), V3(-30, 60, -110), V3(-20, 0, -170)], false, 'catmullrom', 0.5);
const pathPts = Array.from({ length: 401 }, (_, i) => CPATH.getPoint(i / 400));
const clearAt = (x, z, rad) => { let h = Infinity; for (const p of pathPts) { const d = Math.hypot(p.x - x, p.z - z); if (d < rad + 12) h = Math.min(h, p.y - 10); } return h; };

const TOWER_VS = `attribute vec4 aSeed; varying vec3 vW, vN, vL; varying vec4 vS; varying vec2 vF;
  void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vS = aSeed;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vL = position * sc; vF = vec2(sc.y, 0.0);
    gl_Position = projectionMatrix * viewMatrix * w; }`;
const towerMat = new T.ShaderMaterial({
  uniforms: cityU,
  vertexShader: TOWER_VS,
  fragmentShader: `uniform vec3 uSun; uniform float uTime; varying vec3 vW, vN, vL; varying vec4 vS; varying vec2 vF; ${SKY_GLSL} ${FOG_GLSL} ${NOISE}
    float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
      float u = abs(n.x) > 0.5 ? vL.z : vL.x; float y = vL.y;          // local face coordinates in world units
      float top = step(0.9, n.y);
      float cw = 1.4 + vS.y * 0.8, chh = 1.6;
      vec2 cell = vec2(u / cw, y / chh), f = fract(cell), id = floor(cell);
      float frame = step(0.12, f.x) * step(f.x, 0.88) * step(0.18, f.y) * step(f.y, 0.86);
      // fins: some towers are all-glass curtain walls with vertical mullions
      float glassy = step(0.55, vS.z);
      float wnd = mix(frame, step(0.08, f.x) * step(f.x, 0.92), glassy);
      float sunL = max(dot(n, uSun), 0.0);
      vec3 wall = mix(vec3(0.7, 0.66, 0.62), vec3(0.5, 0.56, 0.62), vS.x) * (0.1 + sunL * 1.15 * vec3(1.25, 0.82, 0.55) + max(n.y, 0.0) * 0.1);
      vec3 r = reflect(-v, n); r.y = abs(r.y) * 0.6 + 0.02;
      float fres = 0.08 + 0.9 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
      vec3 glass = mix(vec3(0.02, 0.035, 0.05), skyCol(r, uSun) * 0.7, fres) + vec3(0.02, 0.04, 0.05) * sunL;
      float on = step(0.86, hash2(id + vS.xy * 91.0));
      float aa = clamp(length(fwidth(cell)) * 3.0 - 0.15, 0.0, 1.0);
      wnd = mix(wnd, 0.6, aa); on = mix(on, 0.14, aa);
      glass += on * vec3(1.4, 0.95, 0.55) * 0.55;
      vec3 c = mix(wall, glass, wnd * (1.0 - top));
      // vertical-forest bands: every few floors a planted terrace
      float bandEvery = 4.0 + floor(vS.w * 4.0); float fl = floor(y / chh);
      float band = step(mod(fl, bandEvery), 0.0) * step(0.25, vS.w) * (1.0 - top);
      float leaf = fbm(vec3(u * 1.7, y * 1.7, vS.x * 10.0));
      vec3 green = vec3(0.12, 0.32, 0.07) * (0.5 + leaf) * (0.25 + sunL * 2.2 * vec3(1.2, 0.9, 0.6));
      float hang = band + step(mod(fl - 1.0, bandEvery), 0.0) * step(0.25, vS.w) * step(f.y, 0.55 * leaf + 0.1) * (1.0 - top);
      c = mix(c, green, clamp(hang, 0.0, 1.0) * step(0.35, leaf + band * 0.3));
      // roofs: solar skin, a garden on some, a crown light at the edge
      vec3 roof = mix(vec3(0.03, 0.06, 0.14) + skyCol(r, uSun) * 0.15, vec3(0.15, 0.34, 0.09), step(0.6, vS.w));
      c = mix(c, roof, top);
      float crown = smoothstep(vF.x / 2.0 - 0.35, vF.x / 2.0 - 0.05, y) * (1.0 - top);
      c += crown * mix(vec3(0.4, 1.6, 2.4), vec3(2.4, 1.2, 0.5), step(0.5, vS.y)) * 0.8;
      gl_FragColor = vec4(fogIt(c, vW), 1.0); }`,
});
// towers: boxes and cylinders; base at y=0 means the geometry is centred and translated up in the matrix
const boxG = new T.BoxGeometry(1, 1, 1), cylG = new T.CylinderGeometry(0.5, 0.5, 1, 20, 1);
const towers = { box: [], cyl: [] };
const rT = rng(2076);
function addTower(x, z, w, d, h, kind = rT() < 0.25 ? 'cyl' : 'box') {
  const lim = clearAt(x, z, Math.max(w, d) / 2); if (lim < h) h = lim; if (h < 8) return;
  towers[kind].push({ x, z, w, d, h, ry: kind === 'box' ? (rT() < 0.6 ? 0 : rT() * Math.PI) : 0, s: [rT(), rT(), rT(), rT()] });
}
const PLAT_Y = 2.2;
for (const P of PLATS) {
  const centre = P === PLATS[0];
  for (let gx = -P.r; gx <= P.r; gx += 11) for (let gz = -P.r; gz <= P.r; gz += 11) {
    const x = P.x + gx + (rT() - 0.5) * 4, z = P.z + gz + (rT() - 0.5) * 4, dd = Math.hypot(x - P.x, z - P.z);
    if (dd > P.r * 0.8 || (centre && dd < 16) || rT() < 0.18) continue;
    const core = 1 - dd / P.r, h = (centre ? 40 : 22) + core * (centre ? 110 : 70) * (0.5 + rT());
    const w = 5 + rT() * 4, d = 5 + rT() * 4;
    addTower(x, z, w, d, h);
  }
}
// the mainland skyline far behind: dense, tall, fogged
for (let i = 0; i < 520; i++) {
  const x = (rT() - 0.5) * 1700, z = -260 - rT() * 650, core = Math.exp(-((x / 520) ** 2));
  addTower(x, z, 9 + rT() * 14, 9 + rT() * 14, 30 + core * 160 * (0.4 + rT()) + rT() * 30);
}
function towerMesh(geo, list) {
  const m = new T.InstancedMesh(geo, towerMat, list.length), seeds = new Float32Array(list.length * 4), M = new T.Matrix4(), q = new T.Quaternion();
  list.forEach((o, i) => { q.setFromAxisAngle(V3(0, 1, 0), o.ry); M.compose(V3(o.x, PLAT_Y + o.h / 2, o.z), q, V3(o.w, o.h, o.d)); m.setMatrixAt(i, M); seeds.set(o.s, i * 4); });
  geo.setAttribute('aSeed', new T.InstancedBufferAttribute(seeds, 4)); m.frustumCulled = false; return m;
}
city.add(towerMesh(boxG, towers.box), towerMesh(cylG, towers.cyl));
// standard-lit parts: platforms, turbines, trains, the elevator
const sunL = new T.DirectionalLight(0xffc89a, 2.6); sunL.position.copy(CSUN).multiplyScalar(500); city.add(sunL);
city.add(new T.HemisphereLight(0x6d7fb8, 0x6a4a3a, 0.75));
city.fog = null;
const platMat = new T.MeshStandardMaterial({ color: 0xc9c4bc, roughness: 0.75, metalness: 0.1 });
const parkMat = new T.MeshStandardMaterial({ color: 0x3f6a2a, roughness: 0.95 });
const edgeMat = new T.MeshBasicMaterial({ color: new T.Color(0.6, 2.2, 3.0) });
for (const P of PLATS) {
  const slab = new T.Mesh(new T.CylinderGeometry(P.r, P.r * 0.92, 4.4, 6), platMat); slab.position.set(P.x, 0, P.z); slab.rotation.y = Math.PI / 6; city.add(slab);
  const park = new T.Mesh(new T.CylinderGeometry(P.r * 0.3, P.r * 0.3, 0.3, 6), parkMat); park.position.set(P.x, PLAT_Y + 0.1, P.z); park.rotation.y = Math.PI / 6; if (P !== PLATS[0]) city.add(park);
  const edge = new T.Mesh(new T.TorusGeometry(P.r * 1.0, 0.35, 4, 6), edgeMat); edge.rotation.x = Math.PI / 2; edge.rotation.z = Math.PI / 6; edge.position.set(P.x, PLAT_Y, P.z); city.add(edge);
}
// floating solar fields between the districts
{
  const list = [], r = rng(9);
  for (let i = 0; i < 1400; i++) { const a = r() * Math.PI * 2, d = 175 + r() * 140, x = Math.cos(a) * d, z = Math.sin(a) * d * 0.7 + 60;
    if (z < -60) continue; list.push([Math.round(x / 7) * 7, Math.round(z / 5) * 5]); }
  const uniq = [...new Map(list.map((p) => [p.join(','), p])).values()];
  const solar = new T.InstancedMesh(new T.BoxGeometry(6.2, 0.25, 4.2), new T.MeshStandardMaterial({ color: 0x0d1d44, metalness: 0.85, roughness: 0.16, emissive: 0x050b18 }), uniq.length);
  const M = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(-0.12, 0, 0));
  uniq.forEach(([x, z], i) => { M.compose(V3(x, 0.6, z), q, V3(1, 1, 1)); solar.setMatrixAt(i, M); });
  city.add(solar);
}
// offshore wind
const turbines = [];
{
  const wMat = new T.MeshStandardMaterial({ color: 0xf2f0ec, roughness: 0.45, metalness: 0.1 }), r = rng(31);
  for (let i = 0; i < 28; i++) {
    const x = -420 + (i % 7) * 150 + (r() - 0.5) * 40, z = 330 + Math.floor(i / 7) * 150 + (r() - 0.5) * 40;
    if (Math.abs(x - 40) < 60 && z < 520) continue;
    const g = new T.Group(); g.position.set(x, 0, z);
    const mast = new T.Mesh(new T.CylinderGeometry(0.9, 1.6, 70, 12), wMat); mast.position.y = 35; g.add(mast);
    const nac = new T.Mesh(new T.BoxGeometry(6, 3, 3), wMat); nac.position.set(0, 71, 0); g.add(nac);
    const hub = new T.Group(); hub.position.set(-3.2, 71, 0); g.add(hub);
    for (let b = 0; b < 3; b++) { const bl = new T.Mesh(new T.BoxGeometry(0.6, 34, 1.8), wMat); bl.geometry.translate(0, 17, 0); bl.rotation.x = b * Math.PI * 2 / 3; hub.add(bl); }
    const lamp = new T.Mesh(new T.SphereGeometry(0.7, 8, 6), new T.MeshBasicMaterial({ color: new T.Color(4, 0.3, 0.2) })); lamp.position.set(1.5, 73, 0); g.add(lamp);
    g.rotation.y = Math.atan2(CSUN.z, CSUN.x) * 0 + 0.5; hub.userData.ph = r() * 6; turbines.push(hub); city.add(g);
  }
}
// maglev lines between the districts: a white beam with a glowing dash stripe, and trains running on them
const tracks = [];
const dashMat = new T.ShaderMaterial({
  uniforms: cityU, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ float d = step(0.5, fract(vUv.x * 60.0 - uTime * 3.0)); gl_FragColor = vec4(vec3(0.5, 2.0, 2.8) * (0.25 + d * 1.6), 1.0); }`,
});
const beamMat = new T.MeshStandardMaterial({ color: 0xe9e9ee, roughness: 0.4, metalness: 0.3 });
const trainMat = new T.MeshStandardMaterial({ color: 0xf6f6f8, roughness: 0.25, metalness: 0.5, emissive: 0x223344 });
for (let k = 1; k <= 6; k++) {
  const A = PLATS[0], Bp = PLATS[k], C = PLATS[k % 6 + 1];
  for (const [p, q, hgt] of [[A, Bp, 16], [Bp, C, 11]]) {
    const pa = V3(p.x, hgt, p.z), pb = V3(q.x, hgt, q.z), mid = pa.clone().lerp(pb, 0.5); mid.y += 6;
    const curve = new T.CatmullRomCurve3([pa, mid, pb]);
    city.add(new T.Mesh(new T.TubeGeometry(curve, 40, 0.9, 6, false), beamMat));
    const dc = new T.CatmullRomCurve3(curve.getPoints(40).map((v) => v.clone().add(V3(0, 1.0, 0))));
    city.add(new T.Mesh(new T.TubeGeometry(dc, 80, 0.28, 5, false), dashMat));
    const tr = new T.Mesh(new T.CapsuleGeometry(1.2, 22, 4, 8).rotateZ(Math.PI / 2), trainMat); city.add(tr);
    tracks.push({ curve: dc, train: tr, off: rT(), dir: rT() < 0.5 ? 1 : -1 });
  }
}
// the space elevator: a glowing tether from the central plaza into the sky, with climbers
const elev = new T.Group(); city.add(elev);
elev.add(new T.Mesh(new T.CylinderGeometry(9, 12, 14, 6), new T.MeshStandardMaterial({ color: 0xdedad2, roughness: 0.5, metalness: 0.2 })).translateY(PLAT_Y + 7));
elev.add(new T.Mesh(new T.TorusGeometry(10.5, 0.5, 6, 6), edgeMat).rotateX(Math.PI / 2).translateZ(-(PLAT_Y + 14.2)));
const cable = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 6000, 8, 1, true).translate(0, 3000, 0), new T.MeshBasicMaterial({ color: new T.Color(1.4, 1.7, 2.2) }));
cable.position.y = PLAT_Y + 14; elev.add(cable);
const pods = Array.from({ length: 5 }, (_, i) => { const p = new T.Mesh(new T.CylinderGeometry(2.6, 2.6, 4, 6), new T.MeshStandardMaterial({ color: 0xf0f0f0, emissive: 0xffaa66, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.4 })); p.userData.k = i; elev.add(p); return p; });
// air taxis and drones: one instanced swarm on looping lanes
const NDR = 700;
const drones = new T.InstancedMesh(new T.BoxGeometry(1.5, 0.4, 0.8), new T.MeshBasicMaterial({ color: 0xffffff }), NDR);
const lanes = []; { const r = rng(77), cols = [[1.8, 1.7, 1.6], [0.5, 1.6, 2.2], [2.2, 1.1, 0.45], [1.9, 0.6, 1.8]];
  for (let i = 0; i < NDR; i++) { const ring = r() < 0.7; const c = cols[Math.floor(r() * (r() < 0.6 ? 1.6 : 4))];
    lanes.push({ ring, cx: ring ? 0 : (r() - 0.5) * 500, cz: ring ? 0 : -120 + (r() - 0.5) * 500, rad: ring ? 30 + r() * 200 : 0, y: 22 + r() * 110 + (r() < 0.2 ? 120 : 0),
      sp: (r() < 0.5 ? 1 : -1) * (14 + r() * 26), ph: r() * Math.PI * 2, ang: r() * Math.PI * 2, len: 600 });
    drones.setColorAt(i, new T.Color(...c)); } }
drones.frustumCulled = false; city.add(drones);

// =============================================================================================================
// HUD
// =============================================================================================================
const FONT = '"Liberation Sans", "DejaVu Sans", Arial, sans-serif';
function text(s, x, y, size, { alpha = 1, weight = 400, spacing = 0, color = '255,255,255', align = 'center', glow = 0 } = {}) {
  if (alpha <= 0.001) return;
  cx.save(); cx.font = `${weight} ${size}px ${FONT}`; cx.letterSpacing = `${spacing}px`; cx.textAlign = align; cx.textBaseline = 'middle';
  if (glow) { cx.shadowColor = `rgba(120,220,255,${0.6 * alpha})`; cx.shadowBlur = glow; }
  cx.fillStyle = `rgba(${color},${alpha})`; cx.fillText(s, x, y); cx.restore();
}
function caption(s, t, a, b, sub) {
  const k = win(t, a, b, 0.55); if (k <= 0) return;
  const rise = (1 - seg(t, a, a + 0.8)) * 18, y = H * 0.83 + rise;
  cx.save(); cx.globalAlpha = k * 0.55; const gr = cx.createLinearGradient(0, H * 0.7, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.75)'); cx.fillStyle = gr; cx.fillRect(0, H * 0.7, W, H * 0.3); cx.restore();
  const lw = 140 * seg(t, a + 0.1, a + 0.9);
  cx.save(); cx.globalAlpha = k; cx.fillStyle = 'rgb(120,220,255)'; cx.fillRect(W / 2 - lw / 2, y - 44, lw, 2); cx.restore();
  text(s.toUpperCase(), W / 2, y, 50, { alpha: k, spacing: 9, weight: 700 });
  if (sub) text(sub, W / 2, y + 48, 24, { alpha: k * 0.8, spacing: 4, color: '200,225,240' });
}
function hud(t) {
  cx.clearRect(0, 0, W, H);
  // 0-3 s: the year counter
  if (t < 3.4) {
    const k = 1 - seg(t, 2.95, 3.35), y = yearAt(t), big = 300 + 40 * seg(t, 2.6, 2.9);
    text('FIFTY YEARS FROM NOW', W / 2, H / 2 - 210, 28, { alpha: k * seg(t, 0.15, 0.7), spacing: 14, color: '170,215,240' });
    text(String(y), W / 2, H / 2 + 20, big, { alpha: k, weight: 700, spacing: 6, glow: 40 * seg(t, 2.3, 2.85) });
    const p = clamp((y - 2026) / 50, 0, 1);
    cx.save(); cx.globalAlpha = k * 0.9; cx.fillStyle = 'rgba(255,255,255,0.18)'; cx.fillRect(W / 2 - 360, H / 2 + 200, 720, 3); cx.fillStyle = 'rgb(120,220,255)'; cx.fillRect(W / 2 - 360, H / 2 + 200, 720 * p, 3); cx.restore();
    text('2026', W / 2 - 360, H / 2 + 235, 22, { alpha: k * 0.7, align: 'left', spacing: 3 });
    text('2076', W / 2 + 360, H / 2 + 235, 22, { alpha: k * 0.7, align: 'right', spacing: 3 });
  }
  // the corner tag
  const tg = seg(t, 3.2, 3.9) * (1 - seg(t, 22.6, 23.1));
  text('2076', 70, 70, 34, { alpha: tg * 0.9, align: 'left', weight: 700, spacing: 6 });
  text(t < 8.4 ? 'EARTH · ORBIT' : t < 19.2 ? 'COASTAL MEGACITY · ARABIAN SEA' : 'EARTH–MOON SYSTEM', 72, 106, 17, { alpha: tg * 0.65, align: 'left', spacing: 5, color: '170,215,240' });
  caption('10 billion people · one planet', t, 3.7, 7.9, 'greener, brighter, connected');
  caption('Powered by the sun', t, 9.9, 13.8, 'and the wind, and the tide');
  caption('Cities that rise with the sea', t, 14.2, 18.4, 'floating districts · vertical forests');
  caption('Reaching beyond', t, 19.6, 22.7, 'one elevator ride to orbit · a light on the Moon');
  // title
  const ti = seg(t, 23.0, 23.8);
  if (ti > 0) {
    cx.save(); cx.globalAlpha = ti * 0.5; cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H); cx.restore();
    text('THE WORLD IN', W / 2, H / 2 - 70, 46, { alpha: ti, spacing: 22 + 10 * (1 - ti), color: '200,230,250' });
    text('2076', W / 2, H / 2 + 40, 170, { alpha: ti, weight: 700, spacing: 18 + 30 * (1 - ti), glow: 50 });
    text('imagined, fifty years ahead', W / 2, H / 2 + 150, 26, { alpha: seg(t, 23.5, 24.1), spacing: 6, color: '170,215,240' });
  }
  capTex.needsUpdate = true;
}

// =============================================================================================================
// the cut
// =============================================================================================================
const M4 = new T.Matrix4(), Q = new T.Quaternion();
function frame(t) {
  Final.uniforms.uTime.value = t;
  earthU.uTime.value = t; cityU.uTime.value = t;
  const inCity = t >= 8.95 && t < 19.05;
  space.visible = !inCity; city.visible = inCity;
  bloom.strength = inCity ? 0.7 : 0.95; bloom.threshold = inCity ? 0.92 : 0.82;
  Final.uniforms.uWarm.value = inCity ? 1 : 0;
  Final.uniforms.uFlash.value = Math.max(win(t, 8.45, 9.35, 0.45) * 1.0, win(t, 18.75, 19.3, 0.27) * 0.9, (1 - seg(t, 3.0, 3.35)) * seg(t, 2.85, 3.0) * 0.7);
  Final.uniforms.uFade.value = Math.max(1 - seg(t, 0, 0.35), seg(t, 24.45, 25));
  Final.uniforms.uExposure.value = inCity ? 0.85 : 1;
  camera.fov = 38; camera.near = 0.05; camera.far = 6000;

  if (!inCity) {
    // the planet: greening and lights as the decades pass; ring slowly turning; arcs drawing in
    earthU.uGreen.value = seg(t, 3.5, 8.0);
    earthU.uLights.value = 0.6 + 0.4 * seg(t, 2.0, 5.0);
    ringSpin.rotation.z = t * 0.035;
    cloudMesh.rotation.y = t * 0.004;
    for (const a of arcs) { const k = t > 19 ? 1 : seg(t, 4.0 + a.userData.delay, 5.6 + a.userData.delay); a.geometry.setDrawRange(0, Math.floor(a.userData.count * k / 3) * 3); a.visible = k > 0.001; a.material.opacity = 0.9; }
    climbers.forEach((c, i) => { const s = ((t * 0.08 + i / 3) % 1); c.position.copy(MUM).multiplyScalar(R + 0.1 + s * 7.3); });
    moon.material.uniforms.uOn.value = seg(t, 20.5, 22.0);
    const mumW = onEarth(19.1, 72.9);
    if (t < 3.0) {
      // far away, drifting in behind the counter
      const k = t / 3;
      camera.position.copy(V3(18, 9, 60).lerp(V3(15, 7, 44), ease(k)));
      camera.lookAt(0, 0, 0);
    } else if (t < 8.95) {
      // orbit: a slow arc round toward the Arabian Sea, then the dive into the megacity
      const k = seg(t, 3.0, 8.0), dive = seg(t, 7.6, 9.0);
      const a0 = V3(-0.25, 0.32, 1).normalize().multiplyScalar(34), a1 = mumW.clone().normalize().add(V3(0.15, 0.05, 0.0)).normalize().multiplyScalar(26);
      const orbit = a0.clone().lerp(a1, k).normalize().multiplyScalar(lerp(34, 26, k));
      const pos = orbit.clone().lerp(mumW.clone().multiplyScalar(1.03), Math.pow(dive, 2.2));
      camera.position.copy(pos);
      const look = V3(0, 0, 0).lerp(mumW, Math.pow(dive, 1.2) * 0.98);
      camera.lookAt(look);
      camera.fov = lerp(38, 60, dive);
    } else {
      // 19-23: out along the elevator past the ring to a wide shot with the Moon; 23-25 the title over it
      const k = seg(t, 19.0, 23.2), up = V3(0, 1, 0);
      const side = mumW.clone().normalize().cross(up).normalize();
      const p0 = mumW.clone().normalize().multiplyScalar(R + 2.0).add(side.clone().multiplyScalar(0.7));
      const p1 = V3(-2, 7, 42);
      camera.position.copy(p0.clone().lerp(p1, Math.pow(k, 0.7)));
      const l0 = mumW.clone().normalize().multiplyScalar(R + 9), l1 = V3(-4.5, 1.8, 0);
      camera.lookAt(l0.lerp(l1, ease(clamp(k * 1.25, 0, 1))));
      camera.position.y += (t - 23) > 0 ? (t - 23) * 0.3 : 0;
    }
  } else {
    // the megacity
    const s = clamp((t - 9.0) / 10.0, 0, 1);
    camera.position.copy(CPATH.getPoint(s));
    camera.lookAt(CLOOK.getPoint(s));
    camera.fov = 44; camera.far = 6000; camera.near = 0.5;
    for (const hb of turbines) hb.rotation.x = t * 1.4 + hb.userData.ph;
    for (const tr of tracks) { const u = ((tr.off + t * 0.09 * tr.dir) % 1 + 1) % 1; tr.train.position.copy(tr.curve.getPointAt(u)).add(V3(0, 1.6, 0)); const tg = tr.curve.getTangentAt(u); tr.train.rotation.y = Math.atan2(-tg.z, tg.x); }
    pods.forEach((p) => { p.position.set(0, PLAT_Y + 20 + ((t * 60 + p.userData.k * 260) % 1400), 0); });
    for (let i = 0; i < NDR; i++) { const L = lanes[i];
      let x, z, yaw;
      if (L.ring) { const a = L.ph + t * L.sp / L.rad; x = Math.cos(a) * L.rad; z = Math.sin(a) * L.rad; yaw = -a + (L.sp > 0 ? -Math.PI / 2 : Math.PI / 2); }
      else { const u = ((L.ph / 6.283 + t * L.sp / L.len) % 1 + 1) % 1 - 0.5; x = L.cx + Math.cos(L.ang) * u * L.len; z = L.cz + Math.sin(L.ang) * u * L.len; yaw = -L.ang + (L.sp > 0 ? 0 : Math.PI); }
      Q.setFromAxisAngle(V3(0, 1, 0), yaw); M4.compose(V3(x, L.y + Math.sin(t * 1.3 + i) * 0.6, z), Q, V3(1, 1, 1)); drones.setMatrixAt(i, M4); }
    drones.instanceMatrix.needsUpdate = true;
  }
  camera.aspect = W / H; camera.updateProjectionMatrix();
  hud(t);
  composer.render();
  renderer.autoClear = false; renderer.render(hudScene, hudCam); renderer.autoClear = true;
}

window.DURATION = DURATION; window.FPS = FPS;
window.renderFrame = (i) => frame(i / FPS);
if (!new URLSearchParams(location.search).has('render')) { const t0 = performance.now(); const loop = () => { frame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); }; loop(); }
window.ready = true;
