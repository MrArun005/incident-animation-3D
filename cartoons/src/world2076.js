// "The World in 2076": a 25 second three.js film in six shots, lit naturally (daylight sky as the environment,
// soft shadows, bloom only on the sun). A year counter runs 2026 -> 2076 over Earth; a greener planet with a
// solar ring; quiet electric skies (an air taxi alongside, air lanes, a solar airship, delivery drones, clouds)
// over a floating sea city; a tree-lined street that belongs to people (walkers, kids, robot companions, drones
// overhead, self-driving pods); a pod up close, its seats facing each other; the sea city at golden hour and the
// title. 1920x1080, 30 fps. Cut times: SHOTS below.
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
const SHOTS = { earth: 2.6, sky: 6.0, street: 10.5, car: 15.5, city: 19.5, title: 22.5 };
// the year on screen; the score's ticks use the same curve (tools/audio-world2076.mjs)
export const yearAt = (t) => 2026 + Math.floor(50 * Math.pow(clamp(t / 2.3, 0, 1), 2.2) + 1e-6);

// ---- renderer and post ------------------------------------------------------------------------------------
const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
const renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputEncoding = T.LinearEncoding; renderer.toneMapping = T.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(38, W / H, 0.1, 9000);
const rt = new T.WebGLRenderTarget(W, H, { type: T.HalfFloatType, samples: 4 });
const composer = new T.EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new T.RenderPass(scene, camera));
const bloom = new T.UnrealBloomPass(new T.Vector2(W, H), 0.3, 0.4, 1.6); composer.addPass(bloom);
[bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical].forEach((t) => { t.texture.type = T.HalfFloatType; t.dispose(); });
const Final = new T.ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 0 }, uFlash: { value: 0 }, uExposure: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uFade, uFlash, uExposure; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      vec3 c = aces(texture2D(tDiffuse, vUv).rgb * uExposure);
      c *= 1.0 - 0.28 * smoothstep(0.45, 1.0, length(d * vec2(1.0, 0.85)) * 1.25);
      c = pow(c, vec3(1.0/2.2));
      c += (hash(vUv * 1920.0 + fract(uTime * 7.1)) - 0.5) * 0.018;
      c = mix(c, vec3(1.0), uFlash);
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
const canvasTex = (w, h, draw, rep = [1, 1]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; t.encoding = T.sRGBEncoding; return t; };
const MATS = new Map();
const mat = (hex, o = {}) => { const k = hex + JSON.stringify(o); if (!MATS.has(k)) MATS.set(k, new T.MeshStandardMaterial({ color: new T.Color(hex).convertSRGBToLinear(), roughness: 0.7, metalness: 0, ...o })); return MATS.get(k); };

const NOISE = `
  float h3(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
`;

// =============================================================================================================
// SPACE: Earth (greening, natural night lights), atmosphere, clouds, a sunlit solar ring.
// =============================================================================================================
const space = new T.Group(); scene.add(space);
const R = 10;
const SUN = V3(0.62, 0.22, 0.75).normalize();
const latlon = (lat, lon, r = R) => { const ph = (lon + 180) / 360 * Math.PI * 2, th = (90 - lat) / 180 * Math.PI;
  return V3(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)).multiplyScalar(r); };
space.add(new T.Mesh(new T.SphereGeometry(3000, 48, 24), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, color: 0x6a6f88 })));
const earth = new T.Group(); space.add(earth);
const earthU = { map: { value: earthTex }, sunDir: { value: SUN.clone() }, uGreen: { value: 0 }, uTime: { value: 0 } };
earth.add(new T.Mesh(new T.SphereGeometry(R, 128, 64), new T.ShaderMaterial({
  uniforms: earthU,
  vertexShader: `varying vec2 vUv; varying vec3 vN, vW, vP;
    void main(){ vUv = uv; vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform sampler2D map; uniform vec3 sunDir; uniform float uGreen, uTime; varying vec2 vUv; varying vec3 vN, vW, vP;
    ${NOISE}
    float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
      vec3 day = pow(texture2D(map, vUv).rgb, vec3(2.2));
      float ocean = smoothstep(-0.005, 0.03, day.b - max(day.r, day.g) * 0.9), land = 1.0 - ocean;
      float dry = smoothstep(0.0, 0.08, day.r - day.g) * land;
      vec3 green = vec3(day.g * 0.5, day.g * 1.1 + 0.01, day.g * 0.38);
      day = mix(day, green, dry * uGreen * 0.8);
      float d = dot(n, sunDir), lit = smoothstep(-0.08, 0.35, d);
      vec3 col = day * (lit * 1.5 + 0.008);
      vec3 r = reflect(-sunDir, n); col += ocean * pow(max(dot(r, v), 0.0), 60.0) * vec3(1.2, 1.0, 0.8) * lit;
      vec2 g = vUv * vec2(900.0, 450.0); vec2 cell = floor(g);
      float cl = smoothstep(0.52, 0.78, fbm(vP * 0.9));
      float dots = step(0.86 - cl * 0.35, hash2(cell)) * smoothstep(0.5, 0.1, length(fract(g) - 0.5));
      float night = smoothstep(0.12, -0.25, d);
      col += land * night * (dots * 1.2 + cl * 0.08) * vec3(1.0, 0.68, 0.36) * (0.4 + cl);
      float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
      col += fr * vec3(0.25, 0.5, 1.1) * (smoothstep(-0.3, 0.4, d) * 1.0 + 0.03);
      gl_FragColor = vec4(col, 1.0); }`,
})));
const cloudMesh = new T.Mesh(new T.SphereGeometry(R * 1.012, 96, 48), new T.ShaderMaterial({
  uniforms: { sunDir: earthU.sunDir, uTime: earthU.uTime }, transparent: true, depthWrite: false,
  vertexShader: `varying vec3 vN, vP; void main(){ vP = position; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 sunDir; uniform float uTime; varying vec3 vN, vP; ${NOISE}
    void main(){ vec3 n = normalize(vN); float d = dot(n, sunDir);
      float c = smoothstep(0.5, 0.78, fbm(vP * 0.42));
      gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * (smoothstep(-0.1, 0.5, d) * 1.2 + 0.02), c * 0.85 * smoothstep(-0.25, 0.1, d)); }`,
}));
earth.add(cloudMesh);
earth.add(new T.Mesh(new T.SphereGeometry(R * 1.06, 96, 48), new T.ShaderMaterial({
  uniforms: { sunDir: earthU.sunDir }, transparent: true, depthWrite: false, side: T.BackSide, blending: T.AdditiveBlending,
  vertexShader: `varying vec3 vN, vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 sunDir; varying vec3 vN, vW;
    void main(){ vec3 n = normalize(vN), v = normalize(cameraPosition - vW); float f = max(-dot(n, v), 0.0);
      float k = smoothstep(0.0, 0.5, f) * (1.0 - smoothstep(0.5, 1.0, f) * 0.6);
      gl_FragColor = vec4(vec3(0.3, 0.6, 1.3) * k * (0.06 + smoothstep(-0.35, 0.5, dot(n, sunDir)) * 1.1), 1.0); }`,
})));
earth.rotation.y = -0.4; earth.updateMatrixWorld(true);
const onEarth = (lat, lon, r = R) => latlon(lat, lon, r).applyMatrix4(earth.matrixWorld);
// a solar ring you could build: sunlit collector panels on a slim truss, no glow
const ringTilt = new T.Group(); ringTilt.rotation.set(0.38, 0, -0.22); space.add(ringTilt);
const ringSpin = new T.Group(); ringTilt.add(ringSpin);
const spaceSun = new T.DirectionalLight(0xfff4e6, 3.0); spaceSun.position.copy(SUN).multiplyScalar(100); space.add(spaceSun);
space.add(new T.AmbientLight(0x223355, 0.25));
{
  const RING_R = 13.2, truss = mat('#9aa0a8', { metalness: 0.8, roughness: 0.35 });
  ringSpin.add(new T.Mesh(new T.TorusGeometry(RING_R, 0.02, 6, 400), truss));
  const N = 1100, panel = new T.InstancedMesh(new T.BoxGeometry(0.14, 0.01, 0.34), new T.MeshStandardMaterial({ color: 0x14244e, metalness: 0.9, roughness: 0.18 }), N);
  const m = new T.Matrix4(), r = rng(5);
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2;
    m.compose(V3(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0), new T.Quaternion().setFromEuler(new T.Euler(0, 0.9 + r() * 0.05, a)), V3(1, 1, 1)); panel.setMatrixAt(i, m); }
  ringSpin.add(panel);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, st = new T.Group();
    st.add(new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.6, 16), mat('#e6e8ec', { metalness: 0.5, roughness: 0.3 })));
    st.add(new T.Mesh(new T.TorusGeometry(0.28, 0.035, 8, 32), mat('#e6e8ec', { metalness: 0.5, roughness: 0.3 })));
    st.position.set(Math.cos(a) * RING_R, Math.sin(a) * RING_R, 0); st.rotation.z = a; ringSpin.add(st); }
}

