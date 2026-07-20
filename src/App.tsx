// App.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties } from 'react'

// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker?url'

import { useAudioPulse } from './hooks/useAudioPulse'
import { useVoidTune } from './hooks/useVoidTune'
import type {
  TimeSignature,
  ClickSound,
  ClickSubdivision,
  VisualEffect,
  SpaceMode,
  SavedSettings,
  DebugMetrics,
  PdfSlot,
  ViewMode,
  SwipeMode,
} from './types'

import {
  saveSlotToDB,
  loadSlotsFromDB,
  updateSlotMetadataInDB,
  clearPdfSlotsFromDB,
} from './utils/db'

import {
  STORAGE_KEY,
  clickSoundOptions,
  clickSubdivisionOptions,
  visualEffectOptions,
  spaceModeOptions,
  swipeModeOptions,
} from './utils/constants'

import {
  createInitialPdfSlots,
  loadSettings,
} from './utils/settings'

import './App.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// 💡 Reader Paradigm 移行: onTap の追加とタップ判定の実装
function useSwipe(
  onSwipeLeft: () => void, 
  onSwipeRight: () => void, 
  onTap: () => void, 
  cooldownMs: number = 400
) {
  const startPos = useRef<{ x: number; y: number; time: number } | null>(null)
  const isCooldown = useRef(false)

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!event.isPrimary) return
    const target = event.target as HTMLElement
    // 💡 純粋な入力要素のみを除外対象とし、空白エリアのタップを許容するよう修正
    if (target.closest('button, input, select, textarea')) return
    startPos.current = { x: event.clientX, y: event.clientY, time: Date.now() }
  }, [])

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || !startPos.current || isCooldown.current) {
      startPos.current = null
      return
    }

    const dx = event.clientX - startPos.current.x
    const dy = event.clientY - startPos.current.y
    const dt = Date.now() - startPos.current.time

    startPos.current = null

    if (dt > 1000) return

    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (absDx > 56 && absDx > absDy * 1.4) {
      isCooldown.current = true
      if (dx > 0) {
        onSwipeRight()
      } else {
        onSwipeLeft()
      }
      setTimeout(() => {
        isCooldown.current = false
      }, cooldownMs)
    } else if (absDx < 20 && absDy < 20 && dt < 500) {
      // 💡 遊び幅 20px: 実機でのブレを許容しつつ、ドラッグと明確に区別する
      onTap()
    }
  }, [onSwipeLeft, onSwipeRight, onTap, cooldownMs])

  return { onPointerDown, onPointerUp }
}

