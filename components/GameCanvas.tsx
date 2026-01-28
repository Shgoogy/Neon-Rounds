import React, { useRef, useEffect, useCallback } from 'react';
import { 
  GameSession, 
  PlayerStats, 
  Card, 
  GameState, 
  Platform, 
  Bullet, 
  Entity, 
  Particle,
  StatModifiers
} from '../types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  GRAVITY, 
  FRICTION, 
  BASE_PLAYER_STATS, 
  COLORS, 
  TERMINAL_VELOCITY, 
  AIR_RESISTANCE,
  MAPS
} from '../constants';

interface GameCanvasProps {
  session: GameSession;
  gameState: GameState;
  onRoundEnd: (winner: 'p1' | 'p2') => void;
  // Network Props
  networkMode: 'local' | 'host' | 'client';
  onSendState?: (state: any) => void;
  onSendInput?: (input: any) => void;
  latestRemoteState?: any; // For Client to render
  latestRemoteInput?: any; // For Host to process
}

// Helper to apply card modifiers
const calculateStats = (base: PlayerStats, cards: Card[]): PlayerStats => {
  const stats = { ...base };
  cards.forEach(card => {
    const s = card.stats;
    if (s.speedMult) stats.moveSpeed *= s.speedMult;
    if (s.jumpMult) stats.jumpForce *= s.jumpMult;
    if (s.sizeMult) {
      stats.width *= s.sizeMult;
      stats.height *= s.sizeMult;
    }
    if (s.healthMult) stats.maxHealth *= s.healthMult;
    if (s.damageMult) stats.damage *= s.damageMult;
    if (s.fireRateMult) stats.fireRate *= s.fireRateMult;
    if (s.bulletSpeedMult) stats.bulletSpeed *= s.bulletSpeedMult;
    if (s.bulletSizeMult) stats.bulletSize *= s.bulletSizeMult;
    if (s.ammoMult) stats.maxAmmo = Math.floor(stats.maxAmmo * s.ammoMult);
    if (s.bulletBounces) stats.bulletBounces += s.bulletBounces;
    if (s.lifeSteal) stats.lifeSteal += s.lifeSteal;
    if (s.explosiveRadius) stats.explosiveRadius += s.explosiveRadius;
    if (s.knockbackMult) stats.knockback *= s.knockbackMult;
    if (s.gravityMult) stats.gravity *= s.gravityMult;
    if (s.homing) stats.homing += s.homing;
  });
  stats.fireRate = Math.max(2, stats.fireRate);
  stats.moveSpeed = Math.max(0.2, stats.moveSpeed);
  return stats;
};

// Physics Entity Interface
interface PhysicsEntity extends Entity {
  id: 'p1' | 'p2';
  onGround: boolean;
  canJump: boolean;
  currentAmmo: number;
  reloadTimer: number;
  shootTimer: number;
  health: number;
  maxHealth: number;
  facing: 1 | -1;
  aimAngle: number;
  stats: PlayerStats;
  legCycle: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
    session, 
    gameState, 
    onRoundEnd, 
    networkMode,
    onSendState,
    onSendInput,
    latestRemoteState,
    latestRemoteInput
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef<number>(0);
  
  // Mutable game state
  const physicsState = useRef({
    p1: null as PhysicsEntity | null,
    p2: null as PhysicsEntity | null,
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    platforms: [] as Platform[],
    screenShake: 0,
    roundEnded: false,
  });

  // Input state
  const inputs = useRef({
    // Local Input (Mapped to P1 in Local/Host, Mapped to P2 in Client)
    up: false, left: false, down: false, right: false, jump: false, shoot: false,
    mouseX: 0, mouseY: 0,
    // Local P2 Input (Only used in 'local' mode for second keyboard player)
    p2Up: false, p2Left: false, p2Down: false, p2Right: false, p2Shoot: false
  });

