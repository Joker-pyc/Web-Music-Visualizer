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

class SpiralParticle {
    constructor(canvas, type) {
        this.canvas = canvas;
        this.type = type || 'spiral';
        this.reset();
        this.waveOffset = Math.random() * Math.PI * 2;
        this.spiralTightness = Math.random() * 0.5 + 0.2;
        this.morphSpeed = Math.random() * 0.02 + 0.01;
        this.shapePhase = Math.random() * Math.PI * 2;
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.baseSize = Math.random() * 4 + 2;
        this.size = this.baseSize;
        this.opacity = Math.random() * 0.8 + 0.2;
        this.hue = Math.random() * 360;
        this.saturation = Math.random() * 50 + 50;
        this.brightness = Math.random() * 40 + 60;
        this.life = 1.0;
        this.decay = Math.random() * 0.005 + 0.002;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.attractorForce = Math.random() * 0.001 + 0.0005;
    }

    update(bands, beatDetected, centerX, centerY) {
        const dx = centerX - this.x;
        const dy = centerY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        this.vx += (dx / distance) * this.attractorForce;
        this.vy += (dy / distance) * this.attractorForce;
        
        if (bands) {
            const bassInfluence = bands.bass * 3;
            const midInfluence = bands.mid * 2;
            const trebleInfluence = bands.treble * 1.5;
            
            this.vx += Math.sin(this.waveOffset) * bassInfluence * 0.1;
            this.vy += Math.cos(this.waveOffset) * bassInfluence * 0.1;
            
            this.size = this.baseSize + bassInfluence * 2 + midInfluence;
            this.hue += trebleInfluence * 2;
            this.brightness = Math.min(100, this.brightness + midInfluence * 10);
            
            this.waveOffset += 0.02 + trebleInfluence * 0.05;
            this.shapePhase += 0.01 + bassInfluence * 0.02;
        }
        
        if (beatDetected) {
            this.vx *= 1.5;
            this.vy *= 1.5;
            this.size += 8;
            this.opacity = Math.min(1, this.opacity + 0.4);
            
            const angle = Math.atan2(dy, dx);
            this.vx += Math.cos(angle + Math.PI/2) * 2;
            this.vy += Math.sin(angle + Math.PI/2) * 2;
        }
        
        this.x += this.vx;
        this.y += this.vy;
        
        this.vx *= 0.99;
        this.vy *= 0.99;
        
        this.rotation += this.rotationSpeed;
        this.pulsePhase += 0.1;
        this.morphSpeed += 0.001;
        
        if (this.x < 0 || this.x > this.canvas.width || this.y < 0 || this.y > this.canvas.height) {
            this.reset();
        }
        
        this.life -= this.decay;
        if (this.life <= 0) {
            this.reset();
        }
        
        this.opacity *= 0.9999;
        this.size *= 0.999;
    }

    draw(ctx, bands) {
        const pulse = Math.sin(this.pulsePhase) * 0.3 + 0.7;
        const dynamicSize = this.size * pulse;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.globalAlpha = this.opacity * this.life;
        
        if (this.type === 'spiral') {
            this.drawSpiral(ctx, dynamicSize, bands);
        } else if (this.type === 'morph') {
            this.drawMorphShape(ctx, dynamicSize, bands);
        } else if (this.type === 'wave') {
            this.drawWaveForm(ctx, dynamicSize, bands);
        } else {
            this.drawFluidBlob(ctx, dynamicSize, bands);
        }
        
        ctx.restore();
    }

