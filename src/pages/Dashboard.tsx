import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Call = {
  id: string
  customer_name: string
  start_time: string
  duration: number | null
  sentiment: string | null
  status: string
}

export default function Dashboard() {
  const [customerName, setCustomerName] = useState("")
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Fetch recent calls
    fetch('/api/calls', { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } })
      .then(res => res.json())
      .then(data => setCalls(data || []))
      .catch(err => console.error("Failed to fetch calls:", err))
  }, [setCalls])

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
        body: JSON.stringify({ customer_name: customerName })
      })
      if (!res.ok) throw new Error("Failed to start call")
      const data = await res.json()
      navigate(`/call/${data.call_id}`)
    } catch (err) {
      console.error(err)
      // Fallback for dev/testing without backend
      navigate(`/call/fake-id-${Date.now()}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto w-full p-8 flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">New Call</h1>
        <form onSubmit={startCall} className="flex gap-4 items-center">
          <Input 
            placeholder="Customer Name (e.g. Acme Corp)" 
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="max-w-sm"
          />
          <Button 
            type="submit" 
            disabled={!customerName.trim() || loading}
            className="bg-[#00C853] hover:bg-[#00E676] text-white font-medium"
          >
            Start Call
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-4 mt-8">
        <h2 className="text-xl font-semibold tracking-tight">Recent Calls</h2>
        
        {calls.length === 0 ? (
          <div className="h-40 border rounded-xl border-dashed flex items-center justify-center text-zinc-500 bg-zinc-50/50">
            No calls yet. Start your first call above.
          </div>
        ) : (
          <div className="border rounded-xl bg-white overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-zinc-50/80">
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Sentiment</TableHead>
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
                          call.sentiment.toLowerCase() === 'positive' ? 'border-green-200 text-green-700 bg-green-50' :
                          call.sentiment.toLowerCase() === 'negative' ? 'border-red-200 text-red-700 bg-red-50' :
                          'border-yellow-200 text-yellow-700 bg-yellow-50'
                        }>
                          {call.sentiment}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-600">Active</Badge>
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
