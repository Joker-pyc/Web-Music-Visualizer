class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.bufferLength = null;
    this.isInitialized = false;
    this.beatThreshold = 0.35;
    this.lastBeatTime = 0;
    this.beatCooldown = 200;
    this.bassEnergy = 0;
    this.lastBassEnergy = 0;
  }

  async initialize(audioElement) {
    try {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);

      if (!this.source) {
        this.source = this.audioContext.createMediaElementSource(audioElement);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("Audio initialization failed:", error);
      return false;
    }
  }

  getFrequencyData() {
    if (!this.isInitialized) return null;
    this.analyser.getByteFrequencyData(this.dataArray);
    this.lastBassEnergy = this.bassEnergy;
    this.bassEnergy = this.getEnergy(0, 4);
    return this.dataArray;
  }

  getEnergy(startBin, endBin) {
    let sum = 0;
    for (let i = startBin; i < endBin; i++) {
      sum += this.dataArray[i];
    }
    return sum / ((endBin - startBin) * 255);
  }

  detectBeat() {
    if (!this.isInitialized) return false;

    const now = performance.now();
    if (now - this.lastBeatTime < this.beatCooldown) return false;

    const isBeat =
      this.bassEnergy > this.lastBassEnergy &&
      this.bassEnergy > this.beatThreshold;

    if (isBeat) {
      this.lastBeatTime = now;
      return true;
    }
    return false;
  }

  getBands() {
    if (!this.dataArray) return { bass: 0, mid: 0, treble: 0 };

    const bass =
      this.dataArray.slice(0, 64).reduce((sum, val) => sum + val, 0) / 64;
    const mid =
      this.dataArray.slice(64, 192).reduce((sum, val) => sum + val, 0) / 128;
    const treble =
      this.dataArray.slice(192, 512).reduce((sum, val) => sum + val, 0) / 320;

    return {
      bass: bass / 255,
      mid: mid / 255,
      treble: treble / 255,
    };
  }
}

class Particle {
  constructor(canvas, particleShapes) {
    this.canvas = canvas;
    this.particleShapes = particleShapes;
    this.reset();
    this.shape =
      particleShapes[Math.floor(Math.random() * particleShapes.length)];
  }

  reset() {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * this.canvas.width * 0.5 + 50;
    this.x = this.canvas.width / 2 + Math.cos(angle) * radius;
    this.y = this.canvas.height / 2 + Math.sin(angle) * radius;
    this.vx = 0;
    this.vy = 0;
    this.size = Math.random() * 3 + 1;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.04;
    this.life = 1.0;
    this.decay = 0.005 + Math.random() * 0.005;
    this.alpha = 0;
    this.hue = 200 + Math.random() * 60;
  }

  update(bands, beatDetected, center) {
    this.alpha += (1.0 - this.alpha) * 0.05;

    const dx = center.x - this.x;
    const dy = center.y - this.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    const forceX = dx / dist;
    const forceY = dy / dist;
    this.vx += forceX * 0.03;
    this.vy += forceY * 0.03;

    if (beatDetected) {
      const beatStrength = Math.min(2.5, 1.0 + (bands ? bands.bass : 0.5) * 5);
      this.vx -= forceX * beatStrength;
      this.vy -= forceY * beatStrength;
      this.hue = 300 + Math.random() * 60;
    } else {
      this.hue += (200 + Math.random() * 60 - this.hue) * 0.05;
    }

    this.vx *= 0.985;
    this.vy *= 0.985;

    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotationSpeed;

    this.life -= this.decay;
    if (this.life <= 0) {
      this.reset();
    }
  }

