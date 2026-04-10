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

interface TutorialEvent {
  action: string
  kind?: string
  insertMode?: string
  inputMethod?: string
  hasNestedComponent?: boolean
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

  // Listen for vybit-tutorial CustomEvents dispatched by demo/bootstrap.ts
  useEffect(() => {
    function handleTutorial(e: Event) {
      const detail = (e as CustomEvent<TutorialEvent>).detail
      if (!detail) return

      switch (detail.action) {
        case 'panel-registered':
          completeStep(3)
          break
        case 'patch-committed':
          completeStep(4)
          break
        case 'message-staged':
          if (detail.insertMode) {
            completeStep(7)
          }
          if (detail.inputMethod === 'voice') {
            completeStep(5)
          }
          break
        case 'text-edit-done':
          completeStep(6)
          break
        case 'component-dropped':
          completeStep(9)
          if (detail.hasNestedComponent) {
            completeStep(10)
          }
          break
        case 'patch-staged':
          if (detail.kind === 'class-change') {
            completeStep(11)
          }
          if (detail.kind === 'design') {
            completeStep(8)
          }
          break
        case 'bug-report-staged':
          completeStep(12)
          break
      }
    }

    window.addEventListener('vybit-tutorial', handleTutorial)
    return () => window.removeEventListener('vybit-tutorial', handleTutorial)
  }, [completeStep])

  return { completedSteps, completeStep, resetProgress }
}
