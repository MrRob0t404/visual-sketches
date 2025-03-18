const canvasSketch = require("canvas-sketch");
const random = require("canvas-sketch-util/random");
const math = require("canvas-sketch-util/math");
const Tweakpane = require("tweakpane");

class AudioManager {
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
      volumeSum: 0
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      console.log('Audio Context created:', {
        sampleRate: this.audioContext.sampleRate,
        state: this.audioContext.state
      });

      // Configure analyzer node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.minDecibels = -85;
      this.analyser.maxDecibels = -10;
      console.log('Analyzer configured:', {
        fftSize: this.analyser.fftSize,
        frequencyBinCount: this.analyser.frequencyBinCount,
        smoothingTimeConstant: this.analyser.smoothingTimeConstant
      });

      this.initialized = true;
      console.log('Audio Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
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
          echoCancellation: false,  // Disable echo cancellation
          noiseSuppression: false,  // Disable noise suppression
          autoGainControl: false,   // Disable auto gain
          sampleRate: 44100,        // Set specific sample rate
          channelCount: 1,          // Use mono audio
          latency: 0,               // Minimize latency
        }
      });

      // Log stream details
      const audioTrack = this.stream.getAudioTracks()[0];
      console.log('Microphone stream obtained:', {
        label: audioTrack.label,
        enabled: audioTrack.enabled,
        muted: audioTrack.muted,
        readyState: audioTrack.readyState,
        settings: audioTrack.getSettings()
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
        volumeSum: 0
      };

      console.log('Microphone started successfully');
    } catch (error) {
      console.error('Failed to start microphone:', error);
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
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      // Disconnect the microphone node
      if (this.microphone) {
        this.microphone.disconnect();
        this.microphone = null;
      }

      this.isActive = false;
      console.log('Microphone stopped successfully');
    } catch (error) {
      console.error('Error stopping microphone:', error);
      throw error;
    }
  }

  getAudioData() {
    if (!this.isActive || !this.analyser) return { volume: 0, frequencyData: null };

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(frequencyData);

    // Calculate volume (average of all frequency bins)
    const sum = frequencyData.reduce((acc, val) => acc + val, 0);
    const rawVolume = sum / frequencyData.length / 255; // Normalize to 0-1

    // Apply smoothing
    this.prevVolume = this.prevVolume * this.volumeSmoothing + 
                     rawVolume * (1 - this.volumeSmoothing);

    // Update metrics
    this.updateMetrics(this.prevVolume);

    return {
      volume: this.prevVolume,
      frequencyData: frequencyData,
      metrics: this.metrics
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
      this.metrics.averageVolume = this.metrics.volumeSum / this.metrics.sampleCount;
      
      console.log('Audio Metrics:', {
        timestamp: new Date().toISOString(),
        currentVolume: volume.toFixed(3),
        peakVolume: this.metrics.peakVolume.toFixed(3),
        averageVolume: this.metrics.averageVolume.toFixed(3),
        samples: this.metrics.sampleCount,
        audioContextState: this.audioContext?.state,
        isActive: this.isActive
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

const settings = {
  dimensions: [1080, 1080],
  animate: true,
};

const params = {
  cols: 10,
  rows: 10,
  scaleMin: 1,
  scaleMax: 30,
  freq: 0.001,
  amp: 0.2,
  animate: true,
  frame: 0,
  lineCap: "butt",
  // Audio visualization parameters
  volumeScale: 3.0,     // Increased from 1.5 to 3.0 for more dramatic effect
  volumeRotation: 1.0,  // Increased from 0.5 to 1.0 for more rotation
  showDebug: true,      // Toggle debug visualization
  debugBarHeight: 20,   // Height of debug bar
};

// Create a single instance of AudioManager
const audioManager = new AudioManager();

const sketch = () => {
  return ({ context, width, height, frame }) => {
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);

    // Get audio data
    const audioData = audioManager.getAudioData();
    const volume = audioData.volume || 0;

    // Draw debug visualization if enabled
    if (params.showDebug) {
      context.fillStyle = "rgba(0, 0, 0, 0.1)";
      context.fillRect(0, 0, width, params.debugBarHeight);
      
      // Draw volume bar
      context.fillStyle = "red";
      context.fillRect(0, 0, width * volume, params.debugBarHeight);
      
      // Draw volume text
      context.fillStyle = "black";
      context.font = "12px Arial";
      context.fillText(`Volume: ${volume.toFixed(3)}`, 10, 15);
    }

    const cols = params.cols;
    const rows = params.rows;
    const numCells = rows * cols;

    const gridw = width * 0.8;
    const gridh = height * 0.8;
    const cellw = gridw / cols;
    const cellh = gridh / rows;
    const margx = (width - gridw) * 0.5;
    const margy = (height - gridh) * 0.5 + (params.showDebug ? params.debugBarHeight : 0); // Adjust for debug bar

    for (let i = 0; i < numCells; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = col * cellw;
      const y = row * cellh;
      const w = 0.8 * cellw;
      const h = 0.8 * cellh;

      const f = params.animate ? frame : params.frame;
      
      // Incorporate volume into noise calculation
      const n = random.noise2D(x + f * 10, y, params.freq);
      
      // Add volume influence to angle and scale with more dramatic effect
      const angle = n * Math.PI * params.amp + (volume * Math.PI * params.volumeRotation);
      const volumeInfluence = 1 + (volume * params.volumeScale);
      const scale = math.mapRange(n, -1, 1, params.scaleMin, params.scaleMax) * volumeInfluence;

      // Add color based on volume
      const hue = (volume * 360) % 360;
      context.strokeStyle = `hsl(${hue}, 70%, 50%)`;

      context.save();
      context.translate(x, y);
      context.translate(margx, margy);
      context.translate(cellw * 0.5, cellh * 0.5);
      context.rotate(angle);

      context.lineWidth = scale;
      context.lineCap = params.lineCap;

      context.beginPath();
      context.moveTo(w * -0.5, 0);
      context.lineTo(w * 0.5, 0);
      context.stroke();

      context.restore();
    }
  };
};

const createPane = () => {
  const pane = new Tweakpane.Pane();
  let folder;

  folder = pane.addFolder({ title: "Grid" });
  folder.addInput(params, "lineCap", {
    options: { butt: "butt", round: "round", square: "square" },
  });
  folder.addInput(params, "cols", { min: 2, max: 50, step: 1 });
  folder.addInput(params, "rows", { min: 2, max: 50, step: 1 });
  folder.addInput(params, "scaleMin", { min: 1, max: 100 });
  folder.addInput(params, "scaleMax", { min: 1, max: 100 });

  folder = pane.addFolder({ title: "Noise" });
  folder.addInput(params, "freq", { min: -0.01, max: 0.01 });
  folder.addInput(params, "amp", { min: 0, max: 1 });
  folder.addInput(params, "animate");
  folder.addInput(params, "frame", { min: 0, max: 999 });

  folder = pane.addFolder({ title: "Audio" });
  folder.addInput(params, "volumeScale", { min: 0, max: 5, step: 0.1 });
  folder.addInput(params, "volumeRotation", { min: 0, max: 3, step: 0.1 });
  folder.addInput(params, "showDebug", { label: "Show Debug Bar" });
  folder.addButton({ title: "Start Microphone" }).on("click", async () => {
    try {
      await audioManager.startMicrophone();
    } catch (error) {
      console.error('Failed to start microphone:', error);
    }
  });

  folder.addButton({ title: "Stop Microphone" }).on("click", () => {
    audioManager.stopMicrophone();
  });
};

// Cleanup on page unload
window.addEventListener('unload', () => {
  audioManager.cleanup();
});

createPane();
canvasSketch(sketch, settings);
