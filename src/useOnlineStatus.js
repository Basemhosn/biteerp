import { useState, useEffect, useCallback } from 'react'
import { getPending, markDone, markFailed, getPendingCount } from './offlineQueue.js'
import { supabase } from './supabase.js'

export function useOnlineStatus() {
  const [isOnline,   setIsOnline]   = useState(navigator.onLine)
  const [isSyncing,  setIsSyncing]  = useState(false)
  const [pendingCnt, setPendingCnt] = useState(0)

  // Refresh pending count
  const refreshCount = useCallback(async () => {
    try { const cnt = await getPendingCount(); setPendingCnt(cnt) } catch {}
  }, [])

  useEffect(() => {
    refreshCount().catch(() => {})
    const handleOnline  = () => { setIsOnline(true);  syncQueue() }
    const handleOffline = () => { setIsOnline(false) }
    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return
    const items = await getPending()
    if (!items.length) return
    setIsSyncing(true)
    for (const item of items) {
      try {
        await replayOperation(item)
        await markDone(item.id)
      } catch (e) {
        await markFailed(item.id, e.message)
      }
    }
    setIsSyncing(false)
    await refreshCount()
  }, [refreshCount])

  // Attempt sync on mount if online
  useEffect(() => {
    if (navigator.onLine) syncQueue()
  }, [])

  return { isOnline, isSyncing, pendingCnt, syncQueue, refreshCount }
}

// Replay an operation that was queued while offline
async function replayOperation(item) {
  const { type, payload } = item
  switch (type) {
    case 'create_order': {
      const { error } = await supabase.from('orders').insert(payload)
      if (error) throw new Error(error.message)
      break
    }
    case 'add_order_item': {
      const { error } = await supabase.from('order_items').insert(payload)
      if (error) throw new Error(error.message)
      break
    }
    case 'close_order': {
      const { orderId, payMethod, invoiceNumber } = payload
      const { error } = await supabase.from('orders').update({
        status: 'paid', payment_method: payMethod,
        invoice_number: invoiceNumber, closed_at: new Date().toISOString(),
      }).eq('id', orderId)
      if (error) throw new Error(error.message)
      break
    }
    case 'stock_movement': {
      const { error } = await supabase.from('stock_movements').insert(payload)
      if (error) throw new Error(error.message)
      break
    }
    case 'update_stock': {
      const { ingredientId, stockQty, costPerUnit } = payload
      const { error } = await supabase.from('ingredients')
        .update({ stock_qty: stockQty, cost_per_unit: costPerUnit })
        .eq('id', ingredientId)
      if (error) throw new Error(error.message)
      break
    }
    default:
      console.warn('Unknown offline operation type:', type)
  }
}