// =============================================================================================================
// THE WORLD: one sky (day or golden hour), also used as the environment light for every surface.
// =============================================================================================================
const SKY_GLSL = `
  uniform float uGold;
  vec3 skyCol(vec3 d, vec3 sunD){
    float y = d.y;
    vec3 day = mix(vec3(0.56, 0.68, 0.86), vec3(0.09, 0.22, 0.58), pow(smoothstep(0.0, 0.9, y), 0.6));
    vec3 gold = mix(vec3(0.95, 0.56, 0.33), vec3(0.38, 0.32, 0.46), smoothstep(0.0, 0.2, y)); gold = mix(gold, vec3(0.07, 0.12, 0.28), smoothstep(0.15, 0.75, y));
    vec3 c = mix(day, gold, uGold);
    c = mix(c, mix(vec3(0.33, 0.37, 0.42), vec3(0.24, 0.18, 0.17), uGold), smoothstep(0.0, -0.15, y));
    float s = max(dot(d, sunD), 0.0);
    c += mix(vec3(1.0, 0.9, 0.75), vec3(1.4, 0.72, 0.38), uGold) * (pow(s, 10.0) * 0.22 + pow(s, 220.0) * 1.0) + vec3(30.0, 26.0, 21.0) * smoothstep(0.99955, 0.9998, s);
    return c; }`;
const FOG_GLSL = `uniform float uFog; vec3 fogIt(vec3 c, vec3 w){ float dist = length(w - cameraPosition); vec3 d = normalize(w - cameraPosition);
    float f = 1.0 - exp(-dist * uFog); vec3 fc = skyCol(normalize(vec3(d.x, max(d.y, 0.0) * 0.3 + 0.02, d.z)), uSun); return mix(c, fc * 0.85, f); }`;
const DSUN = V3(0.5, 0.62, -0.6).normalize(), GSUN = V3(0.85, 0.15, -0.5).normalize();
const wU = { uSun: { value: DSUN.clone() }, uTime: { value: 0 }, uGold: { value: 0 }, uFog: { value: 0.0009 } };
const skyMat = (u) => new T.ShaderMaterial({
  uniforms: u, side: T.BackSide, depthWrite: false,
  vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 uSun; uniform float uTime; varying vec3 vD; ${SKY_GLSL} ${NOISE}
    void main(){ vec3 d = normalize(vD); vec3 c = skyCol(d, uSun);
      vec2 p = d.xz / max(d.y + 0.06, 0.02);
      float cl = smoothstep(0.52, 0.8, fbm(vec3(p * 0.9 + vec2(uTime * 0.008, 0.0), 2.0)));
      float base = fbm(vec3(p * 0.9 + vec2(0.05, 0.05), 2.0));
      vec3 cloudC = mix(mix(vec3(1.0, 0.99, 0.97), vec3(1.25, 0.8, 0.6), uGold) * 1.05, mix(vec3(0.62, 0.66, 0.74), vec3(0.45, 0.35, 0.42), uGold), smoothstep(0.55, 0.75, base) * 0.6);
      c = mix(c, cloudC, cl * smoothstep(0.02, 0.18, d.y) * 0.9);
      gl_FragColor = vec4(c, 1.0); }`,
});
const world = new T.Group(); scene.add(world);
world.add(new T.Mesh(new T.SphereGeometry(8000, 48, 24), skyMat(wU)));
// environment maps: the same sky, pre-filtered, for day and golden hour
const pmrem = new T.PMREMGenerator(renderer);
const envOf = (gold, sun) => { const s = new T.Scene(); s.add(new T.Mesh(new T.SphereGeometry(100, 32, 16), skyMat({ uSun: { value: sun }, uTime: { value: 0 }, uGold: { value: gold } }))); return pmrem.fromScene(s, 0.02).texture; };
const ENV_DAY = envOf(0, DSUN), ENV_GOLD = envOf(1, GSUN);
const sunW = new T.DirectionalLight(0xfff2e2, 2.6); world.add(sunW, sunW.target);
sunW.castShadow = true; sunW.shadow.mapSize.set(2048, 2048); sunW.shadow.bias = -0.0004; sunW.shadow.normalBias = 0.02;
Object.assign(sunW.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 260 });
const hemi = new T.HemisphereLight(0xbcd2ee, 0x7a6e5c, 0.25); world.add(hemi);

// ---- the sea city (sky shot by day, closing shot at golden hour) ---------------------------------------------
const city = new T.Group(); world.add(city);
city.add(new T.Mesh(new T.PlaneGeometry(16000, 16000, 1, 1).rotateX(-Math.PI / 2), new T.ShaderMaterial({
  uniforms: wU,
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 uSun; uniform float uTime; varying vec3 vW; ${SKY_GLSL} ${FOG_GLSL}
    vec2 wv(vec2 p, vec2 dir, float k, float a, float sp){ float ph = dot(p, dir) * k + uTime * sp; return dir * (a * k * cos(ph)); }
    void main(){ vec2 p = vW.xz; vec2 g = vec2(0.0);
      g += wv(p, normalize(vec2(0.8, 0.6)), 0.08, 0.3, 1.3); g += wv(p, normalize(vec2(-0.3, 1.0)), 0.17, 0.1, 1.9);
      g += wv(p, normalize(vec2(1.0, -0.2)), 0.41, 0.035, 2.7); g += wv(p, normalize(vec2(0.2, 0.9)), 0.93, 0.014, 3.9);
      g += wv(p, normalize(vec2(-0.9, 0.4)), 2.1, 0.005, 5.3);
      vec3 n = normalize(vec3(-g.x, 1.0, -g.y)), v = normalize(cameraPosition - vW); vec3 r = reflect(-v, n); r.y = abs(r.y);
      float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
      vec3 c = mix(vec3(0.012, 0.05, 0.07), skyCol(r, uSun) * 0.9, fres);
      c += vec3(2.0, 1.6, 1.2) * pow(max(dot(r, uSun), 0.0), 300.0) * 2.0;
      gl_FragColor = vec4(fogIt(c, vW), 1.0); }`,
})));
const PLATS = [{ x: 0, z: 0, r: 52 }];
for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3, d = k % 2 ? 128 : 118; PLATS.push({ x: Math.cos(a) * d, z: Math.sin(a) * d - 10, r: k % 2 ? 36 : 42 }); }
const TOWER_VS = `attribute vec4 aSeed; varying vec3 vW, vN, vL; varying vec4 vS;
  void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vS = aSeed;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vL = position * sc + vec3(0.0, sc.y * 0.5, 0.0);
    gl_Position = projectionMatrix * viewMatrix * w; }`;
