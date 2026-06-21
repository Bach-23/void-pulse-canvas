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
    let needsWarmup = false

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
      needsWarmup = true
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
      needsWarmup = true
    }

    if (needsWarmup) {
      const ctx = audioContextRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.00001, ctx.currentTime)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.05)
    }

    return audioContextRef.current
  }, [])

  const createNoiseBuffer = useCallback((audioContext: AudioContext, duration: number) => {
    const sampleRate = audioContext.sampleRate
    const frameCount = Math.floor(sampleRate * duration)
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate)
    const channelData = buffer.getChannelData(0)

    for (let index = 0; index < frameCount; index += 1) {
      const whiteNoise = Math.random() * 2 - 1
      channelData[index] = whiteNoise
    }

    return buffer
  }, [])

  const playOscillatorClick = useCallback((
    audioContext: AudioContext,
    now: number,
    intensity: BeatIntensity,
    sound: ClickSound,
  ) => {
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    const filterNode = audioContext.createBiquadFilter()

    let type: OscillatorType = 'sine'
    let freq = 880
    let peakGain = 0.5
    let decay = 0.05
    let filterType: BiquadFilterType = 'lowpass'
    let filterFreq = 6000
    let filterQ = 0
    let pitchDrop = false

    if (sound === 'Soft Tick') {
      type = 'sine'
      freq = intensity === 'High' ? 1480 : intensity === 'Mid' ? 980 : 740
      peakGain = intensity === 'High' ? 0.6 : intensity === 'Mid' ? 0.4 : 0.25
      decay = 0.03
      filterType = 'highpass'
      filterFreq = 400
    } else if (sound === 'Wood') {
      type = 'triangle'
      freq = intensity === 'High' ? 720 : intensity === 'Mid' ? 480 : 340
      peakGain = intensity === 'High' ? 0.55 : intensity === 'Mid' ? 0.38 : 0.25
      decay = 0.026
      filterType = 'lowpass'
      filterFreq = 2000
      filterQ = 0.25
      pitchDrop = false
    } else if (sound === 'Metal') {
      type = 'square'
      freq = intensity === 'High' ? 1800 : intensity === 'Mid' ? 1200 : 900
      peakGain = intensity === 'High' ? 0.25 : intensity === 'Mid' ? 0.15 : 0.1
      decay = 0.02
      filterType = 'bandpass'
      filterFreq = freq
      filterQ = 2.0
    } else if (sound === 'Muted Key') {
      type = 'sine'
      freq = intensity === 'High' ? 400 : intensity === 'Mid' ? 300 : 200
      peakGain = intensity === 'High' ? 0.9 : intensity === 'Mid' ? 0.7 : 0.5
      decay = 0.06
      filterType = 'lowpass'
      filterFreq = 600
    }

    oscillator.type = type
    filterNode.type = filterType
    filterNode.frequency.setValueAtTime(filterFreq, now)
    filterNode.Q.setValueAtTime(filterQ, now)

    oscillator.frequency.setValueAtTime(freq, now)
    if (pitchDrop) {
      oscillator.frequency.exponentialRampToValueAtTime(freq * 0.5, now + decay)
    }

    const adjustedPeak = Math.max(0.0001, peakGain * volumeRatio)
    const attack = 0.002

    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(adjustedPeak, now + attack)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay)

    oscillator.connect(filterNode)
    filterNode.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.start(now)
    oscillator.stop(now + attack + decay + 0.01)
  }, [volumeRatio])

  const playBreathClick = useCallback((
    audioContext: AudioContext,
    now: number,
    intensity: BeatIntensity,
  ) => {
    const source = audioContext.createBufferSource()
    const highPassNode = audioContext.createBiquadFilter()
    const lowPassNode = audioContext.createBiquadFilter()
    const gainNode = audioContext.createGain()

    source.buffer = createNoiseBuffer(audioContext, 0.15)

    highPassNode.type = 'highpass'
    highPassNode.frequency.setValueAtTime(400, now)
    highPassNode.Q.setValueAtTime(0.5, now)

    lowPassNode.type = 'lowpass'
    lowPassNode.frequency.setValueAtTime(
      intensity === 'High' ? 2200 : intensity === 'Mid' ? 1400 : 900, 
      now
    )
    lowPassNode.Q.setValueAtTime(0.7, now)

    const baseGain = intensity === 'High' ? 0.35 : intensity === 'Mid' ? 0.25 : 0.15
    const adjustedPeak = Math.max(0.0001, baseGain * volumeRatio)
    const attack = 0.01
    const decay = 0.08

    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(adjustedPeak, now + attack)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay)

    source.connect(highPassNode)
    highPassNode.connect(lowPassNode)
    lowPassNode.connect(gainNode)
    gainNode.connect(audioContext.destination)

    source.start(now)
    source.stop(now + attack + decay + 0.01)
  }, [createNoiseBuffer, volumeRatio])

  const playClick = useCallback(async (intensity: BeatIntensity) => {
    if (!isAudioEnabled) return
    if (volumeRatio <= 0) return

    const audioContext = await ensureAudioContext()
    const now = audioContext.currentTime

    if (clickSound === 'Breath') {
      playBreathClick(audioContext, now, intensity)
      return
    }

    playOscillatorClick(audioContext, now, intensity, clickSound)
  }, [isAudioEnabled, volumeRatio, ensureAudioContext, clickSound, playBreathClick, playOscillatorClick])

  useEffect(() => {
    if (!isRunning) {
      return
    }

    const eighthClickTimeoutIds: number[] = []

    const intervalId = window.setInterval(() => {
      updateDebugMetrics()
      setSmallRippleKey((key) => key + 1)

      setCurrentBeat((beat) => {
        const nextBeat = (beat + 1) % beatsPerBar
        const isBarHead = timeSignature !== 'Free' && nextBeat === 0

        if (isBarHead) {
          setLargeRippleKey((key) => key + 1)
        }

        const currentIntensity: BeatIntensity = timeSignature === 'Free' ? 'Mid' : (isBarHead ? 'High' : 'Mid')
        void playClick(currentIntensity)

        if (clickSubdivision === 'Eighth') {
          const timeoutId = window.setTimeout(() => {
            void playClick('Low')
          }, (beatDuration * 1000) / 2)

          eighthClickTimeoutIds.push(timeoutId)
        }

        return nextBeat
      })
    }, beatDuration * 1000)

    return () => {
      window.clearInterval(intervalId)

      eighthClickTimeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
    }
  }, [
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
    playClick
  ])

  return { ensureAudioContext }
}