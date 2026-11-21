import * as THREE from "three";
import { RING, hash, landHeight, landNormal } from "./world";

export type PlaneRig = {
  group: THREE.Group;
  props: THREE.Object3D[];
  blurs: THREE.Mesh[];
  blades: THREE.Mesh[];
  door: THREE.Group;
  heads: THREE.Object3D[];
};

export type PersonRig = {
  group: THREE.Group;
  legs: [THREE.Group, THREE.Group];
  arms: [THREE.Group, THREE.Group];
};

const bodyMat = new THREE.MeshStandardMaterial({
  color: 0xf3efe6,
  roughness: 0.42,
  metalness: 0.04,
});
const stripeMat = new THREE.MeshStandardMaterial({
  color: 0xc4523a,
  roughness: 0.48,
  metalness: 0.02,
});
const tealMat = new THREE.MeshStandardMaterial({
  color: 0x1c6e72,
  roughness: 0.46,
  metalness: 0.06,
});
const floatMat = new THREE.MeshStandardMaterial({
  color: 0xd7d2c8,
  roughness: 0.55,
  metalness: 0.08,
});
const darkMat = new THREE.MeshStandardMaterial({
  color: 0x1a1d20,
  roughness: 0.4,
  metalness: 0.2,
});
const bladeMat = new THREE.MeshStandardMaterial({
  color: 0x1a1d20,
  roughness: 0.4,
  metalness: 0.2,
});
const glassMat = new THREE.MeshBasicMaterial({ color: 0x132026 });
const woodMat = new THREE.MeshStandardMaterial({
  color: 0x8d5e34,
  roughness: 0.86,
  metalness: 0,
});
const deckMat = new THREE.MeshStandardMaterial({
  color: 0xc4a36a,
  roughness: 0.78,
  metalness: 0,
});
const thatchMat = new THREE.MeshStandardMaterial({
  color: 0x9a6230,
  roughness: 0.92,
  metalness: 0,
});
const wallMat = new THREE.MeshStandardMaterial({
  color: 0xf6f1e6,
  roughness: 0.7,
  metalness: 0,
});
const skinMats = [0xc9956c, 0xa8754e, 0xe0b08a, 0x8d5a3c].map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.72 }),
);
const cloth = [
  { shirt: 0xe6d3b0, pants: 0x3e4a55 },
  { shirt: 0xf4efe6, pants: 0x2c3a44 },
  { shirt: 0xd4654a, pants: 0x243038 },
  { shirt: 0x1c7c86, pants: 0x2a3034 },
].map((c) => ({
  shirt: new THREE.MeshStandardMaterial({ color: c.shirt, roughness: 0.78 }),
  pants: new THREE.MeshStandardMaterial({ color: c.pants, roughness: 0.8 }),
}));

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  parent.add(m);
  return m;
}

