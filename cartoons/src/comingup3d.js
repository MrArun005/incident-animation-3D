// "Clawd: Coming Up", the 3D cut. Same story and beats as comingup.js (stories/comingup.beats.json), shot in
// three.js. Clawd stays exactly the original pixel sprite: a flat plane drawn from the 11 x 11 sprite with
// nearest-neighbour texels. The world around him is 3D: an arcade cabinet in a dark room (modelled in Blender,
// tools/blender_cabinet.py) that the film pushes into, a tower of neon-edged platforms over a pile of dead-pixel
// cubes, a glow line at the top that cracks open onto deep space with the Astra planets, and a final pull back
// out to the cabinet. Bloom and an ACES grade (vendor/three-r147.js). 1920x1080, 30 fps.
import B from '../stories/comingup.beats.json' with { type: 'json' };

const W = 1920, H = 1080, FPS = 30, DURATION = B.duration;
await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/three-r147.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
const T = window.THREE;
const V3 = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const seg = (t, a, b) => ease(clamp((t - a) / (b - a), 0, 1));
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hash = (n) => rng(n * 7919 + 13)();
const SCN = Object.fromEntries(B.scenes.map(([id, t0], i) => [id, [t0, i + 1 < B.scenes.length ? B.scenes[i + 1][1] : DURATION]]));
const sceneAt = (t) => { let s = B.scenes[0][0]; for (const [id, t0] of B.scenes) if (t >= t0) s = id; return s; };

