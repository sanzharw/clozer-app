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

  // Buffer-based accumulation
  const bufferRef = useRef<string[]>([])
  const utteranceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onFlushRef = useRef(onFlush)

  // Keep onFlush ref up to date without re-triggering effect
  useEffect(() => {
    onFlushRef.current = onFlush
  }, [onFlush])

  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0) return

    const fullSentence = bufferRef.current.join(' ').trim()

    if (fullSentence.length > 3) {
      // Add as one complete transcript line
      setTranscripts((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          speaker: "Customer:",
          text: fullSentence,
          isFinal: true,
          timestamp: Date.now()
        }
      ])

      // Trigger suggestion with the full combined sentence
      onFlushRef.current?.(fullSentence)
    }

    // Reset everything
    bufferRef.current = []
    setInterimText("")
    if (utteranceTimerRef.current) {
      clearTimeout(utteranceTimerRef.current)
      utteranceTimerRef.current = null
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
          `wss://api.deepgram.com/v1/listen?language=${language}&model=nova-2&punctuate=true&smart_format=true&interim_results=true&utterance_end_ms=2000&vad_events=true`,
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

            // Handle UtteranceEnd — customer definitely stopped talking
            if (data.type === 'UtteranceEnd') {
              console.log("UtteranceEnd received — flushing buffer")
              flushBuffer()
              return
            }

            const transcript = data.channel?.alternatives?.[0]?.transcript
            if (!transcript || transcript.trim() === '') return

            const isFinal = data.is_final

            if (isFinal) {
              // Add to buffer — DO NOT show as a transcript line yet
              bufferRef.current.push(transcript.trim())

              // Show combined buffer as grey interim text
              setInterimText(bufferRef.current.join(' '))

              // Reset utterance timer (safety flush after 2s of silence)
              if (utteranceTimerRef.current) clearTimeout(utteranceTimerRef.current)
              utteranceTimerRef.current = setTimeout(flushBuffer, 2000)
            } else {
              // Show interim + buffer as grey preview text
              setInterimText([...bufferRef.current, transcript].join(' '))
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
          // Flush any remaining buffered text
          flushBuffer()
        }
      } catch (err) {
        console.error("Failed to setup socket", err)
        setSocketStatus("error")
      }
    }

    setupConnection()

    return () => {
      if (utteranceTimerRef.current) clearTimeout(utteranceTimerRef.current)
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