const towerMat = new T.ShaderMaterial({
  uniforms: wU, vertexShader: TOWER_VS,
  fragmentShader: `uniform vec3 uSun; uniform float uTime; varying vec3 vW, vN, vL; varying vec4 vS; ${SKY_GLSL} ${FOG_GLSL} ${NOISE}
    float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
      float u = abs(n.x) > 0.5 ? vL.z : vL.x, y = vL.y, top = step(0.9, n.y);
      float cw = 1.5 + vS.y * 0.8, chh = 3.2;
      vec2 cell = vec2(u / cw, y / chh), f = fract(cell), id = floor(cell);
      float glassy = step(0.6, vS.z);
      float wnd = mix(step(0.14, f.x) * step(f.x, 0.86) * step(0.22, f.y) * step(f.y, 0.84), step(0.06, f.x) * step(f.x, 0.94) * step(0.1, f.y), glassy);
      float aa = clamp(length(fwidth(cell)) * 2.5 - 0.2, 0.0, 1.0); wnd = mix(wnd, 0.55, aa);
      float sunL = max(dot(n, uSun), 0.0);
      vec3 sunC = mix(vec3(1.0, 0.95, 0.86), vec3(1.25, 0.78, 0.5), uGold);
      vec3 skyAmb = skyCol(normalize(vec3(n.x, max(n.y, 0.0) + 0.35, n.z)), uSun) * 0.35;
      vec3 albedo = mix(vec3(0.82, 0.78, 0.71), vec3(0.66, 0.68, 0.7), vS.x);
      vec3 wall = albedo * (skyAmb + sunL * 1.6 * sunC);
      vec3 r = reflect(-v, n); r.y = abs(r.y) * 0.7 + 0.03;
      float fres = 0.06 + 0.9 * pow(1.0 - max(dot(n, v), 0.0), 4.0);
      vec3 glass = mix(vec3(0.03, 0.05, 0.065), skyCol(r, uSun) * 0.8, fres);
      glass += step(0.9, hash2(id + vS.xy * 91.0)) * vec3(1.0, 0.72, 0.45) * 0.35 * uGold;
      vec3 c = mix(wall, glass, wnd * (1.0 - top));
      // vertical forests: a planted terrace every few floors, foliage spilling down
      float every = 3.0 + floor(vS.w * 3.0), fl = floor(y / chh);
      float leaf = fbm(vec3(u * 1.3, y * 1.3, vS.x * 10.0));
      float band = step(mod(fl, every), 0.0) * step(0.2, vS.w) * (1.0 - top);
      float hang = band + step(mod(fl - 1.0, every), 0.0) * step(0.2, vS.w) * step(f.y, 0.5 * leaf + 0.05) * (1.0 - top);
      vec3 green = mix(vec3(0.07, 0.17, 0.04), vec3(0.2, 0.33, 0.09), leaf) * (skyAmb * 1.4 + sunL * 1.5 * sunC);
      c = mix(c, green, clamp(hang, 0.0, 1.0) * step(0.32, leaf + band * 0.3));
      vec3 roof = mix(vec3(0.03, 0.05, 0.11) + skyCol(r, uSun) * 0.12, vec3(0.12, 0.24, 0.07) * (skyAmb + sunL * 1.4 * sunC), step(0.55, vS.w));
      c = mix(c, roof, top);
      gl_FragColor = vec4(fogIt(c, vW), 1.0); }`,
});
const rT = rng(2076);
function towerMesh(list) {
  const geo = new T.BoxGeometry(1, 1, 1), m = new T.InstancedMesh(geo, towerMat, list.length), seeds = new Float32Array(list.length * 4), M = new T.Matrix4(), q = new T.Quaternion();
  list.forEach((o, i) => { q.setFromAxisAngle(V3(0, 1, 0), o.ry || 0); M.compose(V3(o.x, (o.y0 || 0) + o.h / 2, o.z), q, V3(o.w, o.h, o.d)); m.setMatrixAt(i, M); seeds.set([rT(), rT(), rT(), rT()], i * 4); });
  geo.setAttribute('aSeed', new T.InstancedBufferAttribute(seeds, 4)); m.frustumCulled = false; return m;
}
const TRAINS = [];
{
  const list = [], PLAT_Y = 2.2;
  for (const P of PLATS) { const centre = P === PLATS[0];
    for (let gx = -P.r; gx <= P.r; gx += 11) for (let gz = -P.r; gz <= P.r; gz += 11) {
      const x = P.x + gx + (rT() - 0.5) * 4, z = P.z + gz + (rT() - 0.5) * 4, dd = Math.hypot(x - P.x, z - P.z);
      if (dd > P.r * 0.8 || (centre && dd < 16) || rT() < 0.18) continue;
      const core = 1 - dd / P.r; list.push({ x, z, y0: PLAT_Y, w: 5 + rT() * 4, d: 5 + rT() * 4, h: (centre ? 40 : 22) + core * (centre ? 110 : 70) * (0.5 + rT()), ry: rT() < 0.6 ? 0 : rT() * Math.PI }); } }
  for (let i = 0; i < 520; i++) { const x = (rT() - 0.5) * 1700, z = -260 - rT() * 650, core = Math.exp(-((x / 520) ** 2));
    list.push({ x, z, w: 9 + rT() * 14, d: 9 + rT() * 14, h: 30 + core * 150 * (0.4 + rT()) + rT() * 30 }); }
  city.add(towerMesh(list));
  const platMat = mat('#a8a39a', { roughness: 0.8 }), park = mat('#4d7a31', { roughness: 0.95 }), rail = mat('#e9e7e2', { roughness: 0.5 });
  for (const P of PLATS) {
    const slab = new T.Mesh(new T.CylinderGeometry(P.r, P.r * 0.92, 4.4, 6), platMat); slab.position.set(P.x, 0, P.z); slab.rotation.y = Math.PI / 6; city.add(slab);
    const pk = new T.Mesh(new T.CylinderGeometry(P.r * 0.3, P.r * 0.3, 0.3, 6), park); pk.position.set(P.x, PLAT_Y + 0.1, P.z); pk.rotation.y = Math.PI / 6; if (P !== PLATS[0]) city.add(pk);
    const e = new T.Mesh(new T.TorusGeometry(P.r, 0.25, 4, 6), rail); e.rotation.x = Math.PI / 2; e.rotation.z = Math.PI / 6; e.position.set(P.x, PLAT_Y + 0.6, P.z); city.add(e);
  }
  // floating solar fields
  const pts = [], r = rng(9);
  for (let i = 0; i < 1400; i++) { const a = r() * Math.PI * 2, d = 175 + r() * 140, x = Math.cos(a) * d, z = Math.sin(a) * d * 0.7 + 60; if (z < -60) continue; pts.push([Math.round(x / 7) * 7, Math.round(z / 5) * 5]); }
  const uniq = [...new Map(pts.map((p) => [p.join(','), p])).values()];
  const solar = new T.InstancedMesh(new T.BoxGeometry(6.2, 0.25, 4.2), new T.MeshStandardMaterial({ color: 0x101c3c, metalness: 0.85, roughness: 0.18 }), uniq.length);
  const M = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(-0.12, 0, 0));
  uniq.forEach(([x, z], i) => { M.compose(V3(x, 0.6, z), q, V3(1, 1, 1)); solar.setMatrixAt(i, M); }); city.add(solar);
  // maglev beams and trains between districts
  const beam = mat('#e8e8ec', { roughness: 0.45, metalness: 0.2 }), trainM = mat('#f4f4f6', { roughness: 0.25, metalness: 0.4 });
  for (let k = 1; k <= 6; k++) { const A = PLATS[0], B = PLATS[k], C = PLATS[k % 6 + 1];
    for (const [p, q2, hgt] of [[A, B, 16], [B, C, 11]]) { const pa = V3(p.x, hgt, p.z), pb = V3(q2.x, hgt, q2.z), mid = pa.clone().lerp(pb, 0.5); mid.y += 6;
      const curve = new T.CatmullRomCurve3([pa, mid, pb]); city.add(new T.Mesh(new T.TubeGeometry(curve, 40, 0.9, 6, false), beam));
      const tr = new T.Mesh(new T.CapsuleGeometry(1.2, 22, 4, 8).rotateZ(Math.PI / 2), trainM); tr.userData = { curve, off: rT(), dir: rT() < 0.5 ? 1 : -1 }; city.add(tr); TRAINS.push(tr); } }
  // the space elevator: a pale ribbon from the central plaza into the sky
  const base = new T.Mesh(new T.CylinderGeometry(9, 12, 14, 6), mat('#dedad2', { roughness: 0.5 })); base.position.y = PLAT_Y + 7; city.add(base);
  const cable = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 7000, 8, 1, true).translate(0, 3500, 0), mat('#d8dde4', { roughness: 0.4, metalness: 0.6 })); cable.position.y = PLAT_Y + 14; city.add(cable);
}
// offshore wind
const turbines = [];
{
  const wMat = mat('#f2f0ec', { roughness: 0.45 }), r = rng(31);
  for (let i = 0; i < 28; i++) {
    const x = -420 + (i % 7) * 150 + (r() - 0.5) * 40, z = 330 + Math.floor(i / 7) * 150 + (r() - 0.5) * 40;
    const g = new T.Group(); g.position.set(x, 0, z);
    const mast = new T.Mesh(new T.CylinderGeometry(0.9, 1.6, 70, 12), wMat); mast.position.y = 35; g.add(mast);
    const nac = new T.Mesh(new T.BoxGeometry(6, 3, 3), wMat); nac.position.set(0, 71, 0); g.add(nac);
    const hub = new T.Group(); hub.position.set(-3.2, 71, 0); g.add(hub);
    for (let b = 0; b < 3; b++) { const bl = new T.Mesh(new T.BoxGeometry(0.6, 34, 1.8), wMat); bl.geometry.translate(0, 17, 0); bl.rotation.x = b * Math.PI * 2 / 3; hub.add(bl); }
    g.rotation.y = 0.5; hub.userData.ph = r() * 6; turbines.push(hub); city.add(g);
  }
}

