// WARMS - Physics Engine
import { W, H, WATER_Y, GRAVITY, SOLDIER_W, SOLDIER_H, WEAPONS, GameState, Projectile, Particle, Soldier } from './types';
import { isSolid, damageTerrain, getSurfaceY } from './maps';

export function updateProjectiles(state: GameState): void {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.age++;

    // Apply gravity
    const weapon = getWeaponById(p.weaponId);
    if (weapon && weapon.grav) {
      p.vy += GRAVITY;
    }

    // Apply wind
    if (weapon && weapon.wind) {
      p.vx += state.wind * weapon.wind;
    }

    // Sub-step movement
    const steps = Math.max(1, Math.ceil(Math.sqrt(p.vx * p.vx + p.vy * p.vy) / 4));
    const svx = p.vx / steps;
    const svy = p.vy / steps;

    let exploded = false;
    for (let s = 0; s < steps; s++) {
      p.x += svx;
      p.y += svy;

      // Check bounds
      if (p.x < -50 || p.x > W + 50 || p.y > H + 50) {
        state.projectiles.splice(i, 1);
        exploded = true;
        break;
      }

      // Check terrain collision
      if (isSolid(state.terrain, p.x, p.y)) {
        if (p.type === 'g' && p.bounces < 3) {
          // Grenade bounces
          p.vy = -Math.abs(p.vy) * 0.5;
          p.vx *= 0.7;
          p.bounces++;
          // Push out of terrain
          while (isSolid(state.terrain, p.x, p.y)) {
            p.y -= 2;
          }
        } else {
          // Explode on impact
          explode(state, p);
          state.projectiles.splice(i, 1);
          exploded = true;
          break;
        }
      }
    }

    if (exploded) continue;

    // Check delay explosion
    if (p.delay > 0 && p.age >= p.delay) {
      explode(state, p);
      state.projectiles.splice(i, 1);
      continue;
    }

    // Check water
    if (p.y > WATER_Y) {
      state.projectiles.splice(i, 1);
      spawnWaterSplash(state, p.x, WATER_Y);
    }
  }
}

export function updateSoldierPhysics(state: GameState): void {
  for (const team of state.teams) {
    for (const s of team.soldiers) {
      if (s.dead) continue;

      // Gravity
      s.vy += GRAVITY;

      // Horizontal movement
      if (s.moveDir !== 0 && s.onGround) {
        s.vx += s.moveDir * 0.5;
        s.vx = Math.max(-4, Math.min(4, s.vx));
        s.facing = s.moveDir;
      }

      // Friction
      if (s.onGround) {
        s.vx *= 0.85;
      } else {
        s.vx *= 0.98;
      }

      // Jump cooldown
      if (s.jumpCooldown > 0) s.jumpCooldown--;

      // Move horizontally
      const newX = s.x + s.vx;
      if (!checkSoldierCollision(state, newX, s.y)) {
        s.x = newX;
      } else {
        s.vx = 0;
      }

      // Move vertically
      const newY = s.y + s.vy;
      if (!checkSoldierCollision(state, s.x, newY)) {
        s.y = newY;
        s.onGround = false;
      } else {
        // Fall damage
        if (s.vy > 8) {
          const dmg = Math.floor((s.vy - 8) * 5);
          s.hp -= dmg;
          if (dmg > 5) {
            state.floatingTexts.push({
              x: s.x, y: s.y - 30,
              text: `-${dmg}`, color: '#ff4444',
              life: 60, vy: -1.5
            });
          }
        }
        if (s.vy > 0) {
          s.onGround = true;
          // Snap to surface
          while (checkSoldierCollision(state, s.x, s.y)) {
            s.y -= 1;
          }
        }
        s.vy = 0;
      }

      // Clamp to world bounds
      s.x = Math.max(SOLDIER_W / 2, Math.min(W - SOLDIER_W / 2, s.x));

      // Water death
      if (s.y > state.waterLevel) {
        s.hp = 0;
        s.dead = true;
        spawnWaterSplash(state, s.x, state.waterLevel);
      }

      // Death check
      if (s.hp <= 0 && !s.dead) {
        s.dead = true;
        state.floatingTexts.push({
          x: s.x, y: s.y - 40,
          text: `${s.name} eliminated!`, color: '#ff0000',
          life: 90, vy: -1
        });
        spawnDeathParticles(state, s.x, s.y);
      }
    }
  }
}

