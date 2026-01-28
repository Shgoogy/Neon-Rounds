import { PlayerStats, Card, Platform } from './types';

// Physics
export const GRAVITY = 0.6;
export const FRICTION = 0.85;
export const AIR_RESISTANCE = 0.98;
export const TERMINAL_VELOCITY = 15;

// Canvas
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

// Base Stats
export const BASE_PLAYER_STATS: PlayerStats = {
  moveSpeed: 1.2, // Acceleration
  jumpForce: 14,
  maxHealth: 100,
  width: 40,
  height: 40,
  damage: 25,
  fireRate: 20, // Frames
  bulletSpeed: 12,
  bulletSize: 8,
  maxAmmo: 5,
  reloadTime: 120,
  bulletBounces: 0,
  lifeSteal: 0,
  explosiveRadius: 0,
  knockback: 5,
  gravity: 1.0,
  homing: 0,
};

// Colors
export const COLORS = {
  p1: '#3b82f6', // blue-500
  p2: '#ef4444', // red-500
  platform: '#1e293b', // slate-800
  background: '#020617', // slate-950
  bulletP1: '#60a5fa',
  bulletP2: '#f87171',
  text: '#f8fafc',
};

// Maps
export const MAPS: Platform[][] = [
  // 1. Classic Arena
  [
    { x: 100, y: 500, width: 300, height: 20 },
    { x: CANVAS_WIDTH - 400, y: 500, width: 300, height: 20 },
    { x: CANVAS_WIDTH / 2 - 150, y: 300, width: 300, height: 20 },
    { x: 0, y: CANVAS_HEIGHT - 40, width: CANVAS_WIDTH, height: 40 }, // Ground
    { x: 0, y: 0, width: 40, height: CANVAS_HEIGHT }, // Walls
    { x: CANVAS_WIDTH - 40, y: 0, width: 40, height: CANVAS_HEIGHT },
    { x: 0, y: 0, width: CANVAS_WIDTH, height: 40 }, // Ceiling
  ],
  // 2. The Cage
  [
    { x: 200, y: 200, width: 20, height: 400 }, // Pillars
    { x: CANVAS_WIDTH - 220, y: 200, width: 20, height: 400 },
    { x: 300, y: 400, width: 600, height: 20 }, // Mid plat
    { x: 0, y: CANVAS_HEIGHT - 40, width: CANVAS_WIDTH, height: 40 },
    { x: 0, y: 0, width: 40, height: CANVAS_HEIGHT },
    { x: CANVAS_WIDTH - 40, y: 0, width: 40, height: CANVAS_HEIGHT },
    { x: 0, y: 0, width: CANVAS_WIDTH, height: 40 },
  ],
  // 3. Floating Islands
  [
     { x: 200, y: 600, width: 200, height: 20 },
     { x: CANVAS_WIDTH - 400, y: 600, width: 200, height: 20 },
     { x: 100, y: 300, width: 200, height: 20 },
     { x: CANVAS_WIDTH - 300, y: 300, width: 200, height: 20 },
     { x: CANVAS_WIDTH / 2 - 100, y: 450, width: 200, height: 20 },
     { x: 0, y: 0, width: 40, height: CANVAS_HEIGHT },
     { x: CANVAS_WIDTH - 40, y: 0, width: 40, height: CANVAS_HEIGHT },
     { x: 0, y: 0, width: CANVAS_WIDTH, height: 40 },
  ],
  // 4. The Pit
  [
      { x: 0, y: 300, width: 300, height: 20 },
      { x: CANVAS_WIDTH - 300, y: 300, width: 300, height: 20 },
      { x: 0, y: 600, width: 200, height: 20 },
      { x: CANVAS_WIDTH - 200, y: 600, width: 200, height: 20 },
      { x: CANVAS_WIDTH/2 - 50, y: 700, width: 100, height: 20 },
      { x: 0, y: 0, width: 40, height: CANVAS_HEIGHT },
      { x: CANVAS_WIDTH - 40, y: 0, width: 40, height: CANVAS_HEIGHT },
      { x: 0, y: 0, width: CANVAS_WIDTH, height: 40 },
  ],
  // 5. Verticality
  [
      { x: CANVAS_WIDTH/2 - 300, y: 650, width: 600, height: 20 },
      { x: 100, y: 500, width: 150, height: 20 },
      { x: CANVAS_WIDTH - 250, y: 500, width: 150, height: 20 },
      { x: 200, y: 350, width: 150, height: 20 },
      { x: CANVAS_WIDTH - 350, y: 350, width: 150, height: 20 },
      { x: CANVAS_WIDTH/2 - 50, y: 200, width: 100, height: 20 },
      { x: 0, y: CANVAS_HEIGHT - 40, width: CANVAS_WIDTH, height: 40 },
      { x: 0, y: 0, width: 40, height: CANVAS_HEIGHT },
      { x: CANVAS_WIDTH - 40, y: 0, width: 40, height: CANVAS_HEIGHT },
      { x: 0, y: 0, width: CANVAS_WIDTH, height: 40 },
  ]
];

