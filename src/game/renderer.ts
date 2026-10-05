// WARMS - Renderer
import { W, H, SOLDIER_W, SOLDIER_H, MAX_HP, TEAM_COLORS, WEAPONS, GameState } from './types';

export function render(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number, canvasHeight: number): void {
  const cw = canvasWidth;
  const ch = canvasHeight;

  // Clear
  ctx.clearRect(0, 0, cw, ch);

  // Calculate scale to fit
  const scaleX = cw / W;
  const scaleY = ch / H;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (cw - W * scale) / 2;
  const offsetY = (ch - H * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Camera transform
  const shakeX = state.camShake > 0.5 ? (Math.random() - 0.5) * state.camShake : 0;
  const shakeY = state.camShake > 0.5 ? (Math.random() - 0.5) * state.camShake : 0;

  // Draw sky background (far parallax)
  drawParallaxLayer(ctx, state.terrain.bg0, state, 0.08, shakeX, shakeY);

  // Draw near background
  drawParallaxLayer(ctx, state.terrain.bg, state, 0.30, shakeX, shakeY);

  // Camera transform for world objects
  ctx.save();
  ctx.translate(-state.camX * state.camZoom + W / 2 * (1 - state.camZoom) + shakeX,
    -state.camY * state.camZoom + H / 2 * (1 - state.camZoom) + shakeY);
  ctx.scale(state.camZoom, state.camZoom);

  // Draw water (back)
  drawWater(ctx, state, true);

  // Draw terrain
  drawTerrain(ctx, state);

  // Draw projectiles
  drawProjectiles(ctx, state);

  // Draw particles
  drawParticles(ctx, state);

  // Draw glows (additive)
  drawGlows(ctx, state);

  // Draw soldiers
  drawSoldiers(ctx, state);

  // Draw aim indicator
  drawAimIndicator(ctx, state);

  // Draw floating texts
  drawFloatingTexts(ctx, state);

  ctx.restore(); // camera

  // Draw water (front)
  ctx.save();
  ctx.translate(-state.camX * state.camZoom + W / 2 * (1 - state.camZoom) + shakeX,
    -state.camY * state.camZoom + H / 2 * (1 - state.camZoom) + shakeY);
  ctx.scale(state.camZoom, state.camZoom);
  drawWater(ctx, state, false);
  ctx.restore();

  // Draw wind indicator
  drawWindIndicator(ctx, state);

  ctx.restore(); // scale
}

function drawParallaxLayer(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: GameState, factor: number, shakeX: number, shakeY: number): void {
  const camOffsetX = state.camX * factor;
  const camOffsetY = state.camY * factor * 0.3;

  // Tile the background
  for (let tx = -1; tx <= 1; tx++) {
    for (let ty = -1; ty <= 0; ty++) {
      ctx.drawImage(canvas,
        -camOffsetX + tx * W + shakeX * factor,
        -camOffsetY + ty * H + shakeY * factor
      );
    }
  }
}

function drawWater(ctx: CanvasRenderingContext2D, state: GameState, back: boolean): void {
  const theme = state.terrain.theme;
  const wl = state.waterLevel;

  if (back) {
    // Water body
    const grad = ctx.createLinearGradient(0, wl, 0, H);
    grad.addColorStop(0, theme.water);
    grad.addColorStop(1, '#000020');
    ctx.fillStyle = grad;
    ctx.fillRect(-100, wl, W + 200, H - wl + 100);

    // Water surface waves
    ctx.strokeStyle = theme.waterFoam;
    ctx.lineWidth = 2;
    const time = Date.now() * 0.002;
    ctx.beginPath();
    for (let x = -100; x <= W + 100; x += 4) {
      const y = wl + Math.sin(x * 0.02 + time) * 3 + Math.sin(x * 0.05 + time * 1.5) * 1.5;
      if (x === -100) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else {
    // Foam on top
    ctx.fillStyle = theme.waterFoam;
    const time = Date.now() * 0.002;
    for (let x = 0; x < W; x += 20) {
      const y = wl + Math.sin(x * 0.03 + time) * 2;
      ctx.beginPath();
      ctx.arc(x, y, 4 + Math.sin(x * 0.1 + time) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTerrain(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.drawImage(state.terrain.detailCanvas, 0, 0);
}

function drawProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);

    if (p.weaponId === 'bazooka' || p.weaponId === 'cluster_sub') {
      // Rocket
      const angle = Math.atan2(p.vy, p.vx);
      ctx.rotate(angle);
      ctx.fillStyle = '#666';
      ctx.fillRect(-8, -3, 16, 6);
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(-12, -2, 6, 4);
      // Trail
      ctx.fillStyle = 'rgba(255,150,50,0.5)';
      ctx.beginPath();
      ctx.arc(-14, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.weaponId === 'grenade') {
      // Grenade
      ctx.fillStyle = '#3a5a3a';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a3a2a';
      ctx.fillRect(-2, -9, 4, 5);
      // Timer indicator
      if (p.delay > 0) {
        const remaining = Math.max(0, 1 - p.age / p.delay);
        ctx.fillStyle = remaining > 0.3 ? '#00ff00' : '#ff0000';
        ctx.beginPath();
        ctx.arc(0, -9, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.weaponId === 'holy') {
      // Holy hand grenade - glowing
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#ffdd00';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffdd00';
      ctx.font = '10px serif';
      ctx.fillText('✝', -4, 4);
    } else if (p.weaponId === 'dynamite') {
      // Dynamite sticks
      ctx.fillStyle = '#cc3333';
      ctx.fillRect(-4, -10, 8, 20);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(-1, -13, 2, 5);
    } else if (p.weaponId === 'airstrike') {
      // Bomb
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Fins
      ctx.fillStyle = '#555';
      ctx.fillRect(-6, -8, 12, 3);
    }

    ctx.restore();
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    if (p.type === 'fire') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}

function drawGlows(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const g of state.glows) {
    const alpha = g.life / g.maxLife;
    const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.radius);
    grad.addColorStop(0, `${g.color}${alpha * 0.8})`);
    grad.addColorStop(0.5, `${g.color}${alpha * 0.3})`);
    grad.addColorStop(1, `${g.color}0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(g.x - g.radius, g.y - g.radius, g.radius * 2, g.radius * 2);
  }
  ctx.restore();
}

function drawSoldiers(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (let ti = 0; ti < state.teams.length; ti++) {
    const team = state.teams[ti];
    for (const s of team.soldiers) {
      if (s.dead) continue;

      ctx.save();
      ctx.translate(s.x, s.y);

      // Body
      const bodyColor = TEAM_COLORS[ti];
      ctx.fillStyle = bodyColor;

      // Draw soldier as a simple character
      // Helmet
      ctx.fillStyle = ti === 0 ? '#5a6a3a' : ti === 1 ? '#556358' : '#4a4a3a';
      ctx.beginPath();
      ctx.ellipse(0, -SOLDIER_H / 2 + 8, 12, 10, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-12, -SOLDIER_H / 2 + 8, 24, 4);

      // Face
      ctx.fillStyle = '#e8c090';
      ctx.beginPath();
      ctx.arc(0, -SOLDIER_H / 2 + 16, 8, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#000';
      const eyeOff = s.facing > 0 ? 2 : -2;
      ctx.fillRect(eyeOff - 2, -SOLDIER_H / 2 + 14, 2, 2);
      ctx.fillRect(eyeOff + 2, -SOLDIER_H / 2 + 14, 2, 2);

      // Body
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-10, -SOLDIER_H / 2 + 22, 20, 18);

      // Legs
      ctx.fillStyle = '#3a3a2a';
      ctx.fillRect(-8, -SOLDIER_H / 2 + 38, 6, 14);
      ctx.fillRect(2, -SOLDIER_H / 2 + 38, 6, 14);

      // Arm with weapon direction
      ctx.save();
      ctx.translate(s.facing * 6, -SOLDIER_H / 2 + 26);
      ctx.rotate(s.angle * s.facing);
      ctx.fillStyle = bodyColor;
      ctx.fillRect(0, -2, 14 * s.facing, 4);
      ctx.restore();

      // HP bar
      const hpRatio = s.hp / MAX_HP;
      const barW = 30;
      const barH = 4;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-barW / 2, -SOLDIER_H / 2 - 6, barW, barH);
      ctx.fillStyle = hpRatio > 0.5 ? '#44cc44' : hpRatio > 0.25 ? '#cccc44' : '#cc4444';
      ctx.fillRect(-barW / 2, -SOLDIER_H / 2 - 6, barW * hpRatio, barH);

      // Name tag
      ctx.fillStyle = '#fff';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.name, 0, -SOLDIER_H / 2 - 10);

      // Active indicator
      const activeSoldier = getActiveSoldier(state);
      if (activeSoldier === s) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-SOLDIER_W / 2 - 4, -SOLDIER_H / 2 - 4, SOLDIER_W + 8, SOLDIER_H + 8);
        ctx.setLineDash([]);

        // Arrow above
        const bounce = Math.sin(Date.now() * 0.005) * 4;
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(0, -SOLDIER_H / 2 - 22 + bounce);
        ctx.lineTo(-6, -SOLDIER_H / 2 - 30 + bounce);
        ctx.lineTo(6, -SOLDIER_H / 2 - 30 + bounce);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }
  }
}

function getActiveSoldier(state: GameState) {
  if (state.phase !== 'aiming' && state.phase !== 'charging') return null;
  const team = state.teams[state.currentTeam];
  if (!team) return null;
  return team.soldiers[state.currentSoldier] || null;
}

function drawAimIndicator(ctx: CanvasRenderingContext2D, state: GameState): void {
  const soldier = getActiveSoldier(state);
  if (!soldier) return;

  const weapon = state.teams[state.currentTeam].soldiers[state.currentSoldier];
  if (!weapon) return;

  // Trajectory preview for aimed weapons
  if (state.phase === 'aiming' || state.phase === 'charging') {
      const w = WEAPONS[weapon.weaponIdx];    if (w && (w.type === 'r' || w.type === 'g' || w.type === 'c' || w.type === 'h')) {
      // Draw aim line
      const power = weapon.charging ? weapon.power : 0.5;
      const speed = w.speed * power;
      const vx = Math.cos(weapon.angle) * speed * weapon.facing;
      const vy = Math.sin(weapon.angle) * speed;

      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      let px = soldier.x;
      let py = soldier.y - 10;
      ctx.moveTo(px, py);
      for (let i = 0; i < 40; i++) {
        px += vx;
        py += vy + i * 0.18;
        if (px < 0 || px > W || py > H) break;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Charge indicator
  if (soldier.charging) {
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const active = soldier.power >= t;
      const color = t < 0.4 ? '#44ff44' : t < 0.7 ? '#ffff44' : '#ff4444';
      ctx.fillStyle = active ? color : 'rgba(100,100,100,0.3)';
      const dotX = soldier.x + soldier.facing * (22 + i * 5);
      const dotY = soldier.y - 30;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFloatingTexts(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const ft of state.floatingTexts) {
    const alpha = Math.min(1, ft.life / 30);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;
}

function drawWindIndicator(ctx: CanvasRenderingContext2D, state: GameState): void {
  const x = W / 2;
  const y = 30;
  const windStrength = Math.abs(state.wind);
  const windDir = state.wind > 0 ? 1 : -1;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x - 60, y - 12, 120, 24);

  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WIND', x, y - 1);

  // Wind arrow
  const arrowLen = windStrength * 200;
  ctx.strokeStyle = windStrength > 0.3 ? '#ff8844' : '#88ccff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - arrowLen * windDir * 0.5, y + 6);
  ctx.lineTo(x + arrowLen * windDir * 0.5, y + 6);
  ctx.stroke();

  // Arrow head
  ctx.beginPath();
  ctx.moveTo(x + arrowLen * windDir * 0.5, y + 6);
  ctx.lineTo(x + arrowLen * windDir * 0.5 - windDir * 6, y + 2);
  ctx.lineTo(x + arrowLen * windDir * 0.5 - windDir * 6, y + 10);
  ctx.closePath();
  ctx.fillStyle = windStrength > 0.3 ? '#ff8844' : '#88ccff';
  ctx.fill();
}
