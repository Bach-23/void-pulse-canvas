import { useEffect, useRef, useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { BeatIntensity, ClickSound, ClickSubdivision, TimeSignature } from '../types'

type UseAudioPulseProps = {
  isRunning: boolean
  isAudioEnabled: boolean
  beatDuration: number
  beatsPerBar: number
  timeSignature: TimeSignature
  clickSound: ClickSound
  clickSubdivision: ClickSubdivision
  volumeRatio: number
  targetBeatMs: number
  updateDebugMetrics: () => void
  setSmallRippleKey: Dispatch<SetStateAction<number>>
  setCurrentBeat: Dispatch<SetStateAction<number>>
  setLargeRippleKey: Dispatch<SetStateAction<number>>
}

export function useAudioPulse({
  isRunning,
  isAudioEnabled,
  beatDuration,
  beatsPerBar,
  timeSignature,
  clickSound,
  clickSubdivision,
  volumeRatio,
  targetBeatMs,
  updateDebugMetrics,
  setSmallRippleKey,
  setCurrentBeat,
  setLargeRippleKey,
}: UseAudioPulseProps) {
  const audioContextRef = useRef<AudioContext | null>(null)

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }
    return audioContextRef.current
  }, [])

  const playClick = useCallback(async (intensity: BeatIntensity) => {
    if (!isAudioEnabled) return
    if (volumeRatio <= 0) return

    const ctx = await ensureAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    const freq = intensity === 'High' ? 1320 : intensity === 'Mid' ? 880 : 660

    osc.frequency.value = freq
    gain.gain.value = 0.1 * volumeRatio

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.05)
  }, [isAudioEnabled, volumeRatio, ensureAudioContext])

  useEffect(() => {
    if (!isRunning) return

    const intervalId = setInterval(() => {
      updateDebugMetrics()
      setSmallRippleKey(k => k + 1)

      setCurrentBeat(b => {
        const next = (b + 1) % beatsPerBar
        const isHead = timeSignature !== 'Free' && next === 0

        if (isHead) {
          setLargeRippleKey(k => k + 1)
        }

        const intensity: BeatIntensity =
          timeSignature === 'Free' ? 'Mid' : isHead ? 'High' : 'Mid'

        void playClick(intensity)

        if (clickSubdivision === 'Eighth') {
          setTimeout(() => void playClick('Low'), (beatDuration * 1000) / 2)
        }

        return next
      })
    }, beatDuration * 1000)

    return () => clearInterval(intervalId)
  }, [
    isRunning,
    beatDuration,
    beatsPerBar,
    timeSignature,
    clickSubdivision,
    updateDebugMetrics,
    setSmallRippleKey,
    setCurrentBeat,
    setLargeRippleKey,
    playClick,
  ])

  return { ensureAudioContext }
}