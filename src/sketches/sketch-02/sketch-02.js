const canvasSketch = require("canvas-sketch");
const math = require("canvas-sketch-util/math");
const random = require("canvas-sketch-util/random");
const Tweakpane = require("tweakpane");
const { AudioManager } = require("../../utils/AudioManager");

const settings = {
  dimensions: [1080, 1080],
  animate: true,
};

const params = {
  debug: true, // Toggle debug visualization
  volumeMultiplier: 5, // Control volume effect strength
  debugHeight: 100, // Height of debug panel
  arcWidthMultiplier: 2,    // How much volume affects line width
  arcRadiusMultiplier: 0.5, // How much volume affects radius
  arcLengthMultiplier: 1,   // How much volume affects arc length
  rotationSpeed: 0.02,  // Add this new parameter
  rectScaleMultiplier: 1.0,    // How much volume affects rectangle scale
  rectHeightMultiplier: 1.0,   // How much volume affects rectangle height
  rectOffsetMultiplier: 0.5,   // How much volume affects rectangle position
};

const audioManager = new AudioManager();

const sketch = () => {
  // Store init values for each arc (these are random)
  const arcs = Array.from({ length: 12 }, () => ({
    scale: random.range(0.1, 2),
    heightScale: random.range(0.2, 0.5),
    rectOffset: random.range(0, -0.5),
    lineWidth: random.range(5, 20),
    arcRadius: random.range(0.7, 1.3),
    arcStart: random.range(1, -5),
    arcEnd: random.range(0, 8),
  }));

  // Helper function to draw debug info
  const drawDebug = (context, width, volume, metrics = {}) => {
    const debugH = params.debugHeight;

    // background
    context.fillStyle = "rgba(0, 0, 0, 0.1)";
    context.fillRect(0, 0, width, debugH);

    // volume bar
    context.fillStyle = "rgba(255, 0, 0, 0.5)";
    context.fillRect(0, 0, width * volume, 20);

    // text information with access to metrics
    context.fillStyle = "black";
    context.font = "12px monospace";
    context.fillText(`Current Volume: ${volume.toFixed(3)}`, 10, 35);
    context.fillText(`Peak Volume: ${(metrics.peakVolume || 0).toFixed(3)}`, 10, 50);
    context.fillText(`Average Volume: ${(metrics.averageVolume || 0).toFixed(3)}`, 10, 65);
    context.fillText(
      `Rectangle Width Multiplier: ${(1 + volume * params.volumeMultiplier).toFixed(2)}x`,
      10,
      80
    );
  };

  return ({ context, width, height, frame = 0 }) => {
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "black";

    // audio data
    const audioData = audioManager.getAudioData();
    const volume = audioData.volume || 0;

    if (params.debug) {
      drawDebug(context, width, volume, audioData.metrics);
    }

    // Adjust drawing area for debug panel
    const drawingOffset = params.debug ? params.debugHeight : 0;
    const cx = width * 0.5;
    const cy = (height - drawingOffset) * 0.5 + drawingOffset;
    const baseWidth = width * 0.01; // Base width for rectangles
    const h = height * 0.1;
    let x, y;

    const num = 12;
    const radius = width * 0.3;

    // Add animation factor based on frame
    const rotation = frame * params.rotationSpeed;

    for (let i = 0; i < num; i++) {
      const slice = math.degToRad(360 / num);
      const angle = slice * i + rotation; // Add rotation to angle
      const arc = arcs[i];

      x = cx + radius * Math.sin(angle);
      y = cy + radius * Math.cos(angle);

      // Modify rectangle width based on audio volume
      const w = baseWidth * (1 + volume * params.volumeMultiplier);

      // Draw rectangles using stored random values
      context.save();
      context.translate(x, y);
      context.rotate(-angle);

      // Modify scale based on volume
      const volumeScale = 1 + volume * params.rectScaleMultiplier;
      const volumeHeight = 1 + volume * params.rectHeightMultiplier;
      context.scale(
        arc.scale * volumeScale, 
        arc.heightScale * volumeHeight
      );

      // Modify offset based on volume
      const offsetWithVolume = h * arc.rectOffset * (1 + volume * params.rectOffsetMultiplier);

      context.beginPath();
      context.rect(-w * 0.5, offsetWithVolume, w, h);
      context.fill();
      context.restore();

      // Draw arcs using stored random values
      context.save();
      context.translate(cx, cy);
      context.rotate(-angle);

      // Modify line width based on volume
      context.lineWidth = arc.lineWidth * (1 + volume * params.volumeMultiplier);

      // Modify arc radius based on volume
      const dynamicRadius = radius * arc.arcRadius * (1 + volume * 0.5);

      // Modify arc length based on volume
      const arcStart = slice * arc.arcStart * (1 + volume);
      const arcEnd = slice * arc.arcEnd * (1 + volume);

      context.beginPath();
      context.arc(
        0,
        0,
        dynamicRadius,
        arcStart,
        arcEnd
      );
      context.stroke();
      context.restore();
    }
  };
};

// Add UI controls for audio
const createPane = () => {
  const pane = new Tweakpane.Pane();

  const folder = pane.addFolder({ title: "Audio Controls" });
  folder.addInput(params, "debug", { label: "Show Debug" });
  folder.addInput(params, "volumeMultiplier", {
    label: "Volume Effect",
    min: 0,
    max: 10,
    step: 0.1,
  });
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
  folder.addInput(params, "arcWidthMultiplier", {
    label: "Arc Width Effect",
    min: 0,
    max: 5,
    step: 0.1,
  });
  folder.addInput(params, "arcRadiusMultiplier", {
    label: "Arc Radius Effect",
    min: 0,
    max: 2,
    step: 0.1,
  });
  folder.addInput(params, "arcLengthMultiplier", {
    label: "Arc Length Effect",
    min: 0,
    max: 2,
    step: 0.1,
  });
  folder.addInput(params, "rotationSpeed", {
    label: "Rotation Speed",
    min: -0.1,
    max: 0.1,
    step: 0.001,
  });
  folder.addInput(params, "rectScaleMultiplier", {
    label: "Rectangle Scale Effect",
    min: 0,
    max: 3,
    step: 0.1,
  });
  folder.addInput(params, "rectHeightMultiplier", {
    label: "Rectangle Height Effect",
    min: 0,
    max: 3,
    step: 0.1,
  });
  folder.addInput(params, "rectOffsetMultiplier", {
    label: "Rectangle Position Effect",
    min: 0,
    max: 2,
    step: 0.1,
  });
};

canvasSketch(sketch, settings);
createPane();