// ---- renderer and post ------------------------------------------------------------------------------------
const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H;
const renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.outputEncoding = T.LinearEncoding; renderer.toneMapping = T.NoToneMapping;
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(38, W / H, 0.05, 4000);
const rt = new T.WebGLRenderTarget(W, H, { type: T.HalfFloatType, samples: 4 });
const composer = new T.EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new T.RenderPass(scene, camera));
const bloom = new T.UnrealBloomPass(new T.Vector2(W, H), 0.9, 0.5, 0.85); composer.addPass(bloom);
[bloom.renderTargetBright, ...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical].forEach((t) => { t.texture.type = T.HalfFloatType; t.dispose(); });
const Final = new T.ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCRT: { value: 0 }, uFade: { value: 0 }, uFlash: { value: 0 }, uExposure: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uCRT, uFade, uFlash, uExposure; varying vec2 vUv;
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float ca = (0.0015 + 0.004 * uCRT) * length(d) * 2.0;
      vec3 c = vec3(texture2D(tDiffuse, vUv + d*ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d*ca).b);
      c = aces(c * uExposure);
      c *= 1.0 - uCRT * 0.10 * (0.5 + 0.5 * sin(vUv.y * 1080.0 * 3.14159 / 3.0));        // scanlines inside the screen
      c *= 1.0 - 0.45 * smoothstep(0.35, 0.95, length(d * vec2(1.0, 0.85)) * 1.25);
      c = pow(c, vec3(1.0/2.2));
      c += (hash(vUv * 1920.0 + fract(uTime * 7.1)) - 0.5) * 0.03;
      c = mix(c, vec3(1.0, 0.95, 0.88), uFlash);
      gl_FragColor = vec4(c * (1.0 - uFade), 1.0); }`,
});
composer.addPass(Final);
// captions are drawn after the post, in screen space
const hudScene = new T.Scene(), hudCam = new T.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -1, 1);
const capCanvas = document.createElement('canvas'); capCanvas.width = W; capCanvas.height = H;
const capCtx = capCanvas.getContext('2d'), capTex = new T.CanvasTexture(capCanvas);
const capMesh = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshBasicMaterial({ map: capTex, transparent: true, depthTest: false }));
hudScene.add(capMesh);

// ---- assets ------------------------------------------------------------------------------------------------
const texL = new T.TextureLoader(), gltfL = new T.GLTFLoader();
const ltex = (f, srgb = true) => new Promise((res) => texL.load(`assets/comingup/${f}`, (t) => { t.encoding = srgb ? T.sRGBEncoding : T.LinearEncoding; res(t); }, undefined, () => res(null)));
const [skyTex, jupT, satT, earT, nepT, marT, ringT, cabinet] = await Promise.all([
  ltex('sky-2k.jpg'), ltex('planet-jupiter.jpg'), ltex('planet-saturn.jpg'), ltex('planet-earth.jpg'), ltex('planet-neptune.jpg'), ltex('planet-mars.jpg'), ltex('planet-rings.png'),
  new Promise((res) => gltfL.load('assets/comingup/cabinet.glb', (g) => res(g.scene), undefined, () => res(null))),
]);

// ---- the original Clawd sprite, as textures (one per pose) ----------------------------------------------------
// Drawn exactly as art.js clawd(): body 9x8 with a lighter top row, side nubs, four legs, two tall eyes.
const SPR = new Map();
function spriteTex(key, draw) {
  if (SPR.has(key)) return SPR.get(key);
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;      // 16 px per... no: 4 texels per sprite pixel
  const cg = cv.getContext('2d'); cg.imageSmoothingEnabled = false;
  const P = (x, y, w, h, col) => { cg.fillStyle = col; cg.fillRect(Math.round((x + 2.5) * 4), Math.round((y + 2) * 4), Math.round(w * 4), Math.round(h * 4)); };
  draw(P);
  const tx = new T.CanvasTexture(cv); tx.magFilter = T.NearestFilter; tx.minFilter = T.LinearMipmapLinearFilter; tx.generateMipmaps = true; tx.encoding = T.sRGBEncoding;
  SPR.set(key, tx); return tx;
}
const ORANGE = '#cc7f61', TOPC = '#dd9a80';
function clawdTex(pose, { blink = false, eyeUp = 0, flick = 0 } = {}) {
  const key = `${pose}|${blink ? 1 : 0}|${eyeUp.toFixed(1)}|${flick}`;
  return spriteTex(key, (P) => {
    let by = 0, legH = 3, bodyH = 8, eh = 1.4;
    if (pose === 'curl') { by = 3; legH = 0.75; bodyH = 7; }
    if (pose === 'lie') { by = 5; legH = 0; bodyH = 6; eh = 0.5; }
    if (pose === 'jump') legH = 3.5;
    P(1, by, 9, bodyH, ORANGE); P(1, by, 9, 1, TOPC);
    P(0, by + 3, 1, 2, ORANGE);
    if (pose === 'reach') P(10, by + 3.5, 5, 1.5, ORANGE); else if (pose === 'hang') P(10, by - 2, 1, 4, ORANGE); else P(10, by + 3, 1, 2, ORANGE);
    if (legH > 0) for (const lx of [1, 3, 7, 9]) {
      if (lx === 9 && flick === 1) continue;
      if (lx === 9 && flick === 2) { P(lx + 0.5, by + bodyH + 0.5, 1, legH * 0.6, '#7fd4ff'); continue; }
      const kick = pose === 'jump' ? (lx < 5 ? -0.5 : 0.5) : 0;
      P(lx + kick, by + bodyH, 1, legH, ORANGE);
    }
    const shut = blink || pose === 'lie', h = shut ? 0.5 : eh, ey = by + 3 - eyeUp + (shut ? 0.6 : 0);
    P(2, ey, 1, h, '#111'); P(8, ey, 1, h, '#111');
  });
}
// a glow halo (shared)
const haloTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const cg = cv.getContext('2d'); const gr = cg.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); cg.fillStyle = gr; cg.fillRect(0, 0, 128, 128); const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; return t; })();
const PXU = 0.1;                                        // one sprite pixel = 0.1 m; Clawd is 1.1 m tall
// A Clawd: a flat sprite plane (16 x 16 sprite px incl. margin) and a halo; plus a little warm point light for ours
class Clawd {
  constructor(parent, withLight = false) {
    this.g = new T.Group(); parent.add(this.g);
    this.mat = new T.MeshBasicMaterial({ map: clawdTex('stand'), transparent: true, alphaTest: 0.5, side: T.DoubleSide, toneMapped: false });
    this.mesh = new T.Mesh(new T.PlaneGeometry(16 * PXU, 16 * PXU), this.mat);
    this.mesh.position.set(0, (16 * PXU) / 2 - 3 * PXU, 0);    // the texture's bottom 3 px are margin; feet on the origin
    this.g.add(this.mesh);
    this.halo = new T.Sprite(new T.SpriteMaterial({ map: haloTex, color: new T.Color(1, 0.55, 0.32), blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
    this.halo.position.set(0, 0.55, -0.05); this.halo.scale.set(2.6, 2.6, 1); this.g.add(this.halo);
    if (withLight) { this.light = new T.PointLight(0xff9a66, 0, 6, 2); this.light.position.set(0, 0.6, 0.6); this.g.add(this.light); }
  }
  set({ x = 0, y = 0, z = 0, pose = 'stand', dir = 1, dim = 1, glow = 0.3, eyeUp = 0, t = 0, flick = false, visible = true, scale = 1 }) {
    this.g.visible = visible; if (!visible) return;
    const blink = (t % 3.3) < 0.12, fk = flick ? (Math.floor(t * 17) % 7 < 1 ? 1 : Math.floor(t * 17) % 7 < 2 ? 2 : 0) : 0;
    this.mat.map = clawdTex(pose, { blink, eyeUp: Math.round(eyeUp * 5) / 5, flick: fk });
    const k = 0.12 + 0.88 * dim; this.mat.color.setRGB(k * 0.92, k * 0.9, k * 0.9);       // stays under the bloom threshold: true orange
    this.g.position.set((x - 160) * PXU, -y * PXU, z); this.g.scale.set(dir * scale, scale, scale);
    this.halo.material.opacity = clamp(glow, 0, 1) * 0.5; this.halo.visible = glow > 0.02;
    if (this.light) this.light.intensity = glow * 1.4;
  }
}

// ---- the room and the cabinet ------------------------------------------------------------------------------------
const room = new T.Group(); scene.add(room);
const floor = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshStandardMaterial({ color: 0x0d0b12, roughness: 0.35, metalness: 0.1 }));
floor.rotation.x = -Math.PI / 2; room.add(floor);
const roomAmb = new T.HemisphereLight(0x6a5a9a, 0x0a0810, 0.25); room.add(roomAmb);
let screenMat = null, marqMat = null;
const CAB = new T.Group(); room.add(CAB);
if (cabinet) {
  cabinet.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material && o.material.name === 'Screen') { screenMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); o.material = screenMat; }
    if (o.material && o.material.name === 'Marquee') { marqMat = o.material; }
    if (o.material && o.material.name === 'ScreenGlass') o.visible = false;      // sits a few mm off the screen: z-fights
  });
  CAB.add(cabinet);
}
// the marquee sign: CLAWD in orange on black, lit
const marqTex = (() => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 120; const cg = cv.getContext('2d'); cg.fillStyle = '#120a10'; cg.fillRect(0, 0, 512, 120); cg.font = 'bold 86px "Liberation Sans", Arial'; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillStyle = '#ff9a5c'; cg.shadowColor = '#ff7a3c'; cg.shadowBlur = 18; cg.fillText('CLAWD', 256, 64); const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.flipY = false; return t; })();
if (marqMat) { marqMat.map = marqTex; marqMat.emissiveMap = marqTex; marqMat.emissive = new T.Color(1, 1, 1); marqMat.emissiveIntensity = 2.2; marqMat.needsUpdate = true; }
const screenGlow = new T.PointLight(0x8a7cff, 1.2, 4, 2); screenGlow.position.set(0, 1.4, 0.6); room.add(screenGlow);
const marqLight = new T.PointLight(0xffa070, 0.8, 3, 2); marqLight.position.set(0, 1.85, 0.4); room.add(marqLight);
// the screen's picture: the world inside, rendered to a texture when we look at the cabinet from outside
const screenRT = new T.WebGLRenderTarget(960, 720, { type: T.UnsignedByteType });
screenRT.texture.repeat.set(1, -1); screenRT.texture.offset.set(0, 1);   // a render target's rows run bottom-up; glTF UVs top-down
if (screenMat) { screenMat.map = screenRT.texture; }
const SCREEN_C = V3(0, 1.415, 0.115);                 // the screen's centre in room space (three.js: y up, +z toward the player)

// ---- the inside: the arcade world (world pixels -> metres: x = (wx - 160) * 0.1, y = -wy * 0.1) -----------------
const world = new T.Group(); scene.add(world); world.position.set(0, 0, -200);     // far from the room; never seen together
const PL = Array.from({ length: 13 }, (_, k) => ({ x: 160 + (k % 2 ? 50 : -50) + (hash(k + 3) - 0.5) * 16, y: -36 * (k + 1), w: 36 + Math.round(hash(k + 40) * 10) }));
const TOPY = -36 * 14 - 6;
const STAND = (k) => (k < 0 ? { x: 160, y: 0 } : { x: PL[k].x, y: PL[k].y });
const WX = (wx) => (wx - 160) * PXU, WY = (wy) => -wy * PXU;
world.add(new T.AmbientLight(0x6050a0, 0.35));
const topLight = new T.PointLight(0xffd59a, 0, 30, 1.6); topLight.position.set(0, WY(TOPY) - 1, 3); world.add(topLight);
// backdrop: a deep purple grid wall far behind, and the painted stars
const gridTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cg = cv.getContext('2d'); cg.fillStyle = '#0b0815'; cg.fillRect(0, 0, 256, 256); cg.strokeStyle = 'rgba(120,90,190,0.55)'; cg.lineWidth = 2; cg.strokeRect(0, 0, 256, 256); const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(30, 40); t.encoding = T.sRGBEncoding; return t; })();
// The backdrop above the glow line is in shards so it can break away; below it is one wall.
const BACKZ = -9;
const wallMat = new T.MeshBasicMaterial({ map: gridTex, color: 0x9a8acc });
const wallLow = new T.Mesh(new T.PlaneGeometry(160, 120), wallMat); wallLow.position.set(0, WY(TOPY) - 60 - 0.3, BACKZ); world.add(wallLow);
const shards = [];
{
  const r = rng(77), cols = 9, top = WY(TOPY) + 0.2, H2 = 60;
  for (let i = 0; i < cols; i++) for (let j = 0; j < 4; j++) {
    const w = 160 / cols, x0 = -80 + i * w, y0 = top + j * (H2 / 4), jag = () => (r() - 0.5) * 3;
    const shape = new T.Shape(); shape.moveTo(x0 + jag() * 0.3, y0 + (j === 0 ? jag() * 0.4 : 0)); shape.lineTo(x0 + w, y0 + (j === 0 ? jag() * 0.4 : 0)); shape.lineTo(x0 + w + jag() * 0.2, y0 + H2 / 4); shape.lineTo(x0, y0 + H2 / 4); shape.closePath();
    const geo = new T.ShapeGeometry(shape); const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (pos.getX(k) + 80) / 160 * 30, (pos.getY(k) - top) / 160 * 40);
    const m = new T.Mesh(geo, wallMat.clone()); m.material.transparent = true; m.position.z = BACKZ; world.add(m);
    shards.push({ m, cx: x0 + w / 2, cy: y0 + H2 / 8, rx: r() - 0.5, ry: r() - 0.5, d: (Math.abs(i - cols / 2) / cols) * 0.8 + j * 0.25 + r() * 0.4 });
  }
}
const starPts = (() => { const r = rng(11), n = 500, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos.set([(r() - 0.5) * 70, r() * 60 + 4, BACKZ + 0.5], i * 3); } const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); return new T.Points(g, new T.PointsMaterial({ color: 0xc8c8ff, size: 0.12, transparent: true, opacity: 0.6 })); })();
world.add(starPts);
// the glow line (the high-score line) at the top
const glowLine = new T.Mesh(new T.BoxGeometry(70, 0.07, 0.07), new T.MeshBasicMaterial({ color: new T.Color(3, 2.4, 1.5), toneMapped: false }));
glowLine.position.set(0, WY(TOPY), -1); world.add(glowLine);
const glowHaze = new T.Sprite(new T.SpriteMaterial({ map: haloTex, color: new T.Color(1, 0.75, 0.45), blending: T.AdditiveBlending, transparent: true, depthWrite: false }));
glowHaze.position.set(0, WY(TOPY), -2); glowHaze.scale.set(50, 3, 1); glowHaze.material.opacity = 0.3; world.add(glowHaze);
// platforms: dark slabs with neon top edges
const NEON = [0xff4fa3, 0x3fe0ff, 0xffd23f];
const platforms = PL.map((p, k) => {
  const g = new T.Group(); g.position.set(WX(p.x), WY(p.y) - 0.15, 0);
  const slab = new T.Mesh(new T.BoxGeometry(p.w * PXU, 0.3, 1.6), new T.MeshStandardMaterial({ color: 0x2a2440, emissive: 0x0d0a1c, roughness: 0.6, metalness: 0.2 }));
  g.add(slab);
  const c = new T.Color(NEON[k % 3]);
  const edge = new T.Mesh(new T.BoxGeometry(p.w * PXU, 0.05, 0.05), new T.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.2), toneMapped: false }));
  edge.position.set(0, -0.02, 0.81); g.add(edge);
  const edge2 = edge.clone(); edge2.position.z = -0.8; g.add(edge2);
  world.add(g); return g;
});
// the dead-pixel floor: thousands of small dim cubes in mounds
const pile = (() => {
  const r = rng(5), n = 5200, geo = new T.BoxGeometry(0.1, 0.1, 0.1), mat = new T.MeshStandardMaterial({ roughness: 0.7, metalness: 0.1 });
  const m = new T.InstancedMesh(geo, mat, n), M = new T.Matrix4(), c = new T.Color();
  for (let i = 0; i < n; i++) {
    const x = r() * 44 - 22, front = r() < 0.12, z = front ? 0.3 + r() * 2.2 : -0.35 - r() * 4.2, mound = Math.max(0, 0.45 + 0.5 * Math.sin(x * 0.45 + 1.3) + 0.3 * Math.sin(x * 1.3 + z)), y = r() ** 1.6 * mound * (front ? 0.15 : 1);
    M.makeRotationY(r() * 0.4); M.setPosition(x, y - 0.05, z); m.setMatrixAt(i, M);
    const v = 0.03 + r() * 0.07, tint = r();
    c.setRGB(tint < 0.1 ? v * 2.2 : v, tint < 0.2 && tint >= 0.1 ? v * 1.8 : v, v * 1.3); m.setColorAt(i, c);
  }
  return m;
})();
world.add(pile);
const ground = new T.Mesh(new T.PlaneGeometry(80, 20), new T.MeshStandardMaterial({ color: 0x07060b, roughness: 0.9 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; world.add(ground);
// static rain at rock bottom: a field of tiny quads
const staticPts = (() => { const n = 3000, pos = new Float32Array(n * 3); const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); return new T.Points(g, new T.PointsMaterial({ color: 0xd0d0e0, size: 0.04, transparent: true, opacity: 0, depthWrite: false })); })();
world.add(staticPts);
// gnats: three little cubes and flapping wings
function makeGnat() { const g = new T.Group(); const body = new T.Mesh(new T.BoxGeometry(0.4, 0.2, 0.2), new T.MeshBasicMaterial({ color: new T.Color(0.6, 1.6, 0.4), toneMapped: false })); g.add(body); const w1 = new T.Mesh(new T.BoxGeometry(0.2, 0.06, 0.3), new T.MeshBasicMaterial({ color: 0xd8f5ff, transparent: true, opacity: 0.8 })); w1.position.set(-0.08, 0.15, 0); g.add(w1); const w2 = w1.clone(); w2.position.x = 0.12; g.add(w2); g.userData = { w1, w2 }; world.add(g); return g; }
const gnats = [makeGnat(), makeGnat()];

// ---- space (above the glow line, and around everything in the last act) ------------------------------------------
const spaceG = new T.Group(); scene.add(spaceG);
const skyS = new T.Mesh(new T.SphereGeometry(1500, 64, 32), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, toneMapped: false, depthWrite: false }));
skyS.renderOrder = -10; spaceG.add(skyS);
const sun = new T.DirectionalLight(0xfff1e0, 2.2); sun.position.set(-1, 0.7, 0.8); spaceG.add(sun);
const spaceAmb = new T.AmbientLight(0x404060, 0.25); spaceG.add(spaceAmb);
const planet = (tex, r, pos, tilt = 0) => { const m = new T.Mesh(new T.SphereGeometry(r, 64, 32), new T.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 })); m.position.copy(pos); m.rotation.z = tilt; spaceG.add(m); return m; };
const jupiter = planet(jupT, 140, V3(-260, 140, -700), 0.05);
const saturn = planet(satT, 70, V3(330, 120, -620), 0.45);
const earth = planet(earT, 22, V3(120, -40, -420), 0.4);
const neptune = planet(nepT, 16, V3(-90, 200, -560), 0.3);
const mars = planet(marT, 9, V3(260, -70, -360), 0.4);
{ const ri = 70 * 1.24, ro = 70 * 2.33, geo = new T.RingGeometry(ri, ro, 160, 1), uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - ri) / (ro - ri), 0.5);
  const ring = new T.Mesh(geo, new T.MeshStandardMaterial({ map: ringT, transparent: true, side: T.DoubleSide, roughness: 1, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2 + 0.35; saturn.add(ring); }
for (const p of [jupiter, saturn, earth, neptune, mars]) { const a = new T.Sprite(new T.SpriteMaterial({ map: haloTex, color: new T.Color(0.45, 0.55, 0.9), blending: T.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.35 })); const r = p.geometry.parameters.radius; a.scale.set(r * 2.6, r * 2.6, 1); p.add(a); }
spaceG.position.set(0, 0, -200);                      // centred on the inside world; seen only through the crack, then all round

// ---- the cast ----------------------------------------------------------------------------------------------------
const ours = new Clawd(world, true);
const OTHERS = [44, 78, 112, 186, 214, 246, 278, 22, 132, 300, 64, 232].map((x, i) => ({ x, i, dir: x < 160 ? 1 : -1, lit: B.blip + 2.2 + i * 0.55, c: new Clawd(world) }));
const column = Array.from({ length: 11 }, () => new Clawd(world));
const crossed = Array.from({ length: 11 }, () => new Clawd(world));
const chain = Array.from({ length: 9 }, () => new Clawd(world));
const constel = (() => { const r = rng(404); return Array.from({ length: 30 }, () => ({ x: (r() - 0.5) * 34, y: 6 + r() * 14, z: -6 - r() * 22, ph: r() * 6, s: 0.7 + r() * 0.8, dir: r() < 0.5 ? 1 : -1, c: new Clawd(world) })); })();

// ---- the climbs (as comingup.js) -----------------------------------------------------------------------------------
const CLIMBS = [
  { t0: B.c1, dt: 1.3, ks: [0, 1, 2, 3, 4, 5], fall: B.hit1, land: B.land1 },
  { t0: B.c2, dt: 0.95, ks: [0, 1, 2, 3, 4, 5, 6, 7], fall: B.hit2, land: B.land2 },
  { t0: B.c3, dt: 0.62, ks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], fall: B.crumble, land: B.land3 },
];
function climbPos(t) {
  let pos = { x: 160, y: 0, pose: 'stand', dir: 1 };
  for (const C of CLIMBS) {
    if (t < C.t0) break;
    if (t >= C.land) { pos = { x: STAND(C.ks[Math.min(C.ks.length - 1, Math.floor((C.fall - C.t0) / C.dt))]).x, y: 0, pose: 'stand', dir: 1 }; continue; }
    if (t >= C.fall) {
      const i = Math.min(C.ks.length - 1, Math.floor((C.fall - C.t0) / C.dt)), p = STAND(C.ks[i]), u = (t - C.fall) / (C.land - C.fall);
      return { x: p.x + Math.sin(u * 3) * 6, y: p.y * (1 - u * u), pose: Math.floor(t * 8) % 2 ? 'jump' : 'curl', dir: Math.floor(t * 6) % 2 ? 1 : -1 };
    }
    const f = (t - C.t0) / C.dt, i = Math.floor(f), u = f - i;
    if (i >= C.ks.length) { const p = STAND(C.ks[C.ks.length - 1]); return { x: p.x, y: p.y, pose: 'stand', dir: 1 }; }
    const a = STAND(i === 0 ? -1 : C.ks[i - 1]), b = STAND(C.ks[i]), hop = clamp((u - 0.35) / 0.65, 0, 1);
    return { x: lerp(a.x, b.x, ease(hop)), y: lerp(a.y, b.y, hop) - Math.sin(hop * Math.PI) * 18, pose: hop > 0 && hop < 1 ? 'jump' : 'stand', dir: b.x >= a.x ? 1 : -1 };
  }
  return pos;
}
const smoothY = (t, f, lag = 0.35) => { let s = 0; for (let k = 0; k < 6; k++) s += f(t - lag * k / 5).y; return s / 6; };

// ---- camera helpers ----------------------------------------------------------------------------------------------------
// look at world pixel (cx, cy) from a distance (metres), with a slow drift for parallax
function worldCam(t, cx, cy, dist, yaw = 0, pitch = 0) {
  const tx = WX(cx), ty = WY(cy), w = world.position;
  const drift = Math.sin(t * 0.17) * 0.06 + yaw, up = Math.sin(t * 0.13) * 0.03 + pitch;
  camera.position.set(w.x + tx + Math.sin(drift) * dist, w.y + ty + Math.sin(up) * dist + dist * 0.06, w.z + Math.cos(drift) * dist);
  camera.lookAt(w.x + tx, w.y + ty, w.z);
}

// ---- reset everything per frame ------------------------------------------------------------------------------------------
function hideCast() { ours.set({ visible: false }); for (const o of OTHERS) o.c.set({ visible: false }); for (const c of column) c.set({ visible: false }); for (const c of crossed) c.set({ visible: false }); for (const c of chain) c.set({ visible: false }); for (const s of constel) s.c.set({ visible: false }); gnats.forEach((g) => (g.visible = false)); }

function insideScene(t, sc) {
  hideCast();
  room.visible = false; world.visible = true; spaceG.visible = false; scene.background = new T.Color(0x05040a);
  platforms.forEach((p) => { p.visible = true; p.position.y = WY(PL[platforms.indexOf(p)].y) - 0.15; });
  shards.forEach((s) => { s.m.visible = true; s.m.position.set(0, 0, BACKZ); s.m.rotation.set(0, 0, 0); s.m.material.opacity = 1; s.m.material.color.copy(wallMat.color); });
  glowLine.material.color.setRGB(1.3, 1.05, 0.75); glowHaze.material.opacity = 0.18;
  staticPts.material.opacity = 0; topLight.intensity = 2;
  Final.uniforms.uCRT.value = 1;
  if (sc === 'bottom') {
    const up = seg(t, B.tiltUp, B.tiltUp + 2.4) * (1 - seg(t, B.tiltDown, B.tiltDown + 2.6));
    worldCam(t, 160, lerp(-12, TOPY + 120, up), lerp(9, 42, up), 0.1, 0.02);
    ours.set({ x: 160, y: 0, t, eyeUp: seg(t, B.lookUp, B.lookUp + 0.6) * 1.2, flick: true, dim: 0.85, glow: 0.25 });
  } else if (sc === 'trying' || sc === 'again') {
    const p = climbPos(t);
    if (t >= B.crumble) { const pp = platforms[11], u = t - B.crumble; pp.position.y = WY(PL[11].y) - 0.15 - u * u * 6; pp.visible = u < 3; }
    worldCam(t, p.x * 0.45 + 160 * 0.55, Math.min(-20, smoothY(t, climbPos) - 12), 9.5, 0.18, 0.03);
    for (const [tb, th, gi] of [[B.bug1, B.hit1, 0], [B.hit2 - 1.2, B.hit2, 1]]) if (t > tb && t < th + 1.2) {
      const q = climbPos(th - 0.01), u = (t - tb) / (th - tb), gx = lerp(q.x - 120, q.x, Math.min(1, u)) + (u > 1 ? (u - 1) * 90 : 0), g = gnats[gi];
      g.visible = true; g.position.set(WX(gx), WY(q.y - 6) + Math.sin(t * 9) * 0.3, 0.3); const f = Math.floor(t * 20) % 2; g.userData.w1.position.y = g.userData.w2.position.y = 0.15 + f * 0.06;
    }
    const smile = t > B.smile1 && t < B.hit1 ? 1 : 0, lying = t > B.land3;
    ours.set({ x: p.x, y: lying ? 0 : p.y, pose: lying ? 'lie' : p.pose, dir: p.dir, flick: true, eyeUp: smile ? 0.6 : 0.2, t, glow: 0.3 + smile * 0.35, dim: lying ? 1 - seg(t, B.land3, B.land3 + 0.6) * 0.4 : 1 });
    if (lying) staticPts.material.opacity = seg(t, B.land3, B.land3 + 0.8) * 0.3;
  } else if (sc === 'lowest') {
    const k = seg(t, B.dimOut, B.dimOut + 6), x = STAND(11).x;
    worldCam(t, x, -6, lerp(6, 4.2, seg(t, SCN.lowest[0], SCN.lowest[1])), 0.05, 0.02);
    ours.set({ x, y: 0, pose: 'curl', flick: true, dim: lerp(0.6, 0.14, k), glow: 0.18 * (1 - k), t });
    topLight.intensity = 2 * (1 - k * 0.8);
    staticPts.material.opacity = 0.35 + 0.35 * Math.sin(Math.PI * clamp((t - SCN.lowest[0]) / 10, 0, 1));
  } else if (sc === 'light' || sc === 'together') {
    const ourX = STAND(11).x, pull = seg(t, B.reveal, B.reveal + 6);
    if (sc === 'light') worldCam(t, lerp(ourX, 160, pull), lerp(-6, -18, pull), lerp(4.5, 26, pull), 0.08, 0.03);
    else worldCam(t, 160, -14, 22, 0.12, 0.03);
    const near = OTHERS[3];
    for (const o of OTHERS) {
      const blipK = t > o.lit ? 0.12 + 0.08 * Math.sin((t - o.lit) * 6) : 0, isNear = o === near;
      let dim = 0.16, glow = Math.max(blipK, isNear && t > B.blip ? 0.25 : 0), x = o.x, pose = 'curl', dir = o.dir;
      if (sc === 'together') {
        const lightT = isNear ? B.take : B.spread + o.i * 0.45, on = seg(t, lightT, lightT + 0.8);
        dim = lerp(0.16, 1, on); glow = lerp(glow, 0.7, on); pose = on > 0.5 ? 'stand' : 'curl';
        x = lerp(o.x, 160 + (o.i - 6) * 13, seg(t, lightT + 0.6, lightT + 3.2)); dir = x < 160 ? 1 : -1;
      }
      o.c.set({ x, y: 0, z: (o.i % 3) * 0.6 - 0.6, pose, dim, glow, dir, t: t + o.i });
    }
    let x = ourX, pose = t > B.headUp ? 'lie' : 'curl', dim = t > B.headUp ? 0.3 : 0.18, eyeUp = t > B.headUp ? 0.8 : 0;
    if (sc === 'together') {
      pose = t < B.rise ? 'lie' : t < B.offer ? 'stand' : t < B.take + 1.2 ? 'reach' : 'stand';
      x = lerp(ourX, near.x - 13, seg(t, B.rise + 0.6, B.offer - 0.3)); dim = lerp(0.35, 1, seg(t, B.take, B.take + 1));
      if (t > B.spread) x = lerp(near.x - 13, 154, seg(t, B.spread + 1, B.spread + 4));
    }
    ours.set({ x, y: 0, z: 0.3, pose, dim, eyeUp, flick: true, t, glow: sc === 'together' ? lerp(0.15, 0.9, seg(t, B.take, B.take + 1.2)) : 0.08 });
    topLight.intensity = sc === 'together' ? lerp(0.6, 2.4, seg(t, B.take, B.take + 6)) : 0.6;
  } else if (sc === 'climb') {
    const N = 11, u = clamp((t - B.stack) / (B.top - B.stack), 0, 1), k = u * 12, kb = Math.floor(k), fr = k - kb;
    const a = STAND(kb - 1), b = STAND(Math.min(12, kb)), bx = lerp(a.x, b.x, ease(fr)), byy = lerp(a.y, b.y, ease(fr)), build = seg(t, B.stack, B.stack + 3);
    if (t > B.gap && t < B.gap + 3.5) { const gp = Math.min(12, kb + 1); platforms[gp].visible = false; }
    worldCam(t, 160 + (bx - 160) * 0.4, clamp(byy - 55, TOPY + 70, -40), 26, 0.22 + Math.sin(t * 0.2) * 0.1, 0.04);
    const bridging = t > B.bridge && t < B.bridge + 2.5;
    column.forEach((c, i) => {
      const vis = clamp(build * N - i, 0, 1); if (vis <= 0) return;
      let x = bx + Math.sin(t * 2 + i) * 0.6, y = byy - i * 10.5, pose = i === 0 ? 'stand' : 'hang';
      if (bridging && i >= N - 4) { const j = i - (N - 5); x = bx + j * 11 * (b.x > a.x ? -1 : 1); y = byy - (N - 5) * 10.5; }
      if (t > B.slip && t < B.catch + 0.8 && i === 6) { const s = seg(t, B.slip, B.slip + 0.3) * (1 - seg(t, B.catch, B.catch + 0.6)); x += -14 * s; y += 6 * s; pose = 'jump'; }
      if (t > B.slip + 0.3 && t < B.catch + 0.6 && (i === 5 || i === 7)) pose = 'reach';
      (i === 0 ? ours : c).set({ x, y, pose, dir: i % 2 ? -1 : 1, flick: i === 0, eyeUp: 1, glow: 0.65, t: t + i });
    });
    if (t > B.slip - 0.6 && t < B.slip + 0.6) { const g = gnats[0]; g.visible = true; g.position.set(WX(lerp(bx - 90, bx - 10, seg(t, B.slip - 0.6, B.slip)) - (t > B.slip ? (t - B.slip) * 150 : 0)), WY(byy - 6 * 10.5 - 4), 0.3); }
    topLight.intensity = 2.6;
  }
}

function breakScene(t, sc) {
  hideCast();
  room.visible = false; world.visible = true; spaceG.visible = true; scene.background = new T.Color(0x020309);
  platforms.forEach((p, i) => { p.visible = true; p.position.y = WY(PL[i].y) - 0.15; });
  staticPts.material.opacity = 0;
  const crackK = seg(t, B.crack, B.open), openK = seg(t, B.open, B.open + 3);
  Final.uniforms.uCRT.value = 1 - openK * 0.8;
  // the shards fly apart from the middle out
  shards.forEach((s) => {
    const u = clamp((t - B.open - s.d) / 2.2, 0, 1), e = u * u;
    s.m.visible = u < 1; s.m.position.set(s.rx * e * 30, (0.3 + s.ry) * e * 20 - e * 6, BACKZ + e * 14);
    s.m.rotation.set(s.ry * e * 3, s.rx * e * 3, s.rx * e * 2); s.m.material.opacity = 1 - u;
    if (crackK > 0 && u === 0) s.m.material.color.setRGB(0.6 + crackK * 0.2, 0.55 + crackK * 0.15, 0.8);
  });
  const gone = 1 - 0.6 * seg(t, B.open + 0.5, B.open + 3.5); glowLine.material.color.setRGB(1.3 + crackK * 0.9, 1.05 + crackK * 0.7, 0.75 + crackK * 0.4); glowLine.material.color.multiplyScalar(gone); glowHaze.material.opacity = 0.18 * gone;
  topLight.intensity = 2.6 + crackK * 4;
  const N = 11, baseY = TOPY + 2 + (N - 1) * 10.5;
  if (sc === 'break') {
    worldCam(t, 160, lerp(TOPY + 40, TOPY - 30, seg(t, B.open, B.pour + 4)), lerp(14, 22, seg(t, B.open, B.pour + 4)), 0.18, lerp(0.03, 0.12, openK));
    const remain = N - 1 - Math.floor(clamp((t - B.pour) / 0.65, 0, N - 1));
    for (let i = 0; i <= remain; i++) {
      const y = baseY - i * 10.5, push = i === N - 1 && t > B.push && t < B.open ? Math.abs(Math.sin((t - B.push) * 5)) * 1.5 : 0;
      (i === 0 ? ours : column[i]).set({ x: 160 + Math.sin(t * 2 + i) * 0.6, y: y - push, pose: i === 0 ? 'stand' : 'hang', dir: i % 2 ? -1 : 1, flick: i === 0, eyeUp: 1, glow: 0.65, t: t + i });
    }
    for (let i = N - 1; i > remain; i--) {
      const tc = B.pour + (N - 1 - i) * 0.65, u = t - tc, c = crossed[i];
      c.set({ x: 160 + Math.sin(i * 2.1) * 30 * Math.min(1, u) + Math.sin(i * 1.7) * u * 10, y: TOPY - 6 - u * 24, z: -u * 0.8, pose: 'hang', dir: i % 2 ? -1 : 1, glow: 1, dim: 1, eyeUp: 1, t: t + i, scale: 1 + Math.min(1, u) * 0.2 });
    }
  } else {
    worldCam(t, 160, lerp(TOPY + 60, TOPY - 20, seg(t, B.pulled, B.solid + 1.5)), lerp(20, 16, seg(t, B.pulled, B.solid + 1.5)), 0.12, 0.08);
    const jump = t > B.alone + 1.2 && t < B.alone + 2.2 ? Math.sin(((t - B.alone - 1.2) / 1) * Math.PI) * 12 : 0;
    const pulled = seg(t, B.pulled, B.solid + 0.4), y = lerp(baseY, TOPY - 30, pulled) - jump;
    ours.set({ x: 160, y, pose: t > B.grab ? 'hang' : jump > 0 ? 'jump' : 'stand', flick: t < B.solid, eyeUp: 1.2, glow: lerp(0.5, 1.2, seg(t, B.solid - 0.5, B.solid + 0.5)), t, scale: 1 + seg(t, B.solid - 0.5, B.solid + 0.8) * 0.15 });
    const reach = seg(t, B.chain, B.grab), pull = seg(t, B.pulled, B.solid + 0.4);
    chain.forEach((c, j) => { if (j / chain.length > reach + 0.01) return; c.set({ x: 160, y: TOPY - 6 + j * 10.5 * reach - pull * 100 - 11 * 0, pose: 'hang', dir: j % 2 ? 1 : -1, glow: 0.9, eyeUp: 0.6, t: t + j }); });
    if (t > SCN.last[1] - 0.8) Final.uniforms.uFlash.value = seg(t, SCN.last[1] - 0.8, SCN.last[1]);
  }
}

function endScene(t) {
  hideCast();
  const u = t - SCN.end[0], pullOut = seg(t, B.endTitle + 1.2, B.fadeOut);
  world.visible = true; spaceG.visible = true; room.visible = false; scene.background = new T.Color(0x020309);
  platforms.forEach((p) => (p.visible = false)); shards.forEach((s) => (s.m.visible = false)); pile.visible = false; ground.visible = false; wallLow.visible = false; glowLine.visible = false; glowHaze.visible = false; starPts.visible = false;
  Final.uniforms.uCRT.value = 0.15;
  const w = world.position;
  // a slow drift through the constellation, ours in front
  camera.position.set(w.x + Math.sin(u * 0.05) * 3, w.y + 9 + u * 0.12, w.z + 18 - u * 0.25);
  camera.lookAt(w.x, w.y + 11, w.z - 10);
  for (const s of constel) s.c.set({ x: 160 + s.x / PXU + Math.sin(t * 0.3 + s.ph) * 3, y: -(s.y + Math.sin(t * 0.9 + s.ph) * 0.4) / PXU, z: s.z, pose: 'stand', dir: s.dir, glow: 0.4, dim: 1, eyeUp: 0.5, t: t + s.ph, scale: s.s });
  const look = seg(t, B.lookBack, B.lookBack + 0.8) * (1 - seg(t, B.lookBack + 3, B.lookBack + 3.8));
  ours.set({ x: 160 + 30, y: -(9.8 + Math.sin(t * 1.1) * 0.15) / PXU, z: 2, pose: 'stand', dir: look > 0.5 ? -1 : 1, glow: 0.3, t, eyeUp: 0.3, scale: 1.4 });
  if (u < 1.2) Final.uniforms.uFlash.value = 1 - u / 1.2;
  return pullOut;
}

// The room: the cabinet in the dark, its screen showing the inside world
function roomShot(t, k, phase) {
  staticPts.visible = staticPts.material.opacity > 0.01;
  world.visible = true; room.visible = false;
  // first render the inside to the screen's target from the inside camera
  const save = camera.position.clone(), saveQ = camera.quaternion.clone();
  renderer.setRenderTarget(screenRT); renderer.setClearColor(0x05040a, 1); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
  // then the room
  world.visible = false; spaceG.visible = false; room.visible = true; scene.background = new T.Color(0x020205);
  hideCastAfter();
  const p = phase === 'in' ? k : 1 - k;                // 0: far, 1: at the screen
  const far = V3(1.6, 1.25, 3.4), near = V3(0, SCREEN_C.y + 0.02, SCREEN_C.z + 0.26);
  camera.position.copy(far).lerp(near, ease(p));
  const look = V3(0.1, 1.15, 0).lerp(SCREEN_C, ease(Math.min(1, p * 1.2)));
  camera.lookAt(look);
  Final.uniforms.uCRT.value = 0;
  void save; void saveQ;
}
function hideCastAfter() {}

// ---- the frame ----------------------------------------------------------------------------------------------------------
function frame(t) {
  const sc = sceneAt(t);
  Final.uniforms.uTime.value = t; Final.uniforms.uFade.value = 0; Final.uniforms.uFlash.value = 0; Final.uniforms.uExposure.value = 1;
  pile.visible = ground.visible = wallLow.visible = glowLine.visible = glowHaze.visible = starPts.visible = true;
  capCtx.clearRect(0, 0, W, H);
  // static rain positions
  { const pos = staticPts.geometry.attributes.position, r = rng(Math.floor(t * 24)), cx = camera.position.x; for (let i = 0; i < pos.count; i++) pos.setXYZ(i, (r() - 0.5) * 16, r() * 6, (r() - 0.5) * 5 - 0.5); pos.needsUpdate = true; void cx; }
  const IN_END = 6.5;                                    // the opening push into the screen
  if (sc === 'end') {
    const out = endScene(t);
    if (out > 0) {                                        // pull back out of the cabinet's screen
      roomShot(t, out, 'out');
    }
    caption('No one comes up alone.', seg(t, B.endTitle, B.endTitle + 1.6) * (1 - seg(t, B.fadeOut, DURATION)), 76, H * 0.15);
    Final.uniforms.uFade.value = seg(t, B.fadeOut + 0.5, DURATION);
  } else if (sc === 'break' || sc === 'last') breakScene(t, sc);
  else {
    insideScene(t, sc);
    if (t < IN_END) roomShot(t, seg(t, 0, IN_END), 'in');
    if (sc === 'bottom') {
      caption('CLAWD', seg(t, IN_END - 0.4, IN_END + 0.6) * (1 - seg(t, IN_END + 3.4, IN_END + 4.4)), 120, H * 0.36);
      caption('coming up', seg(t, IN_END + 0.2, IN_END + 1.2) * (1 - seg(t, IN_END + 3.4, IN_END + 4.4)), 46, H * 0.47, '#ffc79a');
    }
    // dips at the act joins
    const dip = (a, d) => clamp(1 - Math.abs(t - a) / d, 0, 1);
    Final.uniforms.uFade.value = Math.max(dip(SCN.lowest[0], 0.5), dip(SCN.light[0], 0.8) * 0.8, t < 0.6 ? 1 - t / 0.6 : 0);
    // the cut from the room into the world: a white-ish flash as the camera passes the glass
    Final.uniforms.uFlash.value = Math.max(Final.uniforms.uFlash.value, clamp(1 - Math.abs(t - IN_END) / 0.35, 0, 1) * 0.6);
  }
  staticPts.visible = staticPts.material.opacity > 0.01;
  composer.render();
  capTex.needsUpdate = true;
  renderer.autoClear = false; renderer.render(hudScene, hudCam); renderer.autoClear = true;
}
function caption(text, a, size, y, col = '#ffe7c7') {
  if (a <= 0) return;
  capCtx.save(); capCtx.globalAlpha = a; capCtx.font = `bold ${size}px "Liberation Sans", Arial, sans-serif`; capCtx.textAlign = 'center'; capCtx.textBaseline = 'middle';
  capCtx.shadowColor = 'rgba(255,150,90,0.7)'; capCtx.shadowBlur = 30; capCtx.fillStyle = col; capCtx.fillText(text, W / 2, y); capCtx.restore();
}

window.DURATION = DURATION; window.FPS = FPS;
window.renderFrame = (i) => frame(i / FPS);
if (!new URLSearchParams(location.search).has('render')) { const t0 = performance.now(); const loop = () => { frame(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); }; loop(); }
window.ready = true;
