
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { create } from 'zustand';
import { GameStatus, RUN_SPEED_BASE } from './types';
import { audio } from './components/System/Audio';

interface GameState {
  status: GameStatus;
  score: number;
  lives: number;
  maxLives: number;
  speed: number;
  collectedLetters: number[]; 
  level: number;
  laneCount: number;
  gemsCollected: number;
  distance: number;
  
  // Inventory / Abilities
  hasDoubleJump: boolean;
  hasImmortality: boolean;
  isImmortalityActive: boolean;

  // Actions
  startGame: () => void;
  restartGame: () => void;
  takeDamage: () => void;
  addScore: (amount: number) => void;
  collectGem: (value: number) => void;
  collectLetter: (index: number) => void;
  setStatus: (status: GameStatus) => void;
  setDistance: (dist: number) => void;
  togglePause: () => void;
  exitToMenu: () => void;
  
  // Shop / Abilities
  buyItem: (type: 'DOUBLE_JUMP' | 'MAX_LIFE' | 'HEAL' | 'IMMORTAL', cost: number) => boolean;
  advanceLevel: () => void;
  openShop: () => void;
  closeShop: () => void;
  activateImmortality: () => void;
}

const RUNNER_TARGET = ['R', 'U', 'N', 'N', 'E', 'R'];
const MAX_LEVEL = 100;

export const useStore = create<GameState>((set, get) => ({
  status: GameStatus.MENU,
  score: 0,
  lives: 3,
  maxLives: 3,
  speed: 0,
  collectedLetters: [],
  level: 1,
  laneCount: 3,
  gemsCollected: 0,
  distance: 0,
  
  hasDoubleJump: false,
  hasImmortality: false,
  isImmortalityActive: false,

  startGame: () => {
    audio.startMusic(1);
    set({ 
      status: GameStatus.PLAYING, 
      score: 0, 
      lives: 3, 
      maxLives: 3,
      speed: RUN_SPEED_BASE,
      collectedLetters: [],
      level: 1,
      laneCount: 3,
      gemsCollected: 0,
      distance: 0,
      hasDoubleJump: false,
      hasImmortality: false,
      isImmortalityActive: false
    });
  },

  restartGame: () => {
    audio.startMusic(1);
    set({ 
      status: GameStatus.PLAYING, 
      score: 0, 
      lives: 3, 
      maxLives: 3,
      speed: RUN_SPEED_BASE,
      collectedLetters: [],
      level: 1,
      laneCount: 3,
      gemsCollected: 0,
      distance: 0,
      hasDoubleJump: false,
      hasImmortality: false,
      isImmortalityActive: false
    });
  },

  exitToMenu: () => {
    audio.stopMusic();
    set({
      status: GameStatus.MENU,
      score: 0,
      lives: 3,
      speed: 0
    });
  },

  togglePause: () => {
    const { status, level } = get();
    if (status === GameStatus.PLAYING) {
      audio.stopMusic();
      set({ status: GameStatus.PAUSED });
    } else if (status === GameStatus.PAUSED) {
      audio.startMusic(level);
      set({ status: GameStatus.PLAYING });
    }
  },

  takeDamage: () => {
    const { lives, isImmortalityActive } = get();
    if (isImmortalityActive) return;

    if (lives > 1) {
      set({ lives: lives - 1 });
    } else {
      audio.stopMusic();
      set({ lives: 0, status: GameStatus.GAME_OVER, speed: 0 });
    }
  },

  addScore: (amount) => set((state) => ({ score: state.score + amount })),
  
  collectGem: (value) => set((state) => ({ 
    score: state.score + value, 
    gemsCollected: state.gemsCollected + 1 
  })),

  setDistance: (dist) => set({ distance: dist }),

  collectLetter: (index) => {
    const { collectedLetters, level, speed } = get();
    
    if (!collectedLetters.includes(index)) {
      const newLetters = [...collectedLetters, index];
      const speedIncrease = RUN_SPEED_BASE * 0.05;
      const nextSpeed = speed + speedIncrease;

      set({ 
        collectedLetters: newLetters,
        speed: nextSpeed
      });

      if (newLetters.length === RUNNER_TARGET.length) {
        if (level < MAX_LEVEL) {
            get().advanceLevel();
        } else {
            audio.stopMusic();
            set({
                status: GameStatus.VICTORY,
                score: get().score + 10000
            });
        }
      }
    }
  },

  advanceLevel: () => {
      const { level, speed } = get();
      const nextLevel = level + 1;
      const speedIncrease = RUN_SPEED_BASE * 0.15;
      const newSpeed = speed + speedIncrease;
      const newLaneCount = Math.min(3 + Math.floor(nextLevel / 10) * 2, 9);

      audio.startMusic(nextLevel);
      set({
          level: nextLevel,
          laneCount: newLaneCount,
          status: GameStatus.PLAYING,
          speed: newSpeed,
          collectedLetters: []
      });
  },

  openShop: () => {
      audio.stopMusic();
      set({ status: GameStatus.SHOP });
  },
  
  closeShop: () => {
      audio.startMusic(get().level);
      set({ status: GameStatus.PLAYING });
  },

  buyItem: (type, cost) => {
      const { score, maxLives, lives } = get();
      if (score >= cost) {
          set({ score: score - cost });
          switch (type) {
              case 'DOUBLE_JUMP': set({ hasDoubleJump: true }); break;
              case 'MAX_LIFE': set({ maxLives: maxLives + 1, lives: lives + 1 }); break;
              case 'HEAL': set({ lives: Math.min(lives + 1, maxLives) }); break;
              case 'IMMORTAL': set({ hasImmortality: true }); break;
          }
          return true;
      }
      return false;
  },

  activateImmortality: () => {
      const { hasImmortality, isImmortalityActive } = get();
      if (hasImmortality && !isImmortalityActive) {
          set({ isImmortalityActive: true });
          setTimeout(() => {
              set({ isImmortalityActive: false });
          }, 5000);
      }
  },

  setStatus: (status) => set({ status }),
}));