// ---- the sky: electric air taxis, a solar airship, delivery drones, clouds -----------------------------------
const air = new T.Group(); world.add(air);
function airTaxi(livery = '#2f7f86') {
  const g = new T.Group(), white = mat('#f3f4f6', { roughness: 0.3, metalness: 0.15 }), stripe = mat(livery, { roughness: 0.4 }), dark = mat('#141a22', { roughness: 0.08, metalness: 0.6 });
  const body = new T.Mesh(new T.CapsuleGeometry(0.85, 3.4, 8, 16).rotateZ(Math.PI / 2), white); body.scale.set(1, 0.85, 0.9); g.add(body);
  const can = new T.Mesh(new T.SphereGeometry(0.9, 24, 16), dark); can.scale.set(1.5, 0.62, 0.82); can.position.set(1.15, 0.38, 0); g.add(can);
  const band = new T.Mesh(new T.CapsuleGeometry(0.87, 1.2, 4, 16).rotateZ(Math.PI / 2), stripe); band.scale.set(1, 0.3, 0.92); band.position.set(-0.9, -0.2, 0); g.add(band);
  const wing = new T.Mesh(new T.BoxGeometry(1.1, 0.12, 9.0), white); wing.position.set(-0.3, 0.5, 0); g.add(wing);
  const tail = new T.Mesh(new T.BoxGeometry(0.9, 1.3, 0.1), white); tail.position.set(-2.4, 0.8, 0); tail.rotation.z = 0.35; g.add(tail);
  const tw = new T.Mesh(new T.BoxGeometry(0.7, 0.1, 3.2), white); tw.position.set(-2.6, 1.35, 0); g.add(tw);
  const rotors = [], discMat = new T.MeshStandardMaterial({ color: 0x30343a, transparent: true, opacity: 0.3, roughness: 0.5, depthWrite: false });
  for (const [x, z] of [[-0.3, 4.3], [-0.3, -4.3], [1.9, 2.4], [1.9, -2.4], [-2.4, 2.4], [-2.4, -2.4]]) {
    const duct = new T.Mesh(new T.TorusGeometry(0.72, 0.09, 8, 28).rotateX(Math.PI / 2), white); duct.position.set(x, 0.55, z); g.add(duct);
    if (Math.abs(z) < 3) { const arm = new T.Mesh(new T.BoxGeometry(0.12, 0.08, Math.abs(z) - 0.4), white); arm.position.set(x, 0.55, z / 2 + Math.sign(z) * 0.2); g.add(arm); }
    const disc = new T.Mesh(new T.CircleGeometry(0.66, 24).rotateX(-Math.PI / 2), discMat); disc.position.set(x, 0.56, z); g.add(disc);
    const blade = new T.Mesh(new T.BoxGeometry(1.3, 0.02, 0.1), dark); blade.position.set(x, 0.58, z); g.add(blade); rotors.push(blade);
  }
  g.userData.rotors = rotors; return g;
}
const heroTaxi = airTaxi('#2f7f86'); air.add(heroTaxi);
const LANES = [];
{ const r = rng(44), liv = ['#2f7f86', '#b4553a', '#3d5a99', '#6f8a3c', '#555b66'];
  for (let i = 0; i < 26; i++) { const t = airTaxi(liv[i % 5]); air.add(t);
    const lane = i % 4, ang = [0.3, 0.3 + Math.PI, -1.2, -1.2 + Math.PI][lane], y = [190, 205, 240, 255][lane] + (r() - 0.5) * 6;
    LANES.push({ t, ang, y, off: [-120, -90, 60, 90][lane], u: r() * 1800, sp: 38 + r() * 8 }); } }
