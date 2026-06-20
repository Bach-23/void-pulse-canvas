import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type TimeSignature = '2/4' | '3/4' | '4/4' | 'Free'
type ClickSound = 'Soft Tick' | 'Wood' | 'Metal' | 'Breath' | 'Muted Key'
type PresetName =
  | 'Current'
  | 'Void / Score Float'
  | 'Void / Practice'
  | 'Void / Recording'
  | 'Void / Night'
  | 'My Saved Preset'

type PresetValues = {
  bpm: number
  timeSignature: TimeSignature
  breathIntensity: number
  smallRippleIntensity: number
  largeRippleIntensity: number
  clickSound: ClickSound
  volume: number
  isScoreVisible: boolean
  scoreOpacity: number
  scoreScale: number
  scoreX: number
  scoreY: number
  scoreWhiteCut: number
  scoreInkBoost: number
}

type SavedSettings = PresetValues & {
  isDebugEnabled: boolean
  selectedPreset: PresetName
  savedPreset: PresetValues | null
}

type DebugMetrics = {
  targetMs: number
  actualMs: number | null
  diffMs: number | null
  maxDiffMs: number
  beatCount: number
}

const STORAGE_KEY = 'void-pulse-canvas-settings-v1'
const SCORE_IMAGE_SRC = '/images/score-overlay-01.png'

const defaultPresetValues: PresetValues = {
  bpm: 105,
  timeSignature: '4/4',
  breathIntensity: 40,
  smallRippleIntensity: 100,
  largeRippleIntensity: 40,
  clickSound: 'Soft Tick',
  volume: 70,
  isScoreVisible: false,
  scoreOpacity: 70,
  scoreScale: 72,
  scoreX: 0,
  scoreY: 0,
  scoreWhiteCut: 80,
  scoreInkBoost: 30,
}

const defaultSettings: SavedSettings = {
  ...defaultPresetValues,
  isDebugEnabled: false,
  selectedPreset: 'Current',
  savedPreset: null,
}

const clickSoundOptions: ClickSound[] = [
  'Soft Tick',
  'Wood',
  'Metal',
  'Breath',
  'Muted Key',
]

const presetOptions: PresetName[] = [
  'Current',
  'Void / Score Float',
  'Void / Practice',
  'Void / Recording',
  'Void / Night',
  'My Saved Preset',
]

const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) => {
  if (typeof value !== 'number') return fallback
  if (Number.isNaN(value)) return fallback

  return Math.min(Math.max(value, min), max)
}

const isTimeSignature = (value: unknown): value is TimeSignature => {
  return value === '2/4' || value === '3/4' || value === '4/4' || value === 'Free'
}

const isClickSound = (value: unknown): value is ClickSound => {
  return (
    value === 'Soft Tick' ||
    value === 'Wood' ||
    value === 'Metal' ||
    value === 'Breath' ||
    value === 'Muted Key'
  )
}

const isPresetName = (value: unknown): value is PresetName => {
  return (
    value === 'Current' ||
    value === 'Void / Score Float' ||
    value === 'Void / Practice' ||
    value === 'Void / Recording' ||
    value === 'Void / Night' ||
    value === 'My Saved Preset'
  )
}

const normalizePresetValues = (
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
  }
}

