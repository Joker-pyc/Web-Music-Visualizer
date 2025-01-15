const canvas = document.getElementById('visualizerCanvas');
const ctx = canvas.getContext('2d');
const audioFileInput = document.getElementById('audioFileInput');
const fileSelector = document.getElementById('fileSelector');
const playPauseButton = document.getElementById('playPauseButton');
const fullscreenButton = document.getElementById('fullscreenButton');
const musicNameLabel = document.getElementById('musicNameLabel');

let audioContext = null;
let analyser = null;
let audioSource = null;
let isPlaying = false;
let musicName = "";
let audioBuffer;

const particles = [];
const maxParticles = 60;
const trailParticles = [];
const trailOpacityDecay = 0.2;
const maxTrailOpacity = 0.8;
const baseHue = 200;
const hueRange = 120;

function initializeParticles() {
  particles.length = 0;
  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  for (let i = 0; i < maxParticles; i++) {
    const angle = (Math.PI * 2 * i) / maxParticles;
    const radius = canvasWidth * 0.2 + Math.random() * (canvasWidth * 0.1);

    const particle = {
      x: canvasWidth * 0.5 + radius * Math.cos(angle),
      y: canvasHeight * 0.5 + radius * Math.sin(angle),
      radius: 1 + Math.random() * 2,
      velocity: Math.random() * 0.5 + 0.5,
      angle: angle + Math.PI,
      color: `hsl(${baseHue + Math.random() * hueRange}, 100%, 50%)`,
    };
    particles.push(particle);
  }
}

function update() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const particle of particles) {
    particle.x += particle.velocity * Math.cos(particle.angle);
    particle.y += particle.velocity * Math.sin(particle.angle);
    particle.angle += 0.02;

    ctx.save();
    ctx.beginPath();
    const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${maxTrailOpacity})`);
    gradient.addColorStop(1, particle.color);
    ctx.fillStyle = gradient;
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (let i = trailParticles.length - 1; i >= 0; i--) {
    const trailParticle = trailParticles[i];
    trailParticle.opacity -= trailOpacityDecay;
    if (trailParticle.opacity <= 0) {
      trailParticles.splice(i, 1);
    } else {
      ctx.save();
      ctx.globalAlpha = trailParticle.opacity;
      ctx.beginPath();
      const trailGradient = ctx.createRadialGradient(trailParticle.x, trailParticle.y, 0, trailParticle.x, trailParticle.y, trailParticle.radius);
      trailGradient.addColorStop(0, `rgba(255, 255, 255, ${trailParticle.opacity})`);
      trailGradient.addColorStop(1, trailParticle.color);
      ctx.fillStyle = trailGradient;
      ctx.arc(trailParticle.x, trailParticle.y, trailParticle.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  requestAnimationFrame(update);
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  musicName = file.name;
  musicNameLabel.textContent = `Now Playing: ${musicName}`;
  musicNameLabel.style.visibility = 'visible';
  setTimeout(() => {
    musicNameLabel.style.visibility = 'hidden';
  }, 4000);
  fileReader.readAsArrayBuffer(file);
}

async function processAudio(buffer) {
  if (audioSource)
    audioSource.stop();

  if (!audioContext)
    audioContext = new(window.AudioContext || window.webkitAudioContext)();

  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.connect(audioContext.destination);

  audioBuffer = await audioContext.decodeAudioData(buffer);
  audioSource = audioContext.createBufferSource();
  audioSource.buffer = audioBuffer;

  const beatProcessor = audioContext.createScriptProcessor(256, 1, 1);
  analyser.connect(beatProcessor);
  beatProcessor.connect(audioContext.destination);

  const beats = [];

  beatProcessor.onaudioprocess = function(event) {
    const inputBuffer = event.inputBuffer;
    const inputData = inputBuffer.getChannelData(0);
    const bufferLength = inputBuffer.length;
    let sum = 0;

    for (let i = 0; i < bufferLength; i++) {
      sum += Math.abs(inputData[i]);
    }
    const average = sum / bufferLength;

    for (const particle of particles) {
      particle.velocity = 0.5 + average * 10;
      particle.radius = 1 + average * 5;
    }

    if (average > 0.01) {
      beats.push({ x: canvas.width * 0.8, y: canvas.height * 0.8 });
    }
  };

  audioSource.connect(analyser);
  audioSource.start(0);
  isPlaying = true;
  playPauseButton.textContent = 'Pause';
}

let startTime = 0;
let elapsedTime = 0;

function togglePlayPause() {
  if (isPlaying) {
    if (audioSource) {
      audioSource.stop();
      elapsedTime = audioContext.currentTime - startTime;
    }
    isPlaying = false;
    playPauseButton.textContent = 'Play';
  } else {
    if (audioBuffer) {
      audioSource = audioContext.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.connect(analyser);

      startTime = audioContext.currentTime - elapsedTime;

      audioSource.start(0, elapsedTime);
      isPlaying = true;
      playPauseButton.textContent = 'Pause';
    }
  }
}


function toggleFullscreen() {
  document.fullscreenElement ?
    document.exitFullscreen() :
    canvas.requestFullscreen().catch(err => {
      console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
    });
}

audioFileInput.addEventListener('change', handleFileUpload);

const fileReader = new FileReader();
fileReader.addEventListener('load', (event) => {
  const buffer = event.target.result;
  processAudio(buffer);
  initializeParticles();
  update();
});

addEventListener('resize', initializeParticles);

playPauseButton.addEventListener('click', togglePlayPause);
fullscreenButton.addEventListener('click', toggleFullscreen);