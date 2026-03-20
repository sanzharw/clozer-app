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
      
      // DO NOT stop the video track, or Chrome instantly terminates the entire audio capture session!
      // The MediaRecorder configured as 'audio/webm' will naturally ignore the video stream.
      
      if (mediaStream.getAudioTracks().length === 0) {
        mediaStream.getTracks().forEach(t => t.stop())
        throw new Error("No audio track found. You must check 'Share tab audio'.")
      }
      
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