function checkSoldierCollision(state: GameState, x: number, y: number): boolean {
  const hw = SOLDIER_W / 2 - 4;
  const hh = SOLDIER_H / 2 - 2;
  // Check multiple points
  const points = [
    [x - hw, y - hh], [x + hw, y - hh],
    [x - hw, y + hh], [x + hw, y + hh],
    [x, y + hh], [x - hw, y], [x + hw, y]
  ];
  for (const [px, py] of points) {
    if (isSolid(state.terrain, px, py)) return true;
  }
  return false;
}

export function explode(state: GameState, p: Projectile): void {
  const cx = p.x;
  const cy = p.y;
  const radius = p.blast;

  // Damage terrain
  damageTerrain(state.terrain, cx, cy, radius);

  // Damage soldiers
  for (const team of state.teams) {
    for (const s of team.soldiers) {
      if (s.dead) continue;
      const dx = s.x - cx;
      const dy = s.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius + SOLDIER_W / 2) {
        const factor = 1 - dist / (radius + SOLDIER_W / 2);
        const dmg = Math.floor(p.dmg * factor);
        s.hp -= dmg;
        // Knockback
        if (dist > 0) {
          s.vx += (dx / dist) * factor * 8;
          s.vy += (dy / dist) * factor * 6 - 3;
        }
        s.onGround = false;
        if (dmg > 0) {
          state.floatingTexts.push({
            x: s.x, y: s.y - 30,
            text: `-${dmg}`, color: '#ff4444',
            life: 60, vy: -1.5
          });
        }
      }
    }
  }

  // Spawn particles
  spawnExplosionParticles(state, cx, cy, radius);

  // Add glow
  state.glows.push({
    x: cx, y: cy,
    radius: radius * 1.5,
    life: 20, maxLife: 20,
    color: 'rgba(255,200,50,'
  });

  // Camera shake
  state.camShake = Math.min(24, state.camShake + radius * 0.4);

  // Cluster bomb: spawn sub-bombs
  if (p.type === 'c') {
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 + Math.random() * 0.5;
      state.projectiles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * 6,
        vy: Math.sin(angle) * 6 - 4,
        dmg: 20, blast: 20,
        type: 'r', delay: 60 + Math.random() * 40,
        age: 0, bounces: 0,
        owner: p.owner, weaponId: 'cluster_sub'
      });
    }
  }
}

export function spawnExplosionParticles(state: GameState, x: number, y: number, radius: number): void {
  const count = Math.min(60, radius * 2);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 5;
    const type = Math.random() < 0.4 ? 'fire' : (Math.random() < 0.5 ? 'smoke' : 'debris');
    const colors = type === 'fire' ? ['#ff4400', '#ff8800', '#ffcc00', '#ff6600'] :
      type === 'smoke' ? ['#444444', '#666666', '#888888', '#aaaaaa'] :
        ['#8a6540', '#6a4520', '#4a2f2a', '#9a7550'];
    state.particles.push({
      x: x + (Math.random() - 0.5) * radius * 0.5,
      y: y + (Math.random() - 0.5) * radius * 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (type === 'fire' ? 2 : 0),
      life: 30 + Math.random() * 40,
      maxLife: 30 + Math.random() * 40,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: type === 'debris' ? 2 + Math.random() * 4 : 3 + Math.random() * 6,
      type
    });
  }
}

export function spawnWaterSplash(state: GameState, x: number, y: number): void {
  for (let i = 0; i < 15; i++) {
    const angle = -Math.PI * 0.2 - Math.random() * Math.PI * 0.6;
    const speed = 2 + Math.random() * 4;
    state.particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color: '#4488cc',
      size: 2 + Math.random() * 3,
      type: 'water'
    });
  }
}

