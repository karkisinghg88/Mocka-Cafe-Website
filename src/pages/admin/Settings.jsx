import { useEffect, useState } from 'react'
import { QrCode, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getSettings, saveSetting } from '../../lib/db'
import { CAFE } from '../../lib/format'
import { Button, Card, Input, Spinner } from '../../components/ui'

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [charge, setCharge] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [upiId, setUpiId] = useState('')
  const [cycleDay, setCycleDay] = useState('1')
  const [geminiKey, setGeminiKey] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getSettings().then((s) => {
      setCharge(s.delivery_charge ?? '0')
      setQrUrl(s.upi_qr_url ?? '')
      setUpiId(s.upi_id ?? '')
      setCycleDay(s.report_cycle_day ?? '1')
      setGeminiKey(s.gemini_key ?? '')
      setLoading(false)
    })
  }, [])

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