export function buildPlane(): PlaneRig {
  const group = new THREE.Group();
  group.name = "seaplane";

  const fuseGeo = new THREE.CylinderGeometry(0.9, 0.68, 8.4, 18, 1);
  fuseGeo.rotateX(Math.PI / 2);
  mesh(fuseGeo, bodyMat, group).position.z = 0.15;

  const nose = mesh(new THREE.SphereGeometry(0.9, 16, 12), bodyMat, group);
  nose.scale.set(1, 0.92, 0.72);
  nose.position.set(0, 0.02, 4.15);

  const tailCap = mesh(new THREE.SphereGeometry(0.62, 14, 10), bodyMat, group);
  tailCap.scale.set(1, 0.9, 0.85);
  tailCap.position.set(0, 0.05, -3.95);

  const stripeGeo = new THREE.BoxGeometry(0.04, 0.14, 6.8);
  const stripeL = mesh(stripeGeo, stripeMat, group);
  stripeL.position.set(-0.9, 0.18, 0.2);
  const stripeR = mesh(stripeGeo, stripeMat, group);
  stripeR.position.set(0.9, 0.18, 0.2);
  const tealGeo = new THREE.BoxGeometry(0.035, 0.08, 6.6);
  mesh(tealGeo, tealMat, group).position.set(-0.9, -0.02, 0.2);
  mesh(tealGeo, tealMat, group).position.set(0.9, -0.02, 0.2);

  const windshield = mesh(new THREE.BoxGeometry(1.25, 0.62, 0.06), glassMat, group);
  windshield.position.set(0, 0.78, 3.35);
  windshield.rotation.x = -0.62;

  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const win = mesh(new THREE.BoxGeometry(0.06, 0.36, 0.48), glassMat, group);
      win.position.set(side * 0.9, 0.48, 1.7 - i * 0.95);
    }
  }

  for (const side of [-1, 1]) {
    const wingGeo = new THREE.BoxGeometry(8.3, 0.14, 2.2);
    wingGeo.translate(side * 4.15, 0, 0);
    const wing = mesh(wingGeo, bodyMat, group);
    wing.position.set(0, 1.62, 0.45);
    wing.rotation.z = side * -0.045;
    const tip = mesh(new THREE.BoxGeometry(0.12, 0.55, 0.7), tealMat, group);
    tip.position.set(side * 8.25, 1.72, 0.45);
  }

  const props: THREE.Object3D[] = [];
  const blurs: THREE.Mesh[] = [];
  const blades: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const nacelle = mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.95, 12), bodyMat, group);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(side * 2.55, 1.5, 1.9);
    const hub = new THREE.Group();
    hub.position.set(side * 2.55, 1.5, 2.45);
    group.add(hub);
    for (let b = 0; b < 3; b++) {
      const bladeGeo = new THREE.BoxGeometry(0.08, 0.92, 0.03);
      bladeGeo.translate(0, 0.52, 0);
      const blade = mesh(bladeGeo, bladeMat, hub);
      blade.rotation.z = (b * Math.PI * 2) / 3;
      blades.push(blade);
    }
    const blurMat = new THREE.MeshBasicMaterial({
      color: 0x2a2e30,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const blur = mesh(new THREE.CircleGeometry(0.72, 18), blurMat, hub);
    blurs.push(blur);
    props.push(hub);
  }

  const fin = mesh(new THREE.BoxGeometry(0.08, 1.65, 1.15), bodyMat, group);
  fin.position.set(0, 1.15, -4.05);
  const stab = mesh(new THREE.BoxGeometry(4.8, 0.07, 0.95), bodyMat, group);
  stab.position.set(0, 0.42, -4.15);
  mesh(new THREE.BoxGeometry(0.1, 0.7, 0.55), tealMat, group).position.set(0, 1.7, -4.15);
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff4030,
    emissive: 0xff2018,
    emissiveIntensity: 0.7,
    roughness: 0.4,
  });
  mesh(new THREE.SphereGeometry(0.08, 8, 8), beaconMat, group).position.set(0, 2.02, -4.05);

  for (const side of [-1, 1]) {
    const floatGeo = new THREE.CylinderGeometry(0.34, 0.3, 7.6, 12);
    floatGeo.rotateX(Math.PI / 2);
    const pontoon = mesh(floatGeo, floatMat, group);
    pontoon.position.set(side * 1.12, 0.34, 0.1);
    const bow = mesh(new THREE.SphereGeometry(0.34, 12, 8), floatMat, group);
    bow.scale.set(1, 0.9, 1.15);
    bow.position.set(side * 1.12, 0.34, 3.85);
    const stern = mesh(new THREE.SphereGeometry(0.28, 10, 8), floatMat, group);
    stern.position.set(side * 1.12, 0.32, -3.65);
    for (const z of [1.4, -1.5]) {
      const strut = mesh(new THREE.BoxGeometry(0.06, 1.15, 0.06), darkMat, group);
      strut.position.set(side * 0.7, 0.85, z);
      strut.rotation.z = side * 0.22;
    }
  }

  const hinge = new THREE.Group();
  hinge.position.set(0.92, 0.95, 0.35);
  const doorGeo = new THREE.BoxGeometry(0.07, 1.42, 0.7);
  doorGeo.translate(0.04, 0, -0.35);
  const doorMesh = mesh(doorGeo, bodyMat, hinge);
  mesh(new THREE.BoxGeometry(0.02, 0.42, 0.32), glassMat, doorMesh).position.set(0.05, 0.18, -0.35);
  group.add(hinge);

  const heads: THREE.Object3D[] = [];
  for (let i = 0; i < 4; i++) {
    const head = mesh(new THREE.SphereGeometry(0.13, 10, 8), skinMats[i]!, group);
    head.position.set(i % 2 === 0 ? -0.28 : 0.28, 1.02, 1.35 - i * 0.72);
    heads.push(head);
  }
  const pilot = mesh(new THREE.SphereGeometry(0.14, 10, 8), skinMats[0]!, group);
  pilot.position.set(0.22, 0.95, 2.55);
  mesh(new THREE.BoxGeometry(0.46, 0.38, 0.28), tealMat, group).position.set(0.18, 0.62, 2.5);

  return { group, props, blurs, blades, door: hinge, heads };
}

