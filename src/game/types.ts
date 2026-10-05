// WARMS - Types and Constants

export const W = 1600;
export const H = 900;
export const WATER_Y = 864;
export const GRAVITY = 0.18;
export const WIND_FACTOR = 0.015;
export const SOLDIER_W = 44;
export const SOLDIER_H = 52;
export const MAX_HP = 100;
export const TURN_TIME = 30;
export const FIXED_DT = 16.67;

export const TEAM_COLORS = ['#4a7c3f', '#556358', '#6b5b3a', '#3a4a5a'];
export const TEAM_NAMES = ['Alliierte', 'Achsenmächte', 'Partisanen', 'Widerstand'];
export const NAMES = [
  'Hans', 'Fritz', 'Karl', 'Wilhelm', 'Heinrich', 'Günther',
  'Otto', 'Werner', 'Erich', 'Klaus', 'Dieter', 'Helmut',
  'Max', 'Paul', 'Rudolf', 'Albert', 'Franz', 'Ludwig',
  'Georg', 'Friedrich', 'August', 'Theodor'
];

export interface Theme {
  name: string;
  sky: string[];
  dirt1: string;
  dirt2: string;
  grass: string;
  grassHigh: string;
  hills: string[];
  water: string;
  waterFoam: string;
}

export interface MapDef {
  id: string;
  name: string;
  desc: string;
  theme: number;
  islands: number;
  caves: number;
  heightFunc: (x: number, params: number[], amp: number) => number;
}

export interface WeaponDef {
  id: string;
  name: string;
  icon: string;
  type: string;
  dmg: number;
  blast: number;
  speed: number;
  ammo: number;
  grav?: boolean;
  wind?: number;
  delay?: number;
}

export const WEAPONS: WeaponDef[] = [
  { id: 'bazooka', name: 'Bazooka', icon: '🚀', type: 'r', dmg: 50, blast: 38, speed: 16, ammo: 99, grav: true, wind: 0.004 },
  { id: 'grenade', name: 'Granate', icon: '💣', type: 'g', dmg: 45, blast: 44, speed: 12, ammo: 99, grav: true, delay: 180 },
  { id: 'cluster', name: 'Streubombe', icon: '🎇', type: 'c', dmg: 30, blast: 34, speed: 10, ammo: 3, grav: true, delay: 120 },
  { id: 'holy', name: 'Heilige HGr.', icon: '✨', type: 'h', dmg: 100, blast: 90, speed: 8, ammo: 1, grav: true, delay: 240 },
  { id: 'dynamite', name: 'Dynamit', icon: '🧨', type: 'd', dmg: 75, blast: 72, speed: 0, ammo: 3, grav: true, delay: 300 },
  { id: 'shotgun', name: 'Schrotflinte', icon: '🔫', type: 's', dmg: 25, blast: 16, speed: 19, ammo: 99, grav: false },
  { id: 'airstrike', name: 'Luftangriff', icon: '✈️', type: 'a', dmg: 30, blast: 30, speed: 3, ammo: 2, grav: false },
  { id: 'teleport', name: 'Teleport', icon: '🌀', type: 'p', dmg: 0, blast: 0, speed: 0, ammo: 2, grav: false },
  { id: 'fist', name: 'Feuerfaust', icon: '👊', type: 'u', dmg: 30, blast: 22, speed: 0, ammo: 99, grav: false }
];

export const THEMES: Theme[] = [
  {
    name: 'Sommerwiese',
    sky: ['#3fa7f5', '#aee3ff', '#ffe6bd'],
    dirt1: '#9a6540', dirt2: '#4a2f2a',
    grass: '#4fb53f', grassHigh: '#8be06a',
    hills: ['#92c6ea', '#74abd9', '#5c94c5'],
    water: '#1c6aa8', waterFoam: 'rgba(35,130,210,.55)'
  },
  {
    name: 'Wüstenland',
    sky: ['#f5a73f', '#ffe0a0', '#fff5dd'],
    dirt1: '#c4954a', dirt2: '#7a5520',
    grass: '#d4a84f', grassHigh: '#e8c870',
    hills: ['#e8c870', '#d4a84f', '#c49540'],
    water: '#1c6aa8', waterFoam: 'rgba(35,130,210,.55)'
  },
  {
    name: 'Winterland',
    sky: ['#6a8faa', '#b0cfe0', '#ddeef5'],
    dirt1: '#8a9aa0', dirt2: '#4a5a60',
    grass: '#e8eef2', grassHigh: '#ffffff',
    hills: ['#c0d8e8', '#a0c0d8', '#80a8c0'],
    water: '#2a5a8a', waterFoam: 'rgba(100,160,220,.55)'
  },
  {
    name: 'Abendrot',
    sky: ['#1a0a2e', '#8b2252', '#ff6b35'],
    dirt1: '#5a3a2a', dirt2: '#2a1a10',
    grass: '#3a5a2a', grassHigh: '#5a8a3a',
    hills: ['#4a2a4a', '#3a1a3a', '#2a0a2a'],
    water: '#1a2a4a', waterFoam: 'rgba(60,40,100,.55)'
  },
  {
    name: 'Vulkan',
    sky: ['#1a0a0a', '#4a1a0a', '#8a3a1a'],
    dirt1: '#3a2a2a', dirt2: '#1a0a0a',
    grass: '#2a2a1a', grassHigh: '#4a4a2a',
    hills: ['#3a1a0a', '#2a0a0a', '#1a0505'],
    water: '#8a2a0a', waterFoam: 'rgba(200,60,20,.55)'
  },
  {
    name: 'Mondnacht',
    sky: ['#0a0a2a', '#1a1a4a', '#2a2a6a'],
    dirt1: '#3a3a5a', dirt2: '#1a1a3a',
    grass: '#2a4a3a', grassHigh: '#3a6a4a',
    hills: ['#1a1a3a', '#0a0a2a', '#050520'],
    water: '#0a1a3a', waterFoam: 'rgba(30,60,120,.55)'
  },
  {
    name: 'D-Day',
    sky: ['#3a3a3a', '#5a5a5a', '#7a7a7a'],
    dirt1: '#6a5a4a', dirt2: '#3a2a1a',
    grass: '#4a5a3a', grassHigh: '#6a7a4a',
    hills: ['#5a5a5a', '#4a4a4a', '#3a3a3a'],
    water: '#2a3a4a', waterFoam: 'rgba(60,80,100,.55)'
  }
];

