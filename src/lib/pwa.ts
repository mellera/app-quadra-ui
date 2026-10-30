import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

let needRefresh = false
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null
const listeners = new Set<() => void>()

/** Registra il service worker (solo in produzione); alla nuova versione `useUpdateAvailable` diventa true. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  applyUpdate = registerSW({
    onNeedRefresh() {
      needRefresh = true
      listeners.forEach((l) => l())
    },
  })
}

/** Nuova versione pronta: `update()` attiva il nuovo service worker e ricarica. */
export function useUpdateAvailable(): { available: boolean; update: () => void } {
  const available = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => needRefresh,
  )
  return { available, update: () => void applyUpdate?.(true) }
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export type InstallState = 'installed' | 'available' | 'manual'

/**
 * Stato dell'installazione come app:
 * - installed: già aperta come app;
 * - available: il browser (Chrome/Android) ha offerto l'installazione, `install()` mostra la richiesta;
 * - manual: nessuna richiesta disponibile: serve il menu del browser.
 */
export function useInstallApp(): { state: InstallState; install: () => Promise<void> } {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setEvent(null)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!event) return
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') setEvent(null)
  }, [event])

  return { state: installed ? 'installed' : event ? 'available' : 'manual', install }
}
