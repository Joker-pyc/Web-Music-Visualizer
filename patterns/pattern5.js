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
    }

    async initialize(audioElement) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
            console.error('Audio initialization failed:', error);
            return false;
        }
    }

    getFrequencyData() {
        if (!this.isInitialized) return null;
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }

    detectBeat() {
        if (!this.isInitialized) return false;
        
        const now = performance.now();
        if (now - this.lastBeatTime < this.beatCooldown) return false;
        
        const bassRange = this.dataArray.slice(0, 32);
        const average = bassRange.reduce((sum, val) => sum + val, 0) / bassRange.length;
        const normalized = average / 255;
        
        if (normalized > this.beatThreshold) {
            this.lastBeatTime = now;
            return true;
        }
        return false;
    }

    getBands() {
        if (!this.dataArray) return { bass: 0, mid: 0, treble: 0 };
        
        const bass = this.dataArray.slice(0, 64).reduce((sum, val) => sum + val, 0) / 64;
        const mid = this.dataArray.slice(64, 192).reduce((sum, val) => sum + val, 0) / 128;
        const treble = this.dataArray.slice(192, 512).reduce((sum, val) => sum + val, 0) / 320;
        
        return {
            bass: bass / 255,
            mid: mid / 255,
            treble: treble / 255
        };
    }
}

class CrystallineParticle {
    constructor(canvas) {
        this.canvas = canvas;
        this.reset();
        this.baseSize = Math.random() * 4 + 2;
        this.shape = Math.floor(Math.random() * 4); // 0: triangle, 1: diamond, 2: hexagon, 3: star
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
        this.rotation = 0;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.trail = [];
        this.maxTrailLength = 8;
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.life = 1.0;
        this.decay = Math.random() * 0.005 + 0.002;
        this.brightness = Math.random() * 0.8 + 0.2;
        this.hue = Math.random() * 360;
        this.saturation = Math.random() * 50 + 50;
        this.energyLevel = 0;
        this.beatScale = 1;
        this.targetScale = 1;
    }

    update(bands, beatDetected, time) {
        // Update trail
        this.trail.push({ x: this.x, y: this.y, life: 1.0 });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }
        this.trail.forEach(point => {
            point.life *= 0.9;
        });

        // Audio reactive movement
        if (bands) {
            this.energyLevel = (bands.bass + bands.mid + bands.treble) / 3;
            
            // Bass affects horizontal movement
            this.vx += (bands.bass - 0.5) * 0.2;
            // Mid affects vertical movement
            this.vy += (bands.mid - 0.5) * 0.2;
            // Treble affects rotation speed
            this.rotationSpeed = (bands.treble - 0.5) * 0.3;
            
            // Color shifting based on frequency bands
            this.hue = (this.hue + bands.treble * 5) % 360;
            this.brightness = Math.min(1, this.brightness + bands.mid * 0.1);
        }

        // Beat response
        if (beatDetected) {
            this.targetScale = 2.5;
            this.vx += (Math.random() - 0.5) * 4;
            this.vy += (Math.random() - 0.5) * 4;
            this.brightness = Math.min(1, this.brightness + 0.5);
        }

        // Smooth scale animation
        this.beatScale += (this.targetScale - this.beatScale) * 0.15;
        this.targetScale *= 0.95;

        // Position updates
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotationSpeed;

        // Apply friction
        this.vx *= 0.99;
        this.vy *= 0.99;

        // Pulse effect
        this.pulsePhase += 0.1 + this.energyLevel * 0.2;

        // Boundary wrapping
        if (this.x < -50) this.x = this.canvas.width + 50;
        if (this.x > this.canvas.width + 50) this.x = -50;
        if (this.y < -50) this.y = this.canvas.height + 50;
        if (this.y > this.canvas.height + 50) this.y = -50;

        // Life decay
        this.life -= this.decay;
        this.brightness *= 0.999;
        
