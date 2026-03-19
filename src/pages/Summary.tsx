import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Copy, CheckCircle, AlertCircle, FileText, ArrowLeft } from "lucide-react"

export default function Summary() {
  const params = useParams()
  console.log(params.id) // To suppress unused variable warning while keeping realistic logic
  const navigate = useNavigate()

  // Mock data for now
  const summaryData = {
    customerName: "Acme Corp",
    date: "Oct 24, 2026",
    duration: "14m 20s",
    summary: "The customer is experiencing low win rates and is looking for a coaching solution. They are currently using Gong but find it difficult to derive actionable insights mid-call. They seemed very receptive to the idea of real-time suggestions.",
    objections: [
      "Budget constraints for Q4",
      "Concerns about onboarding time for 50 reps"
    ],
    nextSteps: [
      "Send pricing proposal by Friday",
      "Schedule technical demo with their VP of Sales next Tuesday"
    ],
    sentiment: { value: "Positive", reason: "Expressed clear interest in real-time features and agreed to a follow-up." }
  }

  const handleCopy = () => {
    const text = `
Call Summary: ${summaryData.customerName}
Date: ${summaryData.date} | Duration: ${summaryData.duration}

📋 Summary
${summaryData.summary}

⚠️ Objections
${summaryData.objections.map(o => "- " + o).join("\n")}

✅ Next Steps
${summaryData.nextSteps.map(o => "- " + o).join("\n")}
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
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{summaryData.customerName}</h1>
          <div className="text-zinc-500 mt-2 flex items-center gap-3 text-sm">
            <span>{summaryData.date}</span>
            <span className="w-1 h-1 rounded-full bg-zinc-300" />
            <span>{summaryData.duration}</span>
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
              {summaryData.objections.map((obj, i) => (
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
              {summaryData.nextSteps.map((step, i) => (
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
              {summaryData.sentiment.value}
            </Badge>
            <p className="text-zinc-600 mt-0.5">{summaryData.sentiment.reason}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
