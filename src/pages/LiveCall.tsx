import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAudioCapture } from "@/hooks/useAudioCapture"
import { useDeepgram } from "@/hooks/useDeepgram"
import { useLanguage } from "@/lib/LanguageContext"

export default function LiveCall() {
  const { id } = useParams()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { t, language } = useLanguage()
  
  const { stream, startCapture, stopCapture, error: captureError } = useAudioCapture()
  const { transcripts, socketStatus } = useDeepgram(stream, language)
  
  const wordCount = transcripts.reduce((acc, t) => acc + t.text.split(/\s+/).filter(Boolean).length, 0)
  
  const [suggestion, setSuggestion] = useState<string>("")
  const [previousSuggestions, setPreviousSuggestions] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showInstruction, setShowInstruction] = useState(false)
  const lastProcessedTranscriptIdRef = useRef<string | null>(null)

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcripts])

  const handleStartListening = () => {
    const shown = localStorage.getItem('clozer_instruction_shown')
    if (!shown) {
      setShowInstruction(true)
    } else {
      startCapture()
    }
  }

  const handleModalAcknowledge = () => {
    localStorage.setItem('clozer_instruction_shown', 'true')
    setShowInstruction(false)
    startCapture()
  }

  const fetchSuggestion = useCallback(async (text: string) => {
    setIsAnalyzing(true)
    try {
      const res = await fetch(`/api/get-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: id, transcript: text, language })
      })

      if (!res.ok) {
        let errText = res.statusText
        try {
          const cloned = res.clone()
          const errData = await cloned.json()
          errText = errData.error || (errData.detail ? JSON.stringify(errData.detail) : errText)
        } catch (_) {
          const rawText = await res.text()
          errText = rawText.substring(0, 60).replace(/<[^>]*>?/gm, '') + "..."
        }
        setSuggestion(`Say: Vercel HTTP ${res.status} Error: ${errText}`)
        return
      }

      const data = await res.json()
      
      if (data.error) {
        setSuggestion(`Say: Backend Error: ${data.error}`)
        return
      }

      if (suggestion) {
        setPreviousSuggestions(prev => [suggestion, ...prev].slice(0, 3))
      }
      setSuggestion(data.suggestion)
    } catch (err: any) {
      setSuggestion(`Say: Network Error: ${err.message}`)
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
        body: JSON.stringify({ call_id: id, language })
      })
    } catch (e) {
      console.error("Failed to end call", e)
    }
    navigate(`/summary/${id}`)
  }

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Instruction Modal Overlay */}
      {showInstruction && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in duration-300">
            <h3 className="text-2xl font-bold text-zinc-900">{t('modal_title')}</h3>
            <ol className="flex flex-col gap-4 text-zinc-700 font-medium">
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">1</div>
                {t('modal_step_1')}
              </li>
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">2</div>
                {t('modal_step_2')}
              </li>
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0">3</div>
                {t('modal_step_3')}
              </li>
            </ol>
            <Button onClick={handleModalAcknowledge} className="w-full bg-[#00C853] hover:bg-[#00E676] text-white py-6 text-lg font-semibold mt-2">
              {t('modal_button')}
            </Button>
          </div>
        </div>
      )}

      {/* Left Panel: Transcript */}
      <div className="w-[60%] border-r flex flex-col bg-white">
        <header className="h-14 border-b px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {stream ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="font-medium text-green-600">🟢 {t('livecall_listening')}</span>
              </>
            ) : captureError ? (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <span className="font-medium text-red-500 text-sm max-w-[400px] truncate" title={captureError.message}>
                  {captureError.message === "No audio track found. You must check 'Share tab audio'." 
                    ? (language === 'ru' ? "ОШИБКА: Вы не поставили галочку 'Поделиться звуком вкладки'." : captureError.message)
                    : captureError.message || t('livecall_listening_failed')}
                </span>
              </>
            ) : (
              <>
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
                <span className="font-medium text-zinc-900">Ready</span>
              </>
            )}
          </div>
          <div className="text-zinc-500 font-mono text-sm">Live</div>
        </header>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {!stream && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm font-medium flex gap-2 items-start">
              <span>⚠️</span>
              {language === 'ru' 
                ? "При выборе вкладки обязательно поставьте галочку 'Поделиться звуком вкладки', иначе звук не будет захвачен"
                : "When selecting a tab, you MUST check the 'Share tab audio' checkbox or no audio will be captured"}
            </div>
          )}
          {transcripts.length === 0 && !stream && (
            <div className="text-zinc-400 text-center mt-10">
              {language === 'ru' ? 'Нажмите "Слушать" чтобы начать аудио транскрипцию.' : 'Click "Start Listening" to begin audio transcription.'}
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

        <div className="p-2 border-t bg-zinc-100 flex items-center justify-between text-xs font-mono text-zinc-500 shrink-0">
          <div className="flex items-center gap-4">
            <span>🎤 Audio: {stream ? 'active' : 'inactive'}</span>
            <span>📡 Deepgram: {socketStatus}</span>
          </div>
          <div>📝 Words: {wordCount}</div>
        </div>

        <div className="p-4 border-t bg-zinc-50 shrink-0 flex gap-4">
          {!stream ? (
            <Button onClick={handleStartListening} className="w-full bg-[#00C853] hover:bg-[#00E676] text-white">
              {t('livecall_start')}
            </Button>
          ) : (
            <Button onClick={stopCapture} variant="outline" className="w-full font-medium text-zinc-700">
              {t('livecall_stop')}
            </Button>
          )}
        </div>
      </div>

      {/* Right Panel: AI Suggestions */}
      <div className="w-[40%] flex flex-col bg-[#FAFAFA]">
        <header className="h-14 border-b px-6 flex items-center justify-between shrink-0">
          <h2 className="font-medium text-zinc-900 flex items-center gap-2">
            <span className="text-xl">💡</span> {t('livecall_suggestions_title')}
          </h2>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {suggestion ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="text-[#00C853] font-bold mb-2">{language === 'ru' ? 'Скажи:' : 'Say:'}</div>
              <div className="text-[#111111] text-[18px] leading-[1.6]">
                {suggestion.replace(/(Скажи:|Say:)\s*/ig, '').replace(/^["']|["']$/g, '')}
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
              {language === 'ru' ? 'Ожидание диалога...' : 'Waiting for customer input...'}
            </div>
          )}

          {previousSuggestions.length > 0 && (
            <div className="flex flex-col gap-4 opacity-40">
              {previousSuggestions.map((prev, i) => (
                <div key={i} className="bg-white rounded-xl border p-5">
                  <div className="text-[#00C853] font-bold mb-1 text-sm">{language === 'ru' ? 'Скажи:' : 'Say:'}</div>
                  <div className="text-zinc-900 leading-relaxed">
                    {prev.replace(/(Скажи:|Say:)\s*/ig, '').replace(/^["']|["']$/g, '')}
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
            {t('livecall_end_call')}
          </Button>
        </div>
      </div>
    </div>
  )
}
