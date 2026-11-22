import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { THEME, SUN_DIR, HAZE } from './theme';
export { SUN_DIR, HAZE };

/**
 * The game's "camera look" (design board v3.0): a warm golden-hour sky, haze, distant
 * mountains, bloom, a filmic colour grade with vignette, and a speed blur while boosting.
 * Display only. "Low" graphics skips the post effects for slower computers.
 */
export type Quality = 'high' | 'low';
const KEY = 'tr-gfx', AUTO_KEY = 'tr-gfx-auto';
const store = {
  get: (k = KEY) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (v: string, k = KEY) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
/** Frame rate below which "auto" graphics steps down. */
const SLOW_FPS = 45;


const GRADE = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uSpeed: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uSpeed; uniform float uAspect; varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      vec4 col = texture2D(tDiffuse, vUv);
      // speed blur: smear towards the centre, stronger at the edges
      if (uSpeed > 0.001) {
        float edge = smoothstep(0.12, 0.7, length(c * vec2(uAspect, 1.0)));
        vec3 acc = col.rgb; float k = uSpeed * edge * 0.06;
        for (int i = 1; i <= 6; i++) acc += texture2D(tDiffuse, vUv - c * k * float(i) / 6.0).rgb;
        col.rgb = acc / 7.0;
      }
      // grade (in linear light, before tone mapping): warm highlights, cool shadows, a touch more saturation
      float l = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
      col.rgb = mix(vec3(l), col.rgb, 1.18);
      col.rgb *= mix(vec3(0.94, 0.97, 1.05), vec3(1.05, 1.0, 0.93), smoothstep(0.05, 0.8, l));
      // vignette
      float v = smoothstep(0.95, 0.35, length(c * vec2(uAspect * 0.8, 1.0)));
      col.rgb *= mix(0.72, 1.0, v);
      gl_FragColor = col;
    }`,
};

export class Look {
  quality: Quality;
  private composer: EffectComposer | null = null;
  private grade: ShaderPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private speedFx = 0;
  /** Player picked a setting with G or the menu; otherwise graphics adapt to the computer. */
  private manual: boolean;
  private shadowsOff = false;
  private fpsTime = 0; private fpsFrames = 0; private warm = 0; private slowWindows = 0;
  /** Called when auto graphics steps down, so the game can tell the player. */
  onAutoStep?: (what: 'low' | 'shadows') => void;

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    const saved = store.get();
    this.manual = saved === 'low' || saved === 'high';
    // auto: start where this computer ended up last time
    this.quality = this.manual ? saved as Quality : store.get(AUTO_KEY) === 'low' || store.get(AUTO_KEY) === 'lowest' ? 'low' : 'high';
    if (!this.manual && store.get(AUTO_KEY) === 'lowest') { this.shadowsOff = true; renderer.shadowMap.enabled = false; }
    this.sky = makeSky();
    this.mountains = makeMountains();
    scene.add(this.sky, this.mountains);
    this.apply();
  }

  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private mountains: THREE.Group;

  /** The track changed: recolour the sky and rebuild the distant mountains. */
  applyTheme() {
    const u = this.sky.material.uniforms;
    (u.uTop.value as THREE.Vector3).set(...THEME.skyTop); (u.uMid.value as THREE.Vector3).set(...THEME.skyMid); (u.uGlow.value as THREE.Vector3).set(...THEME.sunGlow);
    this.scene.remove(this.mountains);
    this.mountains.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.mountains = makeMountains();
    this.scene.add(this.mountains);
  }

  setQuality(q: Quality) {
    this.quality = q; this.manual = true; store.set(q);
    if (this.shadowsOff) this.setShadows(true);
    this.apply();
  }

  private setShadows(on: boolean) {
    this.shadowsOff = !on; this.renderer.shadowMap.enabled = on;
    this.scene.traverse((o) => { const m = (o as THREE.Mesh).material; if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true; });
  }

  /** Auto graphics: if the game runs slowly for a few seconds, step down once per slow stretch. */
  private watchSpeed(dt: number) {
    if (this.manual) return;
    if (dt > 0.25) { this.fpsTime = 0; this.fpsFrames = 0; return; }   // tab was hidden or a hitch
    this.warm += dt;
    if (this.warm < 4) return;                                          // let the first frames settle
    this.fpsTime += dt; this.fpsFrames++;
    if (this.fpsTime < 2) return;
    const fps = this.fpsFrames / this.fpsTime;
    this.fpsTime = 0; this.fpsFrames = 0;
    this.slowWindows = fps < SLOW_FPS ? this.slowWindows + 1 : 0;
    if (this.slowWindows < 2) return;
    this.slowWindows = 0; this.warm = 0;
    if (this.quality === 'high') { this.quality = 'low'; store.set('low', AUTO_KEY); this.apply(); this.onAutoStep?.('low'); }
    else if (!this.shadowsOff) { this.setShadows(false); store.set('lowest', AUTO_KEY); this.onAutoStep?.('shadows'); }
  }
  toggle() { this.setQuality(this.quality === 'high' ? 'low' : 'high'); return this.quality; }

  private apply() {
    const high = this.quality === 'high';
    // effects run at up to 1.5x screen sharpness: above that the cost grows fast for little visible gain
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 1.5 : 1));
    if (high && !this.composer) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
      const composer = new EffectComposer(this.renderer, rt);
      composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.22, 0.5, 1.7);
      composer.addPass(this.bloom);
      this.grade = new ShaderPass(GRADE);
      composer.addPass(this.grade);
      composer.addPass(new OutputPass());
      this.composer = composer;
    }
    if (!high && this.composer) { this.composer.dispose(); this.composer = null; this.grade = null; this.bloom = null; }
    this.resize();
  }

  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    if (this.grade) this.grade.uniforms.uAspect.value = w / h;
  }

  /** boost 0..1 drives the speed blur. */
  render(dt: number, boost: number) {
    this.watchSpeed(dt);
    this.speedFx += (boost - this.speedFx) * Math.min(1, dt * 6);
    if (this.composer && this.grade) {
      this.grade.uniforms.uSpeed.value = this.speedFx;
      this.composer.render(dt);
    } else this.renderer.render(this.scene, this.camera);
  }
}

/** Big gradient sky dome: deep blue overhead, warm haze at the horizon, a soft sun glow. */
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN_DIR }, uHaze: { value: HAZE }, uTop: { value: new THREE.Vector3(...THEME.skyTop) }, uMid: { value: new THREE.Vector3(...THEME.skyMid) }, uGlow: { value: new THREE.Vector3(...THEME.sunGlow) } },
    vertexShader: /* glsl */`varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uSun; uniform vec3 uHaze; uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uGlow; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.2, 1.0);
        vec3 top = uTop, mid = uMid;
        vec3 col = mix(mid, top, smoothstep(0.08, 0.75, h));
        col = mix(uHaze, col, smoothstep(-0.02, 0.22, h));
        float s = max(dot(d, uSun), 0.0);
        col += uGlow * (pow(s, 6.0) * 0.35 + pow(s, 64.0) * 0.9) + vec3(1.0, 0.95, 0.85) * pow(s, 900.0) * 6.0;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), mat);
  sky.frustumCulled = false; sky.renderOrder = -1;
  sky.name = 'sky';
  sky.onBeforeRender = (_r, _s, cam) => { sky.position.copy(cam.position); };
  return sky;
}