        if (this.life <= 0 || this.brightness < 0.01) {
            this.reset();
        }
    }

    drawShape(ctx, x, y, size, rotation) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        
        ctx.beginPath();
        
        switch (this.shape) {
            case 0: // Triangle
                ctx.moveTo(0, -size);
                ctx.lineTo(-size * 0.866, size * 0.5);
                ctx.lineTo(size * 0.866, size * 0.5);
                ctx.closePath();
                break;
                
            case 1: // Diamond
                ctx.moveTo(0, -size);
                ctx.lineTo(size, 0);
                ctx.lineTo(0, size);
                ctx.lineTo(-size, 0);
                ctx.closePath();
                break;
                
            case 2: // Hexagon
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI * 2) / 6;
                    const px = Math.cos(angle) * size;
                    const py = Math.sin(angle) * size;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                break;
                
            case 3: // Star
                for (let i = 0; i < 10; i++) {
                    const angle = (i * Math.PI * 2) / 10;
                    const radius = i % 2 === 0 ? size : size * 0.5;
                    const px = Math.cos(angle) * radius;
                    const py = Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                break;
        }
        
        ctx.restore();
    }

    draw(ctx, bands) {
        const pulse = Math.sin(this.pulsePhase) * 0.3 + 1;
        const finalSize = this.baseSize * this.beatScale * pulse * this.life;
        const alpha = this.brightness * this.life;

        // Draw trail
        this.trail.forEach((point, index) => {
            if (point.life > 0.1) {
                const trailAlpha = alpha * point.life * 0.3;
                const trailSize = finalSize * point.life * 0.5;
                
                ctx.save();
                ctx.globalAlpha = trailAlpha;
                
                const gradient = ctx.createRadialGradient(
                    point.x, point.y, 0,
                    point.x, point.y, trailSize * 2
                );
                gradient.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, 70%, 1)`);
                gradient.addColorStop(1, `hsla(${this.hue}, ${this.saturation}%, 70%, 0)`);
                
                ctx.fillStyle = gradient;
                this.drawShape(ctx, point.x, point.y, trailSize, this.rotation * point.life);
                ctx.fill();
                ctx.restore();
            }
        });

        // Draw main particle
        ctx.save();
        ctx.globalAlpha = alpha;
        
        // Core particle
        const coreGradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, finalSize * 2
        );
        coreGradient.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, 90%, 1)`);
        coreGradient.addColorStop(0.7, `hsla(${this.hue + 30}, ${this.saturation}%, 70%, 0.8)`);
        coreGradient.addColorStop(1, `hsla(${this.hue}, ${this.saturation}%, 50%, 0)`);
        
        ctx.fillStyle = coreGradient;
        this.drawShape(ctx, this.x, this.y, finalSize, this.rotation);
        ctx.fill();
        
        // Outer glow
        ctx.globalAlpha = alpha * 0.5;
        const glowGradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, finalSize * 4
        );
        glowGradient.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, 80%, 0.6)`);
        glowGradient.addColorStop(1, `hsla(${this.hue}, ${this.saturation}%, 60%, 0)`);
        
        ctx.fillStyle = glowGradient;
        this.drawShape(ctx, this.x, this.y, finalSize * 2, this.rotation);
        ctx.fill();
        
        ctx.restore();
    }

    drawBloom(ctx, bands, bloomIntensity) {
        const pulse = Math.sin(this.pulsePhase) * 0.5 + 1;
        const finalSize = this.baseSize * this.beatScale * pulse * this.life;
        const alpha = this.brightness * this.life * bloomIntensity;

        if (alpha < 0.05) return;

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = alpha * 0.8;

        // Multiple bloom layers for depth
        for (let i = 0; i < 3; i++) {
            const layerSize = finalSize * (3 + i * 2);
            const layerAlpha = alpha * (0.8 - i * 0.2);
            
            ctx.globalAlpha = layerAlpha;
            
            const bloomGradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, layerSize * 2
            );
            
            const lightness = 70 + i * 10;
            bloomGradient.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, ${lightness}%, 1)`);
            bloomGradient.addColorStop(0.5, `hsla(${this.hue + 20}, ${this.saturation}%, ${lightness - 10}%, 0.5)`);
            bloomGradient.addColorStop(1, `hsla(${this.hue}, ${this.saturation}%, ${lightness - 20}%, 0)`);
            
            ctx.fillStyle = bloomGradient;
            this.drawShape(ctx, this.x, this.y, layerSize, this.rotation + i * 0.5);
            ctx.fill();
        }

        // Add sparkle effect on beats
        if (this.beatScale > 1.5) {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = `hsla(${this.hue}, 100%, 95%, ${alpha})`;
            
            // Draw sparkle rays
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + this.rotation;
                const rayLength = finalSize * 3;
                const startX = this.x + Math.cos(angle) * finalSize;
                const startY = this.y + Math.sin(angle) * finalSize;
                const endX = this.x + Math.cos(angle) * rayLength;
                const endY = this.y + Math.sin(angle) * rayLength;
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.lineWidth = 2;
                ctx.strokeStyle = `hsla(${this.hue}, 100%, 90%, ${alpha * 0.6})`;
                ctx.stroke();
            }
        }

        ctx.restore();
    }
}

