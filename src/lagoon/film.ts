import * as THREE from "three";
import {
  buildBungalows,
  buildClouds,
  buildDock,
  buildIsland,
  buildPalms,
  buildPerson,
  buildPlane,
} from "./actors";
import { skyFragmentShader, skyVertexShader, waterFragmentShader, waterVertexShader } from "./shaders";
import {
  DURATION,
  MASK_SIZE_PX,
  PHASES,
  PLANE_STOP,
  buildMaskTexture,
  phaseAt,
  smoothstep,
  waterHeight,
  type PhaseId,
} from "./world";

export type FrameInfo = {
  time: number;
  duration: number;
  phase: string;
  phaseId: PhaseId;
  playing: boolean;
  ended: boolean;
};

export type FilmApi = {
  dispose: () => void;
  seek: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  setOrbit: (yaw: number, pitch: number) => void;
  replay: () => void;
};

type Key = { t: number; x: number; y: number; z: number };

const PATH: Key[] = [
  { t: 0, x: 230, y: 82, z: 500 },
  { t: 9, x: 92, y: 38, z: 230 },
  { t: 16, x: 22, y: 15, z: 92 },
  { t: 21, x: -1, y: 5.2, z: 30 },
  { t: 24.2, x: -6.2, y: 0.85, z: 0 },
  { t: 26, x: -7.2, y: 0.02, z: -12 },
  { t: 27.5, x: -7.35, y: 0.42, z: -16 },
  { t: 29.4, x: PLANE_STOP.x, y: PLANE_STOP.y, z: -20 },
  { t: 37, x: PLANE_STOP.x, y: PLANE_STOP.y, z: PLANE_STOP.z },
  { t: 56, x: PLANE_STOP.x, y: PLANE_STOP.y, z: PLANE_STOP.z },
];

const SUN = new THREE.Vector3(-0.9, 0.28, 0.34).normalize();
const HORIZON = new THREE.Color(0xc5d4dc);
const ZENITH = new THREE.Color(0x2f6fbe);
const FOG = new THREE.Color(0xc5d5dc);

const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _look = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _right = new THREE.Vector3();
const _door = new THREE.Vector3(1.2, 0.22, 0.15);
const _doorWorld = new THREE.Vector3();
const _step = new THREE.Vector3();
const _dockPt = new THREE.Vector3();
const _stand = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const DOCK_LOOK = new THREE.Vector3(-10.5, 1.5, -17.5);

function catmull(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

function samplePath(t: number, out: THREE.Vector3): void {
  const keys = PATH;
  const clamped = Math.min(Math.max(t, keys[0]!.t), keys[keys.length - 1]!.t);
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1]!.t < clamped) i++;
  const i0 = Math.max(0, i - 1);
  const i1 = i;
  const i2 = Math.min(keys.length - 1, i + 1);
  const i3 = Math.min(keys.length - 1, i + 2);
  const span = keys[i2]!.t - keys[i1]!.t || 1;
  const u = (clamped - keys[i1]!.t) / span;
  out.set(
    catmull(keys[i0]!.x, keys[i1]!.x, keys[i2]!.x, keys[i3]!.x, u),
    catmull(keys[i0]!.y, keys[i1]!.y, keys[i2]!.y, keys[i3]!.y, u),
    catmull(keys[i0]!.z, keys[i1]!.z, keys[i2]!.z, keys[i3]!.z, u),
  );
}

function faceForward(obj: THREE.Object3D, forward: THREE.Vector3): void {
  _fwd.copy(forward);
  _fwd.y = 0;
  if (_fwd.lengthSq() < 1e-6) return;
  _fwd.normalize();
  _x.crossVectors(_up, _fwd).normalize();
  _y.crossVectors(_fwd, _x).normalize();
  _m.makeBasis(_x, _y, _fwd);
  obj.quaternion.setFromRotationMatrix(_m);
}