/** Two rings of hazy, snow-capped mountains far behind the hills. */
function makeMountains() {
  const g = new THREE.Group(); g.name = 'mountains';
  const rnd = seeded(7);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  const rings = [{ r: 520, n: 24, h: [60, 110], col: [THEME.mountainRock[0], THEME.mountainSnow[0]] }, { r: 660, n: 28, h: [100, 170], col: [THEME.mountainRock[1], THEME.mountainSnow[1]] }];
  for (const ring of rings) {
    for (let k = 0; k < ring.n; k++) {
      const a = (k / ring.n) * Math.PI * 2 + rnd() * 0.12;
      const height = ring.h[0] + rnd() * (ring.h[1] - ring.h[0]);
      const base = height * (1.1 + rnd() * 0.6);
      const geo = new THREE.ConeGeometry(base, height, 9, 5, true);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const colors: number[] = [];
      const rock = new THREE.Color(ring.col[0]), snow = new THREE.Color(ring.col[1]), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), t = (y + height / 2) / height;
        if (t < 0.98) { pos.setX(i, pos.getX(i) * (0.85 + rnd() * 0.3)); pos.setZ(i, pos.getZ(i) * (0.85 + rnd() * 0.3)); pos.setY(i, y + (rnd() - 0.5) * height * 0.06); }
        c.copy(rock).lerp(snow, t > THEME.snowLine + rnd() * 0.08 ? 1 : 0);
        colors.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat);
      m.position.set(90 + Math.cos(a) * ring.r, height / 2 - 12, 45 + Math.sin(a) * ring.r);
      m.rotation.y = rnd() * 6;
      g.add(m);
    }
  }
  return g;
}

function seeded(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}
