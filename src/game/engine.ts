// WARMS - Game Engine
import { W, H, WATER_Y, GRAVITY, SOLDIER_W, SOLDIER_H, MAX_HP, TURN_TIME, FIXED_DT, TEAM_COLORS, TEAM_NAMES, NAMES, WEAPONS, GameState, Soldier, Team, Projectile } from './types';
import { generateTerrain, isSolid, getSurfaceY } from './maps';
import { updateProjectiles, updateSoldierPhysics, updateParticles, updateGlows, updateFloatingTexts, updateDelayedActions, explode } from './physics';

export function initGame(mapIndex: number, teamCount: number, soldiersPerTeam: number, playerTypes: boolean[]): GameState {
  const terrain = generateTerrain(mapIndex);

  const teams: Team[] = [];
  let nameIdx = 0;

  for (let t = 0; t < teamCount; t++) {
    const soldiers: Soldier[] = [];
    for (let s = 0; s < soldiersPerTeam; s++) {
      // Find spawn position
      const spawnX = (W / (teamCount * soldiersPerTeam)) * (t * soldiersPerTeam + s + 0.5);
      const spawnY = getSurfaceY(terrain, spawnX) - SOLDIER_H / 2;

      soldiers.push({
        x: spawnX,
        y: spawnY,
        vx: 0,
        vy: 0,
        hp: MAX_HP,
        team: t,
        name: NAMES[nameIdx % NAMES.length],
        facing: t % 2 === 0 ? 1 : -1,
        angle: -0.3,
        onGround: false,
        active: false,
        weaponIdx: 0,
        ammo: WEAPONS.map(w => w.ammo),
        charging: false,
        power: 0,
        aiPhase: 0,
        aiTimer: 0,
        aiTarget: null,
        moveDir: 0,
        jumpCooldown: 0,
        dead: false
      });
      nameIdx++;
    }
    teams.push({
      name: TEAM_NAMES[t] || `Team ${t + 1}`,
      color: TEAM_COLORS[t] || '#888888',
      soldiers,
      isAI: playerTypes[t] || false
    });
  }

  return {
    terrain,
    teams,
    currentTeam: 0,
    currentSoldier: 0,
    turnCount: 1,
    timer: TURN_TIME,
    wind: (Math.random() - 0.5) * 0.6,
    phase: 'aiming',
    projectiles: [],
    particles: [],
    glows: [],
    floatingTexts: [],
    camX: W / 2 - 400,
    camY: 0,
    camZoom: 1.0,
    camShake: 0,
    mouseX: W / 2,
    mouseY: H / 2,
    keys: {},
    gameOver: false,
    winner: -1,
    delayedActions: [],
    waterLevel: WATER_Y,
    suddenDeath: false,
    projectileEndTimer: 0
  };
}

export function step(state: GameState, dt: number): void {
  if (state.gameOver) return;

  // Timer
  state.timer -= dt / 1000;
  if (state.timer <= 0) {
    endTurn(state);
    return;
  }

  // Human control
  if (state.phase === 'aiming' || state.phase === 'charging') {
    const soldier = getCurrentSoldier(state);
    if (soldier && !state.teams[state.currentTeam].isAI) {
      humanControl(state, soldier);
    }
  }

  // AI
  if (state.teams[state.currentTeam].isAI && (state.phase === 'aiming' || state.phase === 'charging')) {
    updateAI(state, dt);
  }

  // Delayed actions
  updateDelayedActions(state);

  // Projectiles
  updateProjectiles(state);

  // Check if projectile phase should end
  if (state.phase === 'projectile') {
    if (state.projectileEndTimer > 0) {
      state.projectileEndTimer--;
    }
    if (state.projectiles.length === 0 && state.delayedActions.length === 0 && state.projectileEndTimer <= 0) {
      endTurn(state);
    }
  }

  // Soldier physics
  updateSoldierPhysics(state);

  // Particles
  updateParticles(state);

  // Glows
  updateGlows(state);

  // Floating texts
  updateFloatingTexts(state);

  // Camera
  updateCamera(state);

  // Camera shake decay
  state.camShake *= 0.9;
  if (state.camShake < 0.5) state.camShake = 0;

  // Check victory
  checkVictory(state);
}

