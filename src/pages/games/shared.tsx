import * as THREE from 'three';

// =====================================================================
// SNAPLINK GAMES — SHARED 3D AVATAR & WORLD UTILITIES
// Roblox-style blocky humanoid character system with full animation
// =====================================================================

// ============= TYPES =============
export interface AvatarConfig {
  skinColor: number;
  hairColor: number;
  hairStyle: 'short' | 'spiky' | 'flat' | 'none';
  shirtColor: number;
  pantsColor: number;
  shoeColor: number;
  role: string;
  displayName: string;
  username?: string;
  level?: number;
  isPremium?: boolean;
  photoURL?: string;
}

export interface HumanoidParts {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  headMesh: THREE.Mesh;
  torso: THREE.Mesh;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftHand: THREE.Mesh;
  rightHand: THREE.Mesh;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
  nameTag: THREE.Sprite;
  faceSprite?: THREE.Sprite;
}

export type AnimState = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'dance' | 'wave' | 'sit';

export interface PlayerState {
  uid: string;
  displayName: string;
  username: string;
  photoURL: string;
  role: string;
  level?: number;
  isPremium?: boolean;
  x: number;
  y: number;
  z: number;
  rotY: number;
  animState: AnimState;
  health?: number;
  score?: number;
  lastUpdate: number;
}

export interface GameChatMessage {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  timestamp: number;
}

// ============= COLOR UTILITIES =============
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    return (h & 0x7fffffff) / 0x7fffffff;
  };
}

const SKIN_COLORS = [0xffdbb4, 0xf5c6a1, 0xe8b089, 0xd4956b, 0xc47e5a, 0xa0674b, 0x8b5e3c, 0x6b4226];
const HAIR_COLORS = [0x1a1a1a, 0x3b2716, 0x6b3a2a, 0x8b4c39, 0xb5651d, 0xd4a76a, 0xe8c882, 0xcc3333, 0x2244aa, 0x22aa44, 0xff69b4, 0x9944cc];
const SHIRT_COLORS = [0xff4444, 0x44aaff, 0x44cc44, 0xffaa00, 0xcc44cc, 0x44cccc, 0xff6600, 0x8844ff, 0xff4488, 0x2266cc, 0xffffff, 0x333333];
const PANTS_COLORS = [0x2244aa, 0x333333, 0x555555, 0x1a1a3e, 0x442211, 0x663322, 0x444444, 0x222222];
const SHOE_COLORS = [0x111111, 0x333333, 0x222222, 0x553311, 0x444444, 0xffffff, 0xff0000, 0x0000ff];
const MAKESPACE_AVATAR_PRESETS: Record<string, Partial<AvatarConfig>> = {
  orbit: {
    hairStyle: 'short',
    hairColor: 0x111827,
    shirtColor: 0x2563eb,
    pantsColor: 0x1d4ed8,
    shoeColor: 0xffffff,
  },
  ember: {
    hairStyle: 'spiky',
    hairColor: 0x2d1606,
    shirtColor: 0xea580c,
    pantsColor: 0x7c2d12,
    shoeColor: 0x111111,
  },
  mint: {
    hairStyle: 'flat',
    hairColor: 0x0f172a,
    shirtColor: 0x10b981,
    pantsColor: 0x065f46,
    shoeColor: 0xf8fafc,
  },
  midnight: {
    hairStyle: 'short',
    hairColor: 0x050816,
    shirtColor: 0x7c3aed,
    pantsColor: 0x312e81,
    shoeColor: 0x020617,
  },
};