// Expanded Card Pool
export const CARD_POOL: Card[] = [
  {
    id: 'bulk_up',
    name: 'Bulk Up',
    description: 'More health, but you are larger.',
    rarity: 'common',
    stats: { healthMult: 1.5, sizeMult: 1.25 }
  },
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    description: 'Massive damage, but minimal health.',
    rarity: 'rare',
    stats: { damageMult: 2.5, healthMult: 0.5 }
  },
  {
    id: 'spray_pray',
    name: 'Minigun',
    description: 'Shoot incredibly fast with less accuracy and damage.',
    rarity: 'rare',
    stats: { fireRateMult: 0.25, damageMult: 0.5, ammoMult: 4, bulletSpeedMult: 1.2 }
  },
  {
    id: 'sniper',
    name: 'Sniper Rounds',
    description: 'Fast, high damage bullets. Slow reload.',
    rarity: 'rare',
    stats: { bulletSpeedMult: 2.5, damageMult: 2.0, fireRateMult: 2.0, ammoMult: 0.5 }
  },
  {
    id: 'vampire',
    name: 'Vampirism',
    description: 'Heal on hit.',
    rarity: 'legendary',
    stats: { lifeSteal: 0.25 } 
  },
  {
    id: 'explosive',
    name: 'Explosive Rounds',
    description: 'Bullets explode on impact.',
    rarity: 'legendary',
    stats: { explosiveRadius: 70, damageMult: 0.85 }
  },
  {
    id: 'heavy_rounds',
    name: 'Heavy Rounds',
    description: 'Bullets push enemies back significantly.',
    rarity: 'common',
    stats: { knockbackMult: 3.0, damageMult: 1.1 }
  },
  {
    id: 'moon_boots',
    name: 'Moon Boots',
    description: 'Low gravity jumps.',
    rarity: 'rare',
    stats: { gravityMult: 0.5, jumpMult: 1.2 }
  },
  {
    id: 'tank',
    name: 'Tank',
    description: 'Slow, heavy, and very hard to kill.',
    rarity: 'common',
    stats: { speedMult: 0.7, healthMult: 2.5, sizeMult: 1.3 }
  },
  {
    id: 'ricochet',
    name: 'Ricochet',
    description: 'Bullets bounce off walls.',
    rarity: 'common',
    stats: { bulletBounces: 2, damageMult: 0.9 }
  },
  {
    id: 'homing',
    name: 'Homing Bullets',
    description: 'Bullets slightly steer towards the target.',
    rarity: 'legendary',
    stats: { homing: 0.05, bulletSpeedMult: 0.8 }
  },
  {
    id: 'tiny',
    name: 'Tiny',
    description: 'Small, hard to hit, but fast.',
    rarity: 'rare',
    stats: { sizeMult: 0.6, speedMult: 1.3, healthMult: 0.7 }
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    description: 'Shoot multiple bullets at once (Simulated by speed).',
    rarity: 'rare',
    stats: { fireRateMult: 2.0, damageMult: 1.5, bulletSizeMult: 1.5, knockbackMult: 2.0 }
  },
  {
    id: 'poison',
    name: 'Toxic',
    description: 'Deal more damage, move slower.',
    rarity: 'common',
    stats: { damageMult: 1.3, speedMult: 0.9 }
  },
  {
    id: 'jumper',
    name: 'Springs',
    description: 'Jump incredible heights.',
    rarity: 'common',
    stats: { jumpMult: 1.6 }
  },
  {
    id: 'infinite',
    name: 'Bottomless Clip',
    description: 'Huge ammo capacity.',
    rarity: 'rare',
    stats: { ammoMult: 5.0 }
  }
];