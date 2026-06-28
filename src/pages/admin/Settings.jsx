import { useEffect, useState } from 'react'
import { QrCode, Save, CalendarOff, Plus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getSettings, saveSetting } from '../../lib/db'
import { CAFE, parseClosedDates, istTodayISO } from '../../lib/format'
import { Button, Card, Input, Spinner } from '../../components/ui'

// Pretty label for a 'YYYY-MM-DD' string, e.g. "Sat, 4 Jul 2026".
function dateLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [charge, setCharge] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [upiId, setUpiId] = useState('')
  const [cycleDay, setCycleDay] = useState('1')
  const [geminiKey, setGeminiKey] = useState('')
  const [closedDates, setClosedDates] = useState([])
  const [newDate, setNewDate] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)

  const today = istTodayISO()

  useEffect(() => {
    getSettings().then((s) => {
      setCharge(s.delivery_charge ?? '0')
      setQrUrl(s.upi_qr_url ?? '')
      setUpiId(s.upi_id ?? '')
      setCycleDay(s.report_cycle_day ?? '1')
      setGeminiKey(s.gemini_key ?? '')
      // Keep only today and upcoming dates, sorted, so the list stays tidy.
      setClosedDates(parseClosedDates(s.closed_dates).filter((d) => d >= istTodayISO()).sort())
      setLoading(false)
    })
  }, [])

  const persistClosedDates = async (list) => {
    setClosedDates(list)
    await saveSetting('closed_dates', JSON.stringify(list))
  }
  const addClosedDate = async () => {
    if (!newDate) return
    if (newDate < today) { alert('Please pick today or an upcoming date.'); return }
    if (closedDates.includes(newDate)) { setNewDate(''); return }
    await persistClosedDates([...closedDates, newDate].sort())
    setNewDate('')
  }
  const removeClosedDate = async (d) => { await persistClosedDates(closedDates.filter((x) => x !== d)) }

  const uploadQr = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `upi-qr.${ext}`
      const { error } = await supabase.storage.from('public-assets').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('public-assets').getPublicUrl(path)
      const url = `${data.publicUrl}?t=${Date.now()}`
      setQrUrl(url)
      await saveSetting('upi_qr_url', url)
    } catch (err) { alert('Upload failed: ' + err.message) }
    finally { setUploading(false) }
  }

  const save = async () => {
    await saveSetting('delivery_charge', String(Number(charge || 0)))
    await saveSetting('upi_id', upiId.trim())
    await saveSetting('report_cycle_day', String(Math.min(28, Math.max(1, Number(cycleDay || 1)))))
    await saveSetting('gemini_key', geminiKey.trim())
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Settings</h2>

      <Card className="space-y-3 p-4">
        <Input label="Default delivery charge (₹)" type="number" min="0" value={charge} onChange={(e) => setCharge(e.target.value)} />
        <Input label="UPI ID (shown to customers)" placeholder="mockacafe@okicici" value={upiId} onChange={(e) => setUpiId(e.target.value)} />
        <Input label="Report cycle start day (1 to 28)" type="number" min="1" max="28" value={cycleDay} onChange={(e) => setCycleDay(e.target.value)} />
        <p className="text-xs text-cafe-muted">1 = full calendar month (1 Jan to 1 Feb). e.g. 5 runs the 5th of one month to the 5th of the next. Rent and electricity are entered each month in Reports, Expenses.</p>
        <Input label="Gemini API key (for AI reports)" type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="paste your Google Gemini key" />
        <p className="text-xs text-cafe-muted">Powers the Generate AI report button in Reports. Get a free key at aistudio.google.com.</p>
        <Button onClick={save} className="w-full"><Save size={16} /> {saved ? 'Saved!' : 'Save'}</Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2"><CalendarOff size={18} className="text-cafe-accent" /><p className="font-semibold">Cafe closed days</p></div>
        <p className="rounded-lg bg-cafe-bg px-3 py-2 text-xs text-cafe-muted">
          Closed every <span className="font-semibold text-white">Tuesday</span> automatically. No orders can be placed on closed days.
        </p>
        <span className="block text-sm text-cafe-muted">Add a holiday or off day</span>
        <div className="flex gap-2">
          <input type="date" min={today} value={newDate} onChange={(e) => setNewDate(e.target.value)}
            className="flex-1 rounded-xl border border-cafe-line bg-cafe-bg px-3 py-2.5 text-base outline-none focus:border-cafe-accent" />
          <Button onClick={addClosedDate} className="px-4"><Plus size={16} /> Add</Button>
        </div>
        {closedDates.length === 0 ? (
          <p className="text-xs text-cafe-muted">No extra closed days set. Add as many upcoming dates as you like.</p>
        ) : (
          <div className="space-y-2">
            {closedDates.map((d) => (
              <div key={d} className="flex items-center justify-between rounded-xl border border-cafe-line bg-cafe-bg px-3 py-2 text-sm">
                <span>{dateLabel(d)}</span>
                <button onClick={() => removeClosedDate(d)} aria-label={`Remove ${d}`} className="text-cafe-muted hover:text-red-400"><X size={16} /></button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2"><QrCode size={18} className="text-cafe-accent" /><p className="font-semibold">UPI payment QR</p></div>
        <p className="mb-3 text-xs text-cafe-muted">Customers see this to pay in advance. Upload your UPI QR image.</p>
        {qrUrl && <img src={qrUrl} alt="UPI QR" className="mb-3 h-44 w-44 rounded-xl bg-white object-contain p-2" />}
        <input type="file" accept="image/*" onChange={(e) => uploadQr(e.target.files?.[0])}
          className="block w-full text-sm text-cafe-muted file:mr-3 file:rounded-lg file:border-0 file:bg-cafe-line file:px-3 file:py-2 file:text-white" />
        {uploading && <p className="mt-1 text-xs text-cafe-accent">Uploading…</p>}
      </Card>

      <Card className="p-4 text-sm">
        <p className="font-semibold">{CAFE.name}</p>
        <p className="text-cafe-muted">{CAFE.city}</p>
        <p className="text-cafe-muted">{CAFE.phoneDisplay}</p>
        <p className="mt-2 text-xs text-cafe-muted">To change cafe name/phone, edit <code className="text-white">src/lib/format.js</code>.</p>
      </Card>
    </div>
  )
}