  // Setup Level
  const initLevel = useCallback(() => {
    const p1Stats = calculateStats(BASE_PLAYER_STATS, session.p1Cards);
    const p2Stats = calculateStats(BASE_PLAYER_STATS, session.p2Cards);
    const mapIndex = (session.round - 1) % MAPS.length;
    const currentMap = MAPS[mapIndex];

    physicsState.current = {
      p1: {
        id: 'p1',
        x: 100, y: 200, vx: 0, vy: 0,
        width: p1Stats.width, height: p1Stats.height,
        color: COLORS.p1,
        onGround: false, canJump: true,
        currentAmmo: p1Stats.maxAmmo, reloadTimer: 0, shootTimer: 0,
        health: p1Stats.maxHealth, maxHealth: p1Stats.maxHealth,
        facing: 1, aimAngle: 0, stats: p1Stats, legCycle: 0
      },
      p2: {
        id: 'p2',
        x: CANVAS_WIDTH - 140, y: 200, vx: 0, vy: 0,
        width: p2Stats.width, height: p2Stats.height,
        color: COLORS.p2,
        onGround: false, canJump: true,
        currentAmmo: p2Stats.maxAmmo, reloadTimer: 0, shootTimer: 0,
        health: p2Stats.maxHealth, maxHealth: p2Stats.maxHealth,
        facing: -1, aimAngle: Math.PI, stats: p2Stats, legCycle: 0
      },
      bullets: [],
      particles: [],
      platforms: currentMap,
      screenShake: 0,
      roundEnded: false,
    };
  }, [session]);

  // Input Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;
      const k = e.key.toLowerCase();
      
      // Primary Controls (WASD + Space)
      // Used by P1 (Local/Host) OR P2 (Client)
      if (k === 'w') inputs.current.up = true;
      if (k === 'a') inputs.current.left = true;
      if (k === 's') inputs.current.down = true;
      if (k === 'd') inputs.current.right = true;
      if (k === ' ') inputs.current.jump = true;

      // Secondary Controls (Arrows + Enter) - Only for Local P2
      if (networkMode === 'local') {
          if (e.key === 'ArrowUp') inputs.current.p2Up = true;
          if (e.key === 'ArrowLeft') inputs.current.p2Left = true;
          if (e.key === 'ArrowDown') inputs.current.p2Down = true;
          if (e.key === 'ArrowRight') inputs.current.p2Right = true;
          if (e.key === 'Enter') inputs.current.p2Shoot = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w') inputs.current.up = false;
      if (k === 'a') inputs.current.left = false;
      if (k === 's') inputs.current.down = false;
      if (k === 'd') inputs.current.right = false;
      if (k === ' ') inputs.current.jump = false;

      if (networkMode === 'local') {
          if (e.key === 'ArrowUp') inputs.current.p2Up = false;
          if (e.key === 'ArrowLeft') inputs.current.p2Left = false;
          if (e.key === 'ArrowDown') inputs.current.p2Down = false;
          if (e.key === 'ArrowRight') inputs.current.p2Right = false;
          if (e.key === 'Enter') inputs.current.p2Shoot = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            inputs.current.mouseX = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
            inputs.current.mouseY = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
        }
    };

