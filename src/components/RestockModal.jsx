import { useState } from 'react'
import { restockItem } from '../lib/db'
import { Button, Input, Modal } from './ui'

// Records a purchase and tops up stock. Used from Inventory and the Reports shopping list.
export default function RestockModal({ item, onClose, onDone }) {
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await restockItem(item, Number(qty), Number(cost))
      onClose(); await onDone?.()
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Restock: ${item.name}`}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-xs text-cafe-muted">Records today's purchase and updates stock + cost. Feeds the monthly report.</p>
        <div className="grid grid-cols-2 gap-2">
          <Input label={`Qty bought (${item.unit})`} type="number" min="0" step="any" required value={qty} onChange={(e) => setQty(e.target.value)} />
          <Input label="Total cost (₹)" type="number" min="0" step="any" required value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <Button type="submit" disabled={saving} className="w-full">{saving ? 'Saving…' : 'Add purchase'}</Button>
      </form>
    </Modal>
  )
}