class WaveformParticle {
    constructor(canvas, centerX, centerY) {
        this.canvas = canvas;
        this.centerX = centerX;
        this.centerY = centerY;
        this.reset();
    }

    reset() {
        this.angle = Math.random() * Math.PI * 2;
        this.radius = Math.random() * 150 + 100;
        this.baseRadius = this.radius;
        this.speed = Math.random() * 0.02 + 0.01;
        this.size = Math.random() * 2 + 1;
        this.hue = Math.random() * 60 + 180; // Blue-cyan range
        this.life = 1.0;
        this.waveOffset = Math.random() * Math.PI * 2;
    }

    update(bands, beatDetected, time) {
        this.angle += this.speed;
        this.waveOffset += 0.05;

        if (bands) {
            // Create wave patterns based on frequency data
            const wave = Math.sin(this.waveOffset + this.angle * 3) * bands.bass * 50;
            this.radius = this.baseRadius + wave + bands.mid * 30;
            
            // Color shifting
            this.hue = (this.hue + bands.treble * 2) % 360;
        }

        if (beatDetected) {
            this.radius += 40;
            this.size *= 1.5;
        }

        this.size *= 0.99;
        this.life *= 0.998;

        if (this.life < 0.1) {
            this.reset();
        }
    }

    draw(ctx, bands) {
        const x = this.centerX + Math.cos(this.angle) * this.radius;
        const y = this.centerY + Math.sin(this.angle) * this.radius;

        ctx.save();
        ctx.globalAlpha = this.life * 0.8;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, this.size * 3);
        gradient.addColorStop(0, `hsla(${this.hue}, 80%, 80%, 1)`);
        gradient.addColorStop(1, `hsla(${this.hue}, 80%, 60%, 0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, this.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class ParticleSystem {
    constructor(canvas, bloomCanvas) {
        this.canvas = canvas;
        this.bloomCanvas = bloomCanvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: false });
        this.bloomCtx = bloomCanvas.getContext('2d', { willReadFrequently: false });
        
        this.crystallineParticles = [];
        this.waveformParticles = [];
        
        this.particleCount = window.innerWidth < 768 ? 200 : 350;
        this.waveformCount = window.innerWidth < 768 ? 50 : 80;
        
        this.centerX = 0;
        this.centerY = 0;
        this.bloomIntensity = 0;
        this.targetBloomIntensity = 0;
        this.time = 0;
        
        this.initParticles();
        this.resize();
    }

    initParticles() {
        this.crystallineParticles = [];
        this.waveformParticles = [];
        
        for (let i = 0; i < this.particleCount; i++) {
            this.crystallineParticles.push(new CrystallineParticle(this.canvas));
        }
        
        for (let i = 0; i < this.waveformCount; i++) {
            this.waveformParticles.push(new WaveformParticle(this.canvas, this.centerX, this.centerY));
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.bloomCanvas.width = window.innerWidth;
        this.bloomCanvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        
        // Update waveform particles center
        this.waveformParticles.forEach(particle => {
            particle.centerX = this.centerX;
            particle.centerY = this.centerY;
        });
    }

    update(bands, beatDetected) {
        this.time += 0.016; // Approximate 60fps

        this.crystallineParticles.forEach(particle => {
            particle.update(bands, beatDetected, this.time);
        });

        this.waveformParticles.forEach(particle => {
            particle.update(bands, beatDetected, this.time);
        });

        // Update bloom intensity
        if (bands) {
            this.targetBloomIntensity = (bands.bass * 0.4 + bands.mid * 0.3 + bands.treble * 0.3);
            if (beatDetected) {
                this.targetBloomIntensity = Math.min(1, this.targetBloomIntensity + 0.6);
            }
        } else {
            this.targetBloomIntensity = 0;
        }

        this.bloomIntensity += (this.targetBloomIntensity - this.bloomIntensity) * 0.12;
        
        // Apply bloom CSS class
        if (this.bloomIntensity > 0.15) {
            this.canvas.classList.add('bloom');
        } else {
            this.canvas.classList.remove('bloom');
        }
    }

    render(bands) {
        // Clear canvases with trailing effect
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.bloomCtx.clearRect(0, 0, this.bloomCanvas.width, this.bloomCanvas.height);

        // Draw background energy field
        this.drawEnergyField(bands);

        // Render waveform particles first (background layer)
        this.waveformParticles.forEach(particle => {
            particle.draw(this.ctx, bands);
        });

        // Render crystalline particles
        this.crystallineParticles.forEach(particle => {
            particle.draw(this.ctx, bands);
        });

        // Render bloom effects
        if (this.bloomIntensity > 0.05) {
            this.renderBloomEffect(bands);
        }
    }

    drawEnergyField(bands) {
        if (!bands || this.bloomIntensity < 0.1) return;

        const fieldRadius = 200 + this.bloomIntensity * 300;
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, fieldRadius
        );

        const bassHue = 350; // Red-pink
        const midHue = 200;  // Cyan
        const trebleHue = 250; // Purple

        gradient.addColorStop(0, `hsla(${bassHue}, 60%, 50%, ${bands.bass * this.bloomIntensity * 0.1})`);
        gradient.addColorStop(0.5, `hsla(${midHue}, 70%, 60%, ${bands.mid * this.bloomIntensity * 0.08})`);
        gradient.addColorStop(1, `hsla(${trebleHue}, 80%, 70%, ${bands.treble * this.bloomIntensity * 0.06})`);

        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
    }

    renderBloomEffect(bands) {
        this.bloomCtx.save();
        this.bloomCtx.globalCompositeOperation = 'screen';

        // Render particle bloom effects
        this.crystallineParticles.forEach(particle => {
            if (particle.brightness > 0.3) {
                particle.drawBloom(this.bloomCtx, bands, this.bloomIntensity);
            }
        });

        // Add central energy burst
        if (this.bloomIntensity > 0.3) {
            const burstSize = 100 + this.bloomIntensity * 200;
            const burstGradient = this.bloomCtx.createRadialGradient(
                this.centerX, this.centerY, 0,
                this.centerX, this.centerY, burstSize
            );

            if (bands) {
                burstGradient.addColorStop(0, `rgba(255, 255, 255, ${this.bloomIntensity * 0.4})`);
                burstGradient.addColorStop(0.3, `hsla(${180 + bands.bass * 60}, 80%, 70%, ${this.bloomIntensity * 0.3})`);
                burstGradient.addColorStop(0.6, `hsla(${240 + bands.mid * 60}, 70%, 60%, ${this.bloomIntensity * 0.2})`);
                burstGradient.addColorStop(1, `hsla(${300 + bands.treble * 60}, 60%, 50%, 0)`);
            }

            this.bloomCtx.fillStyle = burstGradient;
            this.bloomCtx.fillRect(0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
        }

        this.bloomCtx.restore();
    }
}

class MusicVisualizer {
    constructor() {
        this.audio = document.getElementById('audio');
        this.canvas = document.getElementById('canvas');
        this.bloomCanvas = document.getElementById('canvasBloom');
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
            audioFile: document.getElementById('audioFile'),
            playBtn: document.getElementById('playBtn'),
            musicPlayer: document.getElementById('musicPlayer'),
            trackTitle: document.getElementById('trackTitle'),
            trackArtist: document.getElementById('trackArtist'),
            currentTime: document.getElementById('currentTime'),
            duration: document.getElementById('duration'),
            progressBar: document.getElementById('progressBar'),
            progressFill: document.getElementById('progressFill'),
            nowPlaying: document.getElementById('nowPlaying'),
            nowPlayingText: document.getElementById('nowPlayingText'),
            beatIndicator: document.getElementById('beatIndicator'),
            fullscreenBtn: document.getElementById('fullscreenBtn'),
            waveform: document.getElementById('waveform'),
            volumeBtn: document.getElementById('volumeBtn')
        };
    }

    bindEvents() {
        this.elements.audioFile.addEventListener('change', (e) => this.handleFileSelect(e));
        this.elements.playBtn.addEventListener('click', () => this.togglePlayPause());
        this.elements.progressBar.addEventListener('click', (e) => this.handleProgressClick(e));
        this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.handleTrackEnd());
        
        window.addEventListener('resize', () => this.handleResize());
        
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    createFrequencyBars() {
        const barCount = 32;
        this.frequencyBars = [];
        
        for (let i = 0; i < barCount; i++) {
            const bar = document.createElement('div');
            bar.className = 'frequency-bar';
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
            file: file
        };
        
        this.elements.trackTitle.textContent = this.currentTrack.name;
        this.elements.trackArtist.textContent = 'Local File';
        this.elements.musicPlayer.style.display = 'block';
        
        this.showNowPlaying(this.currentTrack.name);
        
        await this.audioEngine.initialize(this.audio);
    }

    async togglePlayPause() {
        if (!this.currentTrack) return;
        
        try {
            if (this.isPlaying) {
                this.audio.pause();
                this.elements.playBtn.innerHTML = '▶';
                this.isPlaying = false;
            } else {
                if (this.audioEngine.audioContext?.state === 'suspended') {
                    await this.audioEngine.audioContext.resume();
                }
                await this.audio.play();
                this.elements.playBtn.innerHTML = '⏸';
                this.isPlaying = true;
            }
        } catch (error) {
            console.error('Playback error:', error);
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
        
        this.elements.currentTime.textContent = this.formatTime(this.audio.currentTime);
        this.elements.progressBar.setAttribute('aria-valuenow', percentage);
    }

    updateDuration() {
        this.elements.duration.textContent = this.formatTime(this.audio.duration);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    showNowPlaying(trackName) {
        this.elements.nowPlayingText.textContent = `Now Playing: ${trackName}`;
        this.elements.nowPlaying.classList.add('show');
        
        setTimeout(() => {
            this.elements.nowPlaying.classList.remove('show');
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
        if (event.target.tagName === 'INPUT') return;
        
        switch (event.code) {
            case 'Space':
                event.preventDefault();
                this.togglePlayPause();
                break;
            case 'ArrowLeft':
                if (this.audio.currentTime > 5) {
                    this.audio.currentTime -= 5;
                }
                break;
            case 'ArrowRight':
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
        this.elements.playBtn.innerHTML = '▶';
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
            bar.style.boxShadow = intensity > 0.5 ? 
                `0 0 ${intensity * 10}px hsla(${hue}, ${saturation}%, ${lightness + 20}%, 0.8)` : 
                'none';
        });
    }

    animate() {
        const frequencyData = this.audioEngine.getFrequencyData();
        const bands = this.audioEngine.getBands();
        const beatDetected = this.audioEngine.detectBeat();
        
        if (beatDetected) {
            this.elements.beatIndicator.classList.add('pulse');
            setTimeout(() => {
                this.elements.beatIndicator.classList.remove('pulse');
            }, 200);
        }
        
        this.particleSystem.update(bands, beatDetected);
        this.particleSystem.render(bands);
        this.updateFrequencyBars(frequencyData);
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MusicVisualizer();
});