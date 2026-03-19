import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Copy, CheckCircle, AlertCircle, FileText, ArrowLeft, Loader2 } from "lucide-react"

export default function Summary() {
  const params = useParams()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [callData, setCallData] = useState<any>(null)
  const [summaryData, setSummaryData] = useState<any>(null)

  useEffect(() => {
    if (!params.id) return
    setLoading(true)
    fetch(`/api/call/${params.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.call) {
          setCallData(data.call)
        }
        if (data.summary) {
          setSummaryData(data.summary)
        }
      })
      .catch(err => console.error("Failed to load summary", err))
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 flex-col gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        <p className="text-zinc-500 font-medium animate-pulse">Generating final AI Summary. This takes about 10 seconds...</p>
      </div>
    )
  }

  if (!summaryData) {
    return (
      <div className="flex items-center justify-center p-20 flex-col gap-4">
        <p className="text-zinc-500 font-medium">Summary not found or still processing.</p>
        <Button onClick={() => navigate('/')} variant="outline">Go back to Dashboard</Button>
      </div>
    )
  }

  const handleCopy = () => {
    const text = `
Call Summary: ${callData?.customer_name || 'Customer'}
Date: ${new Date(callData?.start_time || Date.now()).toLocaleDateString()} | Duration: ${callData?.duration || 0}s

📋 Summary
${summaryData.summary}

⚠️ Objections
${(summaryData.objections || []).map((o: string) => "- " + o).join("\n")}

✅ Next Steps
${(summaryData.nextSteps || []).map((o: string) => "- " + o).join("\n")}
    `.trim()
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="max-w-4xl mx-auto w-full p-8 flex flex-col gap-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button 
            onClick={() => navigate('/')}
            className="text-zinc-500 hover:text-zinc-900 mb-4 inline-flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{callData?.customer_name || 'Customer'}</h1>
          <div className="text-zinc-500 mt-2 flex items-center gap-3 text-sm">
            <span>{new Date(callData?.start_time || Date.now()).toLocaleDateString()}</span>
            <span className="w-1 h-1 rounded-full bg-zinc-300" />
            <span>{callData?.duration || 0}s</span>
          </div>
        </div>
        <Button onClick={handleCopy} variant="outline" className="gap-2 font-medium">
          <Copy className="w-4 h-4" /> Copy to clipboard
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-6 w-full">
        {/* Call Summary */}
        <Card className="col-span-2 shadow-sm border-zinc-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-zinc-400" /> Call Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-700 leading-relaxed">{summaryData.summary}</p>
          </CardContent>
        </Card>

        {/* Objections Raised */}
        <Card className="shadow-sm border-zinc-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-amber-700">
              <AlertCircle className="w-5 h-5" /> Objections Raised
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(summaryData.objections || []).map((obj: string, i: number) => (
                <li key={i} className="flex gap-3 text-zinc-700">
                  <span className="text-zinc-300 mt-1">•</span>
                  <span className="leading-relaxed">{obj}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="shadow-sm border-zinc-200 bg-green-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg text-green-700">
              <CheckCircle className="w-5 h-5" /> Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(summaryData.next_steps || []).map((step: string, i: number) => (
                <li key={i} className="flex gap-3 text-zinc-700 font-medium">
                  <span className="text-green-500/50 mt-1">•</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Sentiment */}
        <Card className="col-span-2 shadow-sm border-zinc-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              📊 Sentiment
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-start gap-4">
            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 text-sm py-1">
              {summaryData.sentiment || "Neutral"}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
