/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAudioCapture } from "@/hooks/useAudioCapture"
import { useDeepgram } from "@/hooks/useDeepgram"
import { useLanguage } from "@/lib/LanguageContext"
import { useAuth } from "@/lib/AuthContext"
import { supabase } from "@/lib/supabase"

// ── Script stages ──
const STAGES = [
  { key: "greeting", ru: "Приветствие", en: "Greeting" },
  { key: "discovery", ru: "Выявление", en: "Discovery" },
  { key: "presentation", ru: "Презентация", en: "Presentation" },
  { key: "objections", ru: "Возражения", en: "Objections" },
  { key: "closing", ru: "Закрытие", en: "Closing" },
] as const

type SuggestionMode = "script" | "objection" | "free"

export default function LiveCall() {
  const { id } = useParams()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const { t, language } = useLanguage()
  const { user } = useAuth()

  // ── Audio capture ──
  const {
    stream, startCapture, stopCapture, error: captureError,
    audioDevices, selectedDeviceId, setSelectedDeviceId,
    selectedDeviceLabel, isBlackHole
  } = useAudioCapture()
  // ── onFlush callback: fires once per complete utterance ──
  const handleFlush = useCallback((fullSentence: string) => {
    // Save transcript line to Supabase
    fetch(`/api/add-transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call_id: id, speaker: "Customer:", text: fullSentence })
    }).catch(console.error)

    // Trigger AI suggestion
    setIsAnalyzing(true)
    fetchSuggestionRef.current?.(fullSentence)
  }, [id])

  const { transcripts, interimText, socketStatus } = useDeepgram(stream, language, handleFlush)

  const wordCount = transcripts.reduce((acc, t) => acc + t.text.split(/\s+/).filter(Boolean).length, 0)

  // ── Suggestions ──
  const [suggestion, setSuggestion] = useState<string>("")
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>("free")
  const [objectionType, setObjectionType] = useState<string>("")
  const [previousSuggestions, setPreviousSuggestions] = useState<string[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // ── Script mode ──
  const [currentStage, setCurrentStage] = useState(0)
  const [completedStages, setCompletedStages] = useState<boolean[]>([false, false, false, false, false])
  const [hasScript, setHasScript] = useState<boolean | null>(null) // null = loading

  // ── Modals ──
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false)

  // ── Load sales script from profile ──
  useEffect(() => {
    async function loadProfile() {
      if (!user) return
      const { data } = await supabase.from("profiles").select("sales_script").eq("user_id", user.id).single()
      if (data?.sales_script && data.sales_script.trim() !== "") {
        setHasScript(true)
      } else {
        setHasScript(false)
      }
    }
    loadProfile()
  }, [user])

  // ── Auto-scroll transcript ──
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcripts, interimText])

  // ── Parse AI response ──
  const parseResponse = useCallback((text: string) => {
    if (text.startsWith("СКРИПТ:")) {
      const content = text.replace("СКРИПТ:", "").trim()
      setSuggestionMode("script")
      setObjectionType("")
      // Auto-advance to next stage
      setCompletedStages(prev => {
        const next = [...prev]
        next[currentStage] = true
        return next
      })
      if (currentStage < 4) {
        setCurrentStage(prev => prev + 1)
      }
      return content
    }
    if (text.startsWith("ВОЗРАЖЕНИЕ:")) {
      const parts = text.replace("ВОЗРАЖЕНИЕ:", "").split("|")
      const type = parts[0]?.trim() || ""
      const script = parts[1]?.replace(/Скажи:\s*/i, "").trim() || ""
      setSuggestionMode("objection")
      setObjectionType(type)
      return script
    }
    // Free mode fallback
    setSuggestionMode("free")
    setObjectionType("")
    return text
  }, [currentStage])

  // ── Fetch suggestion ──
  const fetchSuggestion = useCallback(async (text: string) => {
    try {
      const res = await fetch(`/api/get-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: id,
          transcript: text,
          language,
          user_id: user?.id,
          current_stage: currentStage,
          has_script: hasScript === true
        })
      })

      if (!res.ok) {
        let errText = res.statusText
        try {
          const cloned = res.clone()
          const errData = await cloned.json()
          errText = errData.error || (errData.detail ? JSON.stringify(errData.detail) : errText)
        } catch (_) {
          const rawText = await res.text()
          errText = rawText.substring(0, 60).replace(/<[^>]*>?/gm, "") + "..."
        }
        setSuggestion(`Vercel HTTP ${res.status}: ${errText}`)
        setSuggestionMode("free")
        return
      }

      const data = await res.json()

      if (data.error) {
        setSuggestion(`Backend Error: ${data.error}`)
        setSuggestionMode("free")
        return
      }

      if (suggestion) {
        setPreviousSuggestions(prev => [suggestion, ...prev].slice(0, 3))
      }

      const rawSuggestion = data.suggestion || ""
      const parsed = parseResponse(rawSuggestion)
      setSuggestion(parsed)
    } catch (err: any) {
      setSuggestion(`Network Error: ${err.message}`)
      setSuggestionMode("free")
      console.error(err)
    } finally {
      setIsAnalyzing(false)
    }
  }, [id, suggestion, language, user?.id, currentStage, hasScript, parseResponse])

  // Keep a ref to fetchSuggestion so handleFlush can call it without circular deps
  const fetchSuggestionRef = useRef(fetchSuggestion)
  useEffect(() => {
    fetchSuggestionRef.current = fetchSuggestion
  }, [fetchSuggestion])

  // ── End call ──
  const handleEndCall = async () => {
    stopCapture()
    try {
      await fetch(`/api/end-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_id: id, language, user_id: user?.id })
      })
    } catch (e) {
      console.error("Failed to end call", e)
    }
    navigate(`/summary/${id}`)
  }

  // ── Stage click handler ──
  const handleStageClick = (idx: number) => {
    setCurrentStage(idx)
  }

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* ── BlackHole Setup Modal ── */}
      {showSetupModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in duration-300">
            <h3 className="text-2xl font-bold text-zinc-900">🔧 Настройка BlackHole для Mac</h3>
            <ol className="flex flex-col gap-3 text-zinc-700 text-sm leading-relaxed">
              {[
                "Скачайте BlackHole 2ch: existentialapps.com/blackhole",
                "Установите и перезапустите Mac",
                "Откройте Audio MIDI Setup (Spotlight → Audio MIDI Setup)",
                'Нажмите "+" → "Create Multi-Output Device"',
                "Поставьте галочки: BlackHole 2ch + ваши наушники",
                'System Settings → Sound → Output → "Multi-Output Device"',
                'Вернитесь в Clozer → выберите "BlackHole 2ch"',
                "Теперь Clozer слышит всё что играет на Mac!"
              ].map((step, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</div>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <Button onClick={() => setShowSetupModal(false)} className="w-full bg-[#00C853] hover:bg-[#00E676] text-white py-5 text-base font-semibold mt-2">
              Понятно
            </Button>
          </div>
        </div>
      )}

      {/* ══════════ LEFT PANEL: Transcript ══════════ */}
      <div className="w-[60%] border-r flex flex-col bg-white">
        <header className="h-14 border-b px-4 flex items-center justify-between shrink-0">
          {/* Device selector */}
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors text-sm font-medium text-zinc-700"
            >
              <span>{isBlackHole ? "🟢" : "🎤"}</span>
              <span className="max-w-[200px] truncate">
                {selectedDeviceLabel || "Выберите устройство"}
              </span>
              <span className="text-zinc-400 text-xs">▼</span>
            </button>

            {showDeviceDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-40 w-72 py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                  Источник звука
                </div>
                {audioDevices.map((device) => (
                  <button
                    key={device.deviceId}
                    onClick={() => {
                      setSelectedDeviceId(device.deviceId)
                      setShowDeviceDropdown(false)
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-50 flex items-center gap-2 ${
                      device.deviceId === selectedDeviceId ? "bg-green-50 text-green-700 font-medium" : "text-zinc-700"
                    }`}
                  >
                    <span>{device.label.toLowerCase().includes("blackhole") ? "🟢" : "🎤"}</span>
                    <span className="truncate">{device.label}</span>
                    {device.deviceId === selectedDeviceId && <span className="ml-auto text-green-600">✓</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Status indicator */}
            {stream ? (
              <span className="text-xs font-medium text-green-600 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {isBlackHole ? "Системный звук подключён" : "Микрофон подключён"}
              </span>
            ) : (
              <span className="text-xs text-zinc-400">Ready</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSetupModal(true)}
              className="text-xs text-zinc-400 hover:text-zinc-600 underline underline-offset-2 transition-colors"
            >
              Как настроить
            </button>
            <div className="text-zinc-500 font-mono text-sm">Live</div>
          </div>
        </header>

        {/* Transcript area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {transcripts.length === 0 && !stream && (
            <div className="text-zinc-400 text-center mt-10">
              {language === "ru"
                ? 'Нажмите "Слушать" чтобы начать аудио транскрипцию.'
                : 'Click "Start Listening" to begin audio transcription.'}
            </div>
          )}
          {captureError && (
            <div className="mb-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium flex gap-2 items-start">
              <span>❌</span> {captureError.message}
            </div>
          )}
          {transcripts.map((t) => (
            <div key={t.id} className="mb-2">
              <span className="text-zinc-400 font-medium text-sm mr-3">{t.speaker}</span>
              <span className="leading-relaxed text-[#111111]">
                {t.text}
              </span>
            </div>
          ))}
          {interimText && (
            <div className="mb-2">
              <span className="text-zinc-400 font-medium text-sm mr-3">Customer:</span>
              <span className="leading-relaxed text-zinc-400 italic">{interimText}</span>
            </div>
          )}
        </div>

        {/* Debug status bar */}
        <div className="p-2 border-t bg-zinc-100 flex items-center justify-between text-xs font-mono text-zinc-500 shrink-0">
          <div className="flex items-center gap-4">
            <span>🎤 {selectedDeviceLabel || "none"}</span>
            <span>📡 Deepgram: {socketStatus}</span>
          </div>
          <div>📝 Слов: {wordCount}</div>
        </div>

        {/* Action buttons */}
        <div className="p-4 border-t bg-zinc-50 shrink-0 flex gap-4">
          {!stream ? (
            <Button onClick={() => startCapture()} className="w-full bg-[#00C853] hover:bg-[#00E676] text-white">
              {t("livecall_start")}
            </Button>
          ) : (
            <Button onClick={stopCapture} variant="outline" className="w-full font-medium text-zinc-700">
              {t("livecall_stop")}
            </Button>
          )}
        </div>
      </div>

      {/* ══════════ RIGHT PANEL: AI Suggestions ══════════ */}
      <div className="w-[40%] flex flex-col bg-[#FAFAFA]">
        <header className="h-14 border-b px-6 flex items-center justify-between shrink-0">
          <h2 className="font-medium text-zinc-900 flex items-center gap-2">
            <span className="text-xl">💡</span> {t("livecall_suggestions_title")}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {/* ── Stage Tracker ── */}
          {hasScript === true && (
            <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-2">
              {STAGES.map((stage, idx) => {
                const isCurrent = idx === currentStage
                const isCompleted = completedStages[idx]
                return (
                  <button
                    key={stage.key}
                    onClick={() => handleStageClick(idx)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-green-100 text-green-700 ring-2 ring-green-300"
                        : isCompleted
                        ? "bg-zinc-100 text-zinc-400"
                        : "bg-zinc-50 text-zinc-400"
                    }`}
                  >
                    {isCompleted && !isCurrent ? "✓" : isCurrent ? "●" : ""}{" "}
                    {language === "ru" ? stage.ru : stage.en}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── No script banner ── */}
          {hasScript === false && (
            <Link
              to="/settings"
              className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm font-medium hover:bg-amber-100 transition-colors"
            >
              <span>📝</span>
              <span>Добавьте скрипт в настройках для более точных подсказок →</span>
            </Link>
          )}

          {/* ── Current suggestion card ── */}
          {suggestion ? (
            suggestionMode === "objection" ? (
              // Red objection card
              <div className="bg-red-50 rounded-xl border border-red-200 shadow-sm p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">⚠️</span>
                  <span className="text-red-700 font-bold text-sm">Возражение: {objectionType}</span>
                </div>
                <div className="text-red-600 font-semibold text-xs uppercase tracking-wide mb-1">Скажи:</div>
                <div className="text-zinc-900 text-[17px] leading-[1.6]">
                  {suggestion.replace(/(Скажи:|Say:)\s*/gi, "").replace(/^["']|["']$/g, "")}
                </div>
              </div>
            ) : suggestionMode === "script" ? (
              // Blue script card
              <div className="bg-blue-50 rounded-xl border border-blue-200 shadow-sm p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">📋</span>
                  <span className="text-blue-700 font-bold text-sm">
                    По скрипту • Этап {currentStage + 1}/5
                  </span>
                </div>
                <div className="text-blue-600 font-semibold text-xs uppercase tracking-wide mb-1">Скажи:</div>
                <div className="text-zinc-900 text-[17px] leading-[1.6]">
                  {suggestion.replace(/(Скажи:|Say:)\s*/gi, "").replace(/^["']|["']$/g, "")}
                </div>
              </div>
            ) : (
              // Default green suggestion card
              <div className="bg-white rounded-xl border shadow-sm p-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="text-[#00C853] font-bold mb-2">{language === "ru" ? "Скажи:" : "Say:"}</div>
                <div className="text-[#111111] text-[18px] leading-[1.6]">
                  {suggestion.replace(/(Скажи:|Say:)\s*/gi, "").replace(/^["']|["']$/g, "")}
                </div>
              </div>
            )
          ) : isAnalyzing ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 animate-pulse">
              <div className="h-4 bg-zinc-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-zinc-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-zinc-200 rounded w-3/4"></div>
            </div>
          ) : (
            <div className="text-zinc-400 text-center mt-10">
              {language === "ru" ? "Ожидание диалога..." : "Waiting for customer input..."}
            </div>
          )}

          {/* ── Previous suggestions ── */}
          {previousSuggestions.length > 0 && (
            <div className="flex flex-col gap-3 opacity-40">
              {previousSuggestions.map((prev, i) => (
                <div key={i} className="bg-white rounded-xl border p-5">
                  <div className="text-[#00C853] font-bold mb-1 text-sm">{language === "ru" ? "Скажи:" : "Say:"}</div>
                  <div className="text-zinc-900 leading-relaxed">
                    {prev.replace(/(Скажи:|Say:)\s*/gi, "").replace(/^["']|["']$/g, "")}
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
            {t("livecall_end_call")}
          </Button>
        </div>
      </div>
    </div>
  )
}