const airship = new T.Group(); air.add(airship);
{
  const hull = new T.Mesh(new T.SphereGeometry(1, 48, 24), mat('#eceae4', { roughness: 0.55 })); hull.scale.set(45, 11, 11); airship.add(hull);
  const pv = new T.Mesh(new T.SphereGeometry(1.008, 48, 24, 0, Math.PI * 2, 0, 0.75), new T.MeshStandardMaterial({ color: 0x14254f, metalness: 0.7, roughness: 0.25 })); pv.scale.set(45, 11, 11); airship.add(pv);
  for (let k = 0; k < 4; k++) { const fg = new T.Group(); fg.rotation.x = k * Math.PI / 2; const fin = new T.Mesh(new T.BoxGeometry(9, 0.4, 7), mat('#dcd9d2')); fin.position.set(-38, 0, 9); fg.add(fin); airship.add(fg); }
  const gond = new T.Mesh(new T.CapsuleGeometry(2.2, 12, 4, 12).rotateZ(Math.PI / 2), mat('#e8e6e0')); gond.position.set(4, -11.5, 0); airship.add(gond);
  const wi = new T.Mesh(new T.BoxGeometry(12.5, 1.2, 4.6), mat('#1a2028', { roughness: 0.1, metalness: 0.6 })); wi.position.set(4, -11.3, 0); airship.add(wi);
  airship.position.set(-120, 330, 120); airship.rotation.y = -0.35;
}
const NDRONE = 60, drones = new T.InstancedMesh(new T.BoxGeometry(1.2, 0.35, 1.2), mat('#2b2f36', { roughness: 0.4, metalness: 0.3 }), NDRONE);
const parcels = new T.InstancedMesh(new T.BoxGeometry(0.7, 0.5, 0.6), mat('#c79a62', { roughness: 0.9 }), NDRONE);
const DR = []; { const r = rng(61); for (let i = 0; i < NDRONE; i++) DR.push({ x: -500 + r() * 900, z: -100 + r() * 700, y: 95 + r() * 50, ang: r() * Math.PI * 2, sp: 14 + r() * 8 }); }
drones.frustumCulled = parcels.frustumCulled = false; air.add(drones, parcels);
// cumulus billboards
const cloudTex = canvasTex(256, 256, (g, w, h) => { const r = rng(3);
  for (let i = 0; i < 70; i++) { const x = w * (0.18 + r() * 0.64), y = h * (0.32 + r() * 0.36), rad = 22 + r() * 46, gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const shade = Math.round(255 - Math.max(0, y - h * 0.45) * 0.55); gr.addColorStop(0, `rgba(${shade},${shade},${Math.min(255, shade + 6)},0.55)`); gr.addColorStop(1, `rgba(${shade},${shade},${shade},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
cloudTex.wrapS = cloudTex.wrapT = T.ClampToEdgeWrapping;
{ const r = rng(88);
  for (let i = 0; i < 46; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.95 }));
    const a = r() * Math.PI * 2, d = 250 + r() * 1400; s.position.set(Math.cos(a) * d - 200, 300 + r() * 260, Math.sin(a) * d + 200); const k = 180 + r() * 260; s.scale.set(k, k * 0.55, 1); air.add(s); } }

// ---- the street: people, robots, pods, trees ----------------------------------------------------------------
const street = new T.Group(); world.add(street);
const SKIN = ['#f1c9a5', '#e0ac69', '#c68642', '#8d5524', '#5c3a21', '#ffdbac', '#d4a07a'];
const TOPS = ['#3b5b7a', '#c8b89a', '#7a8f6a', '#e8e4dc', '#9b4d3a', '#2f3e46', '#d8a63a', '#6b5b95', '#f2efe9', '#486b5d', '#b86f52', '#1f2a36'];
const BOTTOMS = ['#2c2f36', '#5b5348', '#3f4f63', '#d6d0c4', '#4a5a42', '#7b6a58'];
const HAIR = ['#1b1612', '#3b2a1e', '#6a4a2c', '#a7a39b', '#d8c39a', '#2a2a2a'];
const pick = (r, a) => a[Math.floor(r() * a.length)];
const CAP = (rad, len) => new T.CapsuleGeometry(rad, len, 4, 10);
function person(r, { seated = false, kid = false } = {}) {
  const g = new T.Group(), s = kid ? 0.62 : 0.92 + r() * 0.16;
  const skin = mat(pick(r, SKIN), { roughness: 0.6 }), top = mat(pick(r, TOPS), { roughness: 0.85 }), bot = mat(pick(r, BOTTOMS), { roughness: 0.85 }), shoe = mat(r() < 0.5 ? '#f0f0ee' : '#26282c', { roughness: 0.6 });
  const hips = new T.Group(); hips.position.y = 0.95; g.add(hips);
  const torso = new T.Mesh(CAP(0.17, 0.36), top); torso.position.y = 0.36; torso.scale.set(0.75, 1, 1); hips.add(torso);
  const pelvis = new T.Mesh(CAP(0.15, 0.08), bot); pelvis.position.y = 0.06; pelvis.scale.set(0.8, 1, 1); hips.add(pelvis);
  const head = new T.Group(); head.position.y = 0.8; hips.add(head);
  head.add(new T.Mesh(new T.SphereGeometry(0.11, 16, 12), skin)); const neck = new T.Mesh(CAP(0.045, 0.06), skin); neck.position.y = -0.11; head.add(neck);
  const hair = mat(pick(r, HAIR), { roughness: 0.9 }), hs = new T.Mesh(new T.SphereGeometry(0.118, 16, 12, 0, Math.PI * 2, 0, 1.6), hair); hs.position.set(-0.012, 0.012, 0); head.add(hs);
  if (r() < 0.35) { const pony = new T.Mesh(CAP(0.05, 0.14), hair); pony.position.set(-0.11, -0.04, 0); head.add(pony); }
  if (r() < 0.4) { const gl = new T.Mesh(new T.BoxGeometry(0.03, 0.035, 0.2), mat('#15181c', { roughness: 0.1, metalness: 0.7 })); gl.position.set(0.1, 0.015, 0); head.add(gl); }
  if (r() < 0.25) { const bp = new T.Mesh(new T.BoxGeometry(0.14, 0.32, 0.26), mat(pick(r, ['#3a3f46', '#8a6e4b', '#c2c6cc', '#2e5a4c']))); bp.position.set(-0.19, 0.4, 0); hips.add(bp); }
  const limbs = {};
  for (const side of [1, -1]) {
    const sh = new T.Group(); sh.position.set(0, 0.62, side * 0.21); hips.add(sh);
    const ua = new T.Mesh(CAP(0.05, 0.22), top); ua.position.y = -0.15; sh.add(ua);
    const el = new T.Group(); el.position.y = -0.3; sh.add(el);
    const fa = new T.Mesh(CAP(0.043, 0.2), r() < 0.5 ? skin : top); fa.position.y = -0.13; el.add(fa);
    const hand = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), skin); hand.position.y = -0.27; el.add(hand);
    const hp = new T.Group(); hp.position.set(0, 0.0, side * 0.09); hips.add(hp);
    const th = new T.Mesh(CAP(0.07, 0.32), bot); th.position.y = -0.22; hp.add(th);
    const kn = new T.Group(); kn.position.y = -0.45; hp.add(kn);
    const sn = new T.Mesh(CAP(0.058, 0.32), bot); sn.position.y = -0.21; kn.add(sn);
    const ft = new T.Mesh(new T.BoxGeometry(0.25, 0.07, 0.1), shoe); ft.position.set(0.05, -0.46, 0); kn.add(ft);
    limbs[side > 0 ? 'L' : 'R'] = { sh, el, hp, kn };
  }
  g.scale.setScalar(s);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { hips, head, limbs, seated, ph: r() * 6.28 };
  if (seated) pose(g, 0, 0);
  return g;
}
function pose(p, t, speed) {
  const { hips, head, limbs, seated, ph } = p.userData;
  if (seated) { for (const k of ['L', 'R']) { const L = limbs[k]; L.hp.rotation.z = 1.5; L.kn.rotation.z = -1.45; L.sh.rotation.z = 0.35; L.el.rotation.z = 0.9; } hips.position.y = 0.48; head.rotation.y = Math.sin(t * 0.7 + ph) * 0.25; return; }
  if (speed === 0) { const s = Math.sin(t * 1.3 + ph); for (const k of ['L', 'R']) { const L = limbs[k]; L.hp.rotation.z = 0; L.kn.rotation.z = 0; L.sh.rotation.z = 0.05 * s; L.el.rotation.z = 0.25 + 0.3 * Math.max(0, Math.sin(t * 2.1 + ph)); } hips.position.y = 0.95; head.rotation.y = Math.sin(t * 0.6 + ph) * 0.4; return; }
  const a = t * Math.PI * 2 * speed / 1.35 + ph, sw = Math.sin(a);
  limbs.L.hp.rotation.z = 0.42 * sw; limbs.R.hp.rotation.z = -0.42 * sw;
  limbs.L.kn.rotation.z = -0.7 * Math.max(0, Math.sin(a - 1.4)); limbs.R.kn.rotation.z = -0.7 * Math.max(0, Math.sin(a - 1.4 + Math.PI));
  limbs.L.sh.rotation.z = -0.32 * sw; limbs.R.sh.rotation.z = 0.32 * sw; limbs.L.el.rotation.z = limbs.R.el.rotation.z = 0.3;
  hips.position.y = 0.95 + 0.025 * Math.abs(Math.cos(a)); hips.rotation.x = 0.04 * sw;
}
function robot() {
  const g = new T.Group(), shell = mat('#eef0f2', { roughness: 0.25, metalness: 0.1 });
  const b = new T.Mesh(new T.SphereGeometry(0.24, 20, 14), shell); b.scale.set(1, 1.15, 1); b.position.y = 0.34; g.add(b);
  const h = new T.Mesh(new T.SphereGeometry(0.15, 18, 12), shell); h.position.y = 0.72; g.add(h);
  const vis = new T.Mesh(new T.SphereGeometry(0.152, 18, 12, -0.8, 1.6, 1.1, 0.8), mat('#151a20', { roughness: 0.05, metalness: 0.5 })); vis.position.y = 0.72; g.add(vis);
  const eyeM = new T.MeshStandardMaterial({ color: 0x9fdcff, emissive: 0x9fdcff, emissiveIntensity: 0.8 });
  for (const z of [0.04, -0.04]) { const eye = new T.Mesh(new T.SphereGeometry(0.022, 8, 6), eyeM); eye.position.set(0.145, 0.73, z); g.add(eye); }
  const w = new T.Mesh(new T.SphereGeometry(0.1, 12, 8), mat('#3a3d42')); w.position.y = 0.1; g.add(w);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g;
}
function pod(paint, r) {
  const g = new T.Group(), body = mat(paint, { roughness: 0.28, metalness: 0.35 }), dark = mat('#1d2126', { roughness: 0.6 });
  const lower = new T.Mesh(new T.CapsuleGeometry(0.82, 2.5, 8, 24).rotateZ(Math.PI / 2), body); lower.scale.set(1, 0.52, 1); lower.position.y = 0.78; g.add(lower);
  const glass = new T.Mesh(new T.CapsuleGeometry(0.78, 2.2, 8, 24).rotateZ(Math.PI / 2), new T.MeshStandardMaterial({ color: 0x8a96a0, roughness: 0.04, metalness: 0.9, transparent: true, opacity: 0.3, depthWrite: false, envMapIntensity: 1.6 }));
  glass.scale.set(1, 0.72, 0.96); glass.position.y = 1.12; g.add(glass);
  const roof = new T.Mesh(new T.CapsuleGeometry(0.5, 1.6, 4, 16).rotateZ(Math.PI / 2), new T.MeshStandardMaterial({ color: 0x14254a, metalness: 0.8, roughness: 0.2 })); roof.scale.set(1, 0.12, 0.9); roof.position.y = 1.66; g.add(roof);
  for (const [x, z] of [[1.35, 0.74], [1.35, -0.74], [-1.35, 0.74], [-1.35, -0.74]]) { const wh = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.2, 20).rotateX(Math.PI / 2), dark); wh.position.set(x, 0.34, z); g.add(wh); }
  const fl = new T.Mesh(new T.BoxGeometry(0.04, 0.05, 1.1), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6ea, emissiveIntensity: 0.6 })); fl.position.set(2.04, 0.86, 0); g.add(fl);
  const rl = new T.Mesh(new T.BoxGeometry(0.04, 0.05, 1.1), new T.MeshStandardMaterial({ color: 0x661010, emissive: 0xaa1a1a, emissiveIntensity: 0.6 })); rl.position.set(-2.04, 0.86, 0); g.add(rl);
  // a lounge inside: two benches facing each other, a little table
  const seatM = mat('#d9cfbf', { roughness: 0.9 });
  for (const sx of [0.95, -0.95]) { const bench = new T.Mesh(new T.BoxGeometry(0.5, 0.18, 1.2), seatM); bench.position.set(sx, 0.78, 0); g.add(bench); const back = new T.Mesh(new T.BoxGeometry(0.12, 0.55, 1.2), seatM); back.position.set(sx * 1.32, 1.08, 0); g.add(back); }
  const tab = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.04, 20), mat('#8a6a4a', { roughness: 0.5 })); tab.position.set(0, 1.0, 0); g.add(tab);
  const riders = [];
  for (const [sx, face] of [[1.0, Math.PI], [-1.0, 0]]) { if (r() < 0.15) continue; const p = person(r, { seated: true }); p.position.set(sx, 0.36, (r() - 0.5) * 0.5); p.rotation.y = face; p.scale.multiplyScalar(0.95); g.add(p); riders.push(p); }
  g.traverse((o) => { if (o.isMesh && o.material.transparent !== true) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.riders = riders; return g;
}
{
  const paving = canvasTex(512, 512, (g, w, h) => { const r = rng(1); g.fillStyle = '#b9b3a8'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? -64 : 0; x < w; x += 128) { const v = 138 + r() * 24; g.fillStyle = `rgb(${v},${v - 5},${v - 12})`; g.fillRect(x + 2, y + 2, 124, 60); } }, [60, 6]);
  const ground = new T.Mesh(new T.PlaneGeometry(320, 70).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: paving, roughness: 0.85 })); ground.receiveShadow = true; street.add(ground);
  const laneT = canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#5d6066'; g.fillRect(0, 0, w, h); const r = rng(2); for (let i = 0; i < 3000; i++) { const v = 80 + r() * 30; g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
    g.fillStyle = 'rgba(235,235,230,0.85)'; for (let x = 0; x < w; x += 128) g.fillRect(x, h / 2 - 2, 64, 4); }, [40, 1]);
  const lane = new T.Mesh(new T.PlaneGeometry(320, 6.2).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: laneT, roughness: 0.55 })); lane.position.y = 0.02; lane.receiveShadow = true; street.add(lane);
  const grassT = canvasTex(256, 256, (g, w, h) => { const r = rng(4); g.fillStyle = '#4c6e2a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${50 + r() * 60},${90 + r() * 60},${25 + r() * 30},0.6)`; g.fillRect(r() * w, r() * h, 1.5, 3); } }, [80, 1]);
  for (const z of [4.4, -4.4]) { const gr = new T.Mesh(new T.PlaneGeometry(320, 2.4).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: grassT, roughness: 0.95 })); gr.position.set(0, 0.03, z); gr.receiveShadow = true; street.add(gr); }
  // trees in the verges
  const r = rng(12), bark = mat('#5a4636', { roughness: 0.95 });
  for (const zs of [4.4, -4.4]) for (let x = -150; x < 150; x += 9 + r() * 3) {
    const tr = new T.Group(); tr.position.set(x, 0, zs + (r() - 0.5) * 0.6);
    const h = 4.5 + r() * 2; const trunk = new T.Mesh(new T.CylinderGeometry(0.14, 0.22, h, 8), bark); trunk.position.y = h / 2; tr.add(trunk);
    const leaf = mat(pick(r, ['#3f6a2a', '#4d7a32', '#5b8236', '#386028']), { roughness: 0.9 });
    for (let k = 0; k < 5; k++) { const c = new T.Mesh(new T.IcosahedronGeometry(1.2 + r() * 0.8, 1), leaf); c.position.set((r() - 0.5) * 2, h + (r() - 0.3) * 1.4, (r() - 0.5) * 2); c.scale.y = 0.8; tr.add(c); }
    tr.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); street.add(tr);
  }
  // benches and planters on the walks
  const wood = mat('#9a7350', { roughness: 0.8 }), conc = mat('#cfcac0', { roughness: 0.9 });
  for (let x = -140; x < 140; x += 22) for (const z of [12.6, -12.6]) {
    const bn = new T.Mesh(new T.BoxGeometry(2.0, 0.08, 0.5), wood); bn.position.set(x + 6, 0.46, z); bn.castShadow = true; street.add(bn);
    const bl = new T.Mesh(new T.BoxGeometry(1.8, 0.42, 0.4), conc); bl.position.set(x + 6, 0.21, z); bl.castShadow = bl.receiveShadow = true; street.add(bl);
    const pl = new T.Mesh(new T.CylinderGeometry(0.7, 0.6, 0.6, 16), conc); pl.position.set(x - 3, 0.3, z); pl.castShadow = true; street.add(pl);
    const sh = new T.Mesh(new T.IcosahedronGeometry(0.75, 1), mat('#55803a', { roughness: 0.9 })); sh.position.set(x - 3, 0.95, z); sh.castShadow = true; street.add(sh);
  }
  // mid-rise frontages both sides
  const list = [];
  for (const side of [1, -1]) for (let x = -170; x < 170;) { const w = 14 + rT() * 10, d = 14 + rT() * 8; list.push({ x: x + w / 2, z: side * (15.5 + d / 2), w: w - 0.6, d, h: 14 + rT() * 30 }); x += w; }
  street.add(towerMesh(list));
}
const walkers = [], standers = [], pods = [], streetDrones = [];
{
  const r = rng(77);
  for (let i = 0; i < 60; i++) {
    const kid = r() < 0.12, p = person(r, { kid }), z = (r() < 0.5 ? 1 : -1) * (6.6 + r() * 4.6), dir = r() < 0.5 ? 1 : -1;
    p.userData.walk = { x0: -150 + r() * 300, z, dir, sp: kid ? 1.0 : 1.05 + r() * 0.45 }; p.rotation.y = dir > 0 ? 0 : Math.PI; street.add(p); walkers.push(p);
    if (r() < 0.22 && !kid) { const rb = robot(); street.add(rb); p.userData.robot = rb; }
  }
  // people standing and chatting in twos
  for (let i = 0; i < 6; i++) { const x = -40 + i * 13 + r() * 4, z = (i % 2 ? 1 : -1) * (8 + r() * 2);
    for (let k = 0; k < 2; k++) { const p = person(r); p.position.set(x + k * 0.9, 0, z); p.rotation.y = k ? Math.PI : 0; street.add(p); standers.push(p); } }
  // people on the benches
  for (let x = -140; x < 140; x += 44) { const p = person(r, { seated: true }); p.position.set(x + 6 + (r() - 0.5), 0, 12.45); p.rotation.y = -Math.PI / 2; street.add(p); }
  const PAINT = ['#eae7e1', '#9fb3a2', '#d8c7a6', '#5f7690', '#c9ccd0', '#b9785e'];
  for (let i = 0; i < 9; i++) { const pd = pod(PAINT[i % PAINT.length], r); street.add(pd); pods.push(pd); }
  for (let i = 0; i < 4; i++) { const g = new T.Group(); g.add(new T.Mesh(new T.BoxGeometry(0.5, 0.14, 0.5), mat('#2b2f36', { roughness: 0.4 })));
    const rm = new T.MeshStandardMaterial({ color: 0x444a52, transparent: true, opacity: 0.4 });
    for (const [x, z] of [[0.38, 0.38], [0.38, -0.38], [-0.38, 0.38], [-0.38, -0.38]]) { const rr = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.01, 16), rm); rr.position.set(x, 0.08, z); g.add(rr); }
    const pc = new T.Mesh(new T.BoxGeometry(0.4, 0.3, 0.35), mat('#c79a62', { roughness: 0.9 })); pc.position.y = -0.3; g.add(pc);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); street.add(g); streetDrones.push({ g, x0: -100 + i * 55, y: 11 + i * 1.5, z: (i % 2 ? 1 : -1) * 3, sp: (i % 2 ? -1 : 1) * 6 }); }
}
// pods: lane +1.5 runs +x, lane -1.5 runs -x. pods[0] is the hero of the car shot.
const heroX = (t) => -95 + 5 * (t - SHOTS.street);
const wrap = (x) => ((x + 160) % 320 + 320) % 320 - 160;