export function buildPerson(index: number): PersonRig {
  const look = cloth[index % cloth.length]!;
  const skin = skinMats[index % skinMats.length]!;
  const group = new THREE.Group();
  const legs: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  const arms: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  const hip = 0.9;
  for (const [i, side] of [-1, 1].entries()) {
    const leg = legs[i]!;
    leg.position.set(side * 0.11, hip, 0);
    const limb = mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.86, 6), look.pants, leg);
    limb.position.y = -0.43;
    mesh(new THREE.SphereGeometry(0.07, 6, 6), skin, leg).position.y = -0.88;
    group.add(leg);
    const arm = arms[i]!;
    arm.position.set(side * 0.24, 1.38, 0);
    const a = mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.58, 6), look.shirt, arm);
    a.position.y = -0.3;
    mesh(new THREE.SphereGeometry(0.05, 6, 6), skin, arm).position.y = -0.6;
    group.add(arm);
  }
  mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.5, 8), look.shirt, group).position.y = 1.16;
  mesh(new THREE.SphereGeometry(0.13, 10, 8), skin, group).position.y = 1.52;
  const hair = mesh(new THREE.SphereGeometry(0.135, 10, 8), darkMat, group);
  hair.scale.set(1, 0.72, 1);
  hair.position.y = 1.6;
  group.visible = false;
  return { group, legs, arms };
}

export function buildDock(): THREE.Group {
  const g = new THREE.Group();
  const deck = mesh(new THREE.BoxGeometry(2.6, 0.12, 20), deckMat, g);
  deck.position.set(-11.2, 0.72, -18.5);
  for (let i = 0; i < 6; i++) {
    const z = -27.5 + i * 3.6;
    for (const x of [-12.4, -10.0]) {
      const post = mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.45, 6), woodMat, g);
      post.position.set(x, 0.02, z);
    }
  }
  mesh(new THREE.BoxGeometry(0.05, 0.05, 19), woodMat, g).position.set(-12.5, 1.05, -18.5);
  mesh(new THREE.BoxGeometry(1.7, 0.08, 1.15), deckMat, g).position.set(-9.15, 0.66, -22.05);
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), woodMat, g);
  pole.position.set(-11, 1.7, -12.6);
  const sock = mesh(new THREE.ConeGeometry(0.14, 0.7, 8), stripeMat, g);
  sock.rotation.z = -Math.PI / 2;
  sock.position.set(-11.7, 2.6, -12.6);
  return g;
}

