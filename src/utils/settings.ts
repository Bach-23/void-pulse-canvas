// src/utils/settings.ts
import type {
  TimeSignature,
  ClickSound,
  ClickSubdivision,
  VisualEffect,
  BackgroundMode,
  SavedSettings,
  PdfSlot,
} from '../types'

import {
  STORAGE_KEY,
  PDF_SLOT_COUNT,
  defaultSettings,
} from './constants'

export const createEmptyPdfSlot = (): PdfSlot => ({
  pdf: null,
  fileName: '',
  pageNumber: 1,
  pageCount: 0,
  scoreScale: 72,
  scoreX: 0,
  scoreY: 0,
  scoreOpacity: 70,
  scoreWhiteCut: 80,
  scoreInkBoost: 30,
})

export const createInitialPdfSlots = (): PdfSlot[] =>
  Array.from({ length: PDF_SLOT_COUNT }, () => createEmptyPdfSlot())

export const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) => {
  if (typeof value !== 'number') return fallback
  if (Number.isNaN(value)) return fallback
  return Math.min(Math.max(value, min), max)
}

export const isTimeSignature = (value: unknown): value is TimeSignature => {
  return (
    value === '2/4' ||
    value === '3/4' ||
    value === '4/4' ||
    value === 'Free'
  )
}

export const isClickSound = (value: unknown): value is ClickSound => {
  return (
    value === 'Soft Tick' ||
    value === 'Wood' ||
    value === 'Metal' ||
    value === 'Breath' ||
    value === 'Muted Key'
  )
}

export const isClickSubdivision = (value: unknown): value is ClickSubdivision => {
  return value === 'Quarter' || value === 'Eighth'
}

export const isVisualEffect = (value: unknown): value is VisualEffect => {
  return value === 'Ripple' || value === 'Ghost Sweep' || value === 'None'
}

export const isBackgroundMode = (value: unknown): value is BackgroundMode => {
  return (
    value === 'Image' ||
    value === 'Void Black' ||
    value === 'Warm Gray' ||
    value === 'Deep Blue' ||
    value === 'Paper Dark'
  )
}

export function loadSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaultSettings
    }

    const parsed = JSON.parse(raw) as Partial<SavedSettings>

    return {
      bpm: clampNumber(parsed.bpm, 30, 240, defaultSettings.bpm),
      timeSignature: isTimeSignature(parsed.timeSignature) ? parsed.timeSignature : defaultSettings.timeSignature,
      breathIntensity: clampNumber(parsed.breathIntensity, 0, 100, defaultSettings.breathIntensity),
      smallRippleIntensity: clampNumber(parsed.smallRippleIntensity, 0, 100, defaultSettings.smallRippleIntensity),
      largeRippleIntensity: clampNumber(parsed.largeRippleIntensity, 0, 100, defaultSettings.largeRippleIntensity),
      clickSound: isClickSound(parsed.clickSound) ? parsed.clickSound : defaultSettings.clickSound,
      clickSubdivision: isClickSubdivision(parsed.clickSubdivision) ? parsed.clickSubdivision : defaultSettings.clickSubdivision,
      visualEffect: isVisualEffect(parsed.visualEffect) ? parsed.visualEffect : defaultSettings.visualEffect,
      volume: clampNumber(parsed.volume, 0, 100, defaultSettings.volume),
      isScoreVisible: typeof parsed.isScoreVisible === 'boolean' ? parsed.isScoreVisible : defaultSettings.isScoreVisible,
      backgroundMode: isBackgroundMode(parsed.backgroundMode) ? parsed.backgroundMode : defaultSettings.backgroundMode,
      isDebugEnabled: typeof parsed.isDebugEnabled === 'boolean' ? parsed.isDebugEnabled : defaultSettings.isDebugEnabled,
    }
  } catch {
    return defaultSettings
  }
}