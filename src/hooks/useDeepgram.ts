/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useRef, useCallback } from "react"

export type TranscriptLine = {
  id: string
  speaker: string
  text: string
  isFinal: boolean
  timestamp: number
}

export function useDeepgram(
  stream: MediaStream | null,
  language: string = 'ru',
  onFlush?: (fullSentence: string) => void
) {
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([])
  const [interimText, setInterimText] = useState<string>("")
  const [socketStatus, setSocketStatus] = useState<string>("disconnected")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isStoppedRef = useRef(false)

  // Buffer-based accumulation
  const bufferRef = useRef<{ text: string; timer: ReturnType<typeof setTimeout> | null }>({
    text: '',
    timer: null
  })
  const onFlushRef = useRef(onFlush)

  // Keep onFlush ref up to date without re-triggering effect
  useEffect(() => {
    onFlushRef.current = onFlush
  }, [onFlush])

  const flushBuffer = useCallback(() => {
    if (bufferRef.current.timer) {
      clearTimeout(bufferRef.current.timer)
      bufferRef.current.timer = null
    }
    
    const text = bufferRef.current.text.trim()
    bufferRef.current.text = ''

    if (text.length < 4) return

    // Add as one complete transcript line
    setTranscripts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        speaker: "Customer:",
        text: text,
        isFinal: true,
        timestamp: Date.now()
      }
    ])

    // Trigger suggestion with the full combined sentence
    onFlushRef.current?.(text)
    setInterimText("")
  }, [])

  useEffect(() => {
    if (!stream) {
      isStoppedRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      setSocketStatus("disconnected")
      return
    }

    isStoppedRef.current = false

    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY
    if (!apiKey) {
      console.error("Missing VITE_DEEPGRAM_API_KEY")
      return
    }

    setSocketStatus("connecting")

    const setupConnection = () => {
      try {
        const socket = new WebSocket(
          `wss://api.deepgram.com/v1/listen?language=${language}&model=nova-2&smart_format=true&interim_results=true&utterance_end_ms=1800&vad_events=true`,
          ['token', apiKey]
        )
        socketRef.current = socket

        socket.onopen = () => {
          reconnectAttemptRef.current = 0
          setSocketStatus("connected")
          console.log("Deepgram socket connected")

          try {
            let mimeType;
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
              mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
              mimeType = 'audio/webm';
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
              mimeType = 'audio/mp4';
            }

            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

            recorder.addEventListener("dataavailable", (event) => {
              if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                socket.send(event.data)
              }
            })

            recorder.start(250) // send chunks every 250ms
            mediaRecorderRef.current = recorder
          } catch (err) {
            console.error("Failed to start MediaRecorder:", err)
            setSocketStatus("error")
          }
        }

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)

            // ONLY flush on UtteranceEnd — remove ALL other triggers
            if (data.type === 'UtteranceEnd') {
              flushBuffer()
              return
            }

            const alt = data.channel?.alternatives?.[0]
            if (!alt) return
            
            const transcript = alt.transcript?.trim()
            if (!transcript) return

            if (data.is_final) {
              // Silently accumulate — never show as separate line
              bufferRef.current.text = (bufferRef.current.text + ' ' + transcript).trim()
              
              // Show as grey italic interim
              setInterimText('🎤 ' + bufferRef.current.text + '...')
              
              // Safety timer — flush after 2500ms no matter what
              if (bufferRef.current.timer) {
                clearTimeout(bufferRef.current.timer)
              }
              bufferRef.current.timer = setTimeout(flushBuffer, 2500)
              
            } else {
              // Pure interim — show combined buffer + current
              setInterimText('🎤 ' + 
                (bufferRef.current.text + ' ' + transcript).trim() + '...')
            }
          } catch (e) {
            console.error("Error parsing Deepgram message:", e)
          }
        }

        socket.onerror = (err) => {
          console.error("Deepgram Error:", err)
          setSocketStatus("error")
        }

        socket.onclose = (event) => {
          console.log("Deepgram connection closed", event.code, event.reason)
          setSocketStatus("disconnected")
          // Flush any remaining buffered text
          flushBuffer()

          // Don't reconnect if manually stopped or auth error
          if (event.code === 1000 || event.code === 1008 || isStoppedRef.current) return

          const attempt = reconnectAttemptRef.current
          if (attempt >= 5) {
            console.error("Deepgram: max reconnect attempts reached")
            setSocketStatus("error")
            return
          }

          const delay = Math.min(1000 * 2 ** attempt, 15000) // 1s, 2s, 4s, 8s, 15s
          console.log(`Deepgram: reconnecting in ${delay}ms (attempt ${attempt + 1})`)
          reconnectAttemptRef.current = attempt + 1
          reconnectTimerRef.current = setTimeout(() => setupConnection(), delay)
        }
      } catch (err) {
        console.error("Failed to setup socket", err)
        setSocketStatus("error")
      }
    }

    setupConnection()

    return () => {
      isStoppedRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (bufferRef.current.timer) clearTimeout(bufferRef.current.timer)
      // Flush remaining text before cleanup
      flushBuffer()
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close()
      }
    }
  }, [stream, language, flushBuffer])

  return { transcripts, setTranscripts, interimText, socketStatus }
}