// =============================================================================================================
// HUD
// =============================================================================================================
const FONT = '"Liberation Sans", "DejaVu Sans", Arial, sans-serif';
function text(s, x, y, size, { alpha = 1, weight = 400, spacing = 0, color = '255,255,255', align = 'center', shadow = 0.5 } = {}) {
  if (alpha <= 0.001) return;
  cx.save(); cx.font = `${weight} ${size}px ${FONT}`; cx.letterSpacing = `${spacing}px`; cx.textAlign = align; cx.textBaseline = 'middle';
  cx.shadowColor = `rgba(0,0,0,${shadow * alpha})`; cx.shadowBlur = 18; cx.fillStyle = `rgba(${color},${alpha})`; cx.fillText(s, x, y); cx.restore();
}
function caption(s, t, a, b, sub) {
  const k = win(t, a, b, 0.45); if (k <= 0) return;
  const rise = (1 - seg(t, a, a + 0.7)) * 16, y = H * 0.84 + rise;
  cx.save(); cx.globalAlpha = k * 0.6; const gr = cx.createLinearGradient(0, H * 0.68, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)'); cx.fillStyle = gr; cx.fillRect(0, H * 0.68, W, H * 0.32); cx.restore();
  const lw = 120 * seg(t, a + 0.1, a + 0.8);
  cx.save(); cx.globalAlpha = k; cx.fillStyle = 'rgb(236,200,140)'; cx.fillRect(W / 2 - lw / 2, y - 44, lw, 2); cx.restore();
  text(s.toUpperCase(), W / 2, y, 50, { alpha: k, spacing: 8, weight: 700 });
  if (sub) text(sub, W / 2, y + 48, 24, { alpha: k * 0.85, spacing: 3, color: '235,232,225' });
}
const PLACE = [[0, 'EARTH · ORBIT'], [SHOTS.sky, 'AIR LANES · 200 M'], [SHOTS.street, 'STREET LEVEL'], [SHOTS.car, 'SELF-DRIVING POD'], [SHOTS.city, 'COASTAL CITY · ARABIAN SEA']];
function hud(t) {
  cx.clearRect(0, 0, W, H);
  if (t < 3.0) {
    const k = 1 - seg(t, 2.45, 2.8), y = yearAt(t);
    text('FIFTY YEARS FROM NOW', W / 2, H / 2 - 200, 28, { alpha: k * seg(t, 0.15, 0.6), spacing: 14, color: '220,225,235' });
    text(String(y), W / 2, H / 2 + 20, 290, { alpha: k, weight: 700, spacing: 6 });
    const p = clamp((y - 2026) / 50, 0, 1);
    cx.save(); cx.globalAlpha = k * 0.9; cx.fillStyle = 'rgba(255,255,255,0.2)'; cx.fillRect(W / 2 - 360, H / 2 + 195, 720, 3); cx.fillStyle = 'rgb(236,200,140)'; cx.fillRect(W / 2 - 360, H / 2 + 195, 720 * p, 3); cx.restore();
    text('2026', W / 2 - 360, H / 2 + 230, 22, { alpha: k * 0.7, align: 'left', spacing: 3 });
    text('2076', W / 2 + 360, H / 2 + 230, 22, { alpha: k * 0.7, align: 'right', spacing: 3 });
  }
  const tg = seg(t, 2.7, 3.3) * (1 - seg(t, SHOTS.title - 0.3, SHOTS.title + 0.2));
  let place = PLACE[0][1]; for (const [t0, p] of PLACE) if (t >= t0) place = p;
  text('2076', 70, 70, 34, { alpha: tg * 0.95, align: 'left', weight: 700, spacing: 6 });
  text(place, 72, 106, 17, { alpha: tg * 0.8, align: 'left', spacing: 5, color: '235,232,225' });
  caption('A greener planet', t, 2.9, 5.5, 'deserts re-greened · ten billion people · one home');
  caption('Quiet, electric skies', t, 6.5, 10.2, 'air taxis · solar airships · drone deliveries');
  caption('Streets belong to people', t, 11.0, 15.2, 'trees where traffic lanes were · robots run the errands');
  caption('The car becomes a room', t, 15.9, 19.2, 'self-driving · shared · seats that face each other');
  caption('Cities that live with the sea', t, 19.9, 22.3, 'floating districts · vertical forests · wind and sun');
  const ti = seg(t, SHOTS.title + 0.2, SHOTS.title + 1.0);
  if (ti > 0) {
    cx.save(); cx.globalAlpha = ti * 0.35; const g = cx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.6); g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0.2)'); cx.fillStyle = g; cx.fillRect(0, 0, W, H); cx.restore();
    text('THE WORLD IN', W / 2, H / 2 - 80, 46, { alpha: ti, spacing: 22 + 10 * (1 - ti), color: '245,238,225' });
    text('2076', W / 2, H / 2 + 30, 180, { alpha: ti, weight: 700, spacing: 18 + 30 * (1 - ti), shadow: 0.7 });
    text('imagined, fifty years ahead', W / 2, H / 2 + 145, 26, { alpha: seg(t, SHOTS.title + 0.7, SHOTS.title + 1.4), spacing: 6, color: '245,238,225' });
  }
  capTex.needsUpdate = true;
}

