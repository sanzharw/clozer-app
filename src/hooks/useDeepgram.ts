import { useEffect, useState, useRef } from "react"
import { DeepgramClient } from "@deepgram/sdk"

export type TranscriptLine = {
  id: string
  speaker: string
  text: string
  isFinal: boolean
  timestamp: number
}

export function useDeepgram(stream: MediaStream | null, language: string = 'ru') {
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    if (!stream) return

    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY
    if (!apiKey) {
      console.error("Missing VITE_DEEPGRAM_API_KEY")
      return
    }

    const client = new DeepgramClient({ apiKey })
    
    // Configure Deepgram live stream. In v3+, connect returns the socket directly or needs setup
    const setupConnection = async () => {
      try {
        const connection = await client.listen.v1.connect({
          model: "nova-2",
          language: language,
          smart_format: "true",
          interim_results: "true",
          endpointing: 300,
          Authorization: `Token ${apiKey}`
        } as any)

        connection.on("open", () => {
          console.log("Deepgram connected")

          try {
            let mimeType;
            if (MediaRecorder.isTypeSupported('audio/webm')) {
              mimeType = 'audio/webm';
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
              mimeType = 'audio/mp4';
            }

            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

            recorder.addEventListener("dataavailable", (event) => {
              if (event.data.size > 0 && connection.socket.readyState === 1) {
                connection.socket.send(event.data)
              }
            })

            recorder.start(250) // send chunks every 250ms
            mediaRecorderRef.current = recorder
          } catch (err) {
            console.error("Failed to start MediaRecorder:", err)
          }
        })

        connection.on("message", (data: any) => {
          // If it is a string containing JSON, we need to parse it or if SDK already parsed it
          let msg = data
          if (typeof data === 'string') {
             try { msg = JSON.parse(data) } catch (e) {}
          }

          if (msg.type !== "Results") return
          
          const transcriptStr = msg.channel?.alternatives?.[0]?.transcript
          if (!transcriptStr) return

          const isFinal = msg.is_final

          setTranscripts((prev) => {
            const last = prev[prev.length - 1]
            
            // If the last one isn't final, we update it instead of adding a new one
            if (last && !last.isFinal) {
              const newArr = [...prev]
              newArr[newArr.length - 1] = {
                ...last,
                text: transcriptStr,
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
                text: transcriptStr,
                isFinal,
                timestamp: Date.now()
              }
            ]
          })
        })

        connection.on("error", (err: any) => {
          console.error("Deepgram Error:", err)
        })

        connection.on("close", () => {
          console.log("Deepgram connection closed")
        })

        connection.connect()
      } catch (err) {
        console.error("Failed to setup connection", err)
      }
    }

    setupConnection()

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
    }
  }, [stream])

  return { transcripts, setTranscripts }
}