export function buildBungalows(): THREE.Group {
  const g = new THREE.Group();
  const walk = mesh(new THREE.BoxGeometry(48, 0.08, 1.3), deckMat, g);
  walk.position.set(66, 1.55, -50);
  for (let i = 0; i < 7; i++) {
    const x = 42 + i * 8;
    const z = -50;
    for (const ox of [-1.1, 1.1]) {
      for (const oz of [-1.1, 1.1]) {
        const stilt = mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.1, 5), woodMat, g);
        stilt.position.set(x + ox, 0.55, z + oz);
      }
    }
    mesh(new THREE.BoxGeometry(3.4, 0.12, 3.4), deckMat, g).position.set(x, 1.62, z);
    mesh(new THREE.BoxGeometry(2.8, 1.5, 2.8), wallMat, g).position.set(x, 2.45, z);
    const roof = mesh(new THREE.ConeGeometry(2.35, 1.15, 4), thatchMat, g);
    roof.position.set(x, 3.55, z);
    roof.rotation.y = Math.PI / 4;
    mesh(new THREE.BoxGeometry(0.7, 0.7, 0.05), glassMat, g).position.set(x, 2.45, z + 1.41);
  }
  const hull = mesh(new THREE.BoxGeometry(1.1, 0.35, 3.4), woodMat, g);
  hull.position.set(38, 0.25, -44);
  return g;
}

export function buildPalms(): THREE.Group {
  const g = new THREE.Group();
  const spots: { x: number; z: number; h: number; yaw: number }[] = [];
  for (let i = 0; i < 2800 && spots.length < 64; i++) {
    const x = -190 + hash(i, 3) * 460;
    const z = -200 + hash(i, 9) * 420;
    const h = landHeight(x, z);
    if (h < 0.6 || h > 5.5) continue;
    spots.push({ x, z, h, yaw: hash(i, 4) * Math.PI * 2 });
  }
  if (spots.length === 0) return g;
  const trunkGeo = new THREE.CylinderGeometry(0.11, 0.16, 6.2, 5);
  trunkGeo.translate(0, 3.1, 0);
  const frondGeo = new THREE.BoxGeometry(0.18, 0.04, 1.7);
  frondGeo.translate(0, 0, 0.8);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), spots.length);
  const fronds = new THREE.InstancedMesh(
    frondGeo,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }),
    spots.length * 6,
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  spots.forEach((spot, i) => {
    dummy.position.set(spot.x, spot.h - 0.15, spot.z);
    dummy.rotation.set(0.08, spot.yaw, 0.12);
    dummy.scale.setScalar(0.85 + hash(i, 6) * 0.4);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.07, 0.35, 0.22 + hash(i, 8) * 0.08);
    trunks.setColorAt(i, color);
    for (let f = 0; f < 6; f++) {
      dummy.position.set(spot.x, spot.h + 5.7 * dummy.scale.x, spot.z);
      dummy.rotation.set(-0.7, spot.yaw + (f * Math.PI) / 3, 0);
      dummy.updateMatrix();
      fronds.setMatrixAt(i * 6 + f, dummy.matrix);
      color.setHSL(0.28 + hash(i + f, 2) * 0.06, 0.45, 0.28);
      fronds.setColorAt(i * 6 + f, color);
    }
  });
  trunks.instanceMatrix.needsUpdate = true;
  fronds.instanceMatrix.needsUpdate = true;
  if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true;
  if (fronds.instanceColor) fronds.instanceColor.needsUpdate = true;
  g.add(trunks, fronds);
  return g;
}

export function buildClouds(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xfff6ee,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const geo = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 9; i++) {
    const cluster = new THREE.Group();
    cluster.position.set(-400 + hash(i, 12) * 900, 150 + hash(i, 13) * 90, -350 + hash(i, 14) * 800);
    for (let p = 0; p < 3; p++) {
      const puff = new THREE.Mesh(geo, mat);
      puff.scale.set(28 + p * 8, 8 + p * 2, 16);
      puff.position.set((p - 1) * 22, p === 1 ? 4 : 0, 0);
      cluster.add(puff);
    }
    cluster.userData.drift = 4 + hash(i, 15) * 6;
    g.add(cluster);
  }
  return g;
}