function getCurrentSoldier(state: GameState): Soldier | null {
  const team = state.teams[state.currentTeam];
  if (!team) return null;
  return team.soldiers[state.currentSoldier] || null;
}

function humanControl(state: GameState, soldier: Soldier): void {
  // Movement
  soldier.moveDir = 0;
  if (state.keys['ArrowLeft'] || state.keys['KeyA']) {
    soldier.moveDir = -1;
    soldier.facing = -1;
  }
  if (state.keys['ArrowRight'] || state.keys['KeyD']) {
    soldier.moveDir = 1;
    soldier.facing = 1;
  }

  // Jump
  if ((state.keys['Space'] || state.keys['ArrowUp'] || state.keys['KeyW']) && soldier.onGround && soldier.jumpCooldown <= 0) {
    soldier.vy = -7;
    soldier.onGround = false;
    soldier.jumpCooldown = 15;
  }

  // Aiming with mouse
  const dx = state.mouseX - soldier.x;
  const dy = state.mouseY - (soldier.y - 10);
  soldier.angle = Math.atan2(dy, dx * soldier.facing);
  soldier.angle = Math.max(-Math.PI / 2, Math.min(Math.PI / 4, soldier.angle));

  // Charging
  if (soldier.charging) {
    soldier.power = Math.min(1, soldier.power + 0.015);
  }

  // Weapon switch with Q/E or number keys
  if (state.keys['KeyQ']) {
    switchWeapon(state, -1);
    state.keys['KeyQ'] = false;
  }
  if (state.keys['KeyE']) {
    switchWeapon(state, 1);
    state.keys['KeyE'] = false;
  }
}

function switchWeapon(state: GameState, dir: number): void {
  const soldier = getCurrentSoldier(state);
  if (!soldier) return;
  let idx = soldier.weaponIdx;
  for (let i = 0; i < WEAPONS.length; i++) {
    idx = (idx + dir + WEAPONS.length) % WEAPONS.length;
    if (soldier.ammo[idx] > 0) {
      soldier.weaponIdx = idx;
      break;
    }
  }
}

