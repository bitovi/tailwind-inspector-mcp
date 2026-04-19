import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'vybit-tutorial-progress'

function loadProgress(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return new Set(arr)
    }
  } catch { /* ignore */ }
  return new Set()
}

function saveProgress(steps: Set<number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...steps]))
  } catch { /* ignore */ }
}

interface ServerMessage {
  __vybit?: boolean
  type: string
  role?: string
  connected?: boolean
  insertMode?: string
  inputMethod?: string
  patch?: {
    kind?: string
    componentArgs?: Record<string, unknown>
  }
}

export function useTutorialProgress() {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(loadProgress)

  const completeStep = useCallback((step: number) => {
    setCompletedSteps(prev => {
      if (prev.has(step)) return prev
      const next = new Set(prev)
      next.add(step)
      saveProgress(next)
      return next
    })
  }, [])

  const resetProgress = useCallback(() => {
    const empty = new Set<number>()
    saveProgress(empty)
    setCompletedSteps(empty)
  }, [])

  // Map a raw server/bus message to tutorial step completions
  useEffect(() => {
    function processMessage(msg: ServerMessage) {
      if (!msg?.type) return

      switch (msg.type) {
        case 'REGISTER':
          if (msg.role === 'panel') completeStep(2)
          break
        case 'OVERLAY_STATUS':
          if (msg.connected) completeStep(2)
          break
        case 'PATCH_COMMIT':
          completeStep(3)
          break
        case 'MESSAGE_STAGE':
          if (msg.insertMode) completeStep(6)
          if (msg.inputMethod === 'voice') completeStep(4)
          break
        case 'TEXT_EDIT_DONE':
          completeStep(5)
          break
        case 'COMPONENT_DROPPED': {
          completeStep(8)
          const args = msg.patch?.componentArgs
          const hasNested = args != null && Object.values(args).some(
            (v) => v != null && typeof v === 'object' && (v as Record<string, unknown>).type === 'component'
          )
          if (hasNested) completeStep(9)
          break
        }
        case 'PATCH_STAGED':
          if ((msg.patch?.kind ?? 'class-change') === 'class-change') completeStep(10)
          if (msg.patch?.kind === 'design') completeStep(7)
          break
        case 'BUG_REPORT_STAGE':
          completeStep(11)
          break
        case 'DESIGN_SUBMIT':
          completeStep(7)
          break
      }
    }

    // vybit:message — dispatched by overlay ws.ts and demo bus.ts
    function handleVybitMessage(e: Event) {
      processMessage((e as CustomEvent<ServerMessage>).detail)
    }

    // message — cross-origin postMessage from the panel iframe (real server flow)
    function handleWindowMessage(e: MessageEvent) {
      if (e.data?.__vybit) {
        processMessage(e.data as ServerMessage)
      }
    }

    window.addEventListener('vybit:message', handleVybitMessage)
    window.addEventListener('message', handleWindowMessage)
    return () => {
      window.removeEventListener('vybit:message', handleVybitMessage)
      window.removeEventListener('message', handleWindowMessage)
    }
  }, [completeStep])

  return { completedSteps, completeStep, resetProgress }
}
