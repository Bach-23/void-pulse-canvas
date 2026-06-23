import { useEffect, useRef, useCallback } from 'react'
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
}: UseAudioPulseProps) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const startTimeRef = useRef<number | null>(null)
  
  // Stateを完全に排除し、純粋な参照型（Ref）として時間を保持
  const elapsedTimeRef = useRef<number>(0)

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
      const whiteNoise = (Math.random() * 2 - 1) * 0.4
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
    let attack = 0.002
    let decay = 0.05
    let isExpAttack = false
    let filterType: BiquadFilterType = 'lowpass'
    let filterFreq = 6000
    let filterQ = 0
    let pitchDrop = false

    if (sound === 'Soft Tick') {
      type = 'sine'
      freq = intensity === 'High' ? 1480 : intensity === 'Mid' ? 980 : 740
      peakGain = intensity === 'High' ? 0.6 : intensity === 'Mid' ? 0.4 : 0.25
      attack = 0.0015
      decay = 0.025
      isExpAttack = true
      filterType = 'lowpass'
      filterFreq = 8000
      pitchDrop = false
    } else if (sound === 'Wood') {
      type = 'triangle'
      freq = intensity === 'High' ? 700 : intensity === 'Mid' ? 460 : 320
      peakGain = intensity === 'High' ? 0.5 : intensity === 'Mid' ? 0.34 : 0.22
      attack = 0.0028
      decay = 0.034
      filterType = 'lowpass'
      filterFreq = 1400
      filterQ = 0.2
      pitchDrop = false
    } else if (sound === 'Metal') {
      type = 'triangle'
      freq = intensity === 'High' ? 2000 : intensity === 'Mid' ? 1400 : 1000
      peakGain = intensity === 'High' ? 0.2 : intensity === 'Mid' ? 0.13 : 0.08
      attack = 0.002
      decay = 0.02
      filterType = 'lowpass'
      filterFreq = 3200
      filterQ = 0.3
      pitchDrop = false
    } else if (sound === 'Muted Key') {
      type = 'sine'
      freq = intensity === 'High' ? 400 : intensity === 'Mid' ? 300 : 200
      peakGain = intensity === 'High' ? 0.3 : intensity === 'Mid' ? 0.2 : 0.12
      attack = 0.003
      decay = 0.035
      isExpAttack = false
      filterType = 'lowpass'
      filterFreq = 500
      filterQ = 0.2
      pitchDrop = false
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

    if (isExpAttack) {
      gainNode.gain.setValueAtTime(0.0001, now)
      gainNode.gain.exponentialRampToValueAtTime(adjustedPeak, now + attack)
    } else {
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(adjustedPeak, now + attack)
    }

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
    highPassNode.frequency.setValueAtTime(700, now)
    highPassNode.Q.setValueAtTime(0.5, now)

    lowPassNode.type = 'lowpass'
    lowPassNode.frequency.setValueAtTime(
      intensity === 'High' ? 1400 : intensity === 'Mid' ? 1100 : 800, 
      now
    )
    lowPassNode.Q.setValueAtTime(0.7, now)

    const baseGain = intensity === 'High' ? 0.25 : intensity === 'Mid' ? 0.18 : 0.12
    const adjustedPeak = Math.max(0.0001, baseGain * volumeRatio)
    const attack = 0.025
    const decay = 0.05

    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(adjustedPeak, now + attack)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay)

    source.connect(highPassNode)
    highPassNode.connect(lowPassNode)
    lowPassNode.connect(gainNode)
    gainNode.connect(audioContext.destination)

    source.start(now)
    source.stop(now + attack + decay + 0.01)
  }, [createNoiseBuffer, volumeRatio])

  useEffect(() => {
    if (!isRunning) {
      startTimeRef.current = null
      elapsedTimeRef.current = 0 
      return
    }

    let schedulerTimerId: number
    let animationFrameId: number
    let nextNoteTime = -1
    let scheduledBeatIndex = 0

    const lookaheadMs = 25.0
    const scheduleAheadTime = 0.1 

    const scheduler = async () => {
      const ctx = await ensureAudioContext()
      
      if (nextNoteTime === -1) {
        nextNoteTime = ctx.currentTime + 0.05
        startTimeRef.current = nextNoteTime 
      }

      while (nextNoteTime < ctx.currentTime + scheduleAheadTime) {
        const currentBeatInBar = beatsPerBar === 1 ? 0 : scheduledBeatIndex % beatsPerBar
        const isBarHead = timeSignature !== 'Free' && currentBeatInBar === 0
        const intensity: BeatIntensity = timeSignature === 'Free' ? 'Mid' : (isBarHead ? 'High' : 'Mid')
        
        if (isAudioEnabled && volumeRatio > 0) {
          if (clickSound === 'Breath') {
            playBreathClick(ctx, nextNoteTime, intensity)
          } else {
            playOscillatorClick(ctx, nextNoteTime, intensity, clickSound)
          }

          if (clickSubdivision === 'Eighth') {
            const eighthTime = nextNoteTime + beatDuration / 2
            if (clickSound === 'Breath') {
              playBreathClick(ctx, eighthTime, 'Low')
            } else {
              playOscillatorClick(ctx, eighthTime, 'Low', clickSound)
            }
          }
        }

        nextNoteTime += beatDuration
        scheduledBeatIndex += 1
      }
      
      schedulerTimerId = window.setTimeout(scheduler, lookaheadMs)
    }

    const renderLoop = () => {
      const ctx = audioContextRef.current
      if (ctx && startTimeRef.current !== null) {
        const now = ctx.currentTime
        const elapsed = now - startTimeRef.current
        elapsedTimeRef.current = Math.max(0, elapsed)
      }
      animationFrameId = window.requestAnimationFrame(renderLoop)
    }

    scheduler()
    animationFrameId = window.requestAnimationFrame(renderLoop)

    return () => {
      window.clearTimeout(schedulerTimerId)
      window.cancelAnimationFrame(animationFrameId)
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
    ensureAudioContext,
    playBreathClick,
    playOscillatorClick,
  ])

  return { 
    ensureAudioContext, 
    getElapsedTime: useCallback(() => elapsedTimeRef.current, [])
  }
}