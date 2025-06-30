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

class StellarParticle {
    constructor(canvas, centerX, centerY) {
        this.canvas = canvas;
        this.centerX = centerX;
        this.centerY = centerY;
        this.reset();
    }

    reset() {
        this.x = this.centerX;
        this.y = this.centerY;

        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 2 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.life = 1;
        this.decay = Math.random() * 0.008 + 0.002;
        
        this.baseSize = Math.random() * 2 + 1;
        this.size = this.baseSize;

        const hue = 190 + Math.random() * 120;
        this.color = `hsl(${hue}, 90%, 75%)`;
        this.flashColor = `hsl(${hue}, 100%, 95%)`;
        this.flashLife = 0;
    }

    update(bands, shockwave) {
        this.x += this.vx;
        this.y += this.vy;

        this.vx *= 0.985;
        this.vy *= 0.985;

        this.life -= this.decay;
        this.flashLife = Math.max(0, this.flashLife - 0.05);
        
        if (bands) {
            const acceleration = bands.treble * 0.1;
            this.vx += (Math.random() - 0.5) * acceleration;
            this.vy += (Math.random() - 0.5) * acceleration;
        }

        if (shockwave.active) {
            const dx = this.x - this.centerX;
            const dy = this.y - this.centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (Math.abs(dist - shockwave.radius) < shockwave.thickness) {
                const angle = Math.atan2(dy, dx);
                const pushForce = shockwave.force * (1 - dist/shockwave.maxRadius);
                this.vx += Math.cos(angle) * pushForce;
                this.vy += Math.sin(angle) * pushForce;
                this.flashLife = 1;
            }
        }
        
        if (this.life <= 0) {
            this.reset();
        }
    }

    draw(ctx, bands) {
        if (this.life <= 0.01) return;
        
        this.size = this.baseSize + (bands ? bands.bass * 2 : 0) + this.flashLife * 3;
        
        ctx.fillStyle = this.flashLife > 0 ? `rgba(255, 255, 255, ${this.flashLife})` : this.color;
        ctx.globalAlpha = this.life;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }

    drawBloom(ctx, bands) {
        if (this.life <= 0.01) return;
        
        const bloomSize = this.size * 3 + (bands ? bands.mid * 5 : 0) + this.flashLife * 10;
        const opacity = this.life * 0.5 + this.flashLife * 0.5;

        ctx.globalAlpha = opacity;

        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, bloomSize);
        gradient.addColorStop(0, this.flashColor.replace(')', `, ${0.8 * (this.flashLife + 0.1)})`));
        gradient.addColorStop(0.3, this.color.replace(')', `, ${0.3 * this.life})`));
        gradient.addColorStop(1, this.color.replace(')', ', 0)'));
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, bloomSize, 0, Math.PI * 2);
        ctx.fill();
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
        
        this.shockwave = {
            active: false,
            radius: 0,
            life: 0,
            speed: 5,
            force: 2,
            thickness: 25
        };

        this.resize();
        this.initParticles();
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push(new StellarParticle(this.canvas, this.centerX, this.centerY));
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.bloomCanvas.width = window.innerWidth;
        this.bloomCanvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.shockwave.maxRadius = Math.max(this.centerX, this.centerY);

        this.particles.forEach(p => {
            p.centerX = this.centerX;
            p.centerY = this.centerY;
        });
    }

    update(bands, beatDetected) {
        if (beatDetected) {
            this.shockwave.active = true;
            this.shockwave.radius = 0;
            this.shockwave.life = 1;
        }

        if (this.shockwave.active) {
            this.shockwave.radius += this.shockwave.speed * (1 + (bands ? bands.bass : 0));
            this.shockwave.life -= 0.02;
            if (this.shockwave.life <= 0) {
                this.shockwave.active = false;
            }
        }
        
        this.particles.forEach(particle => {
            particle.update(bands, this.shockwave);
        });
        
        let bloomLevel = bands ? (bands.bass * 0.6 + bands.mid * 0.3 + bands.treble * 0.1) : 0;
        if (beatDetected) bloomLevel = Math.max(bloomLevel, 0.8);
        if (bloomLevel > 0.4) {
            this.canvas.classList.add('bloom');
        } else {
            this.canvas.classList.remove('bloom');
        }
    }

    render(bands) {
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.fillStyle = 'rgba(10, 5, 20, 0.15)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.globalCompositeOperation = 'lighter';
        
        this.bloomCtx.clearRect(0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
        this.bloomCtx.globalCompositeOperation = 'lighter';

        if (bands) {
            this.drawCentralCore(bands);
        }

        if (this.shockwave.active) {
            this.drawShockwave();
        }

        this.particles.forEach(p => {
            p.draw(this.ctx, bands);
            p.drawBloom(this.bloomCtx, bands);
        });

        this.ctx.globalAlpha = 1.0;
        this.bloomCtx.globalAlpha = 1.0;
    }

    drawCentralCore(bands) {
        const baseSize = 10;
        const coreSize = baseSize + bands.bass * 80 + bands.mid * 20;
        
        const coreGradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, coreSize * 0.1,
            this.centerX, this.centerY, coreSize
        );
        coreGradient.addColorStop(0, `hsla(45, 100%, 85%, ${0.9 + bands.bass * 0.1})`);
        coreGradient.addColorStop(0.5, `hsla(30, 100%, 70%, ${0.5 + bands.mid * 0.3})`);
        coreGradient.addColorStop(1, 'hsla(0, 100%, 50%, 0)');

        this.ctx.fillStyle = coreGradient;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, coreSize, 0, Math.PI * 2);
        this.ctx.fill();

        const bloomGradient = this.bloomCtx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, coreSize * 1.5
        );
        bloomGradient.addColorStop(0, `rgba(255, 220, 180, ${bands.bass * 0.6})`);
        bloomGradient.addColorStop(0.7, `rgba(255, 150, 100, ${bands.mid * 0.2})`);
        bloomGradient.addColorStop(1, 'rgba(255, 100, 100, 0)');

        this.bloomCtx.fillStyle = bloomGradient;
        this.bloomCtx.beginPath();
        this.bloomCtx.arc(this.centerX, this.centerY, coreSize * 1.5, 0, Math.PI * 2);
        this.bloomCtx.fill();
    }
    
    drawShockwave() {
        const opacity = this.shockwave.life;
        const radius = this.shockwave.radius;
        
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.7})`;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        this.bloomCtx.strokeStyle = `rgba(220, 180, 255, ${opacity * 0.5})`;
        this.bloomCtx.lineWidth = this.shockwave.thickness * opacity;
        this.bloomCtx.beginPath();
        this.bloomCtx.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2);
        this.bloomCtx.stroke();
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