// WARMS - Terrain Generation
import { W, H, WATER_Y, THEMES, MAPS, Terrain, Theme } from './types';

export function generateTerrain(mapIndex: number): Terrain {
  const map = MAPS[mapIndex];
  const theme = THEMES[map.theme];
  const params = [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2];
  const amp = 0.8 + Math.random() * 0.4;

  // Generate height profile
  const heights = new Uint16Array(W);
  for (let x = 0; x < W; x++) {
    let h = map.heightFunc(x, params, amp);
    // Vertical compression
    h = H * 0.5 + (h - H * 0.5) * 0.88;
    // Edge taper
    const edgeDist = Math.min(x, W - x);
    if (edgeDist < 300) {
      const t = edgeDist / 300;
      const flatH = H * 0.82;
      h = flatH + (h - flatH) * t;
    }
    heights[x] = Math.max(H * 0.3, Math.min(WATER_Y - 10, h));
  }

  // Generate solid mask
  const mask = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    for (let y = Math.floor(heights[x]); y < H; y++) {
      mask[y * W + x] = 1;
    }
  }

  // Add islands
  for (let i = 0; i < map.islands; i++) {
    const cx = 200 + Math.random() * (W - 400);
    const cy = H * 0.4 + Math.random() * H * 0.25;
    const rw = 60 + Math.random() * 80;
    const rh = 20 + Math.random() * 25;
    for (let dx = -rw; dx <= rw; dx++) {
      const x = Math.floor(cx + dx);
      if (x < 0 || x >= W) continue;
      const t = 1 - (dx / rw) * (dx / rw);
      const top = Math.floor(cy - rh * t);
      const bot = Math.floor(cy + rh * t * 0.6);
      for (let y = top; y <= bot; y++) {
        if (y >= 0 && y < H) mask[y * W + x] = 1;
      }
    }
  }

  // Add caves
  for (let i = 0; i < map.caves; i++) {
    const cx = 150 + Math.random() * (W - 300);
    const cy = heights[Math.floor(cx)] + 30 + Math.random() * 60;
    const rw = 30 + Math.random() * 50;
    const rh = 20 + Math.random() * 30;
    for (let dx = -rw; dx <= rw; dx++) {
      const x = Math.floor(cx + dx);
      if (x < 0 || x >= W) continue;
      const t = 1 - (dx / rw) * (dx / rw);
      const top = Math.floor(cy - rh * t);
      const bot = Math.floor(cy + rh * t);
      for (let y = top; y <= bot; y++) {
        if (y >= 0 && y < H) mask[y * W + x] = 0;
      }
    }
  }

  // Generate background layers
  const bg0 = generateFarBackground(theme, mapIndex);
  const bg = generateNearBackground(theme, mapIndex);
  const detailCanvas = generateDetailLayer(heights, mask, theme);

  return { heights, mask, theme, mapIndex, bg0, bg, detailCanvas };
}

