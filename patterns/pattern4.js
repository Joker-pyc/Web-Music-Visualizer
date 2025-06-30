
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

class Particle {
    constructor(canvas) {
        this.canvas = canvas;
        this.reset();
        this.baseRadius = Math.random() * 3 + 1;
    }

    reset() {
        this.angle = Math.random() * Math.PI * 2;
        this.radius = Math.random() * 200 + 50;
        this.speed = Math.random() * 0.02 + 0.005;
        this.opacity = Math.random() * 0.5 + 0.5;
        this.color = {
            r: Math.random() * 255,
            g: Math.random() * 255,
            b: Math.random() * 255
        };
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    update(bands, beatDetected) {
        this.angle += this.speed;
        
        if (bands) {
            this.radius += (bands.bass * 50 - 25) * 0.1;
            this.speed = Math.max(0.005, this.speed + bands.mid * 0.01);
        }
        
        if (beatDetected) {
            this.radius += 20;
            this.opacity = Math.min(1, this.opacity + 0.3);
        }
        
        this.life -= this.decay * 0.5;
        if (this.life <= 0) {
            this.reset();
        }
        
        this.opacity = Math.max(0, this.opacity * 0.998);
    }

    draw(ctx, centerX, centerY, bands) {
        const x = centerX + Math.cos(this.angle) * this.radius;
        const y = centerY + Math.sin(this.angle) * this.radius;
        
        let size = this.baseRadius;
        if (bands) {
            size += bands.bass * 3;
        }
        
        ctx.save();
        ctx.globalAlpha = this.opacity * this.life;
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
        gradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 1)`);
        gradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawBloom(ctx, centerX, centerY, bands, bloomIntensity) {
        const x = centerX + Math.cos(this.angle) * this.radius;
        const y = centerY + Math.sin(this.angle) * this.radius;
        
        let size = this.baseRadius * 2;
        if (bands) {
            size += bands.bass * 6;
        }
        
        ctx.save();
        ctx.globalAlpha = this.opacity * this.life * bloomIntensity * 0.6;
        ctx.globalCompositeOperation = 'screen';
        
        // Enhanced glow for bloom effect
        const bloomGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
        bloomGradient.addColorStop(0, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 1)`);
        bloomGradient.addColorStop(0.3, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0.5)`);
        bloomGradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);
        
        ctx.fillStyle = bloomGradient;
        ctx.beginPath();
        ctx.arc(x, y, size * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Add extra bright core
        ctx.globalAlpha = this.opacity * this.life * bloomIntensity;
        const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, size);
        coreGradient.addColorStop(0, `rgba(255, 255, 255, 0.8)`);
        coreGradient.addColorStop(1, `rgba(${this.color.r}, ${this.color.g}, ${this.color.b}, 0)`);
        
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
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
        this.particles = [];
        this.particleCount = window.innerWidth < 768 ? 300 : 500;
        this.centerX = 0;
        this.centerY = 0;
        this.bloomIntensity = 0;
        this.targetBloomIntensity = 0;
        
        this.initParticles();
        this.resize();
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push(new Particle(this.canvas));
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
        this.particles.forEach(particle => {
            particle.update(bands, beatDetected);
        });

        // Update bloom intensity based on audio
        if (bands) {
            this.targetBloomIntensity = (bands.bass + bands.mid + bands.treble) / 3;
            if (beatDetected) {
                this.targetBloomIntensity = Math.min(1, this.targetBloomIntensity + 0.4);
            }
        } else {
            this.targetBloomIntensity = 0;
        }

        // Smooth bloom transition
        this.bloomIntensity += (this.targetBloomIntensity - this.bloomIntensity) * 0.1;
        
        // Apply bloom effect to main canvas
        if (this.bloomIntensity > 0.1) {
            this.canvas.classList.add('bloom');
        } else {
            this.canvas.classList.remove('bloom');
        }
    }

    render(bands) {
        // Clear main canvas
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Clear bloom canvas
        this.bloomCtx.clearRect(0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
        
        // Render particles on main canvas
        this.particles.forEach(particle => {
            particle.draw(this.ctx, this.centerX, this.centerY, bands);
        });

        // Render bloom effect
        if (this.bloomIntensity > 0.05) {
            this.renderBloomEffect(bands);
        }
    }

    renderBloomEffect(bands) {
        // Copy main canvas content to bloom canvas with modifications
        this.bloomCtx.save();
        this.bloomCtx.globalAlpha = this.bloomIntensity * 0.8;
        this.bloomCtx.globalCompositeOperation = 'screen';
        
        // Draw enhanced particles for bloom
        this.particles.forEach(particle => {
            if (particle.opacity > 0.3) {
                particle.drawBloom(this.bloomCtx, this.centerX, this.centerY, bands, this.bloomIntensity);
            }
        });
        
        // Add radial glow effect
        const glowRadius = 200 + (this.bloomIntensity * 300);
        const gradient = this.bloomCtx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, glowRadius
        );
        
        if (bands) {
            const bassColor = `rgba(255, 71, 87, ${this.bloomIntensity * bands.bass * 0.3})`;
            const midColor = `rgba(52, 211, 153, ${this.bloomIntensity * bands.mid * 0.3})`;
            const trebleColor = `rgba(59, 130, 246, ${this.bloomIntensity * bands.treble * 0.3})`;
            
            gradient.addColorStop(0, bassColor);
            gradient.addColorStop(0.5, midColor);
            gradient.addColorStop(1, trebleColor);
        } else {
            gradient.addColorStop(0, `rgba(255, 255, 255, ${this.bloomIntensity * 0.1})`);
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }
        
        this.bloomCtx.fillStyle = gradient;
        this.bloomCtx.fillRect(0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
        
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
            if (intensity > 0.7) {
                bar.style.backgroundColor = 'rgba(255, 71, 87, 0.8)';
            } else if (intensity > 0.4) {
                bar.style.backgroundColor = 'rgba(52, 211, 153, 0.8)';
            } else {
                bar.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            }
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
