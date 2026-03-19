import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAudioCapture } from "@/hooks/useAudioCapture"
import { useDeepgram } from "@/hooks/useDeepgram"

export default function LiveCall() {
  const { id } = useParams()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const { stream, startCapture, stopCapture } = useAudioCapture()
  const { transcripts } = useDeepgram(stream)
  
  const [suggestion, setSuggestion] = useState<string>("")
  const [previousSuggestions, setPreviousSuggestions] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const lastProcessedTranscriptIdRef = useRef<string | null>(null)

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcripts])

  const fetchSuggestion = useCallback(async (text: string) => {
    setIsAnalyzing(true)
    try {
      const res = await fetch(`/api/get-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: id, transcript: text })
      })
      if (res.ok) {
        const data = await res.json()
        if (suggestion) {
          setPreviousSuggestions(prev => [suggestion, ...prev].slice(0, 3))
        }
        setSuggestion(data.suggestion)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsAnalyzing(false)
    }
  }, [id, suggestion])

  useEffect(() => {
    const finalTranscripts = transcripts.filter(t => t.isFinal)
    if (finalTranscripts.length === 0) return
    
    const lastFinal = finalTranscripts[finalTranscripts.length - 1]
    if (lastProcessedTranscriptIdRef.current !== lastFinal.id) {
      lastProcessedTranscriptIdRef.current = lastFinal.id
      fetchSuggestion(lastFinal.text)
    }
  }, [transcripts, fetchSuggestion])

  const handleEndCall = async () => {
    stopCapture()
    try {
      await fetch(`/api/end-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: id })
      })
    } catch (e) {
      console.error("Failed to end call", e)
    }
    navigate(`/summary/${id}`)
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Panel: Transcript */}
      <div className="w-[60%] border-r flex flex-col bg-white">
        <header className="h-14 border-b px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${stream ? 'bg-red-500 animate-pulse' : 'bg-zinc-300'}`} />
            <span className="font-medium text-zinc-900">{stream ? 'Listening...' : 'Ready'}</span>
          </div>
          <div className="text-zinc-500 font-mono text-sm">Live</div>
        </header>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {transcripts.length === 0 && !stream && (
            <div className="text-zinc-400 text-center mt-10">
              Click "Start Listening" to begin capturing tab audio.
            </div>
          )}
          {transcripts.map((t) => (
            <div key={t.id} className="mb-2">
              <span className="text-zinc-400 font-medium text-sm mr-3">{t.speaker}</span>
              <span className={`leading-relaxed ${t.isFinal ? 'text-[#111111]' : 'text-zinc-500 italic'}`}>
                {t.text}
              </span>
            </div>
          ))}
        </div>

        <div className="p-4 border-t bg-zinc-50 shrink-0 flex gap-4">
          {!stream ? (
            <Button onClick={startCapture} className="w-full bg-[#00C853] hover:bg-[#00E676] text-white">
              Start Listening
            </Button>
          ) : (
            <Button onClick={stopCapture} variant="outline" className="w-full font-medium text-zinc-700">
              Pause Listening
            </Button>
          )}
        </div>
      </div>

      {/* Right Panel: AI Suggestions */}
      <div className="w-[40%] flex flex-col bg-[#FAFAFA]">
        <header className="h-14 border-b px-6 flex items-center shrink-0">
          <h2 className="font-medium text-zinc-900 flex items-center gap-2">
            <span className="text-xl">💡</span> Clozer suggests
          </h2>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {suggestion ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="text-[#00C853] font-bold mb-2">Say:</div>
              <div className="text-[#111111] text-[18px] leading-[1.6]">
                {suggestion.replace(/^Say:\s*/i, '')}
              </div>
            </div>
          ) : isAnalyzing ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-zinc-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-zinc-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-zinc-200 rounded w-3/4"></div>
            </div>
          ) : (
            <div className="text-zinc-400 text-center mt-10">
              Waiting for customer input...
            </div>
          )}

          {previousSuggestions.length > 0 && (
            <div className="flex flex-col gap-4 opacity-40">
              {previousSuggestions.map((prev, i) => (
                <div key={i} className="bg-white rounded-xl border p-5">
                  <div className="text-[#00C853] font-bold mb-1 text-sm">Say:</div>
                  <div className="text-zinc-900 leading-relaxed">
                    {prev.replace(/^Say:\s*/i, '')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-white shrink-0">
          <Button 
            variant="destructive" 
            className="w-full opacity-90 hover:opacity-100 font-medium"
            onClick={handleEndCall}
          >
            End Call
          </Button>
        </div>
      </div>
    </div>
  )
}
