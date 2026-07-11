// src/utils/constants.ts
import type {
  ClickSound,
  ClickSubdivision,
  VisualEffect,
  SpaceMode,
  SavedSettings,
  SwipeMode,
} from '../types'

export const STORAGE_KEY = 'void-pulse-canvas-settings-v1'
export const DEFAULT_SCORE_IMAGE_SRC = '/images/score-overlay-01.png'
export const PDF_SLOT_COUNT = 10

export const defaultSettings: SavedSettings = {
  bpm: 105,
  timeSignature: '4/4',
  breathIntensity: 40,
  smallRippleIntensity: 100,
  largeRippleIntensity: 40,
  clickSound: 'Soft Tick',
  clickSubdivision: 'Quarter',
  visualEffect: 'Ghost Sweep',
  volume: 70,
  isScoreVisible: false,
  spaceMode: 'Dark',
  isDebugEnabled: false,
  isBarAccentEnabled: true,
}

export const clickSoundOptions: ClickSound[] = [
  'Soft Tick',
  'Wood',
  'Metal',
  'Breath',
  'Muted Key',
]

export const clickSubdivisionOptions: ClickSubdivision[] = ['Quarter', 'Eighth', 'Triplet', 'Sixteenth']
export const visualEffectOptions: VisualEffect[] = ['Ghost Sweep', 'Ripple', 'None']

export const spaceModeOptions: SpaceMode[] = ['Void', 'Dark', 'Blue']
export const swipeModeOptions: SwipeMode[] = ['Score', 'Book']