type Shot = { t: number; back: number; up: number; side: number; look: number };
const SHOTS: Shot[] = [
  { t: 0, back: 42, up: 16, side: 22, look: 26 },
  { t: 8, back: 30, up: 10, side: -18, look: 16 },
  { t: 16, back: 18, up: 5.2, side: 12, look: 10 },
  { t: 22, back: 13, up: 3.1, side: -8.5, look: 7 },
  { t: 25.2, back: 15, up: 2.5, side: 7.5, look: 4 },
  { t: 33, back: 18, up: 5.5, side: 9, look: 2 },
  { t: 40, back: 20, up: 8.5, side: 18, look: 4 },
  { t: 56, back: 22, up: 9.2, side: 20, look: 2 },
];

function sampleShot(t: number): Shot {
  let i = 0;
  while (i < SHOTS.length - 2 && SHOTS[i + 1]!.t < t) i++;
  const a = SHOTS[i]!;
  const b = SHOTS[Math.min(SHOTS.length - 1, i + 1)]!;
  const u = smoothstep(a.t, b.t, t);
  return {
    t,
    back: a.back + (b.back - a.back) * u,
    up: a.up + (b.up - a.up) * u,
    side: a.side + (b.side - a.side) * u,
    look: a.look + (b.look - a.look) * u,
  };
}

function propRate(t: number): number {
  if (t < 20) return 62;
  if (t < 26) return 62 + (32 - 62) * smoothstep(20, 26, t);
  if (t < 36) return 32 + (6 - 32) * smoothstep(26, 36, t);
  return 6 * (1 - smoothstep(36, 41, t));
}

function doorAmount(t: number): number {
  return smoothstep(38.4, 40.6, t);
}