export function fireWeapon(state: GameState): void {
  const soldier = getCurrentSoldier(state);
  if (!soldier) return;

  const weapon = WEAPONS[soldier.weaponIdx];
  if (!weapon || soldier.ammo[soldier.weaponIdx] <= 0) return;

  soldier.ammo[soldier.weaponIdx]--;
  const power = Math.max(0.3, soldier.power);
  const speed = weapon.speed * power;

  switch (weapon.type) {
    case 'r': // Rocket
    case 'g': // Grenade
    case 'c': // Cluster
    case 'h': // Holy
      state.projectiles.push({
        x: soldier.x + soldier.facing * 15,
        y: soldier.y - 10,
        vx: Math.cos(soldier.angle) * speed * soldier.facing,
        vy: Math.sin(soldier.angle) * speed,
        dmg: weapon.dmg,
        blast: weapon.blast,
        type: weapon.type,
        delay: weapon.delay || 0,
        age: 0,
        bounces: 0,
        owner: state.currentTeam,
        weaponId: weapon.id
      });
      state.phase = 'projectile';
      break;

    case 'd': // Dynamite
      state.projectiles.push({
        x: soldier.x,
        y: soldier.y - SOLDIER_H / 2,
        vx: soldier.facing * 2,
        vy: -3,
        dmg: weapon.dmg,
        blast: weapon.blast,
        type: 'd',
        delay: weapon.delay || 300,
        age: 0,
        bounces: 0,
        owner: state.currentTeam,
        weaponId: weapon.id
      });
      state.phase = 'projectile';
      break;

    case 's': // Shotgun
      for (let i = 0; i < 2; i++) {
        state.delayedActions.push({
          type: 'shotgun',
          x: soldier.x,
          y: soldier.y,
          timer: i * 10 + 5,
          data: {
            sx: soldier.x + soldier.facing * 15,
            sy: soldier.y - 10,
            angle: soldier.angle
          }
        });
      }
      state.phase = 'projectile';
      state.projectileEndTimer = 30; // ~0.5s at 60fps
      break;

    case 'a': // Airstrike
      for (let i = 0; i < 5; i++) {
        state.delayedActions.push({
          type: 'airstrike',
          x: state.mouseX + (Math.random() - 0.5) * 60,
          y: -20,
          timer: 30 + i * 25,
          data: { owner: state.currentTeam }
        });
      }
      state.phase = 'projectile';
      state.projectileEndTimer = 150; // ~2.5s at 60fps
      break;

    case 'p': // Teleport
      const tx = state.mouseX;
      const ty = getSurfaceY(state.terrain, tx) - SOLDIER_H / 2;
      if (ty > 0 && ty < WATER_Y && !isSolid(state.terrain, tx, ty)) {
        soldier.x = tx;
        soldier.y = ty;
        soldier.vx = 0;
        soldier.vy = 0;
        // Teleport effect
        for (let i = 0; i < 15; i++) {
          const angle = Math.random() * Math.PI * 2;
          state.particles.push({
            x: tx, y: ty,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3,
            life: 20 + Math.random() * 20,
            maxLife: 40,
            color: '#8844ff',
            size: 3 + Math.random() * 3,
            type: 'smoke'
          });
        }
      }
      endTurn(state);
      break;

    case 'u': // Fist (melee)
      const fistRange = 40;
      for (const team of state.teams) {
        for (const s of team.soldiers) {
          if (s.dead || s === soldier) continue;
          const dx = s.x - soldier.x;
          const dy = s.y - soldier.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < fistRange + SOLDIER_W / 2) {
            const dmg = weapon.dmg;
            s.hp -= dmg;
            s.vx += soldier.facing * 8;
            s.vy -= 5;
            s.onGround = false;
            state.floatingTexts.push({
              x: s.x, y: s.y - 30,
              text: `-${dmg}`, color: '#ff4444',
              life: 60, vy: -1.5
            });
          }
        }
      }
      // Punch effect
      for (let i = 0; i < 8; i++) {
        state.particles.push({
          x: soldier.x + soldier.facing * 20,
          y: soldier.y - 10,
          vx: soldier.facing * (2 + Math.random() * 3),
          vy: (Math.random() - 0.5) * 4,
          life: 15 + Math.random() * 10,
          maxLife: 25,
          color: '#ffaa00',
          size: 3 + Math.random() * 3,
          type: 'fire'
        });
      }
      endTurn(state);
      break;
  }

  soldier.charging = false;
  soldier.power = 0;
}

export function startCharging(state: GameState): void {
  const soldier = getCurrentSoldier(state);
  if (!soldier || state.phase !== 'aiming') return;

  const weapon = WEAPONS[soldier.weaponIdx];
  if (!weapon) return;

  // Instant weapons
  if (weapon.type === 'p' || weapon.type === 'u' || weapon.type === 's' || weapon.type === 'a') {
    fireWeapon(state);
    return;
  }

  soldier.charging = true;
  soldier.power = 0;
  state.phase = 'charging';
}

export function releaseCharging(state: GameState): void {
  const soldier = getCurrentSoldier(state);
  if (!soldier || state.phase !== 'charging') return;
  fireWeapon(state);
}

