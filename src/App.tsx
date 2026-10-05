import { useState, useRef, useEffect, useCallback } from 'react';
import { MAPS, THEMES, WEAPONS, W, H, FIXED_DT, TEAM_NAMES, TEAM_COLORS } from './game/types';
import { initGame, step, startCharging, releaseCharging, screenToWorld } from './game/engine';
import { render } from './game/renderer';
import type { GameState } from './game/types';

type Screen = 'menu' | 'game' | 'gameover';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [selectedMap, setSelectedMap] = useState(0);
  const [teamCount, setTeamCount] = useState(2);
  const [soldiersPerTeam, setSoldiersPerTeam] = useState(3);
  const [playerTypes, setPlayerTypes] = useState<boolean[]>([false, true, true, true]);
  const [winner, setWinner] = useState(-1);
  const [currentWeapon, setCurrentWeapon] = useState(0);
  const [currentTeamName, setCurrentTeamName] = useState('');
  const [timer, setTimer] = useState(30);
  const [turnCount, setTurnCount] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accRef = useRef<number>(0);

  const startGame = useCallback((vsComputer: boolean) => {
    const types = [...playerTypes];
    if (vsComputer) {
      types[0] = false;
      for (let i = 1; i < teamCount; i++) types[i] = true;
    }

    const state = initGame(selectedMap, teamCount, soldiersPerTeam, types);
    stateRef.current = state;
    setScreen('game');
    setCurrentTeamName(state.teams[0].name);
    setTimer(state.timer);
    setTurnCount(1);
  }, [selectedMap, teamCount, soldiersPerTeam, playerTypes]);

  // Game loop
  useEffect(() => {
    if (screen !== 'game') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    lastTimeRef.current = performance.now();
    accRef.current = 0;

    const loop = (ts: number) => {
      const state = stateRef.current;
      if (!state) return;

      const dt = Math.min(ts - lastTimeRef.current, 100);
      lastTimeRef.current = ts;
      accRef.current += dt;

      // Fixed timestep
      while (accRef.current >= FIXED_DT) {
        step(state, FIXED_DT);
        accRef.current -= FIXED_DT;
      }

      // Render
      render(ctx, state, canvas.width, canvas.height);

      // Update UI state
      const soldier = state.teams[state.currentTeam]?.soldiers[state.currentSoldier];
      if (soldier) {
        setCurrentWeapon(soldier.weaponIdx);
        setCurrentTeamName(state.teams[state.currentTeam].name);
      }
      setTimer(Math.ceil(state.timer));
      setTurnCount(state.turnCount);

      // Check game over
      if (state.gameOver) {
        setWinner(state.winner);
        setScreen('gameover');
        return;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [screen]);

  // Input handling
  useEffect(() => {
    if (screen !== 'game') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;
      state.keys[e.code] = true;

      // Weapon switch with number keys
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        const idx = parseInt(e.code.slice(5)) - 1;
        const soldier = state.teams[state.currentTeam]?.soldiers[state.currentSoldier];
        if (soldier && idx < WEAPONS.length && soldier.ammo[idx] > 0) {
          soldier.weaponIdx = idx;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;
      state.keys[e.code] = false;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const state = stateRef.current;
      if (!state) return;
      const rect = canvas.getBoundingClientRect();
      const world = screenToWorld(state, e.clientX - rect.left, e.clientY - rect.top, canvas.width, canvas.height);
      state.mouseX = world.x;
      state.mouseY = world.y;
    };

    const handlePointerDown = (e: PointerEvent) => {
      const state = stateRef.current;
      if (!state) return;
      if (e.button === 0) {
        startCharging(state);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const state = stateRef.current;
      if (!state) return;
      if (e.button === 0) {
        releaseCharging(state);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = stateRef.current;
      if (!state) return;
      const soldier = state.teams[state.currentTeam]?.soldiers[state.currentSoldier];
      if (!soldier) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      let idx = soldier.weaponIdx;
      for (let i = 0; i < WEAPONS.length; i++) {
        idx = (idx + dir + WEAPONS.length) % WEAPONS.length;
        if (soldier.ammo[idx] > 0) {
          soldier.weaponIdx = idx;
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [screen]);

  // Menu Screen
  if (screen === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700 max-w-3xl w-full p-6 md:p-8">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-400 tracking-wider">
              WARMS
            </h1>
            <p className="text-gray-400 mt-2 text-sm tracking-widest uppercase">Worms WW2 • Rundenbasiert</p>
          </div>

          {/* Map Selection */}
          <div className="mb-6">
            <h3 className="text-gray-300 font-semibold mb-3 text-sm uppercase tracking-wider">Karte wählen</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {MAPS.map((map, i) => (
                <button
                  key={map.id}
                  onClick={() => setSelectedMap(i)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    selectedMap === i ? 'border-yellow-400 scale-105 shadow-lg shadow-yellow-400/20' : 'border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <MapPreview mapIndex={i} />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                    <div className="text-white text-xs font-bold truncate">{map.name}</div>
                    <div className="text-gray-400 text-[10px] truncate">{map.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Team Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Team Count */}
            <div>
              <h3 className="text-gray-300 font-semibold mb-2 text-sm uppercase tracking-wider">Teams</h3>
              <div className="flex gap-2">
                {[2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setTeamCount(n)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                      teamCount === n ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Soldiers per Team */}
            <div>
              <h3 className="text-gray-300 font-semibold mb-2 text-sm uppercase tracking-wider">Soldaten pro Team</h3>
              <div className="flex gap-2">
                {[2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setSoldiersPerTeam(n)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all ${
                      soldiersPerTeam === n ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Player Types */}
          <div className="mb-8">
            <h3 className="text-gray-300 font-semibold mb-2 text-sm uppercase tracking-wider">Spieler-Typ</h3>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: teamCount }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const newTypes = [...playerTypes];
                    newTypes[i] = !newTypes[i];
                    setPlayerTypes(newTypes);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    playerTypes[i] ? 'bg-red-600/80 text-white' : 'bg-green-600/80 text-white'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: TEAM_COLORS[i] }}></span>
                  {TEAM_NAMES[i]}: {playerTypes[i] ? '🤖 KI' : '👤 Mensch'}
                </button>
              ))}
            </div>
          </div>

          {/* Start Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => startGame(true)}
              className="flex-1 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-xl text-lg shadow-lg transition-all hover:scale-[1.02] active:scale-95"
            >
              ⚔️ vs Computer
            </button>
            <button
              onClick={() => startGame(false)}
              className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-xl text-lg shadow-lg transition-all hover:scale-[1.02] active:scale-95"
            >
              👥 Lokaler Multiplayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Game Over Screen
  if (screen === 'gameover') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/90 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-700 max-w-md w-full p-8 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-3xl font-black text-yellow-400 mb-2">SIEG!</h2>
          <p className="text-xl text-gray-300 mb-6">
            {winner >= 0 ? TEAM_NAMES[winner] : 'Unentschieden'} gewinnt!
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setScreen('menu'); }}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-all"
            >
              🏠 Menü
            </button>
            <button
              onClick={() => startGame(true)}
              className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold rounded-xl transition-all"
            >
              🔄 Nochmal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Game Screen
  return (
    <div className="w-screen h-screen overflow-hidden bg-black relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ touchAction: 'none' }}
      />

      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 pointer-events-none">
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/60 to-transparent">
          {/* Team info */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-lg bg-black/50 border border-gray-600">
              <span className="text-yellow-400 font-bold text-sm">{currentTeamName}</span>
            </div>
            <div className="px-3 py-1 rounded-lg bg-black/50 border border-gray-600">
              <span className="text-white font-mono text-sm">⏱ {timer}s</span>
            </div>
            <div className="px-3 py-1 rounded-lg bg-black/50 border border-gray-600">
              <span className="text-gray-300 text-sm">Runde {turnCount}</span>
            </div>
          </div>

          {/* Team HP bars */}
          <div className="flex gap-2">
            {stateRef.current?.teams.map((team, i) => {
              const totalHp = team.soldiers.reduce((sum, s) => sum + Math.max(0, s.hp), 0);
              const maxHp = team.soldiers.length * 100;
              const ratio = totalHp / maxHp;
              return (
                <div key={i} className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: TEAM_COLORS[i] }}></span>
                  <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${ratio * 100}%`,
                        backgroundColor: ratio > 0.5 ? '#44cc44' : ratio > 0.25 ? '#cccc44' : '#cc4444'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Back button */}
          <button
            onClick={() => { setScreen('menu'); cancelAnimationFrame(animFrameRef.current); }}
            className="pointer-events-auto px-3 py-1 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-sm font-bold transition-all"
          >
            ✕ Beenden
          </button>
        </div>
      </div>

      {/* Weapon Bar */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <div className="flex items-center justify-center px-4 py-3 bg-gradient-to-t from-black/70 to-transparent">
          <div className="flex gap-1 overflow-x-auto max-w-full px-2 py-1">
            {WEAPONS.map((weapon, i) => {
              const soldier = stateRef.current?.teams[stateRef.current.currentTeam]?.soldiers[stateRef.current.currentSoldier];
              const ammo = soldier?.ammo[i] ?? 0;
              const isActive = i === currentWeapon;
              const hasAmmo = ammo > 0;

              return (
                <button
                  key={weapon.id}
                  onClick={() => {
                    const state = stateRef.current;
                    if (!state) return;
                    const s = state.teams[state.currentTeam]?.soldiers[state.currentSoldier];
                    if (s && s.ammo[i] > 0) s.weaponIdx = i;
                  }}
                  className={`pointer-events-auto flex flex-col items-center px-2 py-1 rounded-lg min-w-[52px] transition-all ${
                    isActive ? 'bg-yellow-500/30 border border-yellow-400 scale-110' :
                    hasAmmo ? 'bg-gray-700/80 border border-gray-600 hover:bg-gray-600/80' :
                    'bg-gray-800/50 border border-gray-700 opacity-40'
                  }`}
                >
                  <span className="text-lg">{weapon.icon}</span>
                  <span className="text-[9px] text-gray-300 truncate max-w-[48px]">{weapon.name}</span>
                  {hasAmmo && (
                    <span className="text-[9px] text-yellow-400 font-bold">{ammo === 99 ? '∞' : ammo}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-16 left-4 pointer-events-none">
        <div className="text-[10px] text-gray-500 space-y-0.5">
          <div>← → Bewegen | ↑ Springen</div>
          <div>Maus: Zielen | Klick: Schießen</div>
          <div>Q/E oder 1-9: Waffe wechseln</div>
        </div>
      </div>
    </div>
  );
}

// Map Preview Component
function MapPreview({ mapIndex }: { mapIndex: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 150;
    const h = 64;
    canvas.width = w;
    canvas.height = h;

    const map = MAPS[mapIndex];
    const theme = THEMES[map.theme];

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    theme.sky.forEach((c, i) => skyGrad.addColorStop(i / (theme.sky.length - 1), c));
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Water
    ctx.fillStyle = theme.water;
    ctx.fillRect(0, h * 0.92, w, h * 0.08);

    // Terrain
    const scaleX = W / w;
    ctx.fillStyle = theme.dirt1;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let px = 0; px <= w; px++) {
      const worldX = px * scaleX;
      const height = map.heightFunc(worldX, [1.5, 2.3, 0.7], 0.9);
      const py = (height / H) * h;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Grass line
    ctx.strokeStyle = theme.grass;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px <= w; px++) {
      const worldX = px * scaleX;
      const height = map.heightFunc(worldX, [1.5, 2.3, 0.7], 0.9);
      const py = (height / H) * h;
      if (px === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }, [mapIndex]);

  return <canvas ref={canvasRef} className="w-full h-16" />;
}
