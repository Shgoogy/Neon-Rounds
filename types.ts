export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  ROUND_END = 'ROUND_END',
  GAME_OVER = 'GAME_OVER',
}

export interface StatModifiers {
  speedMult?: number;
  jumpMult?: number;
  sizeMult?: number;
  healthMult?: number;
  damageMult?: number;
  fireRateMult?: number; // Lower is faster (delay multiplier)
  bulletSpeedMult?: number;
  bulletSizeMult?: number;
  ammoMult?: number;
  bulletBounces?: number;
  lifeSteal?: number;
  explosiveRadius?: number;
  knockbackMult?: number;
  gravityMult?: number;
  homing?: number; // 0 none, 1 full
}

export interface Card {
  id: string;
  name: string;
  description: string;
  stats: StatModifiers;
  rarity: 'common' | 'rare' | 'legendary';
}

export interface PlayerStats {
  moveSpeed: number;
  jumpForce: number;
  maxHealth: number;
  width: number;
  height: number;
  damage: number;
  fireRate: number; // Frames between shots
  bulletSpeed: number;
  bulletSize: number;
  maxAmmo: number;
  reloadTime: number; // Frames
  bulletBounces: number;
  lifeSteal: number;
  explosiveRadius: number;
  knockback: number;
  gravity: number;
  homing: number;
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  color: string;
}

export interface Bullet extends Entity {
  id: string;
  ownerId: 'p1' | 'p2';
  damage: number;
  bouncesLeft: number;
  lifeTime: number;
  isExplosive: boolean;
  explosiveRadius: number;
  knockback: number;
  homingStrength: number;
  targetId?: 'p1' | 'p2';
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  alpha: number;
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameSession {
  p1Score: number;
  p2Score: number;
  round: number;
  history: { winner: 'p1' | 'p2' }[];
  p1Cards: Card[];
  p2Cards: Card[];
}