function readMakeSpaceAvatarPreset(uid: string): Partial<AvatarConfig> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`snaplink_makespace_profile_${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { avatarPresetId?: string };
    const presetId = parsed?.avatarPresetId;
    if (!presetId) return null;
    return MAKESPACE_AVATAR_PRESETS[presetId] || null;
  } catch {
    return null;
  }
}

export function generateAvatarConfig(
  uid: string,
  displayName: string,
  role: string,
  photoURL?: string,
  level?: number,
  username?: string,
  isPremium?: boolean,
): AvatarConfig {
  const rng = seededRandom(uid);
  const skinIdx = Math.floor(rng() * SKIN_COLORS.length);
  const hairIdx = Math.floor(rng() * HAIR_COLORS.length);
  const shirtIdx = Math.floor(rng() * SHIRT_COLORS.length);
  const pantsIdx = Math.floor(rng() * PANTS_COLORS.length);
  const shoeIdx = Math.floor(rng() * SHOE_COLORS.length);
  const hairStyles: AvatarConfig['hairStyle'][] = ['short', 'spiky', 'flat', 'none'];
  const hairStyle = hairStyles[Math.floor(rng() * hairStyles.length)];
  const savedPreset = readMakeSpaceAvatarPreset(uid);

  // Role-based overrides for shirt color
  let shirtColor = SHIRT_COLORS[shirtIdx];
  if (role === 'admin') shirtColor = 0x7744dd;
  else if (role === 'member') shirtColor = 0x3388ee;

  return {
    skinColor: savedPreset?.skinColor ?? SKIN_COLORS[skinIdx],
    hairColor: savedPreset?.hairColor ?? HAIR_COLORS[hairIdx],
    hairStyle: savedPreset?.hairStyle ?? hairStyle,
    shirtColor: savedPreset?.shirtColor ?? shirtColor,
    pantsColor: savedPreset?.pantsColor ?? PANTS_COLORS[pantsIdx],
    shoeColor: savedPreset?.shoeColor ?? SHOE_COLORS[shoeIdx],
    role,
    displayName,
    username,
    level,
    isPremium,
    photoURL,
  };
}

// ============= NAME TAG =============
function createTextCanvas(
  text: string,
  fontSize: number,
  bgColor: string,
  textColor: string,
  borderColor?: string,
  subtitle?: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `bold ${fontSize}px "Segoe UI", -apple-system, sans-serif`;
  const metrics = ctx.measureText(text);
  const subtitleSize = subtitle ? Math.max(11, Math.floor(fontSize * 0.62)) : 0;
  let subtitleWidth = 0;
  if (subtitle) {
    ctx.font = `600 ${subtitleSize}px "Segoe UI", -apple-system, sans-serif`;
    subtitleWidth = ctx.measureText(subtitle).width;
  }
  const padX = 16;
  const padY = subtitle ? 10 : 8;
  const w = Math.ceil(Math.max(metrics.width, subtitleWidth) + padX * 2);
  const h = subtitle ? fontSize + subtitleSize + padY * 2 + 4 : fontSize + padY * 2;
  canvas.width = w;
  canvas.height = h;

  // Background
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, h / 2);
  ctx.fill();

  // Border
  if (borderColor) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(1, 1, w - 2, h - 2, (h - 2) / 2);
    ctx.stroke();
  }

  // Text
  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px "Segoe UI", -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const titleY = subtitle ? 8 : (h - fontSize) / 2;
  ctx.fillText(text, w / 2, titleY);

  if (subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = `600 ${subtitleSize}px "Segoe UI", -apple-system, sans-serif`;
    ctx.fillText(subtitle, w / 2, titleY + fontSize + 2);
  }

  return canvas;
}

export function createNameTag(name: string, role: string, level?: number, username?: string, isPremium?: boolean): THREE.Sprite {
  let borderColor: string | undefined;
  if (role === 'admin') borderColor = '#aa55ff';
  else if (role === 'member') borderColor = '#3399ff';
  else if (isPremium) borderColor = '#f59e0b';

  const subtitleParts = [];
  if (typeof level === 'number' && level > 0) subtitleParts.push(`LV ${level}`);
  if (username) subtitleParts.push(`@${username}`);
  const subtitle = subtitleParts.join(' | ');

  const canvas = createTextCanvas(name, 18, 'rgba(7,11,24,0.82)', '#ffffff', borderColor, subtitle);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(aspect * 0.95, subtitle ? 1.05 : 0.8, 1);
  return sprite;
}

// ============= FACE TEXTURE =============
function createFaceTexture(photoURL?: string): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.55, 0.55, 1);

  if (photoURL) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath();
      ctx.arc(64, 64, 62, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      mat.map = tex;
      mat.needsUpdate = true;
    };
    img.src = photoURL.includes('dicebear') ? photoURL.replace('/svg?', '/png?') : photoURL;
  } else {
    // Default face — simple smiley
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000000';
    // Eyes
    ctx.beginPath();
    ctx.arc(22, 24, 4, 0, Math.PI * 2);
    ctx.arc(42, 24, 4, 0, Math.PI * 2);
    ctx.fill();
    // Smile
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(32, 32, 12, 0.2, Math.PI - 0.2);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    mat.map = tex;
    mat.needsUpdate = true;
  }

  return sprite;
}

// ============= HUMANOID AVATAR BUILDER =============
export function createHumanoid(config: AvatarConfig): HumanoidParts {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skinMat = new THREE.MeshStandardMaterial({ color: config.skinColor, roughness: 0.7, metalness: 0.05 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: config.shirtColor, roughness: 0.6, metalness: 0.1 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: config.pantsColor, roughness: 0.6, metalness: 0.05 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: config.shoeColor, roughness: 0.4, metalness: 0.15 });
  const hairMat = new THREE.MeshStandardMaterial({ color: config.hairColor, roughness: 0.8, metalness: 0.0 });

  // === HEAD ===
  const headGroup = new THREE.Group();
  headGroup.position.y = 2.1;

  // Head box (Roblox-style)
  const headGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const eyeWhiteGeo = new THREE.SphereGeometry(0.09, 8, 8);

  [-0.17, 0.17].forEach(xOff => {
    const eyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
    eyeWhite.position.set(xOff, 0.02, 0.42);
    headGroup.add(eyeWhite);
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(xOff, 0.02, 0.44);
    headGroup.add(eye);
  });

  // Mouth
  const mouthGeo = new THREE.BoxGeometry(0.2, 0.04, 0.02);
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x883333 });
  const mouth = new THREE.Mesh(mouthGeo, mouthMat);
  mouth.position.set(0, -0.18, 0.43);
  headGroup.add(mouth);

  // Hair
  if (config.hairStyle === 'short') {
    const hairGeo = new THREE.BoxGeometry(0.9, 0.3, 0.9);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.45;
    headGroup.add(hair);
  } else if (config.hairStyle === 'spiky') {
    for (let i = 0; i < 5; i++) {
      const spikeGeo = new THREE.ConeGeometry(0.12, 0.35, 4);
      const spike = new THREE.Mesh(spikeGeo, hairMat);
      spike.position.set((i - 2) * 0.18, 0.55, -0.05 + Math.random() * 0.1);
      spike.rotation.z = (Math.random() - 0.5) * 0.3;
      headGroup.add(spike);
    }
  } else if (config.hairStyle === 'flat') {
    const hairGeo = new THREE.BoxGeometry(0.92, 0.15, 0.95);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.42;
    headGroup.add(hair);
    // Back hair
    const backHairGeo = new THREE.BoxGeometry(0.88, 0.4, 0.15);
    const backHair = new THREE.Mesh(backHairGeo, hairMat);
    backHair.position.set(0, 0.1, -0.45);
    headGroup.add(backHair);
  }

  body.add(headGroup);

  // === TORSO ===
  const torsoGeo = new THREE.BoxGeometry(1.0, 1.2, 0.55);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = 1.2;
  torso.castShadow = true;
  body.add(torso);

  // Shirt detail — collar
  const collarGeo = new THREE.BoxGeometry(0.6, 0.1, 0.56);
  const collarMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(config.shirtColor).multiplyScalar(0.8).getHex(), roughness: 0.6 });
  const collar = new THREE.Mesh(collarGeo, collarMat);
  collar.position.set(0, 1.75, 0);
  body.add(collar);

  // === LEFT ARM ===
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.65, 1.7, 0);

  const leftArmGeo = new THREE.BoxGeometry(0.35, 0.9, 0.35);
  const leftArm = new THREE.Mesh(leftArmGeo, shirtMat);
  leftArm.position.y = -0.45;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);

  const leftHandGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const leftHand = new THREE.Mesh(leftHandGeo, skinMat);
  leftHand.position.y = -0.95;
  leftHand.castShadow = true;
  leftArmPivot.add(leftHand);

  body.add(leftArmPivot);

  // === RIGHT ARM ===
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.65, 1.7, 0);

  const rightArmGeo = new THREE.BoxGeometry(0.35, 0.9, 0.35);
  const rightArm = new THREE.Mesh(rightArmGeo, shirtMat);
  rightArm.position.y = -0.45;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);

  const rightHandGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const rightHand = new THREE.Mesh(rightHandGeo, skinMat);
  rightHand.position.y = -0.95;
  rightHand.castShadow = true;
  rightArmPivot.add(rightHand);

  body.add(rightArmPivot);

  // === LEFT LEG ===
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.25, 0.6, 0);

  const leftLegGeo = new THREE.BoxGeometry(0.4, 0.85, 0.4);
  const leftLeg = new THREE.Mesh(leftLegGeo, pantsMat);
  leftLeg.position.y = -0.43;
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);

  const leftFootGeo = new THREE.BoxGeometry(0.42, 0.2, 0.55);
  const leftFoot = new THREE.Mesh(leftFootGeo, shoeMat);
  leftFoot.position.set(0, -0.9, 0.05);
  leftFoot.castShadow = true;
  leftLegPivot.add(leftFoot);

  body.add(leftLegPivot);

  // === RIGHT LEG ===
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.25, 0.6, 0);

  const rightLegGeo = new THREE.BoxGeometry(0.4, 0.85, 0.4);
  const rightLeg = new THREE.Mesh(rightLegGeo, pantsMat);
  rightLeg.position.y = -0.43;
  rightLeg.castShadow = true;
  rightLegPivot.add(rightLeg);

  const rightFootGeo = new THREE.BoxGeometry(0.42, 0.2, 0.55);
  const rightFoot = new THREE.Mesh(rightFootGeo, shoeMat);
  rightFoot.position.set(0, -0.9, 0.05);
  rightFoot.castShadow = true;
  rightLegPivot.add(rightFoot);

  body.add(rightLegPivot);

  // === NAME TAG ===
  const nameTag = createNameTag(config.displayName, config.role);
  nameTag.position.y = 3.0;
  root.add(nameTag);

  return {
    root,
    body,
    head: headGroup,
    headMesh,
    torso,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftHand,
    rightHand,
    leftFoot,
    rightFoot,
    nameTag,
  };
}

export function createSnaplinkAvatar(config: AvatarConfig): HumanoidParts {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skinMat = new THREE.MeshStandardMaterial({ color: config.skinColor, roughness: 0.78, metalness: 0.02 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: config.shirtColor, roughness: 0.5, metalness: 0.12 });
  const trimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(config.shirtColor).offsetHSL(0, -0.05, -0.14).getHex(),
    roughness: 0.45,
    metalness: 0.16,
  });
  const pantsMat = new THREE.MeshStandardMaterial({ color: config.pantsColor, roughness: 0.62, metalness: 0.04 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: config.shoeColor, roughness: 0.34, metalness: 0.18 });
  const hairMat = new THREE.MeshStandardMaterial({ color: config.hairColor, roughness: 0.84, metalness: 0.0 });

  const headGroup = new THREE.Group();
  headGroup.position.y = 2.15;

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  const faceSprite = createFaceTexture(config.photoURL);
  faceSprite.position.set(0, 0.01, 0.44);
  headGroup.add(faceSprite);

  if (config.hairStyle === 'short') {
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.43, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairMat,
    );
    hair.position.y = 0.08;
    hair.scale.set(1.03, 1.0, 1.02);
    headGroup.add(hair);
  } else if (config.hairStyle === 'spiky') {
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.39, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
      hairMat,
    );
    crown.position.y = 0.15;
    headGroup.add(crown);
    for (let i = 0; i < 6; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 5), hairMat);
      const angle = (i / 6) * Math.PI * 2;
      spike.position.set(Math.cos(angle) * 0.19, 0.42, Math.sin(angle) * 0.13);
      spike.rotation.z = Math.PI * 0.08;
      spike.rotation.x = Math.cos(angle) * 0.22;
      spike.rotation.y = -angle;
      headGroup.add(spike);
    }
  } else if (config.hairStyle === 'flat') {
    const fringe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.39, 0.16, 18), hairMat);
    fringe.rotation.z = Math.PI / 2;
    fringe.position.set(0, 0.18, 0.06);
    headGroup.add(fringe);

    const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), hairMat);
    backHair.scale.set(1.05, 0.88, 0.92);
    backHair.position.set(0, 0.08, -0.1);
    headGroup.add(backHair);
  }

  body.add(headGroup);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.86, 8, 16), shirtMat);
  torso.position.y = 1.26;
  torso.castShadow = true;
  torso.receiveShadow = true;
  body.add(torso);

  const shoulderBar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.45), trimMat);
  shoulderBar.position.set(0, 1.68, 0);
  shoulderBar.castShadow = true;
  body.add(shoulderBar);

  const chestTrim = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.4), trimMat);
  chestTrim.position.set(0, 1.18, 0.19);
  chestTrim.castShadow = true;
  body.add(chestTrim);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.56, 1.68, 0);
  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.62, 6, 12), shirtMat);
  leftArm.position.y = -0.42;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skinMat);
  leftHand.position.y = -0.84;
  leftHand.castShadow = true;
  leftArmPivot.add(leftHand);
  body.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.56, 1.68, 0);
  const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.62, 6, 12), shirtMat);
  rightArm.position.y = -0.42;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);
  const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skinMat);
  rightHand.position.y = -0.84;
  rightHand.castShadow = true;
  rightArmPivot.add(rightHand);
  body.add(rightArmPivot);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.2, 0.88, 0);
  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.72, 6, 12), pantsMat);
  leftLeg.position.y = -0.46;
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);
  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.54), shoeMat);
  leftFoot.position.set(0, -0.92, 0.08);
  leftFoot.castShadow = true;
  leftLegPivot.add(leftFoot);
  body.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.2, 0.88, 0);
  const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.72, 6, 12), pantsMat);
  rightLeg.position.y = -0.46;
  rightLeg.castShadow = true;
  rightLegPivot.add(rightLeg);
  const rightFoot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.54), shoeMat);
  rightFoot.position.set(0, -0.92, 0.08);
  rightFoot.castShadow = true;
  rightLegPivot.add(rightFoot);
  body.add(rightLegPivot);

  const identityRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.04, 12, 42),
    new THREE.MeshBasicMaterial({
      color: config.isPremium ? 0xf59e0b : config.role === 'admin' ? 0xa855f7 : 0x60a5fa,
      transparent: true,
      opacity: 0.88,
    }),
  );
  identityRing.rotation.x = Math.PI / 2;
  identityRing.position.y = 0.04;
  root.add(identityRing);

  const nameTag = createNameTag(config.displayName, config.role, config.level, config.username, config.isPremium);
  nameTag.position.y = 3.12;
  root.add(nameTag);

  return {
    root,
    body,
    head: headGroup,
    headMesh,
    torso,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftHand,
    rightHand,
    leftFoot,
    rightFoot,
    nameTag,
    faceSprite,
  };
}

// ============= HUMANOID ANIMATION =============
export function animateHumanoid(parts: HumanoidParts, state: AnimState, time: number, _dt: number) {
  const { body, leftArmPivot, rightArmPivot, leftLegPivot, rightLegPivot, head, faceSprite } = parts;

  body.rotation.x *= 0.86;
  body.rotation.y *= 0.86;
  if (faceSprite) {
    faceSprite.position.z = 0.44 + Math.sin(time * 2.2) * 0.005;
  }

  switch (state) {
    case 'idle': {
      // Gentle breathing
      body.position.y = Math.sin(time * 1.5) * 0.015;
      leftArmPivot.rotation.x = Math.sin(time * 0.8) * 0.03;
      rightArmPivot.rotation.x = -Math.sin(time * 0.8) * 0.03;
      leftArmPivot.rotation.z = -0.05;
      rightArmPivot.rotation.z = 0.05;
      leftLegPivot.rotation.x = 0;
      rightLegPivot.rotation.x = 0;
      head.rotation.y = Math.sin(time * 0.3) * 0.05;
      head.rotation.x = 0;
      break;
    }
    case 'walk': {
      const speed = 5;
      body.position.y = Math.abs(Math.sin(time * speed)) * 0.04;
      leftArmPivot.rotation.x = Math.sin(time * speed) * 0.55;
      rightArmPivot.rotation.x = -Math.sin(time * speed) * 0.55;
      leftArmPivot.rotation.z = -0.08;
      rightArmPivot.rotation.z = 0.08;
      leftLegPivot.rotation.x = -Math.sin(time * speed) * 0.5;
      rightLegPivot.rotation.x = Math.sin(time * speed) * 0.5;
      head.rotation.y = 0;
      head.rotation.x = -0.05;
      break;
    }
    case 'run': {
      const speed = 9;
      body.position.y = Math.abs(Math.sin(time * speed)) * 0.08;
      body.rotation.x = -0.1;
      leftArmPivot.rotation.x = Math.sin(time * speed) * 0.9;
      rightArmPivot.rotation.x = -Math.sin(time * speed) * 0.9;
      leftArmPivot.rotation.z = -0.2;
      rightArmPivot.rotation.z = 0.2;
      leftLegPivot.rotation.x = -Math.sin(time * speed) * 0.8;
      rightLegPivot.rotation.x = Math.sin(time * speed) * 0.8;
      head.rotation.y = 0;
      head.rotation.x = -0.1;
      break;
    }
    case 'jump': {
      body.position.y = 0;
      leftArmPivot.rotation.x = -2.5;
      rightArmPivot.rotation.x = -2.5;
      leftArmPivot.rotation.z = -0.3;
      rightArmPivot.rotation.z = 0.3;
      leftLegPivot.rotation.x = 0.3;
      rightLegPivot.rotation.x = 0.3;
      head.rotation.x = -0.2;
      break;
    }
    case 'fall': {
      leftArmPivot.rotation.x = -1.2;
      rightArmPivot.rotation.x = -1.2;
      leftArmPivot.rotation.z = -0.8;
      rightArmPivot.rotation.z = 0.8;
      leftLegPivot.rotation.x = -0.3;
      rightLegPivot.rotation.x = -0.3;
      break;
    }
    case 'dance': {
      const s = 6;
      body.position.y = Math.abs(Math.sin(time * s)) * 0.15;
      body.rotation.y = Math.sin(time * s * 0.5) * 0.2;
      leftArmPivot.rotation.x = Math.sin(time * s) * 1.2;
      rightArmPivot.rotation.x = Math.sin(time * s + 1) * 1.2;
      leftArmPivot.rotation.z = Math.sin(time * s * 0.5) * 0.5 - 0.5;
      rightArmPivot.rotation.z = -Math.sin(time * s * 0.5) * 0.5 + 0.5;
      leftLegPivot.rotation.x = Math.sin(time * s) * 0.4;
      rightLegPivot.rotation.x = -Math.sin(time * s) * 0.4;
      head.rotation.y = Math.sin(time * s * 0.5) * 0.3;
      break;
    }
    case 'wave': {
      body.position.y = 0;
      leftArmPivot.rotation.x = 0;
      leftArmPivot.rotation.z = -0.05;
      rightArmPivot.rotation.x = -2.8;
      rightArmPivot.rotation.z = Math.sin(time * 6) * 0.4 + 0.3;
      leftLegPivot.rotation.x = 0;
      rightLegPivot.rotation.x = 0;
      head.rotation.y = 0.2;
      break;
    }
    case 'sit': {
      body.position.y = -0.4;
      leftArmPivot.rotation.x = -1.5;
      rightArmPivot.rotation.x = -1.5;
      leftArmPivot.rotation.z = 0;
      rightArmPivot.rotation.z = 0;
      leftLegPivot.rotation.x = -1.5;
      rightLegPivot.rotation.x = -1.5;
      head.rotation.x = 0;
      break;
    }
  }
}

// ============= DETERMINE ANIM STATE FROM VELOCITY =============
export function getAnimState(velX: number, velZ: number, velY: number, isGrounded: boolean, isSprinting: boolean): AnimState {
  const speed = Math.sqrt(velX * velX + velZ * velZ);
  if (!isGrounded && velY > 1) return 'jump';
  if (!isGrounded && velY < -1) return 'fall';
  if (speed > 15 && isSprinting) return 'run';
  if (speed > 1) return 'walk';
  return 'idle';
}

// ============= OTHER PLAYER TRACKING =============
export interface TrackedPlayer {
  data: PlayerState;
  humanoid: HumanoidParts;
  targetPos: THREE.Vector3;
  targetRotY: number;
}

export function updateTrackedPlayers(
  tracked: Map<string, TrackedPlayer>,
  scene: THREE.Scene,
  myUid: string,
  players: PlayerState[],
  dt: number,
  time: number,
) {
  const now = Date.now();
  const activeIds = new Set<string>();

  for (const p of players) {
    if (p.uid === myUid) continue;
    if (now - p.lastUpdate > 12000) continue;
    activeIds.add(p.uid);

    const existing = tracked.get(p.uid);
    if (existing) {
      existing.data = p;
      existing.targetPos.set(p.x, p.y, p.z);
      existing.targetRotY = p.rotY;
    } else {
      const config = generateAvatarConfig(p.uid, p.displayName, p.role, p.photoURL, p.level, p.username, p.isPremium);
      const humanoid = createSnaplinkAvatar(config);
      humanoid.root.position.set(p.x, p.y, p.z);
      humanoid.root.rotation.y = p.rotY;
      scene.add(humanoid.root);

      tracked.set(p.uid, {
        data: p,
        humanoid,
        targetPos: new THREE.Vector3(p.x, p.y, p.z),
        targetRotY: p.rotY,
      });
    }
  }

  // Update and remove stale
  tracked.forEach((tp, uid) => {
    if (!activeIds.has(uid)) {
      scene.remove(tp.humanoid.root);
      disposeHumanoid(tp.humanoid);
      tracked.delete(uid);
    } else {
      // Smooth interpolation
      tp.humanoid.root.position.lerp(tp.targetPos, 8 * dt);
      let rDiff = tp.targetRotY - tp.humanoid.root.rotation.y;
      while (rDiff > Math.PI) rDiff -= Math.PI * 2;
      while (rDiff < -Math.PI) rDiff += Math.PI * 2;
      tp.humanoid.root.rotation.y += rDiff * 8 * dt;

      // Animate
      animateHumanoid(tp.humanoid, tp.data.animState || 'idle', time, dt);
    }
  });

  return activeIds.size;
}

export function disposeHumanoid(parts: HumanoidParts) {
  parts.root.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
    if (child instanceof THREE.Sprite && child.material.map) {
      child.material.map.dispose();
      child.material.dispose();
    }
  });
}

// ============= WORLD BUILDING HELPERS =============
export function createSkybox(scene: THREE.Scene, color: number = 0x070714) {
  const topColor = new THREE.Color(0x08111f);
  const horizonColor = new THREE.Color(0x244a73);
  scene.background = horizonColor;
  scene.fog = new THREE.FogExp2(color, 0.0032);

  const domeGeo = new THREE.SphereGeometry(340, 40, 24);
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: topColor },
      bottomColor: { value: horizonColor },
      offset: { value: 36 },
      exponent: { value: 0.72 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(domeGeo, domeMat));

  const starCount = 520;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.55;
    const r = 250 + Math.random() * 150;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi) + 80;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const brightness = 0.5 + Math.random() * 0.5;
    starCol[i * 3] = brightness;
    starCol[i * 3 + 1] = brightness;
    starCol[i * 3 + 2] = brightness + Math.random() * 0.2;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const starMat = new THREE.PointsMaterial({ size: 0.36, vertexColors: true, transparent: true, opacity: 0.7 });
  scene.add(new THREE.Points(starGeo, starMat));
}

export function createGround(scene: THREE.Scene, size: number, color: number = 0x0d0d1a, gridColor: number = 0x00ffcc) {
  const groundGeo = new THREE.PlaneGeometry(size * 2, size * 2);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x101820, roughness: 0.97, metalness: 0.03 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(size * 0.26, 48),
    new THREE.MeshStandardMaterial({ color: 0x1b2635, roughness: 0.88, metalness: 0.06 }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.015;
  plaza.receiveShadow = true;
  scene.add(plaza);

  const grid = new THREE.GridHelper(size * 2, Math.floor(size / 4), gridColor, new THREE.Color(gridColor).multiplyScalar(0.12).getHex());
  grid.position.y = 0.01;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.12;
  scene.add(grid);
}

export function setupLighting(scene: THREE.Scene, accent: number = 0x00ffcc) {
  const ambient = new THREE.AmbientLight(0x253347, 0.9);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0x4c7bb0, 0x091117, 0.88);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xf3f7ff, 1.15);
  dir.position.set(58, 90, 26);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  dir.shadow.camera.far = 250;
  dir.shadow.camera.left = -120;
  dir.shadow.camera.right = 120;
  dir.shadow.camera.top = 120;
  dir.shadow.camera.bottom = -120;
  scene.add(dir);
  const rimLight = new THREE.DirectionalLight(accent, 0.45);
  rimLight.position.set(-40, 36, -28);
  scene.add(rimLight);
}

export function createFloatingParticles(scene: THREE.Scene, count: number, worldSize: number): THREE.Points {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const colors = [new THREE.Color(0x7dd3fc), new THREE.Color(0x93c5fd), new THREE.Color(0xfde68a), new THREE.Color(0xc4b5fd)];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * worldSize * 1.5;
    pos[i * 3 + 1] = Math.random() * 35 + 2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * worldSize * 1.5;
    const c = colors[Math.floor(Math.random() * colors.length)];
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.18, vertexColors: true, transparent: true, opacity: 0.33, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return pts;
}

export function animateParticles(particles: THREE.Points, time: number) {
  const arr = particles.geometry.attributes.position.array as Float32Array;
  for (let i = 0; i < arr.length; i += 3) {
    arr[i + 1] += Math.sin(time + i) * 0.004;
    if (arr[i + 1] > 40) arr[i + 1] = 2;
    if (arr[i + 1] < 1) arr[i + 1] = 35;
  }
  particles.geometry.attributes.position.needsUpdate = true;
}

// ============= PHYSICS HELPERS =============
export const GRAVITY = -30;
export const MOVE_SPEED = 18;
export const SPRINT_SPEED = 34;
export const JUMP_FORCE = 13;

export interface PhysicsBody {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: number;
  grounded: boolean;
}

export function updatePhysics(
  body: PhysicsBody,
  moveX: number,
  moveZ: number,
  jump: boolean,
  sprint: boolean,
  cameraAngle: number,
  dt: number,
  worldBound: number,
  groundY: number = 0,
) {
  // Rotate movement by camera angle
  const sin = Math.sin(cameraAngle);
  const cos = Math.cos(cameraAngle);
  const worldMoveX = moveX * cos - moveZ * sin;
  const worldMoveZ = moveX * sin + moveZ * cos;
  const speed = sprint ? SPRINT_SPEED : MOVE_SPEED;

  body.vel.x = worldMoveX * speed;
  body.vel.z = worldMoveZ * speed;

  if (jump && body.grounded) {
    body.vel.y = JUMP_FORCE;
    body.grounded = false;
  }

  body.vel.y += GRAVITY * dt;
  body.pos.x += body.vel.x * dt;
  body.pos.y += body.vel.y * dt;
  body.pos.z += body.vel.z * dt;

  if (body.pos.y <= groundY) {
    body.pos.y = groundY;
    body.vel.y = 0;
    body.grounded = true;
  }

  const b = worldBound;
  body.pos.x = Math.max(-b, Math.min(b, body.pos.x));
  body.pos.z = Math.max(-b, Math.min(b, body.pos.z));

  // Turn to face movement direction
  const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
  if (moveLen > 0.1) {
    const target = Math.atan2(worldMoveX, worldMoveZ);
    let diff = target - body.rot;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    body.rot += diff * 10 * dt;
  }
}

// ============= INPUT HELPERS =============
export interface InputState {
  keys: Set<string>;
  joystick: { active: boolean; dx: number; dy: number; startX: number; startY: number };
  cameraTouch: { active: boolean; lastX: number; lastY: number };
  gamepadIndex: number | null;
}

export function createInputState(): InputState {
  return {
    keys: new Set(),
    joystick: { active: false, dx: 0, dy: 0, startX: 0, startY: 0 },
    cameraTouch: { active: false, lastX: 0, lastY: 0 },
    gamepadIndex: null,
  };
}

export function getMovementFromInput(input: InputState): { moveX: number; moveZ: number; jump: boolean; sprint: boolean } {
  let moveX = 0, moveZ = 0;

  // Keyboard
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) moveZ -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) moveZ += 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) moveX -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) moveX += 1;

  // Touch joystick
  if (input.joystick.active) {
    moveX += input.joystick.dx;
    moveZ += input.joystick.dy;
  }

  // Gamepad
  if (input.gamepadIndex !== null) {
    const gp = navigator.getGamepads()[input.gamepadIndex];
    if (gp) {
      if (Math.abs(gp.axes[0]) > 0.15) moveX += gp.axes[0];
      if (Math.abs(gp.axes[1]) > 0.15) moveZ += gp.axes[1];
    }
  }

  const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
  if (len > 1) { moveX /= len; moveZ /= len; }

  const jump = input.keys.has('Space') || (input.gamepadIndex !== null && navigator.getGamepads()[input.gamepadIndex]?.buttons[0]?.pressed || false);
  const sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');

  return { moveX, moveZ, jump, sprint };
}

// ============= CAMERA HELPERS =============
export function updateThirdPersonCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  cameraAngle: number,
  cameraPitch: number,
  distance: number,
  height: number,
  dt: number,
) {
  const camX = target.x + Math.sin(cameraAngle) * distance * Math.cos(cameraPitch);
  const camY = target.y + height * (0.5 + cameraPitch);
  const camZ = target.z + Math.cos(cameraAngle) * distance * Math.cos(cameraPitch);
  camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 6 * dt);
  camera.lookAt(target.x, target.y + 2, target.z);
}

// ============= RENDERER SETUP =============
export function createRenderer(container: HTMLElement): THREE.WebGLRenderer {
  const w = container.clientWidth || container.offsetWidth || window.innerWidth;
  const h = container.clientHeight || container.offsetHeight || window.innerHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  // Ensure canvas fills container
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);
  return renderer;
}

// ============= BUILDING HELPERS =============
export function createNeonBuilding(scene: THREE.Scene, x: number, z: number, w: number, h: number, d: number, accentColor: number) {
  const group = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.42, metalness: 0.45 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const edgesGeo = new THREE.EdgesGeometry(bodyGeo);
  const edgesMat = new THREE.LineBasicMaterial({ color: new THREE.Color(accentColor).multiplyScalar(0.7).getHex() });
  const edges = new THREE.LineSegments(edgesGeo, edgesMat);
  edges.position.y = h / 2;
  group.add(edges);

  const winMat = new THREE.MeshBasicMaterial({ color: 0xfff8d1, transparent: true, opacity: 0.72 });
  const rows = Math.floor(h / 4);
  const cols = Math.max(Math.floor(w / 3), 1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() > 0.68) continue;
      const wGeo = new THREE.PlaneGeometry(1.2, 1.5);
      const wf = new THREE.Mesh(wGeo, winMat);
      wf.position.set(-w / 2 + 2 + c * 3, 3 + r * 4, d / 2 + 0.01);
      group.add(wf);
      const wb = wf.clone();
      wb.position.z = -d / 2 - 0.01;
      wb.rotation.y = Math.PI;
      group.add(wb);
    }
  }

  const topGeo = new THREE.BoxGeometry(w + 0.4, 0.3, d + 0.4);
  const topMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.2 });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = h;
  group.add(top);

  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

export function createTree(scene: THREE.Scene, x: number, z: number, scale: number = 1) {
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.24 * scale, 0.36 * scale, 4.4 * scale, 10);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 2.2 * scale;
  trunk.castShadow = true;
  group.add(trunk);

  const fColors = [0x1b8b5a, 0x23724f, 0x2f9f68];
  for (let i = 0; i < 3; i++) {
    const radius = (2.1 - i * 0.38) * scale;
    const folGeo = new THREE.SphereGeometry(radius, 16, 14);
    const folMat = new THREE.MeshStandardMaterial({ color: fColors[i], roughness: 0.82, metalness: 0.02 });
    const fol = new THREE.Mesh(folGeo, folMat);
    fol.position.y = (5.2 + i * 1.1) * scale;
    fol.scale.set(1, 0.82, 1);
    fol.castShadow = true;
    group.add(fol);
  }

  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

export function createStreetLamp(scene: THREE.Scene, x: number, z: number) {
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.11, 6.4, 10);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c3643, metalness: 0.62, roughness: 0.34 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(x, 3.2, z);
  scene.add(pole);

  const lightGeo = new THREE.SphereGeometry(0.24, 12, 12);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff4bf });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.position.set(x, 6.35, z);
  scene.add(light);

  const pointLight = new THREE.PointLight(0xfff6cf, 0.72, 18);
  pointLight.position.set(x, 6.1, z);
  scene.add(pointLight);
}

// ============= COLLISION HELPERS =============
export interface AABB {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export function checkAABBCollision(pos: THREE.Vector3, radius: number, boxes: AABB[]): THREE.Vector3 | null {
  for (const box of boxes) {
    const closestX = Math.max(box.minX, Math.min(pos.x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < radius && pos.y < box.maxY) {
      if (dist === 0) return new THREE.Vector3(1, 0, 0);
      return new THREE.Vector3(dx / dist, 0, dz / dist);
    }
  }
  return null;
}

// ============= PLATFORM HELPERS (for Obby) =============
export function createPlatform(
  scene: THREE.Scene,
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  color: number,
  emissive: boolean = false,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: emissive ? color : 0x000000,
    emissiveIntensity: emissive ? 0.3 : 0,
    roughness: 0.4,
    metalness: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}
