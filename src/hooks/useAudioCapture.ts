import { useState, useCallback, useRef } from "react"

export function useAudioCapture() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const sourceStreamRef = useRef<MediaStream | null>(null)

  const startCapture = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true // Chrome completely blocks getDisplayMedia if video is false
      })
      
      const audioTrack = mediaStream.getAudioTracks()[0]
      if (!audioTrack) {
        mediaStream.getTracks().forEach(t => t.stop())
        throw new Error("No audio track found. You must check 'Share tab audio'.")
      }
      
      // Store the original source stream so we can shut down the video track later!
      sourceStreamRef.current = mediaStream
      
      // Create a clean audio-only stream for the rest of the app to safely consume
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
    // Stop the actual source stream (which kills video too)
    if (sourceStreamRef.current) {
      sourceStreamRef.current.getTracks().forEach((track) => track.stop())
      sourceStreamRef.current = null
    }
    
    // Stop the extracted tracks
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }, [stream])

  return { stream, startCapture, stopCapture, error }
}