// =============================================================================================================
// the cut
// =============================================================================================================
const M4 = new T.Matrix4(), Q = new T.Quaternion();
const look = (p, l) => { camera.position.copy(p); camera.lookAt(l); };
const FOGC = { day: new T.Color(0xb8c8de).convertSRGBToLinear(), gold: new T.Color(0xc89a80).convertSRGBToLinear() };
const fogExp = new T.FogExp2(0xffffff, 0.001);
function setWorld(gold, fog) {
  wU.uGold.value = gold; wU.uSun.value.copy(gold ? GSUN : DSUN); wU.uFog.value = fog;
  scene.environment = gold ? ENV_GOLD : ENV_DAY;
  sunW.color.set(gold ? 0xffc9a0 : 0xfff2e2); sunW.intensity = gold ? 2.4 : 2.8;
  hemi.color.set(gold ? 0xd0a890 : 0xbcd2ee);
  fogExp.color.copy(gold ? FOGC.gold : FOGC.day); fogExp.density = fog; scene.fog = fogExp;
}
function frame(t) {
  Final.uniforms.uTime.value = t; earthU.uTime.value = t; wU.uTime.value = t;
  const shot = t < SHOTS.sky ? 'space' : t < SHOTS.street ? 'sky' : t < SHOTS.car ? 'street' : t < SHOTS.city ? 'car' : 'city';
  space.visible = shot === 'space'; world.visible = !space.visible;
  city.visible = air.visible = shot === 'sky' || shot === 'city'; street.visible = shot === 'street' || shot === 'car';
  // a short dip to black on each cut; a white cloud-flash for the dive
  const dip = Math.max(...[SHOTS.street, SHOTS.car, SHOTS.city].map((c) => 1 - clamp(Math.abs(t - c) / 0.2, 0, 1)));
  Final.uniforms.uFade.value = Math.max(1 - seg(t, 0, 0.3), seg(t, 24.4, 25), dip * 0.95);
  Final.uniforms.uFlash.value = win(t, 5.55, 6.45, 0.4);
  Final.uniforms.uExposure.value = shot === 'space' ? 1.0 : 0.95;
  bloom.strength = shot === 'space' ? 0.45 : 0.25;
  camera.fov = 40;

  if (shot === 'space') {
    scene.environment = null; scene.fog = null;
    earthU.uGreen.value = seg(t, 2.6, 5.4);
    ringSpin.rotation.z = t * 0.035; cloudMesh.rotation.y = t * 0.004;
    const mumW = onEarth(19.1, 72.9);
    if (t < SHOTS.earth) { const k = t / SHOTS.earth; look(V3(18, 9, 60).lerp(V3(15, 7, 44), ease(k)), V3(0, 0, 0)); }
    else { const k = seg(t, 2.6, 5.4), dive = seg(t, 5.0, 6.05);
      const a0 = V3(-0.25, 0.32, 1).normalize().multiplyScalar(34), a1 = mumW.clone().normalize().add(V3(0.15, 0.05, 0.0)).normalize().multiplyScalar(26);
      const orbit = a0.clone().lerp(a1, k).normalize().multiplyScalar(lerp(34, 26, k));
      look(orbit.clone().lerp(mumW.clone().multiplyScalar(1.03), Math.pow(dive, 2.2)), V3(0, 0, 0).lerp(mumW, Math.pow(dive, 1.2) * 0.98));
      camera.fov = lerp(40, 60, dive); }
  } else {
    for (const hb of turbines) hb.rotation.x = t * 1.2 + hb.userData.ph;
    if (shot === 'sky' || shot === 'city') {
      setWorld(shot === 'city' ? 1 : 0, shot === 'city' ? 0.00045 : 0.00032);
      sunW.castShadow = false;
      for (const tr of TRAINS) { const u = ((tr.userData.off + t * 0.09 * tr.userData.dir) % 1 + 1) % 1; tr.position.copy(tr.userData.curve.getPointAt(u)).add(V3(0, 1.6, 0)); const tg = tr.userData.curve.getTangentAt(u); tr.rotation.y = Math.atan2(-tg.z, tg.x); }
      for (const L of LANES) { const u = ((L.u + t * L.sp) % 1800 + 1800) % 1800 - 900, dx = Math.cos(L.ang), dz = -Math.sin(L.ang);
        L.t.position.set(dx * u - dz * L.off - 120, L.y, dz * u + dx * L.off + 180); L.t.rotation.set(0, L.ang, 0); for (const b of L.t.userData.rotors) b.rotation.y = t * 40; }
      for (let i = 0; i < NDRONE; i++) { const d = DR[i], u = ((t * d.sp) % 600) - 300; const x = d.x + Math.cos(d.ang) * u, z = d.z + Math.sin(d.ang) * u;
        Q.setFromAxisAngle(V3(0, 1, 0), -d.ang); M4.compose(V3(x, d.y, z), Q, V3(1, 1, 1)); drones.setMatrixAt(i, M4); M4.compose(V3(x, d.y - 0.5, z), Q, V3(1, 1, 1)); parcels.setMatrixAt(i, M4); }
      drones.instanceMatrix.needsUpdate = parcels.instanceMatrix.needsUpdate = true;
      airship.position.x = -120 + t * 2.5;
    }
    if (shot === 'sky') {
      // flying alongside an air taxi toward the sea city
      const k = (t - SHOTS.sky) / (SHOTS.street - SHOTS.sky);
      const cam = V3(-430, 250, 600).lerp(V3(-190, 220, 330), k);
      const fwd = V3(0, 60, 0).sub(cam).setY(0).normalize(), right = V3(-fwd.z, 0, fwd.x);
      const taxi = cam.clone().add(fwd.clone().multiplyScalar(19 - 3 * k)).add(right.clone().multiplyScalar(5.5 + 1.5 * Math.sin(t * 0.7))).add(V3(0, -3.2 + 0.4 * Math.sin(t * 1.1), 0));
      heroTaxi.position.copy(taxi); heroTaxi.rotation.set(0.04 * Math.sin(t * 0.9), Math.atan2(-fwd.z, fwd.x), 0.05);
      for (const b of heroTaxi.userData.rotors) b.rotation.y = t * 45;
      heroTaxi.visible = true;
      look(cam, taxi.clone().lerp(V3(0, 60, 0), 0.08 + 0.12 * k));
    } else if (shot === 'city') {
      heroTaxi.visible = false;
      const k = seg(t, SHOTS.city, 25), a = lerp(0.95, 0.62, k), d = lerp(430, 330, k);
      look(V3(Math.cos(a) * d, lerp(170, 120, k), Math.sin(a) * d), V3(-10, lerp(60, 70, k), -20));
      camera.fov = 42;
    } else {
      setWorld(0, 0.004);
      sunW.castShadow = true;
      for (const p of walkers) { const w = p.userData.walk, x = wrap(w.x0 + w.dir * w.sp * t); p.position.set(x, 0, w.z); pose(p, t, w.sp);
        const rb = p.userData.robot; if (rb) { rb.position.set(x - w.dir * 0.2, 0.02 * Math.abs(Math.sin(t * 6)), w.z + (w.z > 0 ? -0.7 : 0.7)); rb.rotation.y = p.rotation.y; } }
      for (const p of standers) pose(p, t, 0);
      pods.forEach((pd, i) => { const hero = i === 0, plus = hero || i % 2 === 0;
        const x = hero ? heroX(t) : plus ? wrap(heroX(t) + 45 * i) : wrap(150 - 6 * (t - SHOTS.street) - 40 * i);
        pd.position.set(x, 0, plus ? 1.5 : -1.5); pd.rotation.y = plus ? 0 : Math.PI;
        for (const rd of pd.userData.riders) pose(rd, t, 0); });
      for (const d of streetDrones) d.g.position.set(wrap(d.x0 + d.sp * t), d.y, d.z);
      if (shot === 'street') {
        const k = (t - SHOTS.street) / (SHOTS.car - SHOTS.street);
        look(V3(lerp(-30, -19, k), lerp(1.75, 2.3, k), 8.4), V3(lerp(4, 12, k), lerp(1.6, 2.0, k), 3.0));
        camera.fov = 42;
      } else {
        const k = (t - SHOTS.car) / (SHOTS.city - SHOTS.car), c = V3(heroX(t), 1.0, 1.5);
        const off = V3(0.3, 0.15, -3.4).lerp(V3(4.6, 0.6, -2.6), seg(k, 0, 0.55)).lerp(V3(2.5, 4.0, -5.5), seg(k, 0.55, 1));
        look(c.clone().add(off), c.clone().add(V3(0, 0.25, 0)));
        camera.fov = 44;
      }
      const tgt = camera.position.clone().add(camera.getWorldDirection(V3()).setY(0).normalize().multiplyScalar(18));
      sunW.target.position.copy(tgt); sunW.position.copy(tgt).add(DSUN.clone().multiplyScalar(120));
    }
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
