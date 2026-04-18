import { useEffect, useRef } from 'react'
import { saveCalculatorState } from './supabase.js'

export function useAutoSave(session, state, delay = 1500) {
  const timer = useRef(null)
  const prev  = useRef(null)

  useEffect(() => {
    if (!session?.restaurantId || !session?.userId) return
    const serialized = JSON.stringify(state)
    if (serialized === prev.current) return
    prev.current = serialized

    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await saveCalculatorState(session.restaurantId, state, session.userId)
      } catch {
        // silently fail — app works without persistence
      }
    }, delay)

    return () => clearTimeout(timer.current)
  }, [session, state, delay])
}
