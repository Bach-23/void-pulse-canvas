export type TimeSignature = '2/4' | '3/4' | '4/4' | 'Free'

export type ClickSound = 'Soft Tick' | 'Wood' | 'Metal' | 'Breath' | 'Muted Key'

export type ClickSubdivision = 'Quarter' | 'Eighth'

export type VisualEffect = 'Ripple' | 'Line Sweep' | 'Ghost Sweep' | 'None'

export type BackgroundMode = 'Image' | 'Void Black' | 'Warm Gray' | 'Deep Blue' | 'Paper Dark'

export type PresetName = 'Current' | 'Void / Score Float' | 'Void / Practice' | 'Void / Recording' | 'Void / Night' | 'My Saved Preset'

export type BeatIntensity = 'High' | 'Mid' | 'Low'

export type PresetValues = {
  bpm: number
  timeSignature: TimeSignature
  breathIntensity: number
  smallRippleIntensity: number
  largeRippleIntensity: number
  clickSound: ClickSound
  clickSubdivision: ClickSubdivision
  visualEffect: VisualEffect
  volume: number
  isScoreVisible: boolean
  scoreOpacity: number
  scoreScale: number
  scoreX: number
  scoreY: number
  scoreWhiteCut: number
  scoreInkBoost: number
  backgroundMode: BackgroundMode
}

export type SavedSettings = PresetValues & {
  isDebugEnabled: boolean
  selectedPreset: PresetName
  savedPreset: PresetValues | null
}

export type DebugMetrics = {
  targetMs: number
  actualMs: number | null
  diffMs: number | null
  maxDiffMs: number
  beatCount: number
}

export type PdfSlot = {
  // pdfjs-distの型解決エラーによる連鎖パース崩壊を防ぐため、anyで防壁を構築。
  // 描画エンジン内部で処理されるオブジェクトをここで厳密に縛る必要はございません。
  pdf: any
  fileName: string
  pageNumber: number
  pageCount: number
}