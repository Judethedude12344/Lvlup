// Interactive 3D Cryo Chamber for the Chamber spotlight card.
// Built from primitives at the real proportions (10 x 7 in footprint). Drag to rotate; the cap opens on first view.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ParametricGeometry } from 'three/addons/geometries/ParametricGeometry.js';

const mount = document.querySelector('[data-chamber-3d]');
if (mount) init(mount).catch(() => {});

async function init(mount) {
  const canvas = document.createElement('canvas');
  canvas.className = 'chamber-3d-canvas';
  canvas.setAttribute('aria-label', 'Interactive 3D model of the Cryo Chamber. Drag to rotate.');
  canvas.setAttribute('role', 'img');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return; } // no WebGL: the photo stays in place

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 200);

  // ---------- dimensions (inches) ----------
  const W = 10, D = 7, H = 6;          // body
  const LID_H = 2.0;                    // lid band height above the seam
  const RC = 0.62;                      // vertical corner radius
  const BEV = 0.34;                     // soft top/bottom edge
  const SEAM_Y = H - LID_H;

  // ---------- materials ----------
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xf2f2ef, roughness: 0.42, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.45 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x8c9094, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.7 });
  const gasket = new THREE.MeshStandardMaterial({ color: 0x2b2d2f, roughness: 0.85 });
  const foot = new THREE.MeshStandardMaterial({ color: 0xc9cbcd, roughness: 0.5 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, side: THREE.DoubleSide, bumpMap: weaveTexture(), bumpScale: 0.6 });

  const COLORS = {
    white: { shell: 0xf2f2ef, trim: 0x8c9094, foot: 0xc9cbcd, logo: '#2b2d30', vent: 0x9a9da0, plate: 0xe4e4e1, inner: 0xe9e9e6 },
    black: { shell: 0x17181a, trim: 0x050505, foot: 0x2a2c2e, logo: '#6fb6d5', vent: 0x050506, plate: 0x222427, inner: 0x1e2023 }
  };

  const chamber = new THREE.Group();
  scene.add(chamber);

  // body: rounded-rectangle footprint extruded upward with soft bevelled edges
  const body = new THREE.Mesh(roundedSlab(W, D, H, RC, BEV), shell);
  body.castShadow = true; body.receiveShadow = true;
  chamber.add(body);

  // seam groove between base and lid
  const seam = new THREE.Mesh(roundedSlab(W + 0.014, D + 0.014, 0.045, RC + 0.007, 0), trim);
  seam.position.y = SEAM_Y - 0.022;
  chamber.add(seam);

  // front latch tab at the seam
  const latch = new THREE.Mesh(roundedSlab(1.5, 0.16, 0.26, 0.07, 0.03), shell);
  latch.position.set(0, SEAM_Y - 0.13, D / 2 + 0.02);
  latch.castShadow = true;
  chamber.add(latch);

  // printed logo on the front
  const logoTex = new THREE.CanvasTexture(logoCanvas(COLORS.white.logo));
  logoTex.colorSpace = THREE.SRGBColorSpace;
  logoTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const logoMat = new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.55), logoMat);
  logo.position.set(0, SEAM_Y * 0.5 + 0.15, D / 2 + 0.004);
  chamber.add(logo);

  // side vents: both sides, low and toward the back
  const ventMat = new THREE.MeshStandardMaterial({ color: COLORS.white.vent, roughness: 0.8 });
  for (const side of [1, -1]) {
    for (let i = 0; i < 15; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.15, 0.075), ventMat);
      slot.position.set(side * (W / 2 + 0.004), 1.25, -0.6 + side * 0 + (i - 7) * 0.17 - 0.9);
      chamber.add(slot);
    }
  }

  // power button on the right side, toward the front
  const btnRing = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 40), trim);
  btnRing.rotation.z = Math.PI / 2;
  btnRing.position.set(W / 2 + 0.006, 1.15, 2.35);
  chamber.add(btnRing);
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 40), shell);
  btn.rotation.z = Math.PI / 2;
  btn.position.set(W / 2 + 0.02, 1.15, 2.35);
  chamber.add(btn);

  // feet
  for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.22, 32), foot);
    f.position.set(fx * (W / 2 - 0.95), -0.11, fz * (D / 2 - 0.85));
    f.castShadow = true;
    chamber.add(f);
  }
  chamber.position.y = 0.22;

  // top: recessed dispenser plate with a slit, and the wipe popping out
  const CAP_W = 5.8, CAP_D = 4.3, CAP_T = 0.24, CAP_Z = -0.25;
  const plateMat = new THREE.MeshStandardMaterial({ color: COLORS.white.plate, roughness: 0.55 });
  const plate = new THREE.Mesh(roundedSlab(CAP_W - 0.5, CAP_D - 0.5, 0.02, 0.45, 0), plateMat);
  plate.position.set(0, H + 0.001, CAP_Z);
  chamber.add(plate);
  const slit = new THREE.Mesh(roundedSlab(2.9, 0.42, 0.02, 0.2, 0), dark);
  slit.position.set(0, H + 0.012, CAP_Z + 0.1);
  chamber.add(slit);

  const wipe = new THREE.Mesh(new ParametricGeometry(wipeSurface(H + 0.02, CAP_Z + 0.1), 90, 60), fabric);
  wipe.castShadow = true;
  chamber.add(wipe);

  // flip cap, hinged along its back edge
  const hinge = new THREE.Group();
  hinge.position.set(0, H + 0.02, CAP_Z - CAP_D / 2);
  chamber.add(hinge);
  const cap = new THREE.Mesh(roundedSlab(CAP_W, CAP_D, CAP_T, 0.55, 0.08), shell);
  cap.position.set(0, 0, CAP_D / 2);
  cap.castShadow = true;
  hinge.add(cap);
  // gasket frame on the underside of the cap
  const gk = new THREE.Mesh(frameSlab(CAP_W - 0.55, CAP_D - 0.55, 0.42, 0.5, 0.09), gasket);
  gk.position.set(0, -0.09, CAP_D / 2);
  hinge.add(gk);
  const innerMat = new THREE.MeshStandardMaterial({ color: COLORS.white.inner, roughness: 0.6 });
  const capInner = new THREE.Mesh(roundedSlab(CAP_W - 1.5, CAP_D - 1.5, 0.02, 0.3, 0), innerMat);
  capInner.position.set(0, -0.012, CAP_D / 2);
  hinge.add(capInner);

  // ground: soft contact shadow
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.45 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- lighting ----------
  scene.add(new THREE.HemisphereLight(0xdff3ff, 0x0b0d0f, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-9, 16, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -12; key.shadow.camera.right = 12; key.shadow.camera.top = 12; key.shadow.camera.bottom = -12;
  key.shadow.radius = 6; key.shadow.bias = -0.0004;
  scene.add(key);
  const beam = new THREE.SpotLight(0x9fdcf3, 120, 40, 0.35, 0.8, 1.6); // ice light from the beam above
  beam.position.set(0, 22, -1);
  beam.target.position.set(0, H, 0);
  scene.add(beam, beam.target);
  const rim = new THREE.DirectionalLight(0x7cc8e6, 0.9);
  rim.position.set(10, 6, -12);
  scene.add(rim);

  // ---------- camera + controls ----------
  const target = new THREE.Vector3(0, 4.1, 0);
  camera.position.set(14, 10.5, 22);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.minPolarAngle = 0.95;
  controls.maxPolarAngle = 1.42;
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotateSpeed = 1.1;
  canvas.style.touchAction = 'pan-y'; // let the page scroll vertically on phones; horizontal drags rotate
  controls.update();

  function fit() {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole chamber in frame on narrow cards
    const dist = camera.aspect < 1 ? 35 / camera.aspect ** 0.6 : 35;
    const dir = camera.position.clone().sub(controls.target).normalize();
    camera.position.copy(controls.target).addScaledVector(dir, dist);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(fit).observe(mount);

  // ---------- colour toggle ----------
  const logoCanvases = { white: logoTex.image, black: logoCanvas(COLORS.black.logo) };
  function setColour(name) {
    const c = COLORS[name];
    shell.color.setHex(c.shell); trim.color.setHex(c.trim); foot.color.setHex(c.foot); ventMat.color.setHex(c.vent); plateMat.color.setHex(c.plate); innerMat.color.setHex(c.inner);
    shell.roughness = name === 'black' ? 0.5 : 0.42;
    logoTex.image = logoCanvases[name]; logoTex.needsUpdate = true;
  }
  mount.querySelectorAll('[data-chamber-colour]').forEach(b => b.addEventListener('click', () => {
    mount.querySelectorAll('[data-chamber-colour]').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
    setColour(b.dataset.chamberColour);
  }));

  // ---------- cap opening + render loop ----------
  const OPEN = -1.82; // radians, cap stands up and leans back slightly
  let capT = 0, opening = false, visible = false, running = false, last = performance.now();
  hinge.rotation.x = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { capT = 1; hinge.rotation.x = OPEN; }

  function frame(now) {
    if (!visible) { running = false; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (opening && capT < 1) {
      capT = Math.min(1, capT + dt / 1.1);
      const e = 1 - Math.pow(1 - capT, 3);
      hinge.rotation.x = OPEN * e;
    }
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) { setTimeout(() => { opening = true; }, 350); if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
  }, { threshold: 0.25 }).observe(mount);

  await document.fonts?.ready;
  logoTex.image = logoCanvas(COLORS.white.logo); logoCanvases.white = logoTex.image; logoCanvases.black = logoCanvas(COLORS.black.logo); logoTex.needsUpdate = true;

  mount.appendChild(canvas);
  fit();
  renderer.render(scene, camera);
  mount.classList.add('is-3d');
}

// ---------- geometry helpers ----------
function roundedRectShape(w, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  r = Math.min(r, w / 2, d / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// A rounded rectangle footprint w x d, extruded to height h (y up), with soft bevelled top/bottom edges.
function roundedSlab(w, d, h, r, bev) {
  const b = Math.min(bev, h / 2 - 0.0001 > 0 ? h / 2 - 0.0001 : 0);
  const shape = roundedRectShape(w - 2 * b, d - 2 * b, Math.max(0.001, r - b));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0001, h - 2 * b), curveSegments: 28,
    bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 8
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, b, 0);
  g.computeVertexNormals();
  return g;
}
// A rounded rectangular frame (for the gasket).
function frameSlab(w, d, border, r, h) {
  const outer = roundedRectShape(w, d, r);
  const hole = roundedRectShape(w - 2 * border, d - 2 * border, Math.max(0.05, r - border * 0.6));
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, { depth: h, curveSegments: 28, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 });
  g.rotateX(-Math.PI / 2);
  return g;
}
// The wipe: a soft crumpled peak rising out of the slit.
function wipeSurface(baseY, baseZ) {
  return (u, v, out) => {
    const th = u * Math.PI * 2;
    const taper = Math.pow(1 - v, 0.75);
    const folds = 1 + 0.16 * Math.sin(5 * th + 2.5 * v) + 0.09 * Math.sin(11 * th - 4 * v) + 0.05 * Math.sin(17 * th);
    const a = 1.35 * taper * folds;
    const b = (0.16 + 0.55 * Math.sin(Math.PI * Math.min(1, v * 1.15)) * (1 - v)) * taper * folds;
    const lean = 0.35 * v * v;
    out.set(a * Math.cos(th) + 0.12 * Math.sin(3 * v), baseY + v * 2.1 + 0.08 * Math.sin(6 * th) * (1 - v), baseZ + b * Math.sin(th) + lean);
  };
}
// Fine fabric weave used as a bump map on the wipe.
function weaveTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 4) {
    x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(i, 0, 2, 256);
    x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(0, i, 256, 2);
  }
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},.08)`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6);
  return t;
}
// "CRY❄CHAMBER" print for the front face.
function logoCanvas(color) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 256;
  const x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = color; x.textBaseline = 'middle';
  x.font = '600 190px "Barlow Semi Condensed", "Barlow", "Arial Narrow", Arial, sans-serif';
  const left = 'CRY', right = 'CHAMBER';
  const wl = x.measureText(left).width, wr = x.measureText(right).width;
  const disc = 150, gap = 26;
  const total = wl + gap + disc + gap + wr;
  let px = (c.width - total) / 2; const cy = 132;
  x.fillText(left, px, cy); px += wl + gap;
  const cx = px + disc / 2;
  x.beginPath(); x.arc(cx, cy - 6, disc / 2, 0, Math.PI * 2); x.fill();
  // snowflake knocked out of the disc
  x.save(); x.globalCompositeOperation = 'destination-out'; x.lineCap = 'round'; x.lineWidth = 11;
  const R = disc * 0.34;
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 2 + k * Math.PI / 3, ux = Math.cos(a), uy = -Math.sin(a);
    x.beginPath(); x.moveTo(cx, cy - 6); x.lineTo(cx + ux * R, cy - 6 + uy * R); x.stroke();
    for (const [t, l] of [[0.55, 0.32], [0.82, 0.22]]) {
      const qx = cx + ux * R * t, qy = cy - 6 + uy * R * t;
      for (const s of [-1, 1]) { const bb = a + s * Math.PI / 4; x.beginPath(); x.moveTo(qx, qy); x.lineTo(qx + Math.cos(bb) * R * l, qy - Math.sin(bb) * R * l); x.stroke(); }
    }
  }
  x.restore();
  px += disc + gap;
  x.fillText(right, px, cy);
  return c;
}
