import { useEffect, useState, useRef } from "react"

export type TranscriptLine = {
  id: string
  speaker: string
  text: string
  isFinal: boolean
  timestamp: number
}

export function useDeepgram(stream: MediaStream | null, language: string = 'ru') {
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([])
  const [socketStatus, setSocketStatus] = useState<string>("disconnected")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const socketRef = useRef<WebSocket | null>(null)

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
          `wss://api.deepgram.com/v1/listen?language=${language}&model=nova-2&interim_results=true&punctuate=true`,
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

            if (transcript && transcript.trim() !== '') {
              setTranscripts((prev) => {
                const last = prev[prev.length - 1]
                
                // If the last one isn't final, update it
                if (last && !last.isFinal) {
                  const newArr = [...prev]
                  newArr[newArr.length - 1] = {
                    ...last,
                    text: transcript,
                    isFinal
                  }
                  return newArr
                }
                
                // Add new line
                return [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    speaker: "Customer:",
                    text: transcript,
                    isFinal,
                    timestamp: Date.now()
                  }
                ]
              })
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
        }
      } catch (err) {
        console.error("Failed to setup socket", err)
        setSocketStatus("error")
      }
    }

    setupConnection()

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close()
      }
    }
  }, [stream, language])

  return { transcripts, setTranscripts, socketStatus }
}