function loadSettings(): SavedSettings {
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

function App() {
  const [settings, setSettings] = useState<SavedSettings>(() => loadSettings())

  const [isRunning, setIsRunning] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(false)
  const [currentBeat, setCurrentBeat] = useState(0)
  const [smallRippleKey, setSmallRippleKey] = useState(0)
  const [largeRippleKey, setLargeRippleKey] = useState(0)
  const [isUiVisible, setIsUiVisible] = useState(true)
  const [isScoreImageLoaded, setIsScoreImageLoaded] = useState(false)

  const [debugMetrics, setDebugMetrics] = useState<DebugMetrics>({
    targetMs: 0,
    actualMs: null,
    diffMs: null,
    maxDiffMs: 0,
    beatCount: 0,
  })

  const audioContextRef = useRef<AudioContext | null>(null)
  const lastBeatTimeRef = useRef<number | null>(null)
  const maxDiffRef = useRef(0)
  const beatCountRef = useRef(0)
  const scoreCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const scoreImageRef = useRef<HTMLImageElement | null>(null)

  const {
    bpm,
    timeSignature,
    breathIntensity,
    smallRippleIntensity,
    largeRippleIntensity,
    clickSound,
    volume,
    isDebugEnabled,
    isScoreVisible,
    scoreOpacity,
    scoreScale,
    scoreX,
    scoreY,
    scoreWhiteCut,
    scoreInkBoost,
    selectedPreset,
    savedPreset,
  } = settings

  const updateSettings = (nextSettings: Partial<SavedSettings>) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      ...nextSettings,
    }))
  }

  const getCurrentPresetValues = (): PresetValues => {
    return {
      bpm,
      timeSignature,
      breathIntensity,
      smallRippleIntensity,
      largeRippleIntensity,
      clickSound,
      volume,
      isScoreVisible,
      scoreOpacity,
      scoreScale,
      scoreX,
      scoreY,
      scoreWhiteCut,
      scoreInkBoost,
    }
  }

  const saveCurrentPreset = () => {
    updateSettings({
      savedPreset: getCurrentPresetValues(),
      selectedPreset: 'My Saved Preset',
    })
  }

  const applyPreset = () => {
    if (selectedPreset === 'Current') {
      return
    }

    if (selectedPreset === 'My Saved Preset') {
      if (!savedPreset) return

      updateSettings({
        ...savedPreset,
      })

      return
    }

    if (selectedPreset === 'Void / Score Float') {
      updateSettings({
        bpm: 105,
        timeSignature: '4/4',
        breathIntensity: 40,
        smallRippleIntensity: 100,
        largeRippleIntensity: 40,
        clickSound: 'Muted Key',
        volume: 70,
        isScoreVisible: true,
        scoreOpacity: 70,
        scoreScale: 72,
        scoreX: 0,
        scoreY: 0,
        scoreWhiteCut: 80,
        scoreInkBoost: 30,
      })

      return
    }

    if (selectedPreset === 'Void / Practice') {
      updateSettings({
        bpm: 105,
        timeSignature: '4/4',
        breathIntensity: 32,
        smallRippleIntensity: 100,
        largeRippleIntensity: 36,
        clickSound: 'Soft Tick',
        volume: 72,
        isScoreVisible: true,
        scoreOpacity: 82,
        scoreScale: 78,
        scoreX: 0,
        scoreY: 0,
        scoreWhiteCut: 78,
        scoreInkBoost: 24,
      })

      return
    }

    if (selectedPreset === 'Void / Recording') {
      updateSettings({
        bpm: 105,
        timeSignature: '4/4',
        breathIntensity: 28,
        smallRippleIntensity: 72,
        largeRippleIntensity: 32,
        clickSound: 'Muted Key',
        volume: 48,
        isScoreVisible: true,
        scoreOpacity: 58,
        scoreScale: 70,
        scoreX: 0,
        scoreY: 0,
        scoreWhiteCut: 82,
        scoreInkBoost: 22,
      })

      return
    }

    if (selectedPreset === 'Void / Night') {
      updateSettings({
        bpm: 105,
        timeSignature: 'Free',
        breathIntensity: 58,
        smallRippleIntensity: 76,
        largeRippleIntensity: 30,
        clickSound: 'Breath',
        volume: 54,
        isScoreVisible: true,
        scoreOpacity: 46,
        scoreScale: 68,
        scoreX: 0,
        scoreY: 0,
        scoreWhiteCut: 84,
        scoreInkBoost: 18,
      })
    }
  }

  const beatsPerBar = useMemo(() => {
    if (timeSignature === '2/4') return 2
    if (timeSignature === '3/4') return 3
    if (timeSignature === '4/4') return 4
    return 1
  }, [timeSignature])

  const safeBpm = useMemo(() => {
    return Math.min(Math.max(bpm, 30), 240)
  }, [bpm])

  const beatDuration = useMemo(() => {
    return 60 / safeBpm
  }, [safeBpm])

  const targetBeatMs = useMemo(() => {
    return beatDuration * 1000
  }, [beatDuration])

  const largeRippleDuration = useMemo(() => {
    if (timeSignature === 'Free') return beatDuration
    return beatDuration * beatsPerBar
  }, [beatDuration, beatsPerBar, timeSignature])

  const volumeRatio = useMemo(() => {
    return Math.min(Math.max(volume, 0), 100) / 100
  }, [volume])

  const scoreOpacityRatio = useMemo(() => {
    return Math.min(Math.max(scoreOpacity, 0), 100) / 100
  }, [scoreOpacity])

  const scoreScaleRatio = useMemo(() => {
    return Math.min(Math.max(scoreScale, 20), 160) / 100
  }, [scoreScale])

  const ensureAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }

    return audioContextRef.current
  }

  const resetDebugMetrics = () => {
    lastBeatTimeRef.current = null
    maxDiffRef.current = 0
    beatCountRef.current = 0

    setDebugMetrics({
      targetMs: targetBeatMs,
      actualMs: null,
      diffMs: null,
      maxDiffMs: 0,
      beatCount: 0,
    })
  }

  const updateDebugMetrics = () => {
    const now = performance.now()
    const previousBeatTime = lastBeatTimeRef.current

    beatCountRef.current += 1

    if (previousBeatTime === null) {
      lastBeatTimeRef.current = now

      setDebugMetrics({
        targetMs: targetBeatMs,
        actualMs: null,
        diffMs: null,
        maxDiffMs: maxDiffRef.current,
        beatCount: beatCountRef.current,
      })

      return
    }

    const actualMs = now - previousBeatTime
    const diffMs = actualMs - targetBeatMs
    const absoluteDiffMs = Math.abs(diffMs)

    maxDiffRef.current = Math.max(maxDiffRef.current, absoluteDiffMs)
    lastBeatTimeRef.current = now

    setDebugMetrics({
      targetMs: targetBeatMs,
      actualMs,
      diffMs,
      maxDiffMs: maxDiffRef.current,
      beatCount: beatCountRef.current,
    })
  }

  const createNoiseBuffer = (audioContext: AudioContext, duration: number) => {
    const sampleRate = audioContext.sampleRate
    const frameCount = Math.floor(sampleRate * duration)
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate)
    const channelData = buffer.getChannelData(0)

    for (let index = 0; index < frameCount; index += 1) {
      const whiteNoise = Math.random() * 2 - 1
      const fadeOut = 1 - index / frameCount
      channelData[index] = whiteNoise * fadeOut
    }

    return buffer
  }

  const renderScoreCanvas = () => {
    const canvas = scoreCanvasRef.current
    const image = scoreImageRef.current

    if (!canvas || !image) return
    if (!image.naturalWidth || !image.naturalHeight) return

    const width = image.naturalWidth
    const height = image.naturalHeight
    const context = canvas.getContext('2d')

    if (!context) return

    canvas.width = width
    canvas.height = height

    context.clearRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)

    const imageData = context.getImageData(0, 0, width, height)
    const data = imageData.data

    const paperCutRatio = Math.min(Math.max(scoreWhiteCut, 50), 95) / 100
    const inkLiftRatio = Math.min(Math.max(scoreInkBoost, 0), 60) / 60

    const whiteThreshold = 255 - paperCutRatio * 185
    const fadeRange = Math.max(1, 255 - whiteThreshold)

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index]
      const green = data[index + 1]
      const blue = data[index + 2]
      const alpha = data[index + 3]

      const brightness = (red + green + blue) / 3

      if (brightness >= whiteThreshold) {
        const whiteness = Math.min(1, (brightness - whiteThreshold) / fadeRange)
        const remainingAlpha = Math.max(0, 1 - whiteness)

        data[index + 3] = alpha * remainingAlpha
        continue
      }

      const darkness = 1 - brightness / 255
      const inkStrength = Math.min(1, darkness * inkLiftRatio * 0.8)

      const targetRed = 226
      const targetGreen = 235
      const targetBlue = 248

      data[index] = red * (1 - inkStrength) + targetRed * inkStrength
      data[index + 1] = green * (1 - inkStrength) + targetGreen * inkStrength
      data[index + 2] = blue * (1 - inkStrength) + targetBlue * inkStrength
      data[index + 3] = Math.min(255, alpha * (0.72 + inkStrength * 0.34))
    }

    context.putImageData(imageData, 0, 0)
  }

  const playOscillatorClick = (
    audioContext: AudioContext,
    now: number,
    isBarHead: boolean,
    sound: ClickSound,
  ) => {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    const filterNode = audioContext.createBiquadFilter()

    let frequency = 880
    let peakGain = 0.13
    let duration = 0.055

    oscillator.type = 'sine'
    filterNode.type = 'lowpass'
    filterNode.frequency.setValueAtTime(6000, now)
    filterNode.Q.setValueAtTime(0.4, now)

    if (sound === 'Soft Tick') {
      oscillator.type = 'sine'
      frequency = isBarHead ? 1320 : 880
      peakGain = isBarHead ? 0.22 : 0.13
      duration = 0.055
    }

    if (sound === 'Wood') {
      oscillator.type = 'triangle'
      frequency = isBarHead ? 640 : 430
      peakGain = isBarHead ? 0.26 : 0.17
      duration = 0.045
      filterNode.frequency.setValueAtTime(1400, now)
    }

    if (sound === 'Metal') {
      oscillator.type = 'square'
      frequency = isBarHead ? 1760 : 1180
      peakGain = isBarHead ? 0.18 : 0.11
      duration = 0.04
      filterNode.frequency.setValueAtTime(3800, now)
      filterNode.Q.setValueAtTime(1.8, now)
    }

    if (sound === 'Muted Key') {
      oscillator.type = 'triangle'
      frequency = isBarHead ? 880 : 660
      peakGain = isBarHead ? 0.2 : 0.13
      duration = 0.075
      filterNode.frequency.setValueAtTime(1800, now)
    }

    const adjustedPeakGain = Math.max(0.0001, peakGain * volumeRatio)

    oscillator.frequency.setValueAtTime(frequency, now)

    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(
      adjustedPeakGain,
      now + 0.006,
    )
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    oscillator.connect(filterNode)
    filterNode.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.start(now)
    oscillator.stop(now + duration + 0.01)
  }

  const playBreathClick = (
    audioContext: AudioContext,
    now: number,
    isBarHead: boolean,
  ) => {
    const source = audioContext.createBufferSource()
    const highPassNode = audioContext.createBiquadFilter()
    const lowPassNode = audioContext.createBiquadFilter()
    const gainNode = audioContext.createGain()

    source.buffer = createNoiseBuffer(audioContext, 0.22)

    highPassNode.type = 'highpass'
    highPassNode.frequency.setValueAtTime(260, now)
    highPassNode.Q.setValueAtTime(0.5, now)

    lowPassNode.type = 'lowpass'
    lowPassNode.frequency.setValueAtTime(isBarHead ? 1450 : 1050, now)
    lowPassNode.Q.setValueAtTime(0.7, now)

    const breathPeakGain = (isBarHead ? 0.085 : 0.055) * volumeRatio

    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.linearRampToValueAtTime(
      Math.max(0.0001, breathPeakGain),
      now + 0.045,
    )
    gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.18)

    source.connect(highPassNode)
    highPassNode.connect(lowPassNode)
    lowPassNode.connect(gainNode)
    gainNode.connect(audioContext.destination)

    source.start(now)
    source.stop(now + 0.22)
  }

  const playClick = async (isBarHead: boolean) => {
    if (!isAudioEnabled) return
    if (volumeRatio <= 0) return

    const audioContext = await ensureAudioContext()
    const now = audioContext.currentTime

    if (clickSound === 'Breath') {
      playBreathClick(audioContext, now, isBarHead)
      return
    }

    playOscillatorClick(audioContext, now, isBarHead, clickSound)
  }

  const turnAudioOn = async () => {
    await ensureAudioContext()
    setIsAudioEnabled(true)
  }

  const turnAudioOff = () => {
    setIsAudioEnabled(false)
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const image = new Image()
    image.src = SCORE_IMAGE_SRC

    image.onload = () => {
      scoreImageRef.current = image
      setIsScoreImageLoaded(true)
    }

    image.onerror = () => {
      scoreImageRef.current = null
      setIsScoreImageLoaded(false)
    }
  }, [])

  useEffect(() => {
    if (!isScoreVisible) return
    if (!isScoreImageLoaded) return

    window.requestAnimationFrame(() => {
      renderScoreCanvas()
    })
  }, [isScoreVisible, isScoreImageLoaded, scoreWhiteCut, scoreInkBoost])

  useEffect(() => {
    resetDebugMetrics()
  }, [targetBeatMs, timeSignature])

  useEffect(() => {
    if (!isRunning) {
      lastBeatTimeRef.current = null
      return
    }

    const intervalId = window.setInterval(() => {
      updateDebugMetrics()
      setSmallRippleKey((key) => key + 1)

      setCurrentBeat((beat) => {
        const nextBeat = (beat + 1) % beatsPerBar
        const isBarHead = timeSignature !== 'Free' && nextBeat === 0

        if (isBarHead) {
          setLargeRippleKey((key) => key + 1)
        }

        void playClick(timeSignature === 'Free' ? false : isBarHead)

        return nextBeat
      })
    }, beatDuration * 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    isRunning,
    isAudioEnabled,
    beatDuration,
    beatsPerBar,
    timeSignature,
    clickSound,
    volumeRatio,
    targetBeatMs,
  ])

  useEffect(() => {
    setCurrentBeat(0)
    setSmallRippleKey((key) => key + 1)

    if (timeSignature !== 'Free') {
      setLargeRippleKey((key) => key + 1)
    }
  }, [timeSignature, bpm])

  useEffect(() => {
    let hideTimerId: number | undefined

    const showUi = () => {
      setIsUiVisible(true)

      if (hideTimerId) {
        window.clearTimeout(hideTimerId)
      }

      hideTimerId = window.setTimeout(() => {
        setIsUiVisible(false)
      }, 3000)
    }

    window.addEventListener('mousemove', showUi)
    window.addEventListener('keydown', showUi)

    showUi()

    return () => {
      window.removeEventListener('mousemove', showUi)
      window.removeEventListener('keydown', showUi)

      if (hideTimerId) {
        window.clearTimeout(hideTimerId)
      }
    }
  }, [])

  return (
    <main
      className={`app ${isUiVisible ? 'ui-visible' : 'ui-hidden'}`}
      style={
        {
          '--beat-duration': `${beatDuration}s`,
          '--large-ripple-duration': `${largeRippleDuration}s`,
          '--breath-intensity': breathIntensity / 100,
          '--small-ripple-intensity': smallRippleIntensity / 100,
          '--large-ripple-intensity': largeRippleIntensity / 100,
          '--score-opacity': scoreOpacityRatio,
          '--score-scale': scoreScaleRatio,
          '--score-x': `${scoreX}px`,
          '--score-y': `${scoreY}px`,
        } as React.CSSProperties
      }
    >
      <div className={`background ${isRunning ? 'is-running' : 'is-paused'}`} />

      {isScoreVisible && (
        <div className="score-overlay">
          <canvas ref={scoreCanvasRef} />
        </div>
      )}

      {isRunning && (
        <>
          <div key={`small-${smallRippleKey}`} className="small-ripple" />

          {timeSignature !== 'Free' && (
            <div key={`large-${largeRippleKey}`} className="large-ripple" />
          )}
        </>
      )}

      <section className="hero ui-panel">
        <p className="eyebrow">Project2026 / Void</p>
        <h1>Void Pulse Canvas</h1>
        <p className="subtitle">
          音を出す前に、空間をチューニングする。
        </p>

        <div className="primary-action-row">
          <button
            className={`pulse-button ${isRunning ? 'is-active' : ''}`}
            onClick={() => setIsRunning(!isRunning)}
          >
            {isRunning ? 'Pulse Stop' : 'Pulse Start'}
          </button>
        </div>

        <div className="secondary-controls">
          <label className="compact-control">
            <span>BPM</span>
            <input
              type="number"
              min="30"
              max="240"
              value={bpm}
              onChange={(event) =>
                updateSettings({ bpm: Number(event.target.value) })
              }
            />
          </label>

          <label className="compact-control">
            <span>Meter</span>
            <select
              value={timeSignature}
              onChange={(event) =>
                updateSettings({
                  timeSignature: event.target.value as TimeSignature,
                })
              }
            >
              <option value="2/4">2/4</option>
              <option value="3/4">3/4</option>
              <option value="4/4">4/4</option>
              <option value="Free">Free</option>
            </select>
          </label>

          <label className="compact-control sound-control">
            <span>Sound</span>
            <select
              value={clickSound}
              onChange={(event) =>
                updateSettings({
                  clickSound: event.target.value as ClickSound,
                })
              }
            >
              {clickSoundOptions.map((sound) => (
                <option key={sound} value={sound}>
                  {sound}
                </option>
              ))}
            </select>
          </label>

          <label className="compact-control sound-control">
            <span>Preset</span>
            <select
              value={selectedPreset}
              onChange={(event) =>
                updateSettings({
                  selectedPreset: event.target.value as PresetName,
                })
              }
            >
              {presetOptions.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </label>

          <div className="score-switch-group">
            <button className="score-switch" onClick={applyPreset}>
              Apply
            </button>

            <button className="score-switch" onClick={saveCurrentPreset}>
              Save Current
            </button>
          </div>

          <div className="audio-switch-group">
            <button
              className={`audio-switch ${isAudioEnabled ? 'is-active' : ''}`}
              onClick={turnAudioOn}
            >
              Audio ON
            </button>

            <button
              className={`audio-switch ${!isAudioEnabled ? 'is-active' : ''}`}
              onClick={turnAudioOff}
            >
              Audio OFF
            </button>
          </div>

          <div className="debug-switch-group">
            <button
              className={`debug-switch ${isDebugEnabled ? 'is-active' : ''}`}
              onClick={() => updateSettings({ isDebugEnabled: true })}
            >
              Debug ON
            </button>

            <button
              className={`debug-switch ${!isDebugEnabled ? 'is-active' : ''}`}
              onClick={() => updateSettings({ isDebugEnabled: false })}
            >
              Debug OFF
            </button>
          </div>

          <div className="score-switch-group">
            <button
              className={`score-switch ${isScoreVisible ? 'is-active' : ''}`}
              onClick={() => updateSettings({ isScoreVisible: true })}
            >
              Score ON
            </button>

            <button
              className={`score-switch ${!isScoreVisible ? 'is-active' : ''}`}
              onClick={() => updateSettings({ isScoreVisible: false })}
            >
              Score OFF
            </button>
          </div>
        </div>

        <div className="sliders">
          <label className="slider-control">
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(event) =>
                updateSettings({
                  volume: Number(event.target.value),
                })
              }
            />
            <em>{volume}</em>
          </label>

          <label className="slider-control">
            <span>Breath</span>
            <input
              type="range"
              min="0"
              max="100"
              value={breathIntensity}
              onChange={(event) =>
                updateSettings({
                  breathIntensity: Number(event.target.value),
                })
              }
            />
            <em>{breathIntensity}</em>
          </label>

          <label className="slider-control">
            <span>Small</span>
            <input
              type="range"
              min="0"
              max="100"
              value={smallRippleIntensity}
              onChange={(event) =>
                updateSettings({
                  smallRippleIntensity: Number(event.target.value),
                })
              }
            />
            <em>{smallRippleIntensity}</em>
          </label>

          <label className="slider-control">
            <span>Large</span>
            <input
              type="range"
              min="0"
              max="100"
              value={largeRippleIntensity}
              onChange={(event) =>
                updateSettings({
                  largeRippleIntensity: Number(event.target.value),
                })
              }
            />
            <em>{largeRippleIntensity}</em>
          </label>

          <label className="slider-control">
            <span>Score Visibility</span>
            <input
              type="range"
              min="0"
              max="100"
              value={scoreOpacity}
              onChange={(event) =>
                updateSettings({
                  scoreOpacity: Number(event.target.value),
                })
              }
            />
            <em>{scoreOpacity}</em>
          </label>

          <label className="slider-control">
            <span>Score Size</span>
            <input
              type="range"
              min="20"
              max="160"
              value={scoreScale}
              onChange={(event) =>
                updateSettings({
                  scoreScale: Number(event.target.value),
                })
              }
            />
            <em>{scoreScale}</em>
          </label>

          <label className="slider-control">
            <span>Score X</span>
            <input
              type="range"
              min="-400"
              max="400"
              value={scoreX}
              onChange={(event) =>
                updateSettings({
                  scoreX: Number(event.target.value),
                })
              }
            />
            <em>{scoreX}</em>
          </label>

          <label className="slider-control">
            <span>Score Y</span>
            <input
              type="range"
              min="-300"
              max="300"
              value={scoreY}
              onChange={(event) =>
                updateSettings({
                  scoreY: Number(event.target.value),
                })
              }
            />
            <em>{scoreY}</em>
          </label>

          <label className="slider-control">
            <span>Paper Cut</span>
            <input
              type="range"
              min="50"
              max="95"
              value={scoreWhiteCut}
              onChange={(event) =>
                updateSettings({
                  scoreWhiteCut: Number(event.target.value),
                })
              }
            />
            <em>{scoreWhiteCut}</em>
          </label>

          <label className="slider-control">
            <span>Ink Lift</span>
            <input
              type="range"
              min="0"
              max="60"
              value={scoreInkBoost}
              onChange={(event) =>
                updateSettings({
                  scoreInkBoost: Number(event.target.value),
                })
              }
            />
            <em>{scoreInkBoost}</em>
          </label>
        </div>
      </section>

      <div className="status ui-panel">
        <span>{safeBpm} BPM</span>
        <span>{timeSignature}</span>
        <span>{clickSound}</span>
        <span>VOL {volume}</span>
        <span>{isScoreVisible ? 'Score ON' : 'Score OFF'}</span>
        <span>{selectedPreset}</span>
        <span>
          {timeSignature === 'Free'
            ? 'No Meter'
            : `Beat ${currentBeat + 1}`}
        </span>
        <span>{isRunning ? 'Pulse ON' : 'Pulse OFF'}</span>
        <span>{isAudioEnabled ? 'Audio ON' : 'Audio OFF'}</span>
      </div>

      {isDebugEnabled && (
        <div className="debug-panel ui-panel">
          <span>Debug</span>
          <span>Target {debugMetrics.targetMs.toFixed(1)}ms</span>
          <span>
            Actual{' '}
            {debugMetrics.actualMs === null
              ? '--'
              : `${debugMetrics.actualMs.toFixed(1)}ms`}
          </span>
          <span>
            Diff{' '}
            {debugMetrics.diffMs === null
              ? '--'
              : `${debugMetrics.diffMs >= 0 ? '+' : ''}${debugMetrics.diffMs.toFixed(1)}ms`}
          </span>
          <span>Max ±{debugMetrics.maxDiffMs.toFixed(1)}ms</span>
          <span>Count {debugMetrics.beatCount}</span>
        </div>
      )}
    </main>
  )
}

export default App