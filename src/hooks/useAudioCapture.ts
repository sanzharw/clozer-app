import { useState, useCallback } from "react"

export function useAudioCapture() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const startCapture = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true // Chrome completely blocks getDisplayMedia if video is false
      })
      
      const audioTrack = mediaStream.getAudioTracks()[0]
      if (!audioTrack) {
        mediaStream.getVideoTracks().forEach(t => t.stop())
        throw new Error("No audio track found. You must check 'Share tab audio'.")
      }
      
      mediaStream.getVideoTracks().forEach(track => track.stop())
      const audioOnlyStream = new MediaStream([audioTrack])
      
      setStream(audioOnlyStream)
      setError(null)
      return audioOnlyStream
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