export function endTurn(state: GameState): void {
  state.phase = 'waiting';
  state.wind = (Math.random() - 0.5) * 0.8;

  // Sudden death after 25 rounds
  if (state.turnCount > 25 && !state.suddenDeath) {
    state.suddenDeath = true;
    state.floatingTexts.push({
      x: W / 2, y: H / 3,
      text: 'SUDDEN DEATH!', color: '#ff0000',
      life: 120, vy: -0.5
    });
  }

  // Rising water in sudden death
  if (state.suddenDeath) {
    state.waterLevel = Math.max(H * 0.3, state.waterLevel - 4);
  }

  // Find next alive soldier
  let found = false;
  let teamIdx = state.currentTeam;
  let soldierIdx = state.currentSoldier + 1;

  for (let attempts = 0; attempts < state.teams.length * 20; attempts++) {
    if (soldierIdx >= state.teams[teamIdx].soldiers.length) {
      soldierIdx = 0;
      teamIdx = (teamIdx + 1) % state.teams.length;
      if (teamIdx === state.currentTeam) {
        state.turnCount++;
      }
    }

    const soldier = state.teams[teamIdx].soldiers[soldierIdx];
    if (soldier && !soldier.dead) {
      state.currentTeam = teamIdx;
      state.currentSoldier = soldierIdx;
      found = true;
      break;
    }
    soldierIdx++;
  }

  if (!found) {
    state.gameOver = true;
    return;
  }

  // Reset turn
  state.timer = TURN_TIME;
  state.phase = 'aiming';
  const soldier = getCurrentSoldier(state);
  if (soldier) {
    soldier.charging = false;
    soldier.power = 0;
    soldier.aiPhase = 0;
    soldier.aiTimer = 0;
    soldier.aiTarget = null;
  }
}

function updateCamera(state: GameState): void {
  const soldier = getCurrentSoldier(state);
  let targetX: number, targetY: number;

  if (soldier && !soldier.dead) {
    targetX = soldier.x - W / 2;
    targetY = soldier.y - H / 2;
  } else if (state.projectiles.length > 0) {
    const p = state.projectiles[0];
    targetX = p.x - W / 2;
    targetY = p.y - H / 2;
  } else {
    return;
  }

  // Smooth camera
  state.camX += (targetX - state.camX) * 0.08;
  state.camY += (targetY - state.camY) * 0.08;

  // Clamp
  state.camX = Math.max(-200, Math.min(W - W + 200, state.camX));
  state.camY = Math.max(-200, Math.min(H - H + 200, state.camY));
}

function updateAI(state: GameState, dt: number): void {
  const soldier = getCurrentSoldier(state);
  if (!soldier) return;

  soldier.aiTimer += dt;

  switch (soldier.aiPhase) {
    case 0: // Move towards nearest enemy
      {
        const target = findNearestEnemy(state, soldier);
        if (!target) { endTurn(state); return; }

        const dx = target.x - soldier.x;
        if (Math.abs(dx) > 100) {
          soldier.moveDir = dx > 0 ? 1 : -1;
          soldier.facing = soldier.moveDir;
        } else {
          soldier.moveDir = 0;
        }

        // Jump over obstacles
        if (soldier.onGround && soldier.jumpCooldown <= 0) {
          const aheadX = soldier.x + soldier.facing * 30;
          if (isSolid(state.terrain, aheadX, soldier.y - 10)) {
            soldier.vy = -7;
            soldier.onGround = false;
            soldier.jumpCooldown = 15;
          }
        }

        if (soldier.aiTimer > 1500) {
          soldier.aiPhase = 1;
          soldier.aiTimer = 0;
        }
      }
      break;

    case 1: // Aim
      {
        if (!soldier.aiTarget) {
          // Simulate trajectories
          soldier.aiTarget = simulateBestShot(state, soldier);
        }

        if (soldier.aiTarget) {
          soldier.angle = soldier.aiTarget.angle;
          soldier.facing = Math.cos(soldier.angle) >= 0 ? 1 : -1;
          soldier.power = soldier.aiTarget.power;
        }

        if (soldier.aiTimer > 800) {
          soldier.aiPhase = 2;
          soldier.aiTimer = 0;
        }
      }
      break;

    case 2: // Fire
      {
        fireWeapon(state);
        soldier.aiPhase = 0;
        soldier.aiTimer = 0;
        soldier.aiTarget = null;
      }
      break;
  }
}

