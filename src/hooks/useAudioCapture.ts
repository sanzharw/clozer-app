import { useState, useCallback } from "react"

export function useAudioCapture() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const startCapture = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      
      setStream(mediaStream)
      setError(null)
      return mediaStream
    } catch (err) {
      console.error("Error capturing audio:", err)
      setError(err instanceof Error ? err : new Error("Failed to capture audio"))
      return null
    }
  }, [])

  const stopCapture = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }, [stream])

  return { stream, startCapture, stopCapture, error }
}