export function spawnDeathParticles(state: GameState, x: number, y: number): void {
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      life: 40 + Math.random() * 30,
      maxLife: 70,
      color: '#ff0000',
      size: 3 + Math.random() * 4,
      type: 'fire'
    });
  }
}

export function updateParticles(state: GameState): void {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;

    if (p.type === 'debris' || p.type === 'water') {
      p.vy += GRAVITY * 0.5;
    } else if (p.type === 'fire') {
      p.vy -= 0.05;
      p.vx *= 0.98;
    } else if (p.type === 'smoke') {
      p.vy -= 0.02;
      p.vx *= 0.99;
    }

    if (p.life <= 0 || p.y > H + 20) {
      state.particles.splice(i, 1);
    }
  }

  // Limit particles
  if (state.particles.length > 500) {
    state.particles.splice(0, state.particles.length - 500);
  }
}

export function updateGlows(state: GameState): void {
  for (let i = state.glows.length - 1; i >= 0; i--) {
    state.glows[i].life--;
    if (state.glows[i].life <= 0) {
      state.glows.splice(i, 1);
    }
  }
}

export function updateFloatingTexts(state: GameState): void {
  for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
    const ft = state.floatingTexts[i];
    ft.y += ft.vy;
    ft.life--;
    if (ft.life <= 0) {
      state.floatingTexts.splice(i, 1);
    }
  }
}

export function updateDelayedActions(state: GameState): void {
  for (let i = state.delayedActions.length - 1; i >= 0; i--) {
    const action = state.delayedActions[i];
    action.timer--;
    if (action.timer <= 0) {
      if (action.type === 'airstrike') {
        // Drop bomb
        state.projectiles.push({
          x: action.x, y: action.y,
          vx: 0, vy: 8,
          dmg: 30, blast: 30,
          type: 'r', delay: 0,
          age: 0, bounces: 0,
          owner: action.data?.owner || 0,
          weaponId: 'airstrike'
        });
      } else if (action.type === 'shotgun') {
        // Raycast
        const { sx, sy, angle } = action.data;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        let hitX = sx, hitY = sy;
        for (let d = 0; d < 400; d += 4) {
          hitX = sx + cos * d;
          hitY = sy + sin * d;
          if (hitX < 0 || hitX > W || hitY < 0 || hitY > H) break;
          if (isSolid(state.terrain, hitX, hitY)) break;
          // Check soldier hit
          for (const team of state.teams) {
            for (const s of team.soldiers) {
              if (s.dead) continue;
              const dx = s.x - hitX;
              const dy = s.y - hitY;
              if (Math.abs(dx) < SOLDIER_W / 2 && Math.abs(dy) < SOLDIER_H / 2) {
                const dmg = 25;
                s.hp -= dmg;
                s.vx += cos * 5;
                s.vy += sin * 3 - 2;
                s.onGround = false;
                state.floatingTexts.push({
                  x: s.x, y: s.y - 30,
                  text: `-${dmg}`, color: '#ff4444',
                  life: 60, vy: -1.5
                });
              }
            }
          }
        }
        // Visual trail
        for (let d = 0; d < 400; d += 8) {
          const px = sx + cos * d;
          const py = sy + sin * d;
          if (px < 0 || px > W || py < 0 || py > H) break;
          if (isSolid(state.terrain, px, py)) break;
          state.particles.push({
            x: px, y: py,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 10 + Math.random() * 10,
            maxLife: 20,
            color: '#ffcc00',
            size: 2 + Math.random() * 2,
            type: 'fire'
          });
        }
      }
      state.delayedActions.splice(i, 1);
    }
  }
}

function getWeaponById(id: string) {
  if (id === 'cluster_sub') return { grav: true, wind: 0.004 };
  if (id === 'airstrike') return { grav: true, wind: 0 };
  return WEAPONS.find((w) => w.id === id);
}