    const handleMouseDown = () => { inputs.current.shoot = true; };
    const handleMouseUp = () => { inputs.current.shoot = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameState, networkMode]);

  // Init
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      initLevel();
    }
  }, [gameState, initLevel]);

  // Loop
  useEffect(() => {
    if (gameState !== GameState.PLAYING) {
        if (reqRef.current) cancelAnimationFrame(reqRef.current);
        return;
    }

    const loop = () => {
      if (networkMode === 'client') {
          updateClient();
      } else {
          updateHostOrLocal();
      }
      draw();
      reqRef.current = requestAnimationFrame(loop);
    };

    reqRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(reqRef.current!);
  }, [gameState, networkMode, latestRemoteState, latestRemoteInput]);


  // --- CLIENT MODE UPDATE ---
  // Just render what the host sends us
  const updateClient = () => {
      // 1. Send our inputs to Host
      if (onSendInput) {
          onSendInput({
              up: inputs.current.up,
              left: inputs.current.left,
              down: inputs.current.down,
              right: inputs.current.right,
              jump: inputs.current.jump,
              shoot: inputs.current.shoot,
              mouseX: inputs.current.mouseX,
              mouseY: inputs.current.mouseY
          });
      }

      // 2. Apply Host State
      if (latestRemoteState && physicsState.current.p1 && physicsState.current.p2) {
          // Naively overwrite everything
          const remote = latestRemoteState;
          
          const syncEntity = (local: PhysicsEntity, remote: any) => {
              local.x = remote.x;
              local.y = remote.y;
              local.vx = remote.vx;
              local.vy = remote.vy;
              local.health = remote.health;
              local.facing = remote.facing;
              local.aimAngle = remote.aimAngle;
              local.currentAmmo = remote.currentAmmo;
              local.legCycle = remote.legCycle;
          };

          syncEntity(physicsState.current.p1, remote.p1);
          syncEntity(physicsState.current.p2, remote.p2);
          
          physicsState.current.bullets = remote.bullets;
          physicsState.current.screenShake = remote.screenShake;
          
          // Check round end trigger from host
          if (remote.roundEnded && !physicsState.current.roundEnded) {
               physicsState.current.roundEnded = true;
               // Wait for props to update, or handle locally? 
               // The host drives the game flow in App.tsx typically.
          }
      }
  };

  // --- HOST / LOCAL UPDATE ---
  // Run physics, handle inputs
  const updateHostOrLocal = () => {
    const state = physicsState.current;
    if (!state.p1 || !state.p2 || state.roundEnded) return;

    // --- Inputs Handling ---
    let p1Input, p2Input;

    if (networkMode === 'host') {
        // P1 is Local (WASD/Mouse)
        p1Input = inputs.current;
        // P2 is Remote
        p2Input = latestRemoteInput || { up:false, left:false, right:false, jump:false, shoot:false, mouseX:0, mouseY:0 };
    } else {
        // Local Mode
        // P1 is WASD/Mouse
        p1Input = inputs.current;
        // P2 is Arrow/Enter (Auto Aim helper included in logic below)
        p2Input = {
            up: inputs.current.p2Up,
            down: inputs.current.p2Down,
            left: inputs.current.p2Left,
            right: inputs.current.p2Right,
            jump: false, // Arrows usually don't have separate jump key in this mapping, maybe Up is jump?
            // User said: "[ ] is jump (space) instead of W".
            // For P2 Arrows: Let's make Up jump if they want, or just rely on arrows.
            // Let's assume Up is Jump for P2 Local for now.
            isLocalArrows: true,
            shoot: inputs.current.p2Shoot
        };
    }

    // --- P1 Logic ---
    const p1Center = { x: state.p1.x + state.p1.width/2, y: state.p1.y + state.p1.height/2 };
    state.p1.aimAngle = Math.atan2(p1Input.mouseY - p1Center.y, p1Input.mouseX - p1Center.x);
    state.p1.facing = Math.cos(state.p1.aimAngle) > 0 ? 1 : -1;
    
    applyPhysics(state.p1, p1Input.left, p1Input.right, p1Input.jump, p1Input.down); // Space is Jump
    if (p1Input.shoot) attemptShoot(state.p1, 'p1');

    // --- P2 Logic ---
    if (networkMode === 'host') {
        // Remote P2 uses mouse aiming
        const p2Center = { x: state.p2.x + state.p2.width/2, y: state.p2.y + state.p2.height/2 };
        state.p2.aimAngle = Math.atan2(p2Input.mouseY - p2Center.y, p2Input.mouseX - p2Center.x);
        state.p2.facing = Math.cos(state.p2.aimAngle) > 0 ? 1 : -1;
        
        applyPhysics(state.p2, p2Input.left, p2Input.right, p2Input.jump, p2Input.down);
        if (p2Input.shoot) attemptShoot(state.p2, 'p2');

    } else {
        // Local P2 (Auto-Aim)
        const p2Center = { x: state.p2.x + state.p2.width/2, y: state.p2.y + state.p2.height/2 };
        const targetX = state.p1.x + state.p1.width/2;
        const targetY = state.p1.y + state.p1.height/2;
        const idealAngle = Math.atan2(targetY - p2Center.y, targetX - p2Center.x);
        
        let diff = idealAngle - state.p2.aimAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        state.p2.aimAngle += diff * 0.15;
        state.p2.facing = Math.cos(state.p2.aimAngle) > 0 ? 1 : -1;

        applyPhysics(state.p2, p2Input.left, p2Input.right, p2Input.up, p2Input.down); // Up is jump for arrows
        if (p2Input.shoot) attemptShoot(state.p2, 'p2');
    }

    // --- Bullet Logic (Shared) ---
    updateBullets(state);

    // --- Particles (Shared) ---
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        p.alpha = p.life / p.maxLife;
        if (p.life <= 0) state.particles.splice(i, 1);
    }

    // Screen Shake
    if (state.screenShake > 0) state.screenShake *= 0.9;
    if (state.screenShake < 0.5) state.screenShake = 0;

    // Win Condition
    checkWin(state);

    // Send State if Host
    if (networkMode === 'host' && onSendState) {
        // Minimize bandwidth? Send essential data
        onSendState({
            p1: { x:state.p1.x, y:state.p1.y, vx:state.p1.vx, vy:state.p1.vy, health:state.p1.health, facing:state.p1.facing, aimAngle:state.p1.aimAngle, currentAmmo:state.p1.currentAmmo, legCycle:state.p1.legCycle },
            p2: { x:state.p2.x, y:state.p2.y, vx:state.p2.vx, vy:state.p2.vy, health:state.p2.health, facing:state.p2.facing, aimAngle:state.p2.aimAngle, currentAmmo:state.p2.currentAmmo, legCycle:state.p2.legCycle },
            bullets: state.bullets,
            screenShake: state.screenShake,
            roundEnded: state.roundEnded
        });
    }
  };

  const updateBullets = (state: any) => {
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i];
        
        // Homing
        if (b.homingStrength > 0 && b.targetId) {
            const target = b.targetId === 'p1' ? state.p1 : state.p2;
            const tx = target.x + target.width/2;
            const ty = target.y + target.height/2;
            const bx = b.x + b.width/2;
            const by = b.y + b.height/2;
            const targetAngle = Math.atan2(ty - by, tx - bx);
            const currentAngle = Math.atan2(b.vy, b.vx);
            let angleDiff = targetAngle - currentAngle;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            const newAngle = currentAngle + angleDiff * b.homingStrength;
            const speed = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
            b.vx = Math.cos(newAngle) * speed;
            b.vy = Math.sin(newAngle) * speed;
        }
        
        b.x += b.vx;
        b.y += b.vy;
        b.lifeTime--;

        let hitWall = false;
        for (const p of state.platforms) {
            if (AABB(b, p)) {
                hitWall = true;
                const overlapX = (b.width/2 + p.width/2) - Math.abs((b.x + b.width/2) - (p.x + p.width/2));
                const overlapY = (b.height/2 + p.height/2) - Math.abs((b.y + b.height/2) - (p.y + p.height/2));
                if (overlapX < overlapY) {
                    b.vx *= -1;
                    b.x += (b.vx > 0 ? overlapX : -overlapX);
                } else {
                    b.vy *= -1;
                    b.y += (b.vy > 0 ? overlapY : -overlapY);
                }
                b.bouncesLeft--;
                break;
            }
        }

        const target = b.ownerId === 'p1' ? state.p2 : state.p1;
        if (AABB(b, target)) {
            takeDamage(target, b.damage);
            const knockForce = b.knockback;
            target.vx += (b.vx > 0 ? 1 : -1) * knockForce;
            target.vy += (b.vy > 0 ? 1 : -1) * knockForce * 0.5;
            const attacker = b.ownerId === 'p1' ? state.p1 : state.p2;
            if (attacker.stats.lifeSteal > 0) {
                attacker.health = Math.min(attacker.maxHealth, attacker.health + (b.damage * attacker.stats.lifeSteal));
            }
            if (b.isExplosive) {
                createExplosion(b.x, b.y, b.explosiveRadius, b.damage, b.ownerId);
            }
            createParticles(b.x, b.y, b.color, 10);
            state.bullets.splice(i, 1);
            continue;
        }

        if (b.lifeTime <= 0 || (hitWall && b.bouncesLeft < 0)) {
            if (b.isExplosive && hitWall) {
                createExplosion(b.x, b.y, b.explosiveRadius, b.damage, b.ownerId);
            }
            createParticles(b.x, b.y, b.color, 5);
            state.bullets.splice(i, 1);
        }
    }
  };

  const applyPhysics = (entity: PhysicsEntity, left: boolean, right: boolean, jump: boolean, down: boolean) => {
    // Horizontal
    if (left) {
        entity.vx -= entity.stats.moveSpeed;
        entity.legCycle += 0.2;
    }
    if (right) {
        entity.vx += entity.stats.moveSpeed;
        entity.legCycle += 0.2;
    }
    if (!left && !right) entity.legCycle = 0;
    
    entity.vx *= FRICTION;
    entity.x += entity.vx;

    // Collision X
    const platforms = physicsState.current.platforms;
    for (const p of platforms) {
        if (AABB(entity, p)) {
            if (entity.vx > 0) entity.x = p.x - entity.width;
            else if (entity.vx < 0) entity.x = p.x + p.width;
            entity.vx = 0;
        }
    }

    // Vertical
    entity.vy += GRAVITY * entity.stats.gravity;
    if (entity.vy > TERMINAL_VELOCITY) entity.vy = TERMINAL_VELOCITY;
    entity.vy *= AIR_RESISTANCE;
    entity.y += entity.vy;

    entity.onGround = false;
    for (const p of platforms) {
        if (AABB(entity, p)) {
            if (entity.vy > 0) {
                entity.y = p.y - entity.height;
                entity.onGround = true;
                entity.canJump = true;
            } else if (entity.vy < 0) {
                entity.y = p.y + p.height;
            }
            entity.vy = 0;
        }
    }

    // Jump (Using SPACE or Remote Jump input)
    if (jump && entity.canJump) {
        entity.vy = -entity.stats.jumpForce;
        entity.canJump = false;
        createParticles(entity.x + entity.width/2, entity.y + entity.height, '#fff', 3);
    }

    // Fall of map
    if (entity.y > CANVAS_HEIGHT + 100) {
        entity.health = 0; 
    }

    // Cooldowns
    if (entity.shootTimer > 0) entity.shootTimer--;
    if (entity.reloadTimer > 0) entity.reloadTimer--;
    if (entity.currentAmmo <= 0 && entity.reloadTimer <= 0) {
        entity.reloadTimer = entity.stats.reloadTime;
        entity.currentAmmo = entity.stats.maxAmmo;
    }
    if (entity.reloadTimer === 1) { 
        entity.currentAmmo = entity.stats.maxAmmo;
    }
  };

  const attemptShoot = (entity: PhysicsEntity, owner: 'p1' | 'p2') => {
    if (entity.shootTimer > 0 || entity.currentAmmo <= 0 || entity.reloadTimer > 0) return;

    entity.currentAmmo--;
    entity.shootTimer = entity.stats.fireRate;
    const angle = entity.aimAngle;
    const recoilForce = 2;
    entity.vx -= Math.cos(angle) * recoilForce;
    entity.vy -= Math.sin(angle) * recoilForce;

    const b: Bullet = {
        id: Math.random().toString(),
        ownerId: owner,
        targetId: owner === 'p1' ? 'p2' : 'p1',
        x: entity.x + entity.width/2 + Math.cos(angle) * (entity.width),
        y: entity.y + entity.height/2 + Math.sin(angle) * (entity.height),
        width: entity.stats.bulletSize,
        height: entity.stats.bulletSize,
        vx: Math.cos(angle) * entity.stats.bulletSpeed,
        vy: Math.sin(angle) * entity.stats.bulletSpeed,
        color: owner === 'p1' ? COLORS.bulletP1 : COLORS.bulletP2,
        damage: entity.stats.damage,
        bouncesLeft: entity.stats.bulletBounces,
        lifeTime: 200,
        isExplosive: entity.stats.explosiveRadius > 0,
        explosiveRadius: entity.stats.explosiveRadius,
        knockback: entity.stats.knockback,
        homingStrength: entity.stats.homing
    };
    physicsState.current.bullets.push(b);
    physicsState.current.screenShake += 2;
  };

  const takeDamage = (entity: PhysicsEntity, amount: number) => {
    entity.health -= amount;
    physicsState.current.screenShake += 5;
  };

  const createExplosion = (x: number, y: number, radius: number, damage: number, ownerId: string) => {
      const state = physicsState.current;
      [state.p1, state.p2].forEach(ent => {
          if (!ent) return;
          const cx = ent.x + ent.width/2;
          const cy = ent.y + ent.height/2;
          const dist = Math.sqrt((cx - x)**2 + (cy - y)**2);
          if (dist < radius + Math.max(ent.width, ent.height)) {
              ent.health -= damage * 0.8; 
          }
      });
      createParticles(x, y, '#fbbf24', 20); 
      state.screenShake += 10;
  };

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
        physicsState.current.particles.push({
            x, y, width: 3, height: 3,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            color, life: 30 + Math.random() * 20, maxLife: 50, alpha: 1
        });
    }
  };

  const checkWin = (state: any) => {
      if (state.p1.health <= 0 && !state.roundEnded) {
        state.roundEnded = true;
        createParticles(state.p1.x, state.p1.y, state.p1.color, 50);
        setTimeout(() => onRoundEnd('p2'), 2000);
      } else if (state.p2.health <= 0 && !state.roundEnded) {
        state.roundEnded = true;
        createParticles(state.p2.x, state.p2.y, state.p2.color, 50);
        setTimeout(() => onRoundEnd('p1'), 2000);
      }
  };

  const AABB = (a: any, b: any) => {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  };

  // Drawing Helpers
  const getFloorY = (x: number, startY: number, maxReach: number): number | null => {
      const platforms = physicsState.current.platforms;
      let closestY = Infinity; let found = false;
      for(const p of platforms) {
          if (x >= p.x && x <= p.x + p.width) {
              if (p.y >= startY && p.y - startY <= maxReach) {
                  if (p.y < closestY) { closestY = p.y; found = true; }
              }
          }
      }
      return found ? closestY : null;
  };

  const solveIK = (x1: number, y1: number, x2: number, y2: number, l1: number, l2: number, flip: boolean) => {
      const d = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
      if (d > l1 + l2) return { x: x1 + (x2-x1) * (l1/(l1+l2)), y: y1 + (y2-y1) * (l1/(l1+l2)) };
      const a = (l1**2 - l2**2 + d**2) / (2*d);
      const h = Math.sqrt(Math.max(0, l1**2 - a**2));
      const x3 = x1 + a * (x2 - x1) / d;
      const y3 = y1 + a * (y2 - y1) / d;
      return { x: x3 + (flip ? -1 : 1) * h * (y2 - y1) / d, y: y3 - (flip ? -1 : 1) * h * (x2 - x1) / d };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state = physicsState.current;

    const shakeX = (Math.random() - 0.5) * state.screenShake;
    const shakeY = (Math.random() - 0.5) * state.screenShake;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);

    ctx.fillStyle = COLORS.platform;
    for (const p of state.platforms) {
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 2;
        ctx.strokeRect(p.x, p.y, p.width, p.height);
    }
    for (const p of state.particles) {
        ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);
    }
    ctx.globalAlpha = 1.0;
    for (const b of state.bullets) {
        ctx.fillStyle = b.color; ctx.beginPath();
        ctx.arc(b.x + b.width/2, b.y + b.height/2, b.width/2, 0, Math.PI*2); ctx.fill();
    }

    const drawEntity = (e: PhysicsEntity, label: string) => {
        if (e.health <= 0) return;
        ctx.fillStyle = e.color; ctx.strokeStyle = e.color;
        ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
        const legReach = 45; const hipY = e.y + e.height - 10;
        const leftHipX = e.x + 10; const rightHipX = e.x + e.width - 10;
        const isMoving = Math.abs(e.vx) > 0.1;
        const cycleL = Math.sin(e.legCycle); const cycleR = Math.sin(e.legCycle + Math.PI);
        const stride = 15; const liftHeight = 15;
        
        let targetFootLX = leftHipX + (isMoving ? cycleL * stride : 0);
        let targetFootLY = hipY + legReach; 
        const floorL = getFloorY(targetFootLX, hipY - 20, legReach + 20);
        if (floorL !== null) { targetFootLY = floorL; if (isMoving && cycleL > 0) targetFootLY -= cycleL * liftHeight; }
        
        let targetFootRX = rightHipX + (isMoving ? cycleR * stride : 0);
        let targetFootRY = hipY + legReach;
        const floorR = getFloorY(targetFootRX, hipY - 20, legReach + 20);
        if (floorR !== null) { targetFootRY = floorR; if (isMoving && cycleR > 0) targetFootRY -= cycleR * liftHeight; }

        const kneeL = solveIK(leftHipX, hipY, targetFootLX, targetFootLY, 22, 22, e.facing === -1);
        const kneeR = solveIK(rightHipX, hipY, targetFootRX, targetFootRY, 22, 22, e.facing === -1);
        
        const drawLeg = (hx: number, hy: number, k: any, fx: number, fy: number) => {
            ctx.beginPath(); ctx.moveTo(hx, hy); if (k) ctx.lineTo(k.x, k.y); ctx.lineTo(fx, fy); ctx.stroke();
        };
        ctx.strokeStyle = '#1e293b'; drawLeg(rightHipX, hipY, kneeR, targetFootRX, targetFootRY);
        ctx.strokeStyle = e.color; drawLeg(leftHipX, hipY, kneeL, targetFootLX, targetFootLY);

        ctx.fillStyle = e.color; ctx.beginPath(); ctx.roundRect(e.x, e.y, e.width, e.height, 8); ctx.fill();
        ctx.save(); ctx.translate(e.x + e.width/2, e.y + e.height/2); ctx.rotate(e.aimAngle);
        ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, -5, 25, 10);
        ctx.fillStyle = '#64748b'; ctx.fillRect(25, -3, 8, 6); ctx.restore();
        
        ctx.fillStyle = '#fff';
        const eyeX = e.x + e.width/2 + Math.cos(e.aimAngle) * 10 - 5;
        const eyeY = e.y + e.height/2 + Math.sin(e.aimAngle) * 10 - 5;
        const clampedEyeX = Math.max(e.x + 4, Math.min(e.x + e.width - 12, eyeX));
        const clampedEyeY = Math.max(e.y + 4, Math.min(e.y + e.height - 12, eyeY));
        ctx.beginPath(); ctx.roundRect(clampedEyeX, clampedEyeY, 10, 10, 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath();
        ctx.arc(clampedEyeX + 5 + Math.cos(e.aimAngle)*2, clampedEyeY + 5 + Math.sin(e.aimAngle)*2, 2, 0, Math.PI*2); ctx.fill();

        const hpPct = Math.max(0, e.health / e.maxHealth);
        ctx.fillStyle = '#334155'; ctx.fillRect(e.x, e.y - 15, e.width, 6);
        ctx.fillStyle = hpPct > 0.5 ? '#4ade80' : '#ef4444'; ctx.fillRect(e.x, e.y - 15, e.width * hpPct, 6);
        ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
        ctx.fillText(label, e.x + e.width/2 - 5, e.y - 20);
    };

    if (state.p1) drawEntity(state.p1, networkMode === 'client' ? 'REMOTE P1' : 'YOU (P1)');
    if (state.p2) drawEntity(state.p2, networkMode === 'client' ? 'YOU (P2)' : (networkMode === 'host' ? 'REMOTE P2' : 'P2'));

    ctx.restore();
  };

  return (
    <div className="relative w-full h-full flex justify-center items-center cursor-crosshair">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-4 border-slate-700 rounded-lg shadow-2xl bg-slate-950"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      />
      {/* HUD */}
      <div className="absolute top-4 left-4 font-arcade text-white text-xl">
        PLAYER 1: {session.p1Score}
        <div className="text-xs text-blue-400 mt-1">
          HP: {Math.floor(physicsState.current.p1?.health || 0)} | AMMO: {physicsState.current.p1?.currentAmmo}
        </div>
        <div className="mt-4 flex flex-col gap-1.5 opacity-90">
            {session.p1Cards.map((c, i) => (
                <div key={i} className="text-xs font-mono bg-blue-900/80 px-3 py-1.5 rounded border border-blue-500/50 shadow-sm shadow-blue-500/20">
                    {c.name}
                </div>
            ))}
        </div>
      </div>
      <div className="absolute top-4 right-4 font-arcade text-white text-xl text-right">
        PLAYER 2: {session.p2Score}
        <div className="text-xs text-red-400 mt-1">
          HP: {Math.floor(physicsState.current.p2?.health || 0)} | AMMO: {physicsState.current.p2?.currentAmmo}
        </div>
        <div className="mt-4 flex flex-col gap-1.5 opacity-90 items-end">
            {session.p2Cards.map((c, i) => (
                <div key={i} className="text-xs font-mono bg-red-900/80 px-3 py-1.5 rounded border border-red-500/50 shadow-sm shadow-red-500/20 text-right">
                    {c.name}
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};