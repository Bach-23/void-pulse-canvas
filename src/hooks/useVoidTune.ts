import { useRef, useCallback, useState } from 'react'

export type TuneData = {
  distance: number
  noteName: string
  isStable: boolean
}

export function useVoidTune(): {
  startTuner: () => Promise<void>
  stopTuner: () => Promise<void>
  tuneData: TuneData
} {
  const [tuneData, setTuneData] = useState<TuneData>({
    distance: 0,
    noteName: '--',
    isStable: false,
  })

  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const timerRef = useRef<number | null>(null)
  const distanceEmaRef = useRef<number>(0)

  // 軽量版Autocorrelation（自己相関）アルゴリズム
  const autoCorrelate = (buf: Float32Array, sampleRate: number): number => {
    let SIZE = buf.length
    let rms = 0
    for (let i = 0; i < SIZE; i++) {
      rms += buf[i] * buf[i]
    }
    rms = Math.sqrt(rms / SIZE)
    
    // 無音判定（RMSゲート）
    if (rms < 0.01) return -1 

    let r1 = 0, r2 = SIZE - 1, thres = 0.2
    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buf[i]) < thres) { r1 = i; break }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break }
    }

    buf = buf.subarray(r1, r2)
    SIZE = buf.length

    const c = new Float32Array(SIZE).fill(0)
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE - i; j++) {
        c[i] += buf[j] * buf[j + i]
      }
    }

    let d = 0
    while (c[d] > c[d + 1]) d++
    let maxval = -1, maxpos = -1
    for (let i = d; i < SIZE; i++) {
      if (c[i] > maxval) {
        maxval = c[i]
        maxpos = i
      }
    }
    let T0 = maxpos

    // 安全化1 & 2: ゼロ除算・境界外アクセスの完全防御
    if (!T0) return -1
    if (T0 <= 0 || T0 + 1 >= SIZE) {
      return sampleRate / T0
    }

    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1]
    const a = (x1 + x3 - 2 * x2) / 2
    const b = (x3 - x1) / 2
    if (a) T0 = T0 - b / (2 * a)

    return sampleRate / T0
  }

  const startTuner = useCallback(async () => {
    try {
      // 既に起動中の場合は重複処理を防ぐ
      if (audioCtxRef.current) return

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new window.AudioContext()
      audioCtxRef.current = ctx

      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser

      const source = ctx.createMediaStreamSource(stream)
      const gainNode = ctx.createGain()
      
      // 解析用に取り込むが出力は完全に無音にする
      gainNode.gain.value = 0

      source.connect(analyser)
      analyser.connect(gainNode)
      gainNode.connect(ctx.destination)

      const buffer = new Float32Array(analyser.fftSize)
      const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

      const detectPitch = () => {
        // 安全化3: 検出ループ停止時の完全防御
        if (!analyserRef.current || !audioCtxRef.current) {
          timerRef.current = null
          return
        }

        analyser.getFloatTimeDomainData(buffer)
        const hz = autoCorrelate(buffer, ctx.sampleRate)

        if (hz !== -1) {
          const noteNum = 12 * (Math.log(hz / 440) / Math.log(2)) + 69
          const roundedNote = Math.round(noteNum)
          const targetHz = 440 * Math.pow(2, (roundedNote - 69) / 12)
          const diff = hz - targetHz

          const octave = Math.floor(roundedNote / 12) - 1
          const noteName = noteStrings[roundedNote % 12] + octave

          // Dead zone の適用
          let targetDistance = 0
          if (Math.abs(diff) > 0.8) {
            targetDistance = Math.max(-1, Math.min(1, diff / 20))
          }

          // EMA平滑化係数の動的切り替え
          let alpha = 0.4
          if (Math.abs(targetDistance - distanceEmaRef.current) > 0.5) {
            alpha = 0.7
          } else if (Math.abs(targetDistance) < 0.1) {
            alpha = 0.25
          }

          distanceEmaRef.current = distanceEmaRef.current + alpha * (targetDistance - distanceEmaRef.current)

          setTuneData({
            distance: distanceEmaRef.current,
            noteName,
            isStable: Math.abs(distanceEmaRef.current) < 0.05
          })
        }

        // 負荷対策: requestAnimationFrameではなく、約15fps(66ms)で解析をループ
        timerRef.current = window.setTimeout(detectPitch, 66)
      }

      detectPitch()
    } catch (err) {
      console.error("Microphone access denied or error:", err)
    }
  }, [])

  const stopTuner = useCallback(async () => {
    // 1. 解析ループの完全停止
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // 2. マイクリソースの完全解放（LED消灯）
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // 3. 解析ノードの切断
    if (analyserRef.current) {
      analyserRef.current.disconnect()
      analyserRef.current = null
    }

    // 4. AudioContextの完全破棄（suspend禁止）
    if (audioCtxRef.current) {
      try {
        await audioCtxRef.current.close()
      } catch (e) {
        console.error("AudioContext close error:", e)
      }
      audioCtxRef.current = null
    }

    // 5. 状態と平滑化キャッシュのリセット
    distanceEmaRef.current = 0
    setTuneData({ distance: 0, noteName: '--', isStable: false })
  }, [])

  return { startTuner, stopTuner, tuneData }
}