import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useLanguage } from "@/lib/LanguageContext"
import { useAuth } from "@/lib/AuthContext"

type Call = {
  id: string
  customer_name: string
  start_time: string
  duration: number | null
  sentiment: string | null
  status: string
}

export default function Dashboard() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [customerName, setCustomerName] = useState("")
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Fetch recent calls
    fetch(`/api/calls${user?.id ? `?user_id=${user.id}` : ''}`, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } })
      .then(res => res.json())
      .then(data => setCalls(data || []))
      .catch(err => console.error("Failed to fetch calls:", err))
  }, [setCalls, user?.id])

  const startCall = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName.trim()) return

    setLoading(true)
    try {
      const res = await fetch(`/api/start-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          customer_name: customerName,
          user_id: user?.id
        })
      })
      if (!res.ok) {
        let errMessage = "Unknown Server Error"
        try {
          const cloned = res.clone()
          const errData = await cloned.json()
          errMessage = errData.error || errData.detail || "Error " + res.status
        } catch {
          errMessage = await res.text()
        }
        alert(`CRITICAL ERROR! The backend Database insertion failed: ${errMessage}`)
        throw new Error("Failed to start call")
      }
      const data = await res.json()
      navigate(`/call/${data.call_id}`)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto w-full p-8 flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard_new_call')}</h1>
        <form onSubmit={startCall} className="flex gap-4 items-center">
          <Input 
            placeholder={t('dashboard_placeholder')} 
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="max-w-sm"
          />
          <Button 
            type="submit" 
            disabled={!customerName.trim() || loading}
            className="bg-[#00C853] hover:bg-[#00E676] text-white font-medium"
          >
            {t('dashboard_start_call')}
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-4 mt-8">
        <h2 className="text-xl font-semibold tracking-tight">{t('dashboard_recent_calls')}</h2>
        
        {calls.length === 0 ? (
          <div className="h-40 border rounded-xl border-dashed flex items-center justify-center text-zinc-500 bg-zinc-50/50">
            {t('dashboard_empty_calls')}
          </div>
        ) : (
          <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-zinc-50/80">
                <TableRow>
                  <TableHead>{t('dashboard_table_customer')}</TableHead>
                  <TableHead>{t('dashboard_table_date')}</TableHead>
                  <TableHead>{t('dashboard_table_duration')}</TableHead>
                  <TableHead>{t('dashboard_table_sentiment')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call) => (
                  <TableRow 
                    key={call.id} 
                    className="cursor-pointer hover:bg-zinc-50"
                    onClick={() => navigate(call.status === 'active' ? `/call/${call.id}` : `/summary/${call.id}`)}
                  >
                    <TableCell className="font-medium">{call.customer_name}</TableCell>
                    <TableCell className="text-zinc-600">{format(new Date(call.start_time), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell className="text-zinc-600">
                      {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : '-'}
                    </TableCell>
                    <TableCell>
                      {call.sentiment ? (
                        <Badge variant="outline" className={
                          call.sentiment.toLowerCase() === 'positive' || call.sentiment.toLowerCase() === 'позитивное' ? 'border-green-200 text-green-700 bg-green-50' :
                          call.sentiment.toLowerCase() === 'negative' || call.sentiment.toLowerCase() === 'негативное' ? 'border-red-200 text-red-700 bg-red-50' :
                          'border-yellow-200 text-yellow-700 bg-yellow-50'
                        }>
                          {call.sentiment}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-600">{t('dashboard_active')}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
