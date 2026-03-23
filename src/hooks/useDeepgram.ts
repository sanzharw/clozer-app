/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useRef, useCallback } from "react"

export type TranscriptLine = {
  id: string
  speaker: string
  text: string
  isFinal: boolean
  timestamp: number
}

const MERGE_DELAY = 1500 // 1.5 seconds merge window

export function useDeepgram(stream: MediaStream | null, language: string = 'ru') {
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([])
  const [interimText, setInterimText] = useState<string>("")
  const [socketStatus, setSocketStatus] = useState<string>("disconnected")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  
  // Accumulation refs
  const accumulatedTextRef = useRef<string>("")
  const mergeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const finalize = useCallback(() => {
    const text = accumulatedTextRef.current.trim()
    if (text.length > 5) {
      setTranscripts((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          speaker: "Customer:",
          text,
          isFinal: true,
          timestamp: Date.now()
        }
      ])
      accumulatedTextRef.current = ""
      setInterimText("")
    }
  }, [])

  useEffect(() => {
    if (!stream) {
      setSocketStatus("disconnected")
      return
    }

    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY
    if (!apiKey) {
      console.error("Missing VITE_DEEPGRAM_API_KEY")
      return
    }

    setSocketStatus("connecting")

    const setupConnection = () => {
      try {
        const socket = new WebSocket(
          `wss://api.deepgram.com/v1/listen?language=${language}&model=nova-2&punctuate=true&interim_results=true&endpointing=1500&utterance_end_ms=1500&vad_events=true`,
          ['token', apiKey]
        )
        socketRef.current = socket

        socket.onopen = () => {
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
            const transcript = data.channel?.alternatives?.[0]?.transcript
            const isFinal = data.is_final
            const speechFinal = data.speech_final

            if (transcript && transcript.trim() !== '') {
              if (isFinal) {
                // Accumulate final text
                accumulatedTextRef.current += (accumulatedTextRef.current ? " " : "") + transcript

                // Reset merge timer
                if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current)

                // Smart trigger: if text ends with punctuation, finalize immediately
                if (accumulatedTextRef.current.match(/[.?!।…]$/)) {
                  finalize()
                } else if (speechFinal) {
                  // Speech final but no punctuation — short delay then finalize
                  mergeTimerRef.current = setTimeout(() => {
                    finalize()
                  }, MERGE_DELAY)
                } else {
                  // Not speech final, wait for more
                  mergeTimerRef.current = setTimeout(() => {
                    finalize()
                  }, MERGE_DELAY)
                }

                // Show accumulated text as interim while waiting
                setInterimText(accumulatedTextRef.current)
              } else {
                // Interim result — show as preview
                const preview = accumulatedTextRef.current
                  ? accumulatedTextRef.current + " " + transcript
                  : transcript
                setInterimText(preview)
              }
            }
          } catch (e) {
            console.error("Error parsing Deepgram message:", e)
          }
        }

        socket.onerror = (err) => {
          console.error("Deepgram Error:", err)
          setSocketStatus("error")
        }

        socket.onclose = () => {
          console.log("Deepgram connection closed")
          setSocketStatus("disconnected")
          // Finalize any remaining accumulated text
          if (accumulatedTextRef.current.trim().length > 5) {
            finalize()
          }
        }
      } catch (err) {
        console.error("Failed to setup socket", err)
        setSocketStatus("error")
      }
    }

    setupConnection()

    return () => {
      if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current)
      // Finalize remaining text before cleanup
      if (accumulatedTextRef.current.trim().length > 5) {
        finalize()
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close()
      }
    }
  }, [stream, language, finalize])

  return { transcripts, setTranscripts, interimText, socketStatus }
}
