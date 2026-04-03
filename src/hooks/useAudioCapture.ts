import { useState, useCallback, useRef, useEffect } from "react"

const STORAGE_KEY = "clozer_audio_device_id"

export type AudioDevice = {
  deviceId: string
  label: string
}

export function useAudioCapture() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string>("")
  const streamRef = useRef<MediaStream | null>(null)

  // Enumerate audio input devices on mount
  useEffect(() => {
    async function loadDevices() {
      try {
        // Need a temp stream to get device labels (browser security)
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        tempStream.getTracks().forEach(t => t.stop())

        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices
          .filter(d => d.kind === "audioinput" && d.deviceId !== "")
          .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }))

        setAudioDevices(audioInputs)

        // Restore from localStorage or auto-select system audio
        const savedId = localStorage.getItem(STORAGE_KEY)
        const systemAudioDevice = audioInputs.find(d => {
          const label = d.label.toLowerCase()
          return label.includes("blackhole") || label.includes("stereo mix")
        })

        if (savedId && audioInputs.some(d => d.deviceId === savedId)) {
          setSelectedDeviceIdState(savedId)
        } else if (systemAudioDevice) {
          setSelectedDeviceIdState(systemAudioDevice.deviceId)
          localStorage.setItem(STORAGE_KEY, systemAudioDevice.deviceId)
        } else if (audioInputs.length > 0) {
          setSelectedDeviceIdState(audioInputs[0].deviceId)
        }
      } catch (err) {
        console.error("Error enumerating audio devices:", err)
      }
    }
    loadDevices()
  }, [])

  const selectedDeviceLabel = audioDevices.find(d => d.deviceId === selectedDeviceId)?.label || ""
  const isSystemAudio = selectedDeviceLabel.toLowerCase().includes("blackhole") || 
                        selectedDeviceLabel.toLowerCase().includes("stereo mix")

  const setSelectedDeviceId = useCallback((deviceId: string) => {
    setSelectedDeviceIdState(deviceId)
    localStorage.setItem(STORAGE_KEY, deviceId)
  }, [])

  const startSystemAudioCapture = useCallback(async () => {
    try {
      // getDisplayMedia requires video:true, we discard video tracks immediately
      const displayStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000
        }
      })

      // Stop video tracks — we only need audio
      displayStream.getVideoTracks().forEach((t: MediaStreamTrack) => t.stop())

      const audioTracks = displayStream.getAudioTracks()
      if (audioTracks.length === 0) {
        setError(new Error("No audio track — make sure to check 'Share tab audio' in the dialog"))
        return null
      }

      // Build a new stream with only audio
      const audioOnlyStream = new MediaStream(audioTracks)
      streamRef.current = audioOnlyStream
      setStream(audioOnlyStream)
      setError(null)
      return audioOnlyStream
    } catch (err) {
      console.error("getDisplayMedia failed:", err)
      setError(err instanceof Error ? err : new Error("Failed to capture system audio"))
      return null
    }
  }, [])

  const startCapture = useCallback(async (deviceId?: string) => {
    const isWindows = navigator.platform.toLowerCase().includes("win") 
      || navigator.userAgent.toLowerCase().includes("windows")
    
    // On Windows without a known system audio device — use getDisplayMedia
    if (isWindows && !isSystemAudio) {
      return startSystemAudioCapture()
    }

    const targetDeviceId = deviceId || selectedDeviceId
    if (!targetDeviceId) {
      setError(new Error("No audio device selected"))
      return null
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: targetDeviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000
        }
      })

      streamRef.current = mediaStream
      setStream(mediaStream)
      setError(null)
      return mediaStream
    } catch (err) {
      console.error("Error capturing audio:", err)
      setError(err instanceof Error ? err : new Error("Failed to capture audio"))
      return null
    }
  }, [selectedDeviceId, isSystemAudio, startSystemAudioCapture])

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setStream(null)
  }, [])

  return {
    stream,
    startCapture,
    stopCapture,
    error,
    audioDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    selectedDeviceLabel,
    isSystemAudio,
    isBlackHole: isSystemAudio,
    isWindows: navigator.userAgent.toLowerCase().includes("windows"),
    startSystemAudioCapture,
  }
}
