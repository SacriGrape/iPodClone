import type { Track } from '../types'

const DB_NAME = 'ipod-clone'
const DB_VERSION = 1
const STORE_NAME = 'tracks'

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }

    request.onerror = () => reject(request.error ?? new Error('Could not open the library database.'))
    request.onblocked = () => reject(new Error('The library database is open in another tab.'))
  })

  return databasePromise
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Database request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Database transaction aborted.'))
    transaction.onerror = () => reject(transaction.error ?? new Error('Database transaction failed.'))
  })
}

export async function loadTracks(): Promise<Track[]> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readonly')
  const request = transaction.objectStore(STORE_NAME).getAll()
  const tracks = await requestResult(request)
  await transactionDone(transaction)
  return tracks as Track[]
}

export async function saveTracks(tracks: Track[]): Promise<void> {
  if (tracks.length === 0) return

  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)

  for (const track of tracks) store.put(track)

  await transactionDone(transaction)
}

export async function removeTrack(id: string): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).delete(id)
  await transactionDone(transaction)
}

export async function clearTracks(): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).clear()
  await transactionDone(transaction)
}
