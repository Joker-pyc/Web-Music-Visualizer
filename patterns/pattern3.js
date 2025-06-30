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
            this.audioContext = new(window.AudioContext || window.webkitAudioContext)();
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
        if (!this.dataArray) return {
            bass: 0,
            mid: 0,
            treble: 0
        };

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
    constructor(canvas, initialHue) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.baseHue = initialHue || Math.random() * 360;
        this.reset();
    }

    reset() {
        this.angle = Math.random() * Math.PI * 2;
        this.distance = Math.random() * 10;
        this.speed = Math.random() * 2 + 1;
        this.life = 1;
        this.decay = (Math.random() * 0.005) + 0.005;

        this.baseLength = Math.random() * 40 + 30;
        this.baseWidth = Math.random() * 6 + 3;
        this.length = this.baseLength;
        this.width = this.baseWidth;
    }

    update(bands, beatDetected, centerX, centerY) {
        if (bands) {
            const speedBoost = bands.mid * 0.15;
            this.speed += speedBoost;

            const trebleEffect = (bands.treble - 0.2) * 60;
            this.length = Math.max(10, this.baseLength + trebleEffect);

            const bassEffect = (bands.bass - 0.2) * 20;
            this.width = Math.max(2, this.baseWidth + bassEffect);
        }

        if (beatDetected) {
            this.speed *= 2.8;
            this.life = 1.2;
        }

        this.distance += this.speed;
        this.speed *= 0.97;
        this.life -= this.decay;

        const maxDist = Math.max(centerX, centerY);
        if (this.distance > maxDist + this.length || this.life <= 0) {
            this.reset();
        }
    }

    draw(centerX, centerY, bands) {
        if (this.life <= 0) return;

        const x1 = centerX + Math.cos(this.angle) * this.distance;
        const y1 = centerY + Math.sin(this.angle) * this.distance;

        const baseDistance = this.distance - this.length;
        const x_base_center = centerX + Math.cos(this.angle) * baseDistance;
        const y_base_center = centerY + Math.sin(this.angle) * baseDistance;

        const perpAngle = this.angle + Math.PI / 2;
        const halfWidth = this.width / 2;

        const x2 = x_base_center + Math.cos(perpAngle) * halfWidth;
        const y2 = y_base_center + Math.sin(perpAngle) * halfWidth;

        const x3 = x_base_center - Math.cos(perpAngle) * halfWidth;
        const y3 = y_base_center - Math.sin(perpAngle) * halfWidth;

        let hue = this.baseHue;
        if (bands) {
            hue = (this.baseHue + (bands.bass * 60)) % 360;
        }

        const lightness = Math.min(85, 50 + this.life * 35);
        const alpha = Math.max(0, this.life * 0.95);

        const tipColor = `hsla(${hue}, 100%, ${lightness}%, ${alpha})`;
        const baseColor = `hsla(${(hue + 50) % 360}, 80%, ${lightness - 20}%, 0)`;

        const gradient = this.ctx.createLinearGradient(x1, y1, x_base_center, y_base_center);
        gradient.addColorStop(0, tipColor);
        gradient.addColorStop(1, baseColor);

        this.ctx.fillStyle = gradient;

        if (bands) {
            this.ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.8)`;
            this.ctx.shadowBlur = this.width * 1.5 + (bands.bass * 15);
        }

        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.lineTo(x3, y3);
        this.ctx.closePath();
        this.ctx.fill();
    }
}

class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.particleCount = window.innerWidth < 768 ? 150 : 250;
        this.centerX = 0;
        this.centerY = 0;
        this.baseHue = Math.random() * 360;
        this.beatFlash = 0;

        this.initParticles();
        this.resize();
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            const hue = this.baseHue + (Math.random() - 0.5) * 80;
            this.particles.push(new Particle(this.canvas, hue));
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
    }

    update(bands, beatDetected) {
        if (beatDetected) {
            this.baseHue = (this.baseHue + 25) % 360;
            this.beatFlash = 1.0;
        }

        this.beatFlash *= 0.92;

        this.particles.forEach(p => {
            if (beatDetected) {
                p.baseHue = (this.baseHue + (Math.random() - 0.5) * 80) % 360;
            }
            p.update(bands, beatDetected, this.centerX, this.centerY);
        });
    }

    render(bands, beatDetected) {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.shadowBlur = 0;
        this.ctx.shadowColor = 'transparent';

        this.particles.forEach(p => {
            p.draw(this.centerX, this.centerY, bands);
        });

        this.ctx.shadowBlur = 0;
        this.ctx.shadowColor = 'transparent';

        if (this.beatFlash > 0.01) {
            const flashRadius = Math.max(this.canvas.width, this.canvas.height) * 0.7;
            const gradient = this.ctx.createRadialGradient(this.centerX, this.centerY, 0, this.centerX, this.centerY, flashRadius);
            const bass = bands ? bands.bass : 0.2;
            const alpha = this.beatFlash * 0.5 * (0.5 + bass);

            gradient.addColorStop(0, `hsla(${this.baseHue}, 100%, 80%, ${alpha})`);
            gradient.addColorStop(0.1, `hsla(${this.baseHue}, 100%, 70%, ${alpha * 0.5})`);
            gradient.addColorStop(0.4, `hsla(${(this.baseHue + 60) % 360}, 100%, 60%, ${alpha * 0.1})`);
            gradient.addColorStop(1, 'hsla(0, 0%, 0%, 0)');

            this.ctx.globalCompositeOperation = 'lighter';
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        this.ctx.restore();
    }
}


class MusicVisualizer {
    constructor() {
        this.audio = document.getElementById('audio');
        this.canvas = document.getElementById('canvas');
        this.audioEngine = new AudioEngine();
        this.particleSystem = new ParticleSystem(this.canvas);
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
        this.particleSystem.render(bands, beatDetected);
        this.updateFrequencyBars(frequencyData);

        this.animationId = requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MusicVisualizer();
});