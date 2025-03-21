export class AudioManager {
  constructor() {
    this.initialized = false;
    this.isActive = false;
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.volumeSmoothing = 0.8; // Smoothing factor for volume
    this.prevVolume = 0; // Previous volume for smoothing
    this.stream = null; // Store the media stream
    this.metrics = {
      lastUpdate: 0,
      updateInterval: 1000, // Log metrics every second
      peakVolume: 0,
      averageVolume: 0,
      sampleCount: 0,
      volumeSum: 0,
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      console.log("Audio Context created:", {
        sampleRate: this.audioContext.sampleRate,
        state: this.audioContext.state,
      });

      // Configure analyzer node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.minDecibels = -85;
      this.analyser.maxDecibels = -10;
      console.log("Analyzer configured:", {
        fftSize: this.analyser.fftSize,
        frequencyBinCount: this.analyser.frequencyBinCount,
        smoothingTimeConstant: this.analyser.smoothingTimeConstant,
      });

      this.initialized = true;
      console.log("Audio Manager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize AudioManager:", error);
      throw error;
    }
  }

  async startMicrophone() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // First, stop any existing microphone
      await this.stopMicrophone();

      // Request microphone access with more specific constraints
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // Disable echo cancellation
          noiseSuppression: false, // Disable noise suppression
          autoGainControl: false, // Disable auto gain
          sampleRate: 44100, // Set specific sample rate
          channelCount: 1, // Use mono audio
          latency: 0, // Minimize latency
        },
      });

      // Log stream details
      const audioTrack = this.stream.getAudioTracks()[0];
      console.log("Microphone stream obtained:", {
        label: audioTrack.label,
        enabled: audioTrack.enabled,
        muted: audioTrack.muted,
        readyState: audioTrack.readyState,
        settings: audioTrack.getSettings(),
      });

      // Create and connect the audio nodes
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);
      this.isActive = true;

      // Reset metrics
      this.metrics = {
        lastUpdate: Date.now(),
        updateInterval: 1000,
        peakVolume: 0,
        averageVolume: 0,
        sampleCount: 0,
        volumeSum: 0,
      };

      console.log("Microphone started successfully");
    } catch (error) {
      console.error("Failed to start microphone:", error);
      // Try to clean up any partial initialization
      await this.stopMicrophone();
      throw error;
    }
  }

  async stopMicrophone() {
    if (!this.isActive) return;

    try {
      // Stop all tracks in the stream
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }

      // Disconnect the microphone node
      if (this.microphone) {
        this.microphone.disconnect();
        this.microphone = null;
      }

      this.isActive = false;
      console.log("Microphone stopped successfully");
    } catch (error) {
      console.error("Error stopping microphone:", error);
      throw error;
    }
  }

  getAudioData() {
    if (!this.isActive || !this.analyser)
      return { volume: 0, frequencyData: null };

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(frequencyData);

    // Calculate volume (average of all frequency bins)
    const sum = frequencyData.reduce((acc, val) => acc + val, 0);
    const rawVolume = sum / frequencyData.length / 255; // Normalize to 0-1

    // Apply smoothing
    this.prevVolume =
      this.prevVolume * this.volumeSmoothing +
      rawVolume * (1 - this.volumeSmoothing);

    // Update metrics
    this.updateMetrics(this.prevVolume);

    return {
      volume: this.prevVolume,
      frequencyData: frequencyData,
      metrics: this.metrics,
    };
  }

  updateMetrics(volume) {
    const now = Date.now();

    // Update running metrics
    this.metrics.peakVolume = Math.max(this.metrics.peakVolume, volume);
    this.metrics.volumeSum += volume;
    this.metrics.sampleCount++;

    // Log metrics every second
    if (now - this.metrics.lastUpdate >= this.metrics.updateInterval) {
      this.metrics.averageVolume =
        this.metrics.volumeSum / this.metrics.sampleCount;

      console.log("Audio Metrics:", {
        timestamp: new Date().toISOString(),
        currentVolume: volume.toFixed(3),
        peakVolume: this.metrics.peakVolume.toFixed(3),
        averageVolume: this.metrics.averageVolume.toFixed(3),
        samples: this.metrics.sampleCount,
        audioContextState: this.audioContext?.state,
        isActive: this.isActive,
      });

      // Reset metrics
      this.metrics.lastUpdate = now;
      this.metrics.peakVolume = volume;
      this.metrics.volumeSum = volume;
      this.metrics.sampleCount = 1;
    }
  }

  cleanup() {
    this.stopMicrophone();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.initialized = false;
  }
}