function findNearestEnemy(state: GameState, soldier: Soldier): Soldier | null {
  let nearest: Soldier | null = null;
  let minDist = Infinity;

  for (const team of state.teams) {
    if (team === state.teams[state.currentTeam]) continue;
    for (const s of team.soldiers) {
      if (s.dead) continue;
      const dx = s.x - soldier.x;
      const dy = s.y - soldier.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = s;
      }
    }
  }
  return nearest;
}

function simulateBestShot(state: GameState, soldier: Soldier): { angle: number; power: number } | null {
  const target = findNearestEnemy(state, soldier);
  if (!target) return null;

  let bestAngle = -0.5;
  let bestPower = 0.6;
  let bestScore = Infinity;

  // Choose weapon
  const weaponOptions = [0, 1, 2]; // bazooka, grenade, cluster
  const weaponIdx = weaponOptions[Math.floor(Math.random() * weaponOptions.length)];
  if (soldier.ammo[weaponIdx] > 0) {
    soldier.weaponIdx = weaponIdx;
  }

  for (let attempt = 0; attempt < 60; attempt++) {
    const angle = -Math.PI / 2 + Math.random() * Math.PI * 0.8;
    const power = 0.3 + Math.random() * 0.7;
    const endPos = simulateTrajectory(soldier, angle, power, state);

    if (endPos) {
      const dx = endPos.x - target.x;
      const dy = endPos.y - target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const weapon = WEAPONS[soldier.weaponIdx];
      const blastRadius = weapon ? weapon.blast : 40;

      let score = dist;
      if (dist < blastRadius) score = dist * 0.3; // Bonus for hitting within blast radius
      if (endPos.inWater) score += 200; // Penalty for water

      if (score < bestScore) {
        bestScore = score;
        bestAngle = angle;
        bestPower = power;
      }
    }
  }

  return { angle: bestAngle, power: bestPower };
}

function simulateTrajectory(soldier: Soldier, angle: number, power: number, state: GameState): { x: number; y: number; inWater: boolean } | null {
  const weapon = WEAPONS[soldier.weaponIdx];
  if (!weapon) return null;

  let x = soldier.x + soldier.facing * 15;
  let y = soldier.y - 10;
  let vx = Math.cos(angle) * weapon.speed * power * soldier.facing;
  let vy = Math.sin(angle) * weapon.speed * power;

  for (let i = 0; i < 300; i++) {
    if (weapon.grav) vy += GRAVITY;
    if (weapon.wind) vx += state.wind * weapon.wind;

    x += vx;
    y += vy;

    if (x < 0 || x > W || y > H) return { x, y, inWater: y > WATER_Y };
    if (isSolid(state.terrain, x, y)) return { x, y, inWater: false };
    if (y > WATER_Y) return { x, y, inWater: true };
  }

  return { x, y, inWater: y > WATER_Y };
}

function checkVictory(state: GameState): void {
  let aliveTeams = 0;
  let lastAliveTeam = -1;

  for (let i = 0; i < state.teams.length; i++) {
    const hasAlive = state.teams[i].soldiers.some(s => !s.dead);
    if (hasAlive) {
      aliveTeams++;
      lastAliveTeam = i;
    }
  }

  if (aliveTeams <= 1) {
    state.gameOver = true;
    state.winner = lastAliveTeam;
  }
}

export function screenToWorld(state: GameState, sx: number, sy: number, canvasW: number, canvasH: number): { x: number; y: number } {
  const scaleX = canvasW / W;
  const scaleY = canvasH / H;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (canvasW - W * scale) / 2;
  const offsetY = (canvasH - H * scale) / 2;

  // Remove canvas scaling
  let wx = (sx - offsetX) / scale;
  let wy = (sy - offsetY) / scale;

  // Remove camera transform
  wx = (wx - W / 2 * (1 - state.camZoom)) / state.camZoom + state.camX;
  wy = (wy - H / 2 * (1 - state.camZoom)) / state.camZoom + state.camY;

  return { x: wx, y: wy };
}
