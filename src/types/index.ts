export type TimeSignature = '2/4' | '3/4' | '4/4' | 'Free'

export type ClickSound = 'Soft Tick' | 'Wood' | 'Metal' | 'Breath' | 'Muted Key'

export type ClickSubdivision = 'Quarter' | 'Eighth' | 'Triplet' | 'Sixteenth'

export type VisualEffect = 'Ghost Sweep' | 'Ripple' | 'None'

export type BackgroundMode = 'Image' | 'Void Black' | 'Warm Gray' | 'Deep Blue' | 'Paper Dark'

export type BeatIntensity = 'High' | 'Mid' | 'Low'

export type SavedSettings = {
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
  backgroundMode: BackgroundMode
  isDebugEnabled: boolean
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
  pdf: any
  fileName: string
  pageNumber: number
  pageCount: number
  scoreScale: number
  scoreX: number
  scoreY: number
  scoreOpacity: number
  scoreWhiteCut: number
  scoreInkBoost: number
}