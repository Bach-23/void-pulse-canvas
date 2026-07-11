// src/utils/db.ts
import type { PdfSlot } from '../types'

const DB_NAME = 'VoidPulseCanvasDB'
const DB_VERSION = 3 // PdfSlot拡張（swipeMode追加）に伴いバージョンを引き上げ
const STORE_NAME = 'pdfSlots'

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'slotIndex' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const saveSlotToDB = async (
  slotIndex: number,
  pdfData: ArrayBuffer,
  fileName: string,
  pageNumber: number,
  pageCount: number,
  slotData: Partial<PdfSlot>
): Promise<void> => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({ 
      slotIndex, 
      pdfData, 
      fileName, 
      pageNumber, 
      pageCount,
      scoreScale: slotData.scoreScale ?? 72,
      scoreX: slotData.scoreX ?? 0,
      scoreY: slotData.scoreY ?? 0,
      scoreOpacity: slotData.scoreOpacity ?? 70,
      scoreWhiteCut: slotData.scoreWhiteCut ?? 80,
      scoreInkBoost: slotData.scoreInkBoost ?? 30,
      swipeMode: slotData.swipeMode ?? 'Score'
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const loadSlotsFromDB = async (): Promise<any[]> => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const updateSlotMetadataInDB = async (slotIndex: number, metadata: Partial<PdfSlot>): Promise<void> => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(slotIndex)
   
    request.onsuccess = () => {
      const data = request.result
      if (data) {
        Object.assign(data, metadata)
        store.put(data)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const clearPdfSlotsFromDB = async (): Promise<void> => {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}