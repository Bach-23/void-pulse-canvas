import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type TimeSignature = '2/4' | '3/4' | '4/4' | 'Free'
type ClickSound = 'Soft Tick' | 'Wood' | 'Metal' | 'Breath' | 'Muted Key'

type SavedSettings = {
  bpm: number
  timeSignature: TimeSignature
  breathIntensity: number
  smallRippleIntensity: number
  largeRippleIntensity: number
  clickSound: ClickSound
}

const STORAGE_KEY = 'void-pulse-canvas-settings-v1'

const defaultSettings: SavedSettings = {
  bpm: 105,
  timeSignature: '4/4',
  breathIntensity: 40,
  smallRippleIntensity: 100,
  largeRippleIntensity: 40,
  clickSound: 'Soft Tick',
}

const clickSoundOptions: ClickSound[] = [
  'Soft Tick',
  'Wood',
  'Metal',
  'Breath',
  'Muted Key',
]

function loadSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return defaultSettings
    }

    const parsed = JSON.parse(raw) as Partial<SavedSettings>

    return {
      bpm: typeof parsed.bpm === 'number' ? parsed.bpm : defaultSettings.bpm,

      timeSignature:
        parsed.timeSignature === '2/4' ||
        parsed.timeSignature === '3/4' ||
        parsed.timeSignature === '4/4' ||
        parsed.timeSignature === 'Free'
          ? parsed.timeSignature
          : defaultSettings.timeSignature,

      breathIntensity:
        typeof parsed.breathIntensity === 'number'
          ? parsed.breathIntensity
          : defaultSettings.breathIntensity,

      smallRippleIntensity:
        typeof parsed.smallRippleIntensity === 'number'
          ? parsed.smallRippleIntensity
          : defaultSettings.smallRippleIntensity,

      largeRippleIntensity:
        typeof parsed.largeRippleIntensity === 'number'
          ? parsed.largeRippleIntensity
          : defaultSettings.largeRippleIntensity,

      clickSound:
        parsed.clickSound === 'Soft Tick' ||
        parsed.clickSound === 'Wood' ||
        parsed.clickSound === 'Metal' ||
        parsed.clickSound === 'Breath' ||
        parsed.clickSound === 'Muted Key'
          ? parsed.clickSound
          : defaultSettings.clickSound,
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

  const audioContextRef = useRef<AudioContext | null>(null)

  const {
    bpm,
    timeSignature,
    breathIntensity,
    smallRippleIntensity,
    largeRippleIntensity,
    clickSound,
  } = settings

  const updateSettings = (nextSettings: Partial<SavedSettings>) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      ...nextSettings,
    }))
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

  const largeRippleDuration = useMemo(() => {
    if (timeSignature === 'Free') return beatDuration
    return beatDuration * beatsPerBar
  }, [beatDuration, beatsPerBar, timeSignature])

  const ensureAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }

    return audioContextRef.current
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

    oscillator.frequency.setValueAtTime(frequency, now)

    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(peakGain, now + 0.006)
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

    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.linearRampToValueAtTime(isBarHead ? 0.085 : 0.055, now + 0.045)
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
    if (!isRunning) return

    const intervalId = window.setInterval(() => {
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
        } as React.CSSProperties
      }
    >
      <div className={`background ${isRunning ? 'is-running' : 'is-paused'}`} />

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
        </div>

        <div className="sliders">
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
        </div>
      </section>

      <div className="status ui-panel">
        <span>{safeBpm} BPM</span>
        <span>{timeSignature}</span>
        <span>{clickSound}</span>
        <span>
          {timeSignature === 'Free'
            ? 'No Meter'
            : `Beat ${currentBeat + 1}`}
        </span>
        <span>{isRunning ? 'Pulse ON' : 'Pulse OFF'}</span>
        <span>{isAudioEnabled ? 'Audio ON' : 'Audio OFF'}</span>
      </div>
    </main>
  )
}

export default App