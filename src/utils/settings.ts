// src/utils/settings.ts
import type {
  TimeSignature,
  ClickSound,
  ClickSubdivision,
  VisualEffect,
  BackgroundMode,
  PresetName,
  PresetValues,
  SavedSettings,
  PdfSlot,
} from '../types'

import {
  STORAGE_KEY,
  PDF_SLOT_COUNT,
  defaultPresetValues,
  defaultSettings,
} from './constants'

export const createEmptyPdfSlot = (): PdfSlot => ({
  pdf: null,
  fileName: '',
  pageNumber: 1,
  pageCount: 0,
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
  return value === 'Quarter' ||
    value === 'Eighth'
}

export const isVisualEffect = (value: unknown): value is VisualEffect => {
  return value === 'Ripple' ||
    value === 'Ghost Sweep' ||
    value === 'None'
}

export const isPresetName = (value: unknown): value is PresetName => {
  return (
    value === 'Current' ||
    value === 'Void / Score Float' ||
    value === 'Void / Practice' ||
    value === 'Void / Recording' ||
    value === 'Void / Night' ||
    value === 'My Saved Preset'
  )
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

export const normalizePresetValues = (
  value: Partial<PresetValues> | null | undefined,
  fallback: PresetValues,
): PresetValues => {
  return {
    bpm: clampNumber(value?.bpm, 30, 240, fallback.bpm),

    timeSignature: isTimeSignature(value?.timeSignature)
      ? value.timeSignature
      : fallback.timeSignature,

    breathIntensity: clampNumber(
      value?.breathIntensity,
      0,
      100,
      fallback.breathIntensity,
    ),

    smallRippleIntensity: clampNumber(
      value?.smallRippleIntensity,
      0,
      100,
      fallback.smallRippleIntensity,
    ),

    largeRippleIntensity: clampNumber(
      value?.largeRippleIntensity,
      0,
      100,
      fallback.largeRippleIntensity,
    ),

    clickSound: isClickSound(value?.clickSound)
      ? value.clickSound
      : fallback.clickSound,

    clickSubdivision: isClickSubdivision(value?.clickSubdivision)
      ? value.clickSubdivision
      : fallback.clickSubdivision,

    visualEffect: isVisualEffect(value?.visualEffect)
      ? value.visualEffect
      : fallback.visualEffect,

    volume: clampNumber(value?.volume, 0, 100, fallback.volume),

    isScoreVisible:
      typeof value?.isScoreVisible === 'boolean'
        ? value.isScoreVisible
        : fallback.isScoreVisible,

    scoreOpacity: clampNumber(
      value?.scoreOpacity,
      0,
      100,
      fallback.scoreOpacity,
    ),

    scoreScale: clampNumber(value?.scoreScale, 20, 160, fallback.scoreScale),

    scoreX: clampNumber(value?.scoreX, -400, 400, fallback.scoreX),

    scoreY: clampNumber(value?.scoreY, -300, 300, fallback.scoreY),

    scoreWhiteCut: clampNumber(
      value?.scoreWhiteCut,
      50,
      95,
      fallback.scoreWhiteCut,
    ),

    scoreInkBoost: clampNumber(
      value?.scoreInkBoost,
      0,
      60,
      fallback.scoreInkBoost,
    ),

    backgroundMode: isBackgroundMode(value?.backgroundMode)
      ? value.backgroundMode
      : fallback.backgroundMode,
  }
}

export function loadSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return defaultSettings
    }

    const parsed = JSON.parse(raw) as Partial<SavedSettings>

    const normalizedPresetValues = normalizePresetValues(
      parsed,
      defaultPresetValues,
    )

    const savedPreset =
      parsed.savedPreset && typeof parsed.savedPreset === 'object'
        ? normalizePresetValues(parsed.savedPreset, defaultPresetValues)
        : null

    return {
      ...normalizedPresetValues,

      isDebugEnabled:
        typeof parsed.isDebugEnabled === 'boolean'
          ? parsed.isDebugEnabled
          : defaultSettings.isDebugEnabled,

      selectedPreset: isPresetName(parsed.selectedPreset)
        ? parsed.selectedPreset
        : defaultSettings.selectedPreset,

      savedPreset,
    }
  } catch {
    return defaultSettings
  }
}