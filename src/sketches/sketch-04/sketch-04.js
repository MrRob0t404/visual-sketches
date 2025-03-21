const canvasSketch = require("canvas-sketch");
const random = require("canvas-sketch-util/random");
const math = require("canvas-sketch-util/math");
const Tweakpane = require("tweakpane");
const { AudioManager } = require("../../utils/AudioManager");

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
  volumeScale: 3.0, // Increased from 1.5 to 3.0 for more dramatic effect
  volumeRotation: 1.0, // Increased from 0.5 to 1.0 for more rotation
  showDebug: true, // Toggle debug visualization
  debugBarHeight: 20, // Height of debug bar
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
    const margy =
      (height - gridh) * 0.5 + (params.showDebug ? params.debugBarHeight : 0); // Adjust for debug bar

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
      const angle =
        n * Math.PI * params.amp + volume * Math.PI * params.volumeRotation;
      const volumeInfluence = 1 + volume * params.volumeScale;
      const scale =
        math.mapRange(n, -1, 1, params.scaleMin, params.scaleMax) *
        volumeInfluence;

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
      console.error("Failed to start microphone:", error);
    }
  });

  folder.addButton({ title: "Stop Microphone" }).on("click", () => {
    audioManager.stopMicrophone();
  });
};

// Cleanup on page unload
window.addEventListener("unload", () => {
  audioManager.cleanup();
});

createPane();
canvasSketch(sketch, settings);