export function mountFilm(
  canvas: HTMLCanvasElement,
  opts: { reduced: boolean; onFrame: (frame: FrameInfo) => void },
): FilmApi {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setClearColor(FOG, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, 140, 1100);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.2, 4200);

  const mask = new THREE.DataTexture(buildMaskTexture(), MASK_SIZE_PX, MASK_SIZE_PX);
  mask.colorSpace = THREE.NoColorSpace;
  mask.wrapS = THREE.ClampToEdgeWrapping;
  mask.wrapT = THREE.ClampToEdgeWrapping;
  mask.minFilter = THREE.LinearFilter;
  mask.magFilter = THREE.LinearFilter;
  mask.flipY = false;
  mask.needsUpdate = true;

  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 1 },
    uMask: { value: mask },
    uSunDir: { value: SUN.clone() },
    uHorizon: { value: HORIZON },
    uZenith: { value: ZENITH },
    uFog: { value: FOG },
  };

  const waterMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: waterVertexShader(),
    fragmentShader: waterFragmentShader,
  });
  const nearGeo = new THREE.PlaneGeometry(2200, 2200, 1, 1);
  nearGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(nearGeo, waterMat);
  water.frustumCulled = false;
  water.position.set(40, 0, 60);
  scene.add(water);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1900, 24, 16),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xd7ecff, 0x6d5436, 0.72));
  const sun = new THREE.DirectionalLight(0xfff1d4, 2.35);
  sun.position.copy(SUN).multiplyScalar(400);
  scene.add(sun);

  scene.add(buildDock());
  const clouds = buildClouds();
  scene.add(clouds);

  const plane = buildPlane();
  scene.add(plane.group);
  const people = [0, 1, 2, 3].map((i) => {
    const person = buildPerson(i);
    scene.add(person.group);
    return person;
  });

  const sprayGeo = new THREE.BufferGeometry();
  const sprayCount = 220;
  const sprayPos = new Float32Array(sprayCount * 3);
  sprayGeo.setAttribute("position", new THREE.BufferAttribute(sprayPos, 3));
  const spray = new THREE.Points(
    sprayGeo,
    new THREE.PointsMaterial({
      color: 0xe7f7f4,
      size: 0.45,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  scene.add(spray);
  const drops = Array.from({ length: sprayCount }, () => ({
    x: 0,
    y: -10,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
  }));

  let time = opts.reduced ? 25 : 0;
  let playing = !opts.reduced;
  let orbitYaw = 0;
  let orbitPitch = 0;
  let snap = true;
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  let raf = 0;
  let last = performance.now();
  let stopped = false;

  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, w < 800 ? 1.4 : 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  function posePlane(t: number, dt: number) {
    samplePath(t, _a);
    samplePath(Math.min(t + 0.4, DURATION), _b);
    _fwd.subVectors(_b, _a);
    _fwd.y = 0;
    const moving = _fwd.lengthSq() > 0.04;
    if (!moving) _fwd.set(0, 0, -1);
    else _fwd.normalize();
    let y = _a.y;
    if (t >= 29) y = waterHeight(_a.x, _a.z, t) + 0.04;
    else if (t > 25.5) y = Math.max(_a.y, waterHeight(_a.x, _a.z, t) * 0.35);
    plane.group.position.set(_a.x, y, _a.z);
    const noseUp = t < 23 ? -0.05 : t < 26.5 ? 0.14 * (1 - smoothstep(24.2, 26.5, t)) + 0.08 : 0;
    faceForward(plane.group, _fwd);
    plane.group.rotateX(-noseUp);
    if (t > 6 && t < 18) plane.group.rotateZ(Math.sin(t * 0.35) * 0.05);
    const rate = propRate(t);
    for (const hub of plane.props) hub.rotateZ(rate * dt);
    const blurOpacity = Math.min(0.22, rate / 140);
    const bladeOpacity = 1 - Math.min(0.88, rate / 36);
    for (const blur of plane.blurs) {
      const mat = blur.material as THREE.MeshBasicMaterial;
      mat.opacity = blurOpacity;
    }
    for (const blade of plane.blades) {
      const mat = blade.material as THREE.MeshStandardMaterial;
      mat.transparent = bladeOpacity < 0.98;
      mat.opacity = bladeOpacity;
      mat.depthWrite = bladeOpacity > 0.4;
    }
    plane.door.rotation.y = -1.25 * doorAmount(t);
    plane.group.updateMatrixWorld(true);
  }

  function placePeople(t: number) {
    _doorWorld.copy(_door);
    plane.group.localToWorld(_doorWorld);
    people.forEach((person, i) => {
      const start = 39.0 + i * 0.7;
      const head = plane.heads[i];
      if (head) head.visible = t < start;
      const u = t - start;
      if (u < -0.05) {
        person.group.visible = false;
        return;
      }
      person.group.visible = true;
      _step.set(-9.7, 0.74, -22.1);
      _dockPt.set(-12.15, 0.84, -19.4);
      _stand.set(-11.7, 0.84, -13.6 - i * 1.15);
      let from = _doorWorld;
      let to = _step;
      let f = 0;
      if (u < 1.05) {
        f = smoothstep(0, 1.05, u);
        from = _doorWorld;
        to = _step;
      } else if (u < 2.15) {
        f = smoothstep(1.05, 2.15, u);
        from = _step;
        to = _dockPt;
      } else if (u < 4.3) {
        f = smoothstep(2.15, 4.3, u);
        from = _dockPt;
        to = _stand;
      } else {
        f = 1;
        from = _stand;
        to = _stand;
      }
      person.group.position.lerpVectors(from, to, f);
      _fwd.subVectors(to, from);
      const walking = _fwd.lengthSq() > 0.04 && u < 4.3;
      if (!walking) _fwd.set(0.8, 0, -0.25);
      faceForward(person.group, _fwd);
      const swing = Math.sin(t * 7.5 + i) * (walking ? 0.65 : 0.05);
      person.legs[0].rotation.x = swing;
      person.legs[1].rotation.x = -swing;
      person.arms[0].rotation.x = -swing * 0.65;
      person.arms[1].rotation.x = swing * 0.65;
    });
  }

  function emitSpray(dt: number) {
    const t = time;
    const splash = t > 24 && t < 31;
    const rate = splash ? 70 : 0;
    let spawned = 0;
    const budget = rate * dt;
    if (budget > 0) {
      plane.group.updateMatrixWorld(true);
      for (const drop of drops) {
        if (drop.life > 0 || spawned > budget) continue;
        const side = spawned % 2 === 0 ? -1 : 1;
        _a.set(side * 1.12, 0.05, spawned % 3 === 0 ? 2.2 : -1.4);
        plane.group.localToWorld(_a);
        drop.x = _a.x;
        drop.y = _a.y;
        drop.z = _a.z;
        drop.vx = side * (1.5 + Math.random() * 2);
        drop.vy = 1.4 + Math.random() * 2.4;
        drop.vz = 2 + Math.random() * 3;
        drop.life = 0.45 + Math.random() * 0.45;
        spawned++;
      }
    }
    for (let i = 0; i < drops.length; i++) {
      const drop = drops[i]!;
      if (drop.life <= 0) {
        sprayPos[i * 3 + 1] = -20;
        continue;
      }
      drop.life -= dt;
      drop.vy -= 6 * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.z += drop.vz * dt;
      sprayPos[i * 3] = drop.x;
      sprayPos[i * 3 + 1] = drop.y;
      sprayPos[i * 3 + 2] = drop.z;
    }
    (sprayGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  function frameCamera(dt: number) {
    const shot = sampleShot(time);
    samplePath(time, _a);
    _fwd.set(0, 0, -1);
    samplePath(Math.min(time + 0.4, DURATION), _b);
    _fwd.subVectors(_b, _a);
    _fwd.y = 0;
    if (_fwd.lengthSq() < 0.04) _fwd.set(0, 0, -1);
    else _fwd.normalize();
    _x.crossVectors(_up, _fwd).normalize();
    _y.crossVectors(_fwd, _x).normalize();
    _look.copy(plane.group.position).addScaledVector(_fwd, shot.look).addScaledVector(_y, 1.2);
    if (time > 40) _look.lerp(DOCK_LOOK, smoothstep(40, 45, time));
    _cam
      .copy(plane.group.position)
      .addScaledVector(_fwd, -shot.back)
      .addScaledVector(_x, shot.side)
      .addScaledVector(_y, shot.up);
    if (!opts.reduced && time > 24.4 && time < 27.2) {
      const k = Math.sin(time * 46) * Math.exp(-((time - 25.2) ** 2) * 1.4);
      _cam.y += k * 0.22;
    }
    _rel.subVectors(_cam, _look);
    _rel.applyAxisAngle(_up, orbitYaw);
    _right.crossVectors(_rel, _up);
    if (_right.lengthSq() > 1e-6) {
      _right.normalize();
      _rel.applyAxisAngle(_right, orbitPitch);
    }
    _cam.copy(_look).add(_rel);
    if (_cam.y < 1.25) _cam.y = 1.25;
    const blend = snap ? 1 : 1 - Math.exp(-3.4 * dt);
    camPos.lerp(_cam, blend);
    camLook.lerp(_look, blend);
    snap = false;
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  function tick(now: number) {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (playing && time < DURATION) time = Math.min(DURATION, time + dt);
    if (time >= DURATION) playing = false;
    uniforms.uTime.value = time;
    for (const cloud of clouds.children) {
      cloud.position.x += (cloud.userData.drift as number) * dt * 0.15;
      if (cloud.position.x > 520) cloud.position.x = -520;
    }
    posePlane(time, dt);
    placePeople(time);
    emitSpray(dt);
    frameCamera(dt);
    water.position.x = camera.position.x;
    water.position.z = camera.position.z;
    renderer.render(scene, camera);
    const phase = phaseAt(time);
    opts.onFrame({
      time,
      duration: DURATION,
      phase: phase.label,
      phaseId: phase.id,
      playing,
      ended: time >= DURATION,
    });
    raf = requestAnimationFrame(tick);
  }

  posePlane(time, 0.016);
  frameCamera(0.016);
  renderer.render(scene, camera);
  setTimeout(() => {
    if (stopped) return;
    scene.add(buildIsland());
    scene.add(buildBungalows());
    scene.add(buildPalms());
  }, 0);

  raf = requestAnimationFrame(tick);

  return {
    dispose: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      nearGeo.dispose();
      mask.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material?.dispose();
      });
    },
    seek: (t: number) => {
      time = Math.min(DURATION, Math.max(0, t));
      playing = time < DURATION;
      snap = true;
    },
    setPlaying: (next: boolean) => {
      playing = next && time < DURATION;
    },
    setOrbit: (yaw: number, pitch: number) => {
      orbitYaw = yaw;
      orbitPitch = pitch;
    },
    replay: () => {
      time = 0;
      playing = true;
      snap = true;
      orbitYaw = 0;
      orbitPitch = 0;
    },
  };
}

export { DURATION, PHASES };
