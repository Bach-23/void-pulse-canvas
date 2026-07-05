// src/utils/constants.ts
import type {
  TimeSignature,
  ClickSound,
  ClickSubdivision,
  VisualEffect,
  BackgroundMode,
  PresetName,
  PresetValues,
  SavedSettings,
} from '../types'

export const STORAGE_KEY = 'void-pulse-canvas-settings-v1'
export const DEFAULT_SCORE_IMAGE_SRC = '/images/score-overlay-01.png'
export const PDF_SLOT_COUNT = 10

export const defaultPresetValues: PresetValues = {
  bpm: 105,
  timeSignature: '4/4',
  breathIntensity: 40,
  smallRippleIntensity: 100,
  largeRippleIntensity: 40,
  clickSound: 'Soft Tick',
  clickSubdivision: 'Quarter',
  visualEffect: 'Ripple',
  volume: 70,
  isScoreVisible: false,
  scoreOpacity: 70,
  scoreScale: 72,
  scoreX: 0,
  scoreY: 0,
  scoreWhiteCut: 80,
  scoreInkBoost: 30,
  backgroundMode: 'Image',
}

export const defaultSettings: SavedSettings = {
  ...defaultPresetValues,
  isDebugEnabled: false,
  selectedPreset: 'Current',
  savedPreset: null,
}

export const clickSoundOptions: ClickSound[] = [
  'Soft Tick',
  'Wood',
  'Metal',
  'Breath',
  'Muted Key',
]

export const clickSubdivisionOptions: ClickSubdivision[] = ['Quarter', 'Eighth']
export const visualEffectOptions: VisualEffect[] = ['Ripple', 'Ghost Sweep', 'None']

export const presetOptions: PresetName[] = [
  'Current',
  'Void / Score Float',
  'Void / Practice',
  'Void / Recording',
  'Void / Night',
  'My Saved Preset',
]

export const backgroundModeOptions: BackgroundMode[] = [
  'Image',
  'Void Black',
  'Warm Gray',
  'Deep Blue',
  'Paper Dark',
]