function App() {
  const [settings, setSettings] = useState<SavedSettings>(() => loadSettings())

  const [isRunning, setIsRunning] = useState(false)
  const [isAudioEnabled, setIsAudioEnabled] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isUiVisible, setIsUiVisible] = useState(true)

  const [, forceFrame] = useState(0)

  const [viewMode, setViewMode] = useState<ViewMode>('void')
  const [tunePhase, setTunePhase] = useState<'idle' | 'absorb' | 'expand'>('idle')
  const [isTuneUiVisible, setIsTuneUiVisible] = useState(false)
  
  const [referenceHz, setReferenceHz] = useState(440)
  const [selectedNote, setSelectedNote] = useState('A')
  const [isTonePlaying, setIsTonePlaying] = useState(false)

  const [isScoreImageLoaded, setIsScoreImageLoaded] = useState(false)
  const [scoreImageSource, setScoreImageSource] = useState(
    '/images/score-overlay-01.png',
  )
  const [scoreImageName, setScoreImageName] = useState('Default Score')

  const [pdfSlots, setPdfSlots] = useState<PdfSlot[]>(() =>
    createInitialPdfSlots(),
  )
  const [activePdfSlotIndex, setActivePdfSlotIndex] = useState(0)

  const pdfDataCacheRef = useRef<Map<number, ArrayBuffer>>(new Map())

  const [debugMetrics, setDebugMetrics] = useState<DebugMetrics>({
    targetMs: 0,
    actualMs: null,
    diffMs: null,
    maxDiffMs: 0,
    beatCount: 0,
  })

  const isRenderingPdfRef = useRef(false)
  const scoreCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const scoreImageRef = useRef<HTMLImageElement | null>(null)
  const scoreFileInputRef = useRef<HTMLInputElement | null>(null)
  const scorePdfInputRef = useRef<HTMLInputElement | null>(null)

  const {
    bpm,
    timeSignature,
    breathIntensity,
    smallRippleIntensity,
    largeRippleIntensity,
    clickSound,
    clickSubdivision,
    visualEffect,
    volume,
    isDebugEnabled,
    isScoreVisible,
    spaceMode,
    isBarAccentEnabled,
  } = settings

  const activePdfSlot = pdfSlots[activePdfSlotIndex]
  const isPdfLoaded = Boolean(activePdfSlot?.pdf)
  const pdfPageNumber = activePdfSlot?.pageNumber ?? 1
  const pdfPageCount = activePdfSlot?.pageCount ?? 0

  const activeScoreScale = activePdfSlot?.scoreScale ?? 72
  const activeScoreX = activePdfSlot?.scoreX ?? 0
  const activeScoreY = activePdfSlot?.scoreY ?? 0
  const activeScoreOpacity = activePdfSlot?.scoreOpacity ?? 70
  const activeScoreWhiteCut = activePdfSlot?.scoreWhiteCut ?? 80
  const activeScoreInkBoost = activePdfSlot?.scoreInkBoost ?? 30
  const activeSwipeMode = activePdfSlot?.swipeMode ?? 'Score'

  const updateSettings = (nextSettings: Partial<SavedSettings>) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      ...nextSettings,
    }))
  }

  const updatePdfSlot = (slotIndex: number, nextSlot: Partial<PdfSlot>) => {
    setPdfSlots((currentSlots) =>
      currentSlots.map((slot, index) =>
        index === slotIndex ? { ...slot, ...nextSlot } : slot,
      ),
    )
  }

  const updateActiveSlotSettings = (updates: Partial<PdfSlot>) => {
    updatePdfSlot(activePdfSlotIndex, updates)
    updateSlotMetadataInDB(activePdfSlotIndex, updates).catch((err) => {
      console.error('Failed to update slot metadata in DB:', err)
    })
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

  const volumeRatio = useMemo(() => {
    return Math.min(Math.max(volume, 0), 100) / 100
  }, [volume])

  const scoreOpacityRatio = useMemo(() => {
    return viewMode === 'plain' 
      ? 1 
      : Math.min(Math.max(activeScoreOpacity, 0), 100) / 100
  }, [activeScoreOpacity, viewMode])

  const scoreScaleRatio = useMemo(() => {
    return Math.min(Math.max(activeScoreScale, 20), 160) / 100
  }, [activeScoreScale])

  const spaceInlineStyle = useMemo<CSSProperties>(() => {
    if (spaceMode === 'Void') {
      return {
        backgroundImage:
          'linear-gradient(rgba(5, 6, 8, 0.08), rgba(5, 6, 8, 0.42)), url("/images/void-bg-01.jpg")',
        backgroundColor: '#050608',
      }
    }

    if (spaceMode === 'Blue') {
       return {
        backgroundImage:
          'radial-gradient(circle at 50% 40%, rgba(22, 40, 66, 0.95), rgba(4, 8, 16, 1) 68%)',
        backgroundColor: '#040810',
      }
    }

    // Default to Dark
    return {
      backgroundImage:
        'radial-gradient(circle at 50% 45%, rgba(35, 38, 46, 0.46), rgba(5, 6, 8, 1) 62%)',
      backgroundColor: '#050608',
    }
  }, [spaceMode])

  const { ensureAudioContext, getElapsedTime } = useAudioPulse({
    isRunning,
    isAudioEnabled,
    beatDuration,
    beatsPerBar,
    timeSignature,
    clickSound,
    clickSubdivision,
    volumeRatio,
    isBarAccentEnabled,
  })

  const { startTuner, stopTuner, tuneData } = useVoidTune(referenceHz)

  useEffect(() => {
    if (viewMode === 'tune' && !isTonePlaying) {
      void startTuner()
    } else {
      void stopTuner()
    }
  }, [viewMode, isTonePlaying, startTuner, stopTuner])

  const oscAudioCtxRef = useRef<AudioContext | null>(null)
  const oscNodeRef = useRef<OscillatorNode | null>(null)

  useEffect(() => {
    if (isTonePlaying && viewMode === 'tune') {
      if (!oscAudioCtxRef.current) {
        oscAudioCtxRef.current = new window.AudioContext()
      }
      
      const ctx = oscAudioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      const noteOffsets: Record<string, number> = { 'A': 0, 'B♭': 1, 'B': 2, 'C': 3 }
      const semitones = noteOffsets[selectedNote] || 0
      const freq = referenceHz * Math.pow(2, semitones / 12)

      osc.type = 'sine'
      osc.frequency.value = freq
      
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1)

      osc.connect(gain)
      gain.connect(ctx.destination)
  
      osc.start()
      oscNodeRef.current = osc
      
      return () => {
        const activeCtx = oscAudioCtxRef.current
        const currentOsc = oscNodeRef.current
        
        if (currentOsc && activeCtx) {
          try {
            currentOsc.stop()
            currentOsc.disconnect()
          } catch (e) {}
          oscNodeRef.current = null
        }
      }
    }
  }, [isTonePlaying, viewMode, referenceHz, selectedNote])

  useEffect(() => {
    if (!isRunning && viewMode !== 'tune') return
    let frameId: number
    const loop = () => {
      forceFrame(n => n + 1)
      frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [isRunning, viewMode])

  const elapsedTime = getElapsedTime()

  const beatIndex = elapsedTime > 0 ? Math.floor(elapsedTime / beatDuration) : 0
  const currentBeat = beatsPerBar === 1 ? 0 : beatIndex % beatsPerBar

  const sweepProgress = elapsedTime > 0 ? (elapsedTime % (beatDuration * beatsPerBar)) / (beatDuration * beatsPerBar) : 0
  const sweepLeft = timeSignature === 'Free' ? 7 : 7 + sweepProgress * 86

  const getGhostLifeTime = (isBar: boolean) => {
    return isBar ? 7.0 : 4.0;
  }

  const ghosts = useMemo<{
    id: number
    left: number
    isBar: boolean
    progress: number
  }[]>(() => {
    if (!isRunning || elapsedTime === 0 || visualEffect !== 'Ghost Sweep') return []

    const generated: {
      id: number
      left: number
      isBar: boolean
      progress: number
    }[] = []
 
    const exactBeat = elapsedTime / beatDuration
    let i = beatIndex

    const maxSearchBeats = Math.ceil(7.0 / beatDuration) + 1

    while (i > beatIndex - maxSearchBeats && i >= 0) {
      const beatInBar = beatsPerBar === 1 ? 0 : i % beatsPerBar
      const isBar = timeSignature !== 'Free' && beatInBar === 0
      
      const ageSeconds = (exactBeat - i) * beatDuration
      const lifeTime = getGhostLifeTime(isBar)
      const progress = ageSeconds / lifeTime

      if (progress <= 1) {
        if (timeSignature === 'Free') {
          generated.push({ id: i, left: 7, isBar: false, progress })
          generated.push({ id: i + 1000000, left: 93, isBar: false, progress })
        } else {
          generated.push({
            id: i,
            left: 7 + (beatInBar / beatsPerBar) * 86,
            isBar,
            progress,
          })
          if (isBar) {
            generated.push({ id: i + 1000000, left: 93, isBar, progress })
          }
        }
      }
      i -= 1
    }
    return generated
  }, [elapsedTime, beatIndex, visualEffect, isRunning, beatsPerBar, timeSignature, beatDuration])

  const turnAudioOn = async () => {
    await ensureAudioContext()
    setIsAudioEnabled(true)
  }

  const turnAudioOff = () => {
    setIsAudioEnabled(false)
  }

  const executeZanshinTransition = useCallback(async () => {
    if (tunePhase !== 'idle') return

    setIsTonePlaying(false)
    setIsTuneUiVisible(false)
    
    await new Promise(requestAnimationFrame)
    setTunePhase('absorb')

    setTimeout(() => {
       void stopTuner()
      setTunePhase('expand')
    }, 300)

    setTimeout(() => {
      setViewMode('void')
      setTunePhase('idle')
      setIsRunning(false)
      turnAudioOff()
    }, 800)
  }, [stopTuner, tunePhase])

  const toggleFullscreen = async () => {
    const docEl = document.documentElement as any
    const doc = document as any

    const requestFullscreen = docEl.requestFullscreen || docEl.webkitRequestFullscreen
    const exitFullscreen = doc.exitFullscreen || doc.webkitExitFullscreen
    const isFull = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement)

    try {
      if (!isFull) {
        if (requestFullscreen) await requestFullscreen.call(docEl)
      } else {
        if (exitFullscreen) await exitFullscreen.call(doc)
      }
    } catch (error) {
      console.error('Fullscreen API error:', error)
    }
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

    if (viewMode === 'plain') {
      return
    }

    const imageData = context.getImageData(0, 0, width, height)
    const data = imageData.data

    const paperCutRatio = Math.min(Math.max(activeScoreWhiteCut, 50), 95) / 100
    const inkLiftRatio = Math.min(Math.max(activeScoreInkBoost, 0), 60) / 60

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

  const loadScoreImageFromDataUrl = (dataUrl: string, fileName: string) => {
    setScoreImageName(fileName)
    setIsScoreImageLoaded(false)
    setScoreImageSource(dataUrl)
    updateSettings({ isScoreVisible: true })
  }

  const resetPdfSlots = () => {
    setPdfSlots(createInitialPdfSlots())
    setActivePdfSlotIndex(0)
    pdfDataCacheRef.current.clear()
    clearPdfSlotsFromDB().catch((err) => {
      console.error('Failed to clear PDF slots from DB:', err)
    })
  }

  const handleScoreFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return

    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string') return

      resetPdfSlots()
      loadScoreImageFromDataUrl(reader.result, file.name)
    }

    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const renderPdfPage = async (
    slotIndex: number,
    pageNumber: number,
    pdfOverride?: any,
    fileNameOverride?: string,
  ) => {
    if (isRenderingPdfRef.current) return
    isRenderingPdfRef.current = true

    try {
      const slot = pdfSlots[slotIndex]
      const pdf = pdfOverride ?? slot?.pdf

      if (!pdf) return

      console.log(`[PDF Debug] 2. getPage START for page ${pageNumber}`);
      const totalPages = pdf.numPages
      const safePageNumber = Math.min(Math.max(pageNumber, 1), totalPages)
      const page = await pdf.getPage(safePageNumber).catch((e: any) => {
        console.error(`[PDF Debug] 2. getPage FAILED for page ${safePageNumber}:`, e);
        throw e;
      })
      console.log(`[PDF Debug] 2. getPage SUCCESS for page ${safePageNumber}`);

      const viewport = page.getViewport({ scale: 2 })

      const temporaryCanvas = document.createElement('canvas')
      const temporaryContext = temporaryCanvas.getContext('2d')

      if (!temporaryContext) return

      temporaryCanvas.width = Math.floor(viewport.width)
      temporaryCanvas.height = Math.floor(viewport.height)

      console.log(`[PDF Debug] 3. page.render START with viewport:`, { width: viewport.width, height: viewport.height });
      await page.render({
         canvasContext: temporaryContext,
        viewport,
      }).promise.catch((e: any) => {
         console.error(`[PDF Debug] 3. page.render FAILED:`, e);
         throw e;
      })
      console.log(`[PDF Debug] 4. page.render COMPLETED`);

      const dataUrl = temporaryCanvas.toDataURL('image/png')
      console.log(`[PDF Debug] 5. dataURL Generated (length: ${dataUrl.length})`);
      
      const fileName = fileNameOverride ?? slot?.fileName ?? 'PDF Score'

      updatePdfSlot(slotIndex, {
        pdf,
        fileName,
        pageNumber: safePageNumber,
        pageCount: totalPages,
      })

      updateSlotMetadataInDB(slotIndex, { pageNumber: safePageNumber }).catch((err) => {
        console.error('Failed to update PDF page in DB:', err)
      })

      loadScoreImageFromDataUrl(
        dataUrl,
        `Slot ${slotIndex + 1}: ${fileName} / page ${safePageNumber}`,
      )
    } finally {
      isRenderingPdfRef.current = false
    }
  }

  const handleScorePdfChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') return

    try {
      console.log(`[PDF Debug] 1. getDocument START for file: ${file.name} (${file.size} bytes). Using wasmUrl: '/wasm/' to initialize OpenJPEG.`);
      const arrayBuffer = await file.arrayBuffer()
      const bufferForDb = arrayBuffer.slice(0)

      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        wasmUrl: '/wasm/',
      }).promise.catch((e: any) => {
        console.error(`[PDF Debug] 1. getDocument FAILED:`, e);
        throw e;
      })
      console.log(`[PDF Debug] 1. getDocument SUCCESS. Total pages: ${pdf.numPages}. OpenJPEG wasm loaded successfully.`);

      updatePdfSlot(activePdfSlotIndex, {
        pdf,
        fileName: file.name,
        pageNumber: 1,
        pageCount: pdf.numPages,
      })

       pdfDataCacheRef.current.set(activePdfSlotIndex, bufferForDb.slice(0))

      await renderPdfPage(activePdfSlotIndex, 1, pdf, file.name)

      saveSlotToDB(
        activePdfSlotIndex, 
        bufferForDb, 
        file.name, 
        1, 
        pdf.numPages,
        pdfSlots[activePdfSlotIndex]
      ).catch((err) => {
        console.error('Failed to save PDF to DB:', err)
      })
    } catch (error) {
      console.error('Failed to load PDF score:', error)
    } finally {
      event.target.value = ''
    }
  }

  const showPreviousPdfPage = () => {
    if (!isPdfLoaded) return
    void renderPdfPage(activePdfSlotIndex, pdfPageNumber - 1)
  }

  const showNextPdfPage = () => {
    if (!isPdfLoaded) return
    void renderPdfPage(activePdfSlotIndex, pdfPageNumber + 1)
  }

  const handleNextPage = useCallback(() => {
    if (isPdfLoaded && pdfPageNumber < pdfPageCount && !isRenderingPdfRef.current) {
      showNextPdfPage()
    }
  }, [isPdfLoaded, pdfPageNumber, pdfPageCount])

  const handlePrevPage = useCallback(() => {
    if (isPdfLoaded && pdfPageNumber > 1 && !isRenderingPdfRef.current) {
      showPreviousPdfPage()
    }
  }, [isPdfLoaded, pdfPageNumber])

  const activatePdfSlot = async (slotIndex: number) => {
    setActivePdfSlotIndex(slotIndex)

    const slot = pdfSlots[slotIndex]

    if (slot?.pdf) {
      void renderPdfPage(slotIndex, slot.pageNumber)
      return
    }

    if (pdfDataCacheRef.current.has(slotIndex)) {
      try {
        console.log(`[PDF Debug] 1. getDocument START from cache for slot ${slotIndex}. Using wasmUrl: '/wasm/' to initialize OpenJPEG.`);
        const buffer = pdfDataCacheRef.current.get(slotIndex)!
        const pdf = await pdfjsLib.getDocument({
          data: buffer.slice(0),
          wasmUrl: '/wasm/',
        }).promise.catch((e: any) => {
          console.error(`[PDF Debug] 1. getDocument FAILED from cache:`, e);
          throw e;
        })
        console.log(`[PDF Debug] 1. getDocument SUCCESS from cache. Total pages: ${pdf.numPages}. OpenJPEG wasm loaded successfully.`);
        
        updatePdfSlot(slotIndex, { pdf })
        void renderPdfPage(slotIndex, slot.pageNumber, pdf, slot.fileName)
      } catch (error) {
        console.error(`Failed to parse cached PDF for slot ${slotIndex}`, error)
      }
    }
  }

  // 💡 Reader Paradigm 移行: Timer処理の分離
  const hideTimerIdRef = useRef<number | undefined>(undefined)

  const showUi = useCallback(() => {
    setIsUiVisible(true)

    if (hideTimerIdRef.current) {
      window.clearTimeout(hideTimerIdRef.current)
    }

    if (viewMode === 'tune' && isTonePlaying) {
      return
    }

    const timeoutMs = viewMode === 'tune' ? 2000 : 3000

    hideTimerIdRef.current = window.setTimeout(() => {
      setIsUiVisible(false)
    }, timeoutMs)
  }, [viewMode, isTonePlaying])

  const hideUi = useCallback(() => {
    setIsUiVisible(false)
    if (hideTimerIdRef.current) {
      window.clearTimeout(hideTimerIdRef.current)
      hideTimerIdRef.current = undefined
    }
  }, [])

  const toggleUi = useCallback(() => {
    if (isUiVisible) {
      hideUi()
    } else {
      showUi()
    }
  }, [isUiVisible, hideUi, showUi])

  const swipeHandlers = useSwipe(
    () => { // onSwipeLeft (指を左へ弾く → 画面は右へ進む)
      if (activeSwipeMode === 'Book') {
        handlePrevPage()
      } else {
        handleNextPage()
      }
    },
    () => { // onSwipeRight (指を右へ弾く → 画面は左へ戻る)
      if (activeSwipeMode === 'Book') {
        handleNextPage()
      } else {
        handlePrevPage()
      }
    },
    () => {
      // 💡 Reader Paradigm: タップ（クリック）でUIをトグルする
      toggleUi()
    },
    400
  )

  useEffect(() => {
    let isMounted = true

    const restorePdfsFromDB = async () => {
      try {
        const savedSlots = await loadSlotsFromDB()
      
        if (!isMounted || savedSlots.length === 0) return

        const newSlots = createInitialPdfSlots()
        let activePdfToRender: any = null
        let activePageToRender = 1
        let activeFileName = ''

        for (const saved of savedSlots) {
          pdfDataCacheRef.current.set(saved.slotIndex, saved.pdfData)

          if (saved.slotIndex === 0) {
             try {
              console.log(`[PDF Debug] 1. getDocument START from DB restore for slot 0. Using wasmUrl: '/wasm/' to initialize OpenJPEG.`);
              const pdf = await pdfjsLib.getDocument({
                data: saved.pdfData.slice(0),
                wasmUrl: '/wasm/',
              }).promise
              console.log(`[PDF Debug] 1. getDocument SUCCESS from DB restore. OpenJPEG wasm loaded successfully.`);
              
              newSlots[saved.slotIndex] = {
                pdf,
                fileName: saved.fileName,
                pageNumber: saved.pageNumber,
                pageCount: saved.pageCount,
                scoreScale: saved.scoreScale ?? 72,
                scoreX: saved.scoreX ?? 0,
                scoreY: saved.scoreY ?? 0,
                scoreOpacity: saved.scoreOpacity ?? 70,
                scoreWhiteCut: saved.scoreWhiteCut ?? 80,
                scoreInkBoost: saved.scoreInkBoost ?? 30,
                swipeMode: saved.swipeMode ?? 'Score',
              }
              activePdfToRender = pdf
              activePageToRender = saved.pageNumber
              activeFileName = saved.fileName
            } catch (err) {
               console.error(`[PDF Debug] 1. getDocument FAILED from DB restore:`, err)
              newSlots[saved.slotIndex] = {
                pdf: null,
                fileName: saved.fileName,
                pageNumber: saved.pageNumber,
                pageCount: saved.pageCount,
                scoreScale: saved.scoreScale ?? 72,
                scoreX: saved.scoreX ?? 0,
                scoreY: saved.scoreY ?? 0,
                scoreOpacity: saved.scoreOpacity ?? 70,
                scoreWhiteCut: saved.scoreWhiteCut ?? 80,
                scoreInkBoost: saved.scoreInkBoost ?? 30,
                swipeMode: saved.swipeMode ?? 'Score',
              }
            }
          } else {
            newSlots[saved.slotIndex] = {
              pdf: null,
              fileName: saved.fileName,
              pageNumber: saved.pageNumber,
              pageCount: saved.pageCount,
              scoreScale: saved.scoreScale ?? 72,
              scoreX: saved.scoreX ?? 0,
              scoreY: saved.scoreY ?? 0,
              scoreOpacity: saved.scoreOpacity ?? 70,
              scoreWhiteCut: saved.scoreWhiteCut ?? 80,
              scoreInkBoost: saved.scoreInkBoost ?? 30,
              swipeMode: saved.swipeMode ?? 'Score',
            }
          }
        }

        if (!isMounted) return

        setPdfSlots(newSlots)

        if (activePdfToRender) {
          void renderPdfPage(
            0,
             activePageToRender,
            activePdfToRender,
            activeFileName
          )
        }
      } catch (err) {
        console.error('Failed to restore PDFs from IndexedDB', err)
      }
    }

    restorePdfsFromDB()

    return () => {
      isMounted = false
    }
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const image = new Image()

    image.onload = () => {
      scoreImageRef.current = image
      setIsScoreImageLoaded(true)
    }

    image.onerror = () => {
      scoreImageRef.current = null
      setIsScoreImageLoaded(false)
    }

    image.src = scoreImageSource
  }, [scoreImageSource])

  useEffect(() => {
     if (!isScoreImageLoaded) return

    const firstFrameId = window.requestAnimationFrame(() => {
      renderScoreCanvas()

      window.requestAnimationFrame(() => {
        renderScoreCanvas()
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrameId)
    }
  }, [
    isScoreVisible,
    isScoreImageLoaded,
    activeScoreWhiteCut,
    activeScoreInkBoost,
    scoreImageSource,
    viewMode,
  ])

  // 💡 Reader Paradigm 移行: 初期化とモード変更時の表示保証
  useEffect(() => {
    showUi()
    return () => {
      if (hideTimerIdRef.current) window.clearTimeout(hideTimerIdRef.current)
    }
  }, [showUi])

  // 💡 Reader Paradigm 移行: UI表示中のみ防衛線（タイマー延長）を張る
  useEffect(() => {
    if (!isUiVisible) return

    const resetTimer = () => showUi()

    window.addEventListener('mousemove', resetTimer)
    window.addEventListener('keydown', resetTimer)

    return () => {
      window.removeEventListener('mousemove', resetTimer)
      window.removeEventListener('keydown', resetTimer)
    }
  }, [isUiVisible, showUi])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any
      const isFull = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement)
      setIsFullscreen(isFull)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    if (isRunning && beatIndex > 0) {
      setDebugMetrics((prev) => ({
        ...prev,
        beatCount: beatIndex,
      }))
    }
  }, [beatIndex, isRunning])

  const tuneCanvasBrightness = Math.max(0.1, 1 - Math.abs(tuneData.distance))
  const tuneY = -tuneData.distance * 150
  const tuneTime = performance.now() / 1000
  const centerWobble = tuneData.isStable ? (Math.sin(tuneTime * 0.35) * 3 + Math.sin(tuneTime * 0.5) * 0.15) : 0
  const finalTuneY = tuneY + centerWobble

  // 💡 Beacon Sweep 専用描画レイヤー関数
  const renderBeaconSweep = () => {
    if (!isRunning || visualEffect !== 'Beacon Sweep') return null;

    const exactBeat = elapsedTime > 0 ? elapsedTime / beatDuration : 0;
    const beatProgress = exactBeat % 1;
    
    // Freeや特殊拍子はSquare(4拍子)として扱う
    const isFree = timeSignature === 'Free';
    const effectiveBeatsPerBar = isFree ? 4 : beatsPerBar; 
    const currentBeatInBar = Math.floor(exactBeat) % effectiveBeatsPerBar;
    
    // 拍頭強調判定（アクセント有効かつ小節頭の場合のみさらに強く光る）
    const isFirstBeat = !isFree && isBarAccentEnabled && currentBeatInBar === 0;

    const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

    const beatDecay = Math.pow(1 - beatProgress, 1.6);
    const beatEnergy = beatDecay;

    const accentBoost = isFirstBeat ? 1.12 : 1.0;
    const frameEnergy = clamp01(beatEnergy * accentBoost);
    const ghostEnergy = clamp01(beatEnergy * accentBoost);
    
    let pathD = '';
    
    // 💡 Path Ghost Head ロジック: 先頭と尾の座標を独立して計算
    let headX = 0, headY = 0;
    let tailX = 0, tailY = 0;
    
    // 残像の最大長（辺の15%）と、拍頭で生まれる最小のTime Slice（辺の1%）
    const tailLength = 0.15;
    const minSlice = 0.01; 
    
    let tHead = beatProgress;
    const tTail = Math.max(0, beatProgress - tailLength);

    // 💡 拍頭ゼロ長回避（Safari対策＆視覚的エッジ担保）
    // 常に尾から最低限の長さ(minSlice)を前方に確保することで、拍頭の瞬間に短い切片として顕現させる
    if (tHead - tTail < minSlice) {
      tHead = Math.min(1, tTail + minSlice);
    }

    // 図形マッピングロジック
    if (effectiveBeatsPerBar === 2) {
      // 2/4: Line (往復)
      pathD = 'M 15 50 L 85 50';
      if (currentBeatInBar === 0) {
        headX = 15 + 70 * tHead; headY = 50;
        tailX = 15 + 70 * tTail; tailY = 50;
      } else {
        headX = 85 - 70 * tHead; headY = 50;
        tailX = 85 - 70 * tTail; tailY = 50;
      }
    } else if (effectiveBeatsPerBar === 3) {
      // 3/4: Triangle (小節頭を上頂点に置く)
      pathD = 'M 50 20 L 80 80 L 20 80 Z';
      if (currentBeatInBar === 0) {
        headX = 50 + 30 * tHead; headY = 20 + 60 * tHead;
        tailX = 50 + 30 * tTail; tailY = 20 + 60 * tTail;
      } else if (currentBeatInBar === 1) {
        headX = 80 - 60 * tHead; headY = 80;
        tailX = 80 - 60 * tTail; tailY = 80;
      } else {
        headX = 20 + 30 * tHead; headY = 80 - 60 * tHead;
        tailX = 20 + 30 * tTail; tailY = 80 - 60 * tTail;
      }
    } else {
      // 4/4 or Free: Square
      pathD = 'M 20 20 L 80 20 L 80 80 L 20 80 Z';
      if (currentBeatInBar === 0) {
        headX = 20 + 60 * tHead; headY = 20;
        tailX = 20 + 60 * tTail; tailY = 20;
      } else if (currentBeatInBar === 1) {
        headX = 80; headY = 20 + 60 * tHead;
        tailX = 80; tailY = 20 + 60 * tTail;
      } else if (currentBeatInBar === 2) {
        headX = 80 - 60 * tHead; headY = 80;
        tailX = 80 - 60 * tTail; tailY = 80;
      } else {
        headX = 20; headY = 80 - 60 * tHead;
        tailX = 20; tailY = 80 - 60 * tTail;
      }
    }

    // 枠線の発光ロジック
    const pathOpacity = 0.14 + 0.36 * frameEnergy;
    const pathStrokeWidth = 0.45 + 0.35 * frameEnergy;
    const pathGlow =
      frameEnergy > 0.04
        ? `drop-shadow(0 0 ${1.2 + 2.2 * frameEnergy}px rgba(255, 255, 255, ${0.18 + 0.22 * frameEnergy}))`
        : 'none';

    // 💡 尾から先端へ向けた発光ロジック（白丸廃止、適度な太さへ調整）
    const ghostOpacity = 0.6 + 0.4 * ghostEnergy;
    const ghostStrokeWidth = 1.35 + 0.85 * ghostEnergy;
    const ghostGlow =
      ghostEnergy > 0.04
        ? `drop-shadow(0 0 ${1.6 + 3.0 * ghostEnergy}px rgba(255, 255, 255, ${0.22 + 0.34 * ghostEnergy}))`
        : 'drop-shadow(0 0 1px rgba(255, 255, 255, 0.18))';

    return (
      <div className="beacon-container">
        <svg className="beacon-svg" viewBox="0 0 100 100">
          <defs>
            <linearGradient 
              id="ghostTailGradient" 
              x1={tailX} y1={tailY} 
              x2={headX} y2={headY} 
              gradientUnits="userSpaceOnUse"
            >
              {/* iOS Safari対策: rgba()ではなくstopColorとstopOpacityで完全分離 */}
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={1} />
            </linearGradient>
          </defs>
          <path 
            className="beacon-path" 
            d={pathD} 
            stroke={`rgba(255, 255, 255, ${pathOpacity})`}
            strokeWidth={pathStrokeWidth}
            style={{ filter: pathGlow }}
          />
          <line 
            x1={tailX} y1={tailY}
            x2={headX} y2={headY}
            stroke="url(#ghostTailGradient)"
            strokeWidth={ghostStrokeWidth}
            strokeLinecap="round"
            opacity={ghostOpacity}
            style={{ filter: ghostGlow }}
          />
        </svg>
      </div>
    );
  };

  return (
    <main
      className={`app ${isUiVisible ? 'ui-visible' : 'ui-hidden'} score-${viewMode}-mode phase-${tunePhase}`}
      {...swipeHandlers}
      style={
        {
          '--beat-duration': `${beatDuration}s`,
          '--large-ripple-duration': `${largeRippleDuration}s`,
          '--breath-intensity': breathIntensity / 100,
          '--small-ripple-intensity': smallRippleIntensity / 100,
          '--large-ripple-intensity': largeRippleIntensity / 100,
          '--score-opacity': scoreOpacityRatio,
          '--score-scale': scoreScaleRatio,
          '--score-x': `${activeScoreX}px`,
          '--score-y': `${activeScoreY}px`,
          '--tune-y': `${finalTuneY}px`,
          '--tune-brightness': tuneCanvasBrightness
        } as CSSProperties
      }
    >
      <input
        ref={scoreFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={handleScoreFileChange}
      />

      <input
        ref={scorePdfInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleScorePdfChange}
      />

      {/* 💡 CSSのクラス名は変更せず、変数名とUI上の意味だけをSpaceへ置換 */}
      <div
        className={`background ${isRunning ? 'is-running' : 'is-paused'}`}
        style={spaceInlineStyle}
      />

      <div 
        className={`tune-container ${tunePhase} ${viewMode === 'tune' ? 'is-visible' : 'is-hidden'}`}
      >
        <div className="tune-side-line left" />
        <div className="tune-side-line right" />
        <div className="tune-center-line" />
        
        <div className="tune-note-display">
           {tuneData.noteName !== '--' && <span>{tuneData.noteName}</span>}
        </div>

        <div className="tune-particle-layer">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`p-${i}`} className="tune-particle" style={{ animationDelay: `${i * 0.4}s` }} />
          ))}
        </div>
      </div>

      <div
        className="score-overlay"
        style={{
          opacity: isScoreVisible && viewMode !== 'tune' ? (viewMode === 'plain' ? 1 : undefined) : 0,
        }}
      >
        <canvas ref={scoreCanvasRef} />
      </div>

      {isRunning && visualEffect === 'Ripple' && (
        <>
          <div key={`small-${beatIndex}`} className="small-ripple" />
          {timeSignature !== 'Free' && (
            <div key={`large-${Math.floor(beatIndex / beatsPerBar)}`} className="large-ripple" />
          )}
        </>
      )}

      {/* 💡 ここに Beacon Sweep の呼び出しを追加しております */}
      {renderBeaconSweep()}

      {isRunning && visualEffect === 'Ghost Sweep' && (
        <div className="sweep-container">
          <div className="structural-pillar-base" style={{ left: '7%' }} />
          <div className="structural-pillar-base" style={{ left: '93%' }} />

          {timeSignature !== 'Free' && (
            <>
              <div
                key={`pillar-pulse-left-${Math.floor(beatIndex / beatsPerBar)}`}
                className="structural-pillar-pulse"
                style={{ left: '7%' }}
              />
              <div
                key={`pillar-pulse-right-${Math.floor(beatIndex / beatsPerBar)}`}
                className="structural-pillar-pulse"
                style={{ left: '93%' }}
              />

              <div
                key="sweep-line-main"
                className="sweep-line"
                 style={{
                  left: `${sweepLeft}%`,
                  animation: 'none'
                }}
              />
            </>
          )}

          {ghosts.map((g) => {
            const baseOpacity = g.isBar ? 1 : 0.75;
            const fadeCurve = g.isBar ? Math.pow(1 - g.progress, 2.5) : Math.pow(1 - g.progress, 6.0);

            return (
              <div
                key={g.id}
                className="ghost-sweep-ghost"
                style={{
                  left: `${g.left}%`,
                  opacity: Math.max(0, baseOpacity * fadeCurve),
                  transform: `translateX(-50%) scaleX(${1 + g.progress * (g.isBar ? 2.5 : 1.5)})`,
                  filter: `blur(${g.progress * (g.isBar ? 6 : 4)}px)`,
                  animation: 'none'
                }}
              />
            )
          })}
        </div>
      )}

      <section className="hero ui-panel">
        <p className="eyebrow">Project2026 / Void</p>

        <h1>Void Pulse Canvas</h1>

        <p className="subtitle">
           Tune the space before the sound.
        </p>

        <div className={`standard-ui-controls ${viewMode !== 'tune' ? 'is-visible' : 'is-hidden'}`}>
          <div className="primary-action-row">
            <button
              className={`pulse-button ${isRunning ? 'is-active' : ''}`}
              onClick={() => setIsRunning(!isRunning)}
            >
              {isRunning ? 'Pulse Stop' : 'Pulse Start'}
            </button>

            {!isRunning && (
              <button
                className="pulse-button"
                style={{ marginLeft: '16px' }}
                onClick={() => {
                   setViewMode('tune')
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      setIsTuneUiVisible(true)
                    })
                  })
                }}
              >
                Void Tune
              </button>
            )}
          </div>
        </div>

        <div 
          className={`tune-ui-controls ${viewMode === 'tune' && isTuneUiVisible ? 'is-visible' : 'is-hidden'}`}
        >
          <div className="secondary-controls">
            <label className="compact-control">
              <span>Hz</span>
              <input
                type="number"
                min="430"
                max="450"
                value={referenceHz}
                onChange={(e) => setReferenceHz(Number(e.target.value))}
              />
            </label>

            <label className="compact-control sound-control">
              <span>Note</span>
              <select
                value={selectedNote}
                onChange={(e) => setSelectedNote(e.target.value)}
              >
                <option value="A">A</option>
                <option value="B♭">B♭</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>

            <div className="audio-switch-group">
              <button
                className={`audio-switch ${isTonePlaying ? 'is-active' : ''}`}
                onClick={() => setIsTonePlaying(true)}
              >
                Sound ON
              </button>
              
              <button
                 className={`audio-switch ${!isTonePlaying ? 'is-active' : ''}`}
                onClick={() => setIsTonePlaying(false)}
              >
                Sound OFF
              </button>
            </div>
          </div>

          <div className="primary-action-row" style={{ marginTop: '24px' }}>
            <button
              className={`pulse-button is-active`}
              onClick={executeZanshinTransition}
            >
              {tuneData.isStable ? 'Enter Void' : 'Force Enter Void'}
            </button>
          </div>
        </div>

        <div className={`standard-ui-controls ${viewMode !== 'tune' ? 'is-visible' : 'is-hidden'}`}>
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
              <span>BAR ACCENT</span>
              <select
                 value={isBarAccentEnabled ? 'On' : 'Off'}
                onChange={(event) =>
                  updateSettings({
                    isBarAccentEnabled: event.target.value === 'On',
                  })
               }
              >
                <option value="On">On</option>
                <option value="Off">Off</option>
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
              <span>Click</span>
              <select
                value={clickSubdivision}
                 onChange={(event) =>
                  updateSettings({
                    clickSubdivision: event.target.value as ClickSubdivision,
                  })
                }
               >
                {clickSubdivisionOptions.map((subdivision) => (
                  <option key={subdivision} value={subdivision}>
                    {subdivision}
                  </option>
                ))}
               </select>
            </label>

            <label className="compact-control sound-control">
              <span>SPACE</span>
              <select
                value={spaceMode}
                onChange={(event) =>
                  updateSettings({
                    spaceMode: event.target.value as SpaceMode,
                  })
                }
              >
                {spaceModeOptions.map((mode) => (
                   <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>

            <label className="compact-control sound-control">
               <span>Effect</span>
              <select
                value={visualEffect}
                onChange={(event) =>
                  updateSettings({
                    visualEffect: event.target.value as VisualEffect,
                   })
                }
              >
                {visualEffectOptions.map((effect) => (
                  <option key={effect} value={effect}>
                     {effect}
                  </option>
                ))}
              </select>
            </label>

            <label className="compact-control sound-control">
              <span>VIEW</span>
              <select
                value={viewMode}
                onChange={(event) =>
                  setViewMode(event.target.value as ViewMode)
                }
              >
                <option value="void">Void</option>
                <option value="plain">Plain</option>
              </select>
            </label>

            <label className="compact-control sound-control">
              <span>SWIPE</span>
              <select
                value={activeSwipeMode}
                onChange={(event) => updateActiveSlotSettings({ swipeMode: event.target.value as SwipeMode })}
              >
                {swipeModeOptions.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>

            <label className="compact-control sound-control">
              <span>PDF Slot</span>
              <select
                value={activePdfSlotIndex}
                onChange={(event) => void activatePdfSlot(Number(event.target.value))}
              >
                {pdfSlots.map((slot, index) => (
                  <option key={index} value={index}>
                    {`Slot ${index + 1}${slot.fileName ? ` / ${slot.fileName}` : ''}`}
                  </option>
                ))}
              </select>
            </label>

            <div className="score-switch-group">
              <button
                className={`score-switch ${isFullscreen ? 'is-active' : ''}`}
                onClick={toggleFullscreen}
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
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

              <button
                className="score-switch"
                 onClick={() => scoreFileInputRef.current?.click()}
              >
                Load PNG
              </button>

              <button
                className="score-switch"
                 onClick={() => scorePdfInputRef.current?.click()}
              >
                Load PDF
              </button>

              <button
                className="score-switch"
                 disabled={!isPdfLoaded || pdfPageNumber <= 1}
                onClick={showPreviousPdfPage}
              >
                PDF Prev
              </button>

              <button
                className="score-switch"
                 disabled={!isPdfLoaded || pdfPageNumber >= pdfPageCount}
                onClick={showNextPdfPage}
              >
                PDF Next
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
                value={activeScoreOpacity}
                onChange={(event) => updateActiveSlotSettings({ scoreOpacity: Number(event.target.value) })}
              />
              <em>{activeScoreOpacity}</em>
            </label>

            <label className="slider-control">
              <span>Score Size</span>
              <input
                type="range"
                min="20"
                max="160"
                value={activeScoreScale}
                onChange={(event) => updateActiveSlotSettings({ scoreScale: Number(event.target.value) })}
              />
              <em>{activeScoreScale}</em>
            </label>

            <label className="slider-control">
              <span>Score X</span>
              <input
                type="range"
                min="-400"
                max="400"
                value={activeScoreX}
                onChange={(event) => updateActiveSlotSettings({ scoreX: Number(event.target.value) })}
              />
              <em>{activeScoreX}</em>
            </label>

            <label className="slider-control">
              <span>Score Y</span>
              <input
                type="range"
                min="-300"
                max="300"
                value={activeScoreY}
                onChange={(event) => updateActiveSlotSettings({ scoreY: Number(event.target.value) })}
              />
              <em>{activeScoreY}</em>
            </label>

            <label className="slider-control">
               <span>Paper Cut</span>
              <input
                type="range"
                min="50"
                max="95"
                value={activeScoreWhiteCut}
                onChange={(event) => updateActiveSlotSettings({ scoreWhiteCut: Number(event.target.value) })}
              />
              <em>{activeScoreWhiteCut}</em>
            </label>

            <label className="slider-control">
              <span>Ink Lift</span>
              <input
                type="range"
                min="0"
                max="60"
                value={activeScoreInkBoost}
                onChange={(event) => updateActiveSlotSettings({ scoreInkBoost: Number(event.target.value) })}
              />
              <em>{activeScoreInkBoost}</em>
            </label>
          </div>
        </div>
      </section>

      <div className="status ui-panel">
        <span>{safeBpm} BPM</span>
         <span>{timeSignature}</span>
        <span>{clickSound}</span>
        <span>{clickSubdivision}</span>
        <span>VOL {volume}</span>
        <span>{spaceMode}</span>
        <span>{visualEffect}</span>
        <span>{viewMode === 'void' ? 'Void Mode' : viewMode === 'tune' ? 'Tune Mode' : 'Plain Mode'}</span>
        <span>{isScoreVisible ? 'Score ON' : 'Score OFF'}</span>
        <span>{`Slot ${activePdfSlotIndex + 1}`}</span>
        <span>{scoreImageName}</span>
        <span>
          {isPdfLoaded ? `PDF ${pdfPageNumber}/${pdfPageCount}` : 'PDF --'}
        </span>
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
          <span>Actual Sync Mode: Absolute Ref + forceFrame</span>
          <span>Elapsed: {(elapsedTime).toFixed(2)}s</span>
          <span>Beat Count: {debugMetrics.beatCount}</span>
          <div className={`tune-ui-controls ${viewMode === 'tune' && isTuneUiVisible ? 'is-visible' : 'is-hidden'}`}>
           <span>Tune Hz Dist: {tuneData.distance.toFixed(3)}</span>
            <span>Tune Phase: {tunePhase}</span>
          </div>
        </div>
      )}
    </main>
  )
}

export default App