    drawSpiral(ctx, size, bands) {
        const points = 12;
        const spiralTurns = 3 + (bands ? bands.mid * 2 : 0);
        
        ctx.beginPath();
        for (let i = 0; i <= points * spiralTurns; i++) {
            const angle = (i / points) * Math.PI * 2;
            const radius = (i / (points * spiralTurns)) * size * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2);
        gradient.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, ${this.brightness}%, 0.8)`);
        gradient.addColorStop(0.5, `hsla(${this.hue + 60}, ${this.saturation}%, ${this.brightness - 20}%, 0.4)`);
        gradient.addColorStop(1, `hsla(${this.hue + 120}, ${this.saturation}%, ${this.brightness - 40}%, 0)`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = size * 0.2;
        ctx.stroke();
    }

    drawMorphShape(ctx, size, bands) {
        const vertices = 8;
        const morphIntensity = Math.sin(this.shapePhase) * 0.5 + 0.5;
        
        ctx.beginPath();
        for (let i = 0; i <= vertices; i++) {
            const angle = (i / vertices) * Math.PI * 2;
            const radiusVariation = Math.sin(angle * 3 + this.morphSpeed * 100) * morphIntensity * 0.3;
            const radius = size * (1 + radiusVariation);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        gradient.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, ${this.brightness}%, 0.7)`);
        gradient.addColorStop(1, `hsla(${this.hue}, ${this.saturation}%, ${this.brightness}%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.strokeStyle = `hsla(${this.hue + 180}, ${this.saturation}%, ${this.brightness + 20}%, 0.5)`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawWaveForm(ctx, size, bands) {
        const segments = 16;
        const waveAmplitude = size * 0.5;
        
        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const angle = t * Math.PI * 4 + this.waveOffset;
            const waveY = Math.sin(angle) * waveAmplitude * (bands ? bands.treble + 0.5 : 0.5);
            const x = (t - 0.5) * size * 3;
            const y = waveY;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        
        const gradient = ctx.createLinearGradient(-size * 1.5, 0, size * 1.5, 0);
        gradient.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, ${this.brightness}%, 0)`);
        gradient.addColorStop(0.5, `hsla(${this.hue}, ${this.saturation}%, ${this.brightness}%, 0.8)`);
        gradient.addColorStop(1, `hsla(${this.hue}, ${this.saturation}%, ${this.brightness}%, 0)`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = size * 0.3;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    drawFluidBlob(ctx, size, bands) {
        const blobPoints = 6;
        const blobVariation = 0.4;
        
        ctx.beginPath();
        for (let i = 0; i <= blobPoints; i++) {
            const angle = (i / blobPoints) * Math.PI * 2;
            const variation = Math.sin(angle * 2 + this.shapePhase) * blobVariation;
            const radius = size * (1 + variation);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevAngle = ((i - 1) / blobPoints) * Math.PI * 2;
                const prevVariation = Math.sin(prevAngle * 2 + this.shapePhase) * blobVariation;
                const prevRadius = size * (1 + prevVariation);
                const prevX = Math.cos(prevAngle) * prevRadius;
                const prevY = Math.sin(prevAngle) * prevRadius;
                
                const cpX = (prevX + x) * 0.5 + Math.cos(angle - Math.PI/2) * size * 0.2;
                const cpY = (prevY + y) * 0.5 + Math.sin(angle - Math.PI/2) * size * 0.2;
                
                ctx.quadraticCurveTo(cpX, cpY, x, y);
            }
        }
        ctx.closePath();
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
        gradient.addColorStop(0, `hsla(${this.hue}, ${this.saturation}%, ${this.brightness}%, 0.8)`);
        gradient.addColorStop(0.7, `hsla(${this.hue + 30}, ${this.saturation}%, ${this.brightness - 10}%, 0.4)`);
        gradient.addColorStop(1, `hsla(${this.hue + 60}, ${this.saturation}%, ${this.brightness - 20}%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    drawBloom(ctx, bands, bloomIntensity) {
        const bloomSize = this.size * 3 * bloomIntensity;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = this.opacity * this.life * bloomIntensity * 0.3;
        ctx.globalCompositeOperation = 'screen';
        
        const bloomGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, bloomSize);
        bloomGradient.addColorStop(0, `hsla(${this.hue}, 100%, 80%, 1)`);
        bloomGradient.addColorStop(0.3, `hsla(${this.hue + 60}, 80%, 60%, 0.6)`);
        bloomGradient.addColorStop(0.7, `hsla(${this.hue + 120}, 60%, 40%, 0.3)`);
        bloomGradient.addColorStop(1, `hsla(${this.hue + 180}, 40%, 20%, 0)`);
        
        ctx.fillStyle = bloomGradient;
        ctx.beginPath();
        ctx.arc(0, 0, bloomSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = this.opacity * this.life * bloomIntensity * 0.8;
        const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, bloomSize * 0.3);
        coreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        coreGradient.addColorStop(1, `hsla(${this.hue}, 100%, 70%, 0)`);
        
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(0, 0, bloomSize * 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

class AdvancedParticleSystem {
    constructor(canvas, bloomCanvas) {
        this.canvas = canvas;
        this.bloomCanvas = bloomCanvas;
        this.ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: false });
        this.bloomCtx = bloomCanvas.getContext('2d', { alpha: true, willReadFrequently: false });
        this.particles = [];
        this.particleTypes = ['spiral', 'morph', 'wave', 'blob'];
        this.particleCount = window.innerWidth < 768 ? 200 : 400;
        this.centerX = 0;
        this.centerY = 0;
        this.bloomIntensity = 0;
        this.targetBloomIntensity = 0;
        this.backgroundHue = 0;
        this.energyField = [];
        this.fieldSize = 20;
        
        this.initParticles();
        this.initEnergyField();
        this.resize();
    }

    initParticles() {
        this.particles = [];
        const typesPerCategory = Math.floor(this.particleCount / this.particleTypes.length);
        
        this.particleTypes.forEach((type, typeIndex) => {
            for (let i = 0; i < typesPerCategory; i++) {
                this.particles.push(new SpiralParticle(this.canvas, type));
            }
        });
        
        while (this.particles.length < this.particleCount) {
            const randomType = this.particleTypes[Math.floor(Math.random() * this.particleTypes.length)];
            this.particles.push(new SpiralParticle(this.canvas, randomType));
        }
    }

    initEnergyField() {
        this.energyField = [];
        const cols = Math.ceil(this.canvas.width / this.fieldSize);
        const rows = Math.ceil(this.canvas.height / this.fieldSize);
        
        for (let y = 0; y < rows; y++) {
            this.energyField[y] = [];
            for (let x = 0; x < cols; x++) {
                this.energyField[y][x] = {
                    energy: 0,
                    targetEnergy: 0,
                    lastUpdate: 0
                };
            }
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.bloomCanvas.width = window.innerWidth;
        this.bloomCanvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.initEnergyField();
    }

    updateEnergyField(bands, beatDetected) {
        const cols = this.energyField[0]?.length || 0;
        const rows = this.energyField.length;
        
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const worldX = x * this.fieldSize;
                const worldY = y * this.fieldSize;
                const distanceFromCenter = Math.sqrt(
                    Math.pow(worldX - this.centerX, 2) + Math.pow(worldY - this.centerY, 2)
                );
                
                let targetEnergy = 0;
                if (bands) {
                    const normalizedDistance = distanceFromCenter / Math.max(this.canvas.width, this.canvas.height);
                    targetEnergy = (bands.bass + bands.mid + bands.treble) * (1 - normalizedDistance) * 0.5;
                }
                
                if (beatDetected) {
                    targetEnergy += 0.8;
                }
                
                const field = this.energyField[y][x];
                field.targetEnergy = targetEnergy;
                field.energy += (field.targetEnergy - field.energy) * 0.1;
                field.energy *= 0.95;
            }
        }
    }

    update(bands, beatDetected) {
        this.updateEnergyField(bands, beatDetected);
        
        this.particles.forEach(particle => {
            particle.update(bands, beatDetected, this.centerX, this.centerY);
        });

        if (bands) {
            this.targetBloomIntensity = (bands.bass * 0.4 + bands.mid * 0.3 + bands.treble * 0.3);
            this.backgroundHue += bands.treble * 2;
            
            if (beatDetected) {
                this.targetBloomIntensity = Math.min(1, this.targetBloomIntensity + 0.6);
            }
        } else {
            this.targetBloomIntensity = 0;
        }

        this.bloomIntensity += (this.targetBloomIntensity - this.bloomIntensity) * 0.15;
        
        if (this.bloomIntensity > 0.1) {
            this.canvas.style.filter = `blur(${this.bloomIntensity * 0.5}px) brightness(${1 + this.bloomIntensity * 0.3})`;
        } else {
            this.canvas.style.filter = 'none';
        }
    }

    render(bands) {
        this.renderBackground(bands);
        this.renderEnergyField(bands);
        this.renderParticles(bands);
        
        if (this.bloomIntensity > 0.05) {
            this.renderBloomEffect(bands);
        }
    }

    renderBackground(bands) {
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, Math.max(this.canvas.width, this.canvas.height)
        );
        
        const baseAlpha = 0.02 + (bands ? (bands.bass + bands.mid + bands.treble) * 0.01 : 0);
        
        gradient.addColorStop(0, `hsla(${this.backgroundHue}, 50%, 5%, ${baseAlpha * 2})`);
        gradient.addColorStop(0.5, `hsla(${this.backgroundHue + 60}, 30%, 3%, ${baseAlpha})`);
        gradient.addColorStop(1, `hsla(${this.backgroundHue + 120}, 20%, 1%, ${baseAlpha * 0.5})`);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    renderEnergyField(bands) {
        if (!bands) return;
        
        const cols = this.energyField[0]?.length || 0;
        const rows = this.energyField.length;
        
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'screen';
        
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const field = this.energyField[y][x];
                if (field.energy > 0.1) {
                    const worldX = x * this.fieldSize;
                    const worldY = y * this.fieldSize;
                    
                    this.ctx.globalAlpha = field.energy * 0.3;
                    const gradient = this.ctx.createRadialGradient(
                        worldX, worldY, 0,
                        worldX, worldY, this.fieldSize
                    );
                    
                    const hue = this.backgroundHue + field.energy * 60;
                    gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.8)`);
                    gradient.addColorStop(1, `hsla(${hue + 30}, 60%, 40%, 0)`);
                    
                    this.ctx.fillStyle = gradient;
                    this.ctx.fillRect(worldX - this.fieldSize/2, worldY - this.fieldSize/2, this.fieldSize, this.fieldSize);
                }
            }
        }
        
        this.ctx.restore();
    }

    renderParticles(bands) {
        this.particles.forEach(particle => {
            particle.draw(this.ctx, bands);
        });
    }

    renderBloomEffect(bands) {
        this.bloomCtx.clearRect(0, 0, this.bloomCanvas.width, this.bloomCanvas.height);
        
        this.particles.forEach(particle => {
            if (particle.opacity > 0.2 && particle.life > 0.3) {
                particle.drawBloom(this.bloomCtx, bands, this.bloomIntensity);
            }
        });
        
        this.bloomCtx.save();
        this.bloomCtx.globalCompositeOperation = 'screen';
        this.bloomCtx.globalAlpha = this.bloomIntensity * 0.4;
        
        const centerGlow = this.bloomCtx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, 300 + this.bloomIntensity * 200
        );
        
        if (bands) {
            centerGlow.addColorStop(0, `hsla(${this.backgroundHue}, 100%, 70%, ${this.bloomIntensity * 0.3})`);
            centerGlow.addColorStop(0.3, `hsla(${this.backgroundHue + 120}, 80%, 50%, ${this.bloomIntensity * 0.2})`);
            centerGlow.addColorStop(0.7, `hsla(${this.backgroundHue + 240}, 60%, 30%, ${this.bloomIntensity * 0.1})`);
            centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
            centerGlow.addColorStop(0, `rgba(255, 255, 255, ${this.bloomIntensity * 0.1})`);
            centerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        }
        
        this.bloomCtx.fillStyle = centerGlow;
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
        this.particleSystem = new AdvancedParticleSystem(this.canvas, this.bloomCanvas);
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