function pushTri(
  positions: number[],
  normals: number[],
  colors: number[],
  corners: { sx: number; h: number; sz: number; n: [number, number, number]; c: THREE.Color }[],
) {
  for (const idx of [0, 2, 1, 1, 2, 3]) {
    const c = corners[idx]!;
    positions.push(c.sx, c.h, c.sz);
    normals.push(c.n[0], c.n[1], c.n[2]);
    colors.push(c.c.r, c.c.g, c.c.b);
  }
}

function sampleCorner(x: number, z: number, color: THREE.Color) {
  const h = Math.max(landHeight(x, z), 0.02);
  const n = landNormal(x, z);
  const jitter = hash(x, z);
  if (h < 1.15) color.setRGB(0.9, 0.82, 0.62);
  else if (n[1] < 0.58 || h > 58) color.setRGB(0.4 + jitter * 0.06, 0.38, 0.34);
  else if (h < 18) color.setRGB(0.14 + jitter * 0.05, 0.4, 0.16);
  else if (h < 40 && n[1] > 0.7) color.setRGB(0.22, 0.36, 0.18);
  else color.setRGB(0.46, 0.43, 0.39);
  if (h < 0.65) color.multiplyScalar(0.75);
  return { sx: x, h, sz: z, n, c: color.clone() };
}

function addPatch(
  positions: number[],
  normals: number[],
  colors: number[],
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  step: number,
) {
  const color = new THREE.Color();
  const nx = Math.ceil((x1 - x0) / step);
  const nz = Math.ceil((z1 - z0) / step);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = x0 + ix * step;
      const z = z0 + iz * step;
      const hs = [landHeight(x, z), landHeight(x + step, z), landHeight(x, z + step), landHeight(x + step, z + step)];
      if (Math.max(...hs) < 0.28) continue;
      const corners = [
        sampleCorner(x, z, color),
        sampleCorner(x + step, z, color),
        sampleCorner(x, z + step, color),
        sampleCorner(x + step, z + step, color),
      ];
      pushTri(positions, normals, colors, corners);
    }
  }
}

export function buildIsland(): THREE.Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  addPatch(positions, normals, colors, 90, 250, -160, 10, 1.7);
  const ring = RING;
  const segs = 140;
  const bands = 7;
  const inner = ring.radius - 18;
  const band = 36 / bands;
  for (let a = 0; a < segs; a++) {
    const a0 = (a / segs) * Math.PI * 2;
    const a1 = ((a + 1) / segs) * Math.PI * 2;
    for (let s = 0; s < bands; s++) {
      const r0 = inner + s * band;
      const r1 = r0 + band;
      const quad: [number, number][] = [
        [ring.x + Math.cos(a0) * r0, ring.z + Math.sin(a0) * r0],
        [ring.x + Math.cos(a0) * r1, ring.z + Math.sin(a0) * r1],
        [ring.x + Math.cos(a1) * r0, ring.z + Math.sin(a1) * r0],
        [ring.x + Math.cos(a1) * r1, ring.z + Math.sin(a1) * r1],
      ];
      const hs = quad.map(([x, z]) => landHeight(x, z));
      if (Math.max(...hs) < 0.28) continue;
      const color = new THREE.Color();
      pushTri(
        positions,
        normals,
        colors,
        quad.map(([x, z]) => sampleCorner(x, z, color)) as {
          sx: number;
          h: number;
          sz: number;
          n: [number, number, number];
          c: THREE.Color;
        }[],
      );
    }
  }
  addPatch(positions, normals, colors, 8, 52, 4, 48, 2.4);
  addPatch(positions, normals, colors, -124, -70, 52, 106, 2.6);
  addPatch(positions, normals, colors, 104, 148, 66, 110, 2.6);
  addPatch(positions, normals, colors, -66, -16, -146, -96, 2.6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
  return new THREE.Mesh(geo, mat);
}