export const MAPS: MapDef[] = [
  {
    id: 'meadow', name: 'Sonnenwiese', desc: 'Grüne Hügel, harte Köpfe.',
    theme: 0, islands: 3, caves: 3,
    heightFunc: (x, p, a) => H * 0.72 + Math.sin(x / 260 + p[0]) * 70 * a + Math.sin(x / 110 + p[1]) * 34 * a
  },
  {
    id: 'peaks', name: 'Gipfelsturm', desc: 'Zackige Berge, tiefe Täler.',
    theme: 2, islands: 1, caves: 5,
    heightFunc: (x, p, a) => H * 0.65 + Math.sin(x / 140 + p[0]) * 100 * a + Math.sin(x / 60 + p[1]) * 50 * a + Math.abs(Math.sin(x / 200 + p[2])) * 40 * a
  },
  {
    id: 'desert', name: 'Wüstencanyon', desc: 'Sandige Weiten, brennende Hitze.',
    theme: 1, islands: 2, caves: 2,
    heightFunc: (x, p, a) => H * 0.75 + Math.sin(x / 300 + p[0]) * 50 * a + Math.sin(x / 80 + p[1]) * 30 * a
  },
  {
    id: 'islands', name: 'Inselreich', desc: 'Verstreute Inseln im Meer.',
    theme: 0, islands: 5, caves: 1,
    heightFunc: (x, p, a) => {
      const base = H * 0.78;
      const v = Math.sin(x / 200 + p[0]) * 60 * a + Math.sin(x / 90 + p[1]) * 25 * a;
      return base + v;
    }
  },
  {
    id: 'volcano', name: 'Vulkanschlund', desc: 'Glühende Lava, schwarzer Fels.',
    theme: 4, islands: 2, caves: 4,
    heightFunc: (x, p, a) => H * 0.68 + Math.sin(x / 180 + p[0]) * 80 * a + Math.sin(x / 70 + p[1]) * 45 * a
  },
  {
    id: 'moon', name: 'Mondnacht', desc: 'Stille Nacht, dunkle Schatten.',
    theme: 5, islands: 3, caves: 3,
    heightFunc: (x, p, a) => H * 0.70 + Math.sin(x / 220 + p[0]) * 65 * a + Math.sin(x / 100 + p[1]) * 35 * a
  },
  {
    id: 'dday', name: 'Omaha Beach', desc: 'Landung am Strand. Viel Glück.',
    theme: 6, islands: 0, caves: 2,
    heightFunc: (x, p, a) => H * 0.80 + Math.sin(x / 350 + p[0]) * 40 * a + Math.sin(x / 120 + p[1]) * 20 * a
  }
];

export interface Soldier {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  team: number;
  name: string;
  facing: number;
  angle: number;
  onGround: boolean;
  active: boolean;
  weaponIdx: number;
  ammo: number[];
  charging: boolean;
  power: number;
  aiPhase: number;
  aiTimer: number;
  aiTarget: { angle: number; power: number } | null;
  moveDir: number;
  jumpCooldown: number;
  dead: boolean;
}

export interface Team {
  name: string;
  color: string;
  soldiers: Soldier[];
  isAI: boolean;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  blast: number;
  type: string;
  delay: number;
  age: number;
  bounces: number;
  owner: number;
  weaponId: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: string;
}

export interface Glow {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
}

export interface Terrain {
  heights: Uint16Array;
  mask: Uint8Array;
  theme: Theme;
  mapIndex: number;
  bg0: HTMLCanvasElement;
  bg: HTMLCanvasElement;
  detailCanvas: HTMLCanvasElement;
}

export interface GameState {
  terrain: Terrain;
  teams: Team[];
  currentTeam: number;
  currentSoldier: number;
  turnCount: number;
  timer: number;
  wind: number;
  phase: string;
  projectiles: Projectile[];
  particles: Particle[];
  glows: Glow[];
  floatingTexts: FloatingText[];
  camX: number;
  camY: number;
  camZoom: number;
  camShake: number;
  mouseX: number;
  mouseY: number;
  keys: Record<string, boolean>;
  gameOver: boolean;
  winner: number;
  delayedActions: Array<{ type: string; x: number; y: number; timer: number; data?: any }>;
  waterLevel: number;
  suddenDeath: boolean;
  projectileEndTimer: number;
}