  draw(ctx, bands) {
    const currentAlpha = this.alpha * this.life;
    if (currentAlpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = currentAlpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = `hsl(${this.hue}, 90%, 70%)`;
    ctx.scale(this.size, this.size);
    ctx.fill(this.shape);
    ctx.restore();
  }

  drawBloom(ctx, bands, bloomIntensity) {
    const currentAlpha = this.alpha * this.life * bloomIntensity;
    if (currentAlpha <= 0.01) return;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = currentAlpha * 0.8;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = `hsl(${this.hue}, 100%, 80%)`;
    ctx.scale(this.size * 2, this.size * 2);
    ctx.fill(this.shape);
    ctx.restore();
  }
}

class ParticleSystem {
  constructor(canvas, bloomCanvas) {
    this.canvas = canvas;
    this.bloomCanvas = bloomCanvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: false });
    this.bloomCtx = bloomCanvas.getContext("2d", { willReadFrequently: false });
    this.particles = [];
    this.particleShapes = [];
    this.particleCount = window.innerWidth < 768 ? 100 : 250;
    this.centerX = 0;
    this.centerY = 0;
    this.bloomIntensity = 0;
    this.targetBloomIntensity = 0;

    this.createParticleShapes();
    this.initParticles();
    this.resize();
  }

  createParticleShapes() {
    const createShape = (points) => {
      const path = new Path2D();
      path.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        path.lineTo(points[i][0], points[i][1]);
      }
      path.closePath();
      return path;
    };

    this.particleShapes.push(
      createShape([
        [0, -1],
        [-0.866, 0.5],
        [0.866, 0.5],
      ])
    );
    this.particleShapes.push(
      createShape([
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ])
    );
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(new Particle(this.canvas, this.particleShapes));
    }
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.bloomCanvas.width = window.innerWidth;
    this.bloomCanvas.height = window.innerHeight;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
  }

  update(bands, beatDetected) {
    const center = { x: this.centerX, y: this.centerY };

    this.particles.forEach((particle) => {
      particle.update(bands, beatDetected, center);
    });

    if (bands) {
      this.targetBloomIntensity =
        bands.bass * 0.4 + bands.mid * 0.3 + bands.treble * 0.3;
      if (beatDetected) {
        this.targetBloomIntensity = Math.min(
          1,
          this.targetBloomIntensity + 0.6
        );
      }
    } else {
      this.targetBloomIntensity = 0;
    }

    this.bloomIntensity +=
      (this.targetBloomIntensity - this.bloomIntensity) * 0.12;

    if (this.bloomIntensity > 0.15) {
      this.canvas.classList.add("bloom");
    } else {
      this.canvas.classList.remove("bloom");
    }
  }

  render(bands) {
    // Clear canvases
    this.ctx.fillStyle = "rgba(0, 0, 10, 0.1)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.bloomCtx.clearRect(
      0,
      0,
      this.bloomCanvas.width,
      this.bloomCanvas.height
    );
    this.bloomCtx.globalCompositeOperation = "lighter";

    // Draw background
    this.drawBackground(bands);

    // Draw particles
    this.particles.forEach((p) => {
      p.draw(this.ctx, bands);
      p.drawBloom(this.bloomCtx, bands, this.bloomIntensity);
    });

    // Draw waveform and frequency spectrum
    const center = { x: this.centerX, y: this.centerY };
    this.drawWaveform(center, bands);
    this.drawFrequencySpectrum(center, bands);

    // Draw core glow
    this.ctx.save();
    this.ctx.globalCompositeOperation = "lighter";
    this.drawCoreGlow(center, false, bands);
    this.ctx.drawImage(this.bloomCanvas, 0, 0);
    this.ctx.restore();

    this.drawCoreGlow(center, true, bands);
  }

  drawBackground(bands) {
    // Set background to complete black
    this.ctx.fillStyle = "rgb(0, 0, 0)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawWaveform(center, bands) {
    if (!bands) return;

    const data = this.audioEngine?.dataArray;
    if (!data) return;

    const bufferLength = data.length;
    const radius = Math.min(this.canvas.width, this.canvas.height) * 0.2;
    const energy = bands.bass;

    this.ctx.save();
    this.ctx.translate(center.x, center.y);

    this.ctx.strokeStyle = `hsla(${200 + energy * 100}, 90%, 70%, 0.8)`;
    this.ctx.lineWidth = 2 + energy * 4;

    this.ctx.beginPath();
    for (let i = 0; i < bufferLength; i += 4) {
      const v = data[i] / 128.0 - 1.0;
      const angle = (i / bufferLength) * Math.PI * 2 - Math.PI / 2;
      const r = radius * (1 + v * 0.25);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawFrequencySpectrum(center, bands) {
    if (!bands) return;

    const data = this.audioEngine?.dataArray;
    if (!data) return;

    const barCount = 64;
    const radius = Math.min(this.canvas.width, this.canvas.height) * 0.25;

    this.ctx.save();
    this.ctx.translate(center.x, center.y);

    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
      const barHeight = (data[i] / 255) * radius * 0.4;
      const hue = 200 + (i / barCount) * 120;

      this.ctx.save();
      this.ctx.rotate(angle);

      const gradient = this.ctx.createLinearGradient(
        0,
        radius,
        0,
        radius + barHeight
      );
      gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0)`);
      gradient.addColorStop(1, `hsla(${hue}, 90%, 75%, 0.8)`);

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(-2, radius, 4, barHeight);
      this.ctx.restore();
    }
    this.ctx.restore();
  }

  drawCoreGlow(center, isBloomPass, bands) {
    if (!bands) return;

    const energy = bands.bass;
    const radius =
      Math.min(this.canvas.width, this.canvas.height) *
      0.2 *
      (1 + energy * 0.5);
    const ctx = isBloomPass ? this.bloomCtx : this.ctx;

    const gradient = ctx.createRadialGradient(
      center.x,
      center.y,
      0,
      center.x,
      center.y,
      radius
    );

    const hue = 200 + energy * 80;
    gradient.addColorStop(
      0,
      `hsla(${hue}, 100%, 85%, ${isBloomPass ? 0.4 : 0.18})`
    );
    gradient.addColorStop(
      0.5,
      `hsla(${hue + 20}, 100%, 70%, ${isBloomPass ? 0.15 : 0.08})`
    );
    gradient.addColorStop(1, `hsla(${hue + 40}, 100%, 60%, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
  }
}

class MusicVisualizer {
  constructor() {
    this.audio = document.getElementById("audio");
    this.canvas = document.getElementById("canvas");
    this.bloomCanvas = document.getElementById("canvasBloom");
    this.audioEngine = new AudioEngine();
    this.particleSystem = new ParticleSystem(this.canvas, this.bloomCanvas);
    this.isPlaying = false;
    this.animationId = null;
    this.currentTrack = null;

    this.initializeElements();
    this.bindEvents();
    this.createFrequencyBars();

    this.animate();
  }

  initializeElements() {
    this.elements = {
      audioFile: document.getElementById("audioFile"),
      playBtn: document.getElementById("playBtn"),
      musicPlayer: document.getElementById("musicPlayer"),
      trackTitle: document.getElementById("trackTitle"),
      trackArtist: document.getElementById("trackArtist"),
      currentTime: document.getElementById("currentTime"),
      duration: document.getElementById("duration"),
      progressBar: document.getElementById("progressBar"),
      progressFill: document.getElementById("progressFill"),
      nowPlaying: document.getElementById("nowPlaying"),
      nowPlayingText: document.getElementById("nowPlayingText"),
      beatIndicator: document.getElementById("beatIndicator"),
      fullscreenBtn: document.getElementById("fullscreenBtn"),
      waveform: document.getElementById("waveform"),
      volumeBtn: document.getElementById("volumeBtn"),
    };
  }

  bindEvents() {
    this.elements.audioFile.addEventListener("change", (e) =>
      this.handleFileSelect(e)
    );
    this.elements.playBtn.addEventListener("click", () =>
      this.togglePlayPause()
    );
    this.elements.progressBar.addEventListener("click", (e) =>
      this.handleProgressClick(e)
    );
    this.elements.fullscreenBtn.addEventListener("click", () =>
      this.toggleFullscreen()
    );

    this.audio.addEventListener("loadedmetadata", () => this.updateDuration());
    this.audio.addEventListener("timeupdate", () => this.updateProgress());
    this.audio.addEventListener("ended", () => this.handleTrackEnd());

    window.addEventListener("resize", () => this.handleResize());

    document.addEventListener("keydown", (e) => this.handleKeyboard(e));
  }

  createFrequencyBars() {
    const barCount = 32;
    this.frequencyBars = [];

    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement("div");
      bar.className = "frequency-bar";
      this.elements.waveform.appendChild(bar);
      this.frequencyBars.push(bar);
    }
  }

  async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    this.audio.src = url;
    this.currentTrack = {
      name: file.name.replace(/\.[^/.]+$/, ""),
      file: file,
    };

    this.elements.trackTitle.textContent = this.currentTrack.name;
    this.elements.trackArtist.textContent = "Local File";
    this.elements.musicPlayer.style.display = "block";

    this.showNowPlaying(this.currentTrack.name);

    await this.audioEngine.initialize(this.audio);
  }

  async togglePlayPause() {
    if (!this.currentTrack) return;

    try {
      if (this.isPlaying) {
        this.audio.pause();
        this.elements.playBtn.innerHTML = "▶";
        this.isPlaying = false;
      } else {
        if (this.audioEngine.audioContext?.state === "suspended") {
          await this.audioEngine.audioContext.resume();
        }
        await this.audio.play();
        this.elements.playBtn.innerHTML = "⏸";
        this.isPlaying = true;
      }
    } catch (error) {
      console.error("Playback error:", error);
    }
  }

  handleProgressClick(event) {
    if (!this.audio.duration) return;

    const rect = this.elements.progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * this.audio.duration;

    this.audio.currentTime = newTime;
  }

  updateProgress() {
    if (!this.audio.duration) return;

    const percentage = (this.audio.currentTime / this.audio.duration) * 100;
    this.elements.progressFill.style.width = `${percentage}%`;

    this.elements.currentTime.textContent = this.formatTime(
      this.audio.currentTime
    );
    this.elements.progressBar.setAttribute("aria-valuenow", percentage);
  }

  updateDuration() {
    this.elements.duration.textContent = this.formatTime(this.audio.duration);
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  showNowPlaying(trackName) {
    this.elements.nowPlayingText.textContent = `Now Playing: ${trackName}`;
    this.elements.nowPlaying.classList.add("show");

    setTimeout(() => {
      this.elements.nowPlaying.classList.remove("show");
    }, 3000);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  handleKeyboard(event) {
    if (event.target.tagName === "INPUT") return;

    switch (event.code) {
      case "Space":
        event.preventDefault();
        this.togglePlayPause();
        break;
      case "ArrowLeft":
        if (this.audio.currentTime > 5) {
          this.audio.currentTime -= 5;
        }
        break;
      case "ArrowRight":
        if (this.audio.currentTime < this.audio.duration - 5) {
          this.audio.currentTime += 5;
        }
        break;
    }
  }

  handleResize() {
    this.particleSystem.resize();
  }

  handleTrackEnd() {
    this.isPlaying = false;
    this.elements.playBtn.innerHTML = "▶";
  }

  updateFrequencyBars(frequencyData) {
    if (!frequencyData || !this.frequencyBars) return;

    const step = Math.floor(frequencyData.length / this.frequencyBars.length);

    this.frequencyBars.forEach((bar, index) => {
      const value = frequencyData[index * step] || 0;
      const height = Math.max(4, (value / 255) * 40);
      bar.style.height = `${height}px`;

      const intensity = value / 255;
      const hue = intensity * 240 + 180; // Blue to purple range
      const saturation = 60 + intensity * 40;
      const lightness = 40 + intensity * 50;

      bar.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      bar.style.boxShadow =
        intensity > 0.5
          ? `0 0 ${intensity * 10}px hsla(${hue}, ${saturation}%, ${
              lightness + 20
            }%, 0.8)`
          : "none";
    });
  }

  animate() {
    const frequencyData = this.audioEngine.getFrequencyData();
    const bands = this.audioEngine.getBands();
    const beatDetected = this.audioEngine.detectBeat();

    if (beatDetected) {
      this.elements.beatIndicator.classList.add("pulse");
      setTimeout(() => {
        this.elements.beatIndicator.classList.remove("pulse");
      }, 200);
    }

    this.particleSystem.update(bands, beatDetected);
    this.particleSystem.render(bands);
    this.updateFrequencyBars(frequencyData);

    this.animationId = requestAnimationFrame(() => this.animate());
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new MusicVisualizer();
});