function generateFarBackground(theme: Theme, mapIndex: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  theme.sky.forEach((c, i) => skyGrad.addColorStop(i / (theme.sky.length - 1), c));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Sun/Moon
  if (mapIndex === 5) { // Moon night
    ctx.fillStyle = '#e8e8d0';
    ctx.beginPath();
    ctx.arc(W * 0.8, H * 0.15, 40, 0, Math.PI * 2);
    ctx.fill();
    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 100; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * H * 0.5;
      ctx.globalAlpha = 0.3 + Math.random() * 0.7;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = mapIndex === 4 ? '#ff4400' : '#ffe060';
    ctx.beginPath();
    ctx.arc(W * 0.75, H * 0.12, 35, 0, Math.PI * 2);
    ctx.fill();
    // Sun glow
    const sunGlow = ctx.createRadialGradient(W * 0.75, H * 0.12, 20, W * 0.75, H * 0.12, 100);
    sunGlow.addColorStop(0, 'rgba(255,220,100,0.3)');
    sunGlow.addColorStop(1, 'rgba(255,220,100,0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, W, H);
  }

  // Far hills
  theme.hills.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    const baseY = H * (0.55 + i * 0.08);
    for (let x = 0; x <= W; x += 4) {
      const y = baseY + Math.sin(x / (300 + i * 100) + i * 2) * (40 - i * 8)
        + Math.sin(x / (150 + i * 50) + i) * (20 - i * 4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  });

  return canvas;
}

function generateNearBackground(theme: Theme, mapIndex: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Near hills
  ctx.fillStyle = theme.hills[2] || theme.dirt1;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 3) {
    const y = H * 0.68 + Math.sin(x / 180 + 5) * 35 + Math.sin(x / 80 + 3) * 18;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // D-Day special: ships and clouds
  if (mapIndex === 6) {
    ctx.fillStyle = '#3a3a3a';
    for (let i = 0; i < 3; i++) {
      const sx = 200 + i * 500;
      const sy = H * 0.55;
      ctx.fillRect(sx, sy, 80, 20);
      ctx.fillRect(sx + 30, sy - 15, 20, 15);
    }
    // Smoke clouds
    ctx.fillStyle = 'rgba(80,80,80,0.3)';
    for (let i = 0; i < 8; i++) {
      const cx = Math.random() * W;
      const cy = H * 0.2 + Math.random() * H * 0.3;
      ctx.beginPath();
      ctx.arc(cx, cy, 30 + Math.random() * 40, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ground fog
  const fogGrad = ctx.createLinearGradient(0, H * 0.75, 0, H);
  fogGrad.addColorStop(0, 'rgba(200,200,200,0)');
  fogGrad.addColorStop(1, 'rgba(200,200,200,0.15)');
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, H * 0.75, W, H * 0.25);

  return canvas;
}

function generateDetailLayer(heights: Uint16Array, mask: Uint8Array, theme: Theme): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Draw terrain base
  const imgData = ctx.createImageData(W, H);
  const data = imgData.data;

  for (let x = 0; x < W; x++) {
    const surfaceY = heights[x];
    for (let y = Math.floor(surfaceY); y < H; y++) {
      if (mask[y * W + x] === 0) continue;
      const depth = (y - surfaceY) / (H - surfaceY);
      const idx = (y * W + x) * 4;

      // Base color with depth gradient
      const r1 = parseInt(theme.dirt1.slice(1, 3), 16);
      const g1 = parseInt(theme.dirt1.slice(3, 5), 16);
      const b1 = parseInt(theme.dirt1.slice(5, 7), 16);
      const r2 = parseInt(theme.dirt2.slice(1, 3), 16);
      const g2 = parseInt(theme.dirt2.slice(3, 5), 16);
      const b2 = parseInt(theme.dirt2.slice(5, 7), 16);

      const t = Math.min(1, depth * 1.5);
      // Add noise
      const noise = (Math.sin(x * 0.1 + y * 0.1) * 0.5 + Math.sin(x * 0.3 - y * 0.2) * 0.3) * 15;

      data[idx] = Math.floor(r1 + (r2 - r1) * t + noise);
      data[idx + 1] = Math.floor(g1 + (g2 - g1) * t + noise);
      data[idx + 2] = Math.floor(b1 + (b2 - b1) * t + noise);
      data[idx + 3] = 255;

      // Grass on surface
      if (y <= surfaceY + 3 && y >= surfaceY) {
        const gr = parseInt(theme.grass.slice(1, 3), 16);
        const gg = parseInt(theme.grass.slice(3, 5), 16);
        const gb = parseInt(theme.grass.slice(5, 7), 16);
        const grassT = 1 - (y - surfaceY) / 3;
        data[idx] = Math.floor(data[idx] * (1 - grassT) + gr * grassT);
        data[idx + 1] = Math.floor(data[idx + 1] * (1 - grassT) + gg * grassT);
        data[idx + 2] = Math.floor(data[idx + 2] * (1 - grassT) + gb * grassT);
      }

      // Rock details
      if (Math.sin(x * 0.05 + y * 0.08) > 0.7) {
        data[idx] = Math.min(255, data[idx] + 20);
        data[idx + 1] = Math.min(255, data[idx + 1] + 15);
        data[idx + 2] = Math.min(255, data[idx + 2] + 10);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Add grass tufts on edges
  ctx.strokeStyle = theme.grassHigh;
  ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 3) {
    const y = heights[x];
    if (x > 0 && Math.abs(heights[x] - heights[x - 1]) < 5) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.random() * 4 - 2, y - 4 - Math.random() * 6);
      ctx.stroke();
    }
  }

  // Shadow under edges
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x < W; x++) {
    const y = heights[x];
    if (x === 0) ctx.moveTo(x, y + 3);
    else ctx.lineTo(x, y + 3);
  }
  ctx.stroke();

  return canvas;
}

export function damageTerrain(terrain: Terrain, cx: number, cy: number, radius: number): void {
  const r2 = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(W - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(H - 1, Math.ceil(cy + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        terrain.mask[y * W + x] = 0;
      }
    }
  }

  // Update heights
  for (let x = minX; x <= maxX; x++) {
    let newH = terrain.heights[x];
    for (let y = Math.floor(terrain.heights[x]); y < H; y++) {
      if (terrain.mask[y * W + x] === 1) {
        newH = y;
        break;
      }
      if (y === H - 1) newH = H;
    }
    terrain.heights[x] = newH;
  }

  // Update detail canvas
  const ctx = terrain.detailCanvas.getContext('2d')!;
  ctx.clearRect(minX, minY, maxX - minX + 1, maxY - minY + 1);
  const imgData = ctx.getImageData(minX, minY, maxX - minX + 1, maxY - minY + 1);
  const data = imgData.data;
  const theme = terrain.theme;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (terrain.mask[y * W + x] === 0) continue;
      const localX = x - minX;
      const localY = y - minY;
      const idx = (localY * (maxX - minX + 1) + localX) * 4;
      const depth = (y - terrain.heights[x]) / (H - terrain.heights[x]);
      const r1 = parseInt(theme.dirt1.slice(1, 3), 16);
      const g1 = parseInt(theme.dirt1.slice(3, 5), 16);
      const b1 = parseInt(theme.dirt1.slice(5, 7), 16);
      const r2c = parseInt(theme.dirt2.slice(1, 3), 16);
      const g2c = parseInt(theme.dirt2.slice(3, 5), 16);
      const b2c = parseInt(theme.dirt2.slice(5, 7), 16);
      const t = Math.min(1, depth * 1.5);
      data[idx] = Math.floor(r1 + (r2c - r1) * t);
      data[idx + 1] = Math.floor(g1 + (g2c - g1) * t);
      data[idx + 2] = Math.floor(b1 + (b2c - b1) * t);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, minX, minY);
}

export function isSolid(terrain: Terrain, x: number, y: number): boolean {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return false;
  return terrain.mask[iy * W + ix] === 1;
}

export function getSurfaceY(terrain: Terrain, x: number): number {
  const ix = Math.max(0, Math.min(W - 1, Math.floor(x)));
  return terrain.heights[ix];
}
