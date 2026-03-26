document.addEventListener('DOMContentLoaded', () => {
    let audioContext;
    let audioBuffer;
    let currentSource;
    let isPlaying = false;
    let startTime = 0;
    let pausedTime = 0;

    // Web Audio Nodes
    let vocalFilter;
    let bassFilter;
    let gainNode;
    let analyser;

    // DOM Elements
    const uploadArea = document.getElementById('uploadArea');
    const audioInput = document.getElementById('audioInput');
    const fileInfo = document.getElementById('fileName');
    const controlsSection = document.getElementById('controlsSection');
    const vocalSlider = document.getElementById('vocalSlider');
    const vocalValue = document.getElementById('vocalValue');
    const bassSlider = document.getElementById('bassSlider');
    const bassValue = document.getElementById('bassValue');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const stopBtn = document.getElementById('stopBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const newFileBtn = document.getElementById('newFileBtn');
    const waveformCanvas = document.getElementById('waveform');
    const waveformCtx = waveformCanvas.getContext('2d');
    const progressBar = document.getElementById('progressBar');
    const currentTimeDisplay = document.getElementById('currentTime');
    const durationDisplay = document.getElementById('duration');
    const progressContainer = document.querySelector('.progress-bar-container');
    const formatSelect = document.getElementById('formatSelect');
    const qualitySelect = document.getElementById('qualitySelect');

    // Initialize Web Audio API
    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioContext.createGain();

            // Vocal filter (mid-frequencies: ~1000Hz)
            vocalFilter = audioContext.createBiquadFilter();
            vocalFilter.type = 'peaking';
            vocalFilter.frequency.value = 1000;
            vocalFilter.Q.value = 1;

            // Bass filter (low-frequencies: ~100Hz)
            bassFilter = audioContext.createBiquadFilter();
            bassFilter.type = 'lowshelf';
            bassFilter.frequency.value = 100;

            // Analyser for visualization
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;

            // Connect nodes
            vocalFilter.connect(bassFilter);
            bassFilter.connect(gainNode);
            gainNode.connect(analyser);
            analyser.connect(audioContext.destination);
        }
    }

    // Set canvas size
    function resizeCanvas() {
        waveformCanvas.width = waveformCanvas.offsetWidth;
        waveformCanvas.height = waveformCanvas.offsetHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // File Upload Handlers
    uploadArea.addEventListener('click', () => audioInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleAudioFile(files[0]);
        }
    });

    audioInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleAudioFile(e.target.files[0]);
        }
    });

    function handleAudioFile(file) {
        fileInfo.textContent = '✓ Loaded: ' + file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            initAudioContext();
            audioContext.decodeAudioData(e.target.result, (buffer) => {
                audioBuffer = buffer;
                controlsSection.style.display = 'block';
                uploadArea.style.display = 'none';
                updateDuration();
                visualizeWaveform();
            }, (error) => {
                alert('Error decoding audio: ' + error);
            });
        };
        reader.readAsArrayBuffer(file);
    }

    // Vocal Control
    vocalSlider.addEventListener('input', (e) => {
        const vocal = parseFloat(e.target.value);
        vocalValue.textContent = vocal + ' dB';
        if (vocalFilter) {
            vocalFilter.gain.value = vocal;
        }
    });

    // Bass Control
    bassSlider.addEventListener('input', (e) => {
        const bass = parseFloat(e.target.value);
        bassValue.textContent = bass + ' dB';
        if (bassFilter) {
            bassFilter.gain.value = bass;
        }
    });

    // Playback Controls
    playBtn.addEventListener('click', play);
    pauseBtn.addEventListener('click', pause);
    stopBtn.addEventListener('click', stop);

    function play() {
        if (!audioBuffer || isPlaying) return;

        if (currentSource) {
            currentSource.stop();
        }

        currentSource = audioContext.createBufferSource();
        currentSource.buffer = audioBuffer;
        currentSource.connect(vocalFilter);

        isPlaying = true;
        startTime = audioContext.currentTime - pausedTime;
        currentSource.start(0, pausedTime);

        playBtn.disabled = true;
        pauseBtn.disabled = false;

        animatePlayback();
    }

    function pause() {
        if (!currentSource || !isPlaying) return;

        currentSource.stop();
        pausedTime = audioContext.currentTime - startTime;
        isPlaying = false;

        playBtn.disabled = false;
        pauseBtn.disabled = true;
    }

    function stop() {
        if (currentSource) {
            currentSource.stop();
        }
        isPlaying = false;
        pausedTime = 0;
        progressBar.style.width = '0%';
        currentTimeDisplay.textContent = '0:00';

        playBtn.disabled = false;
        pauseBtn.disabled = true;
    }

    function animatePlayback() {
        if (!isPlaying || !audioBuffer) return;

        const duration = audioBuffer.duration;
        const currentTime = pausedTime + (audioContext.currentTime - startTime);
        const progress = (currentTime / duration) * 100;

        progressBar.style.width = progress + '%';
        currentTimeDisplay.textContent = formatTime(currentTime);

        visualizeWaveform();

        if (currentTime < duration) {
            requestAnimationFrame(animatePlayback);
        } else {
            stop();
        }
    }

    function updateDuration() {
        if (audioBuffer) {
            durationDisplay.textContent = formatTime(audioBuffer.duration);
        }
    }

    function formatTime(seconds) {
        if (!isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Progress Bar Click
    progressContainer.addEventListener('click', (e) => {
        if (!audioBuffer) return;

        const rect = progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        pausedTime = percent * audioBuffer.duration;

        if (isPlaying) {
            currentSource.stop();
            play();
        }
    });

    // Waveform Visualization
    function visualizeWaveform() {
        if (!analyser) return;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        waveformCtx.fillStyle = '#f5f7fa';
        waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

        const gradient = waveformCtx.createLinearGradient(0, 0, waveformCanvas.width, 0);
        gradient.addColorStop(0, '#5b6de8');
        gradient.addColorStop(1, '#6b5eea');
        waveformCtx.strokeStyle = gradient;
        waveformCtx.lineWidth = 2;

        waveformCtx.beginPath();
        const sliceWidth = waveformCanvas.width / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * waveformCanvas.height) / 2;

            if (i === 0) {
                waveformCtx.moveTo(x, y);
            } else {
                waveformCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        waveformCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
        waveformCtx.stroke();
    }

    // Download Processed Audio
    downloadBtn.addEventListener('click', downloadAudio);

    function downloadAudio() {
        if (!audioBuffer) return;

        downloadBtn.disabled = true;
        downloadBtn.textContent = '⏳ Processing...';

        const format = formatSelect.value;

        // Create offline context
        const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
        );

        // Create source
        const source = offlineContext.createBufferSource();
        source.buffer = audioBuffer;

        // Create filters with current settings
        const offlineVocal = offlineContext.createBiquadFilter();
        offlineVocal.type = 'peaking';
        offlineVocal.frequency.value = 1000;
        offlineVocal.Q.value = 1;
        offlineVocal.gain.value = parseFloat(vocalSlider.value);

        const offlineBass = offlineContext.createBiquadFilter();
        offlineBass.type = 'lowshelf';
        offlineBass.frequency.value = 100;
        offlineBass.gain.value = parseFloat(bassSlider.value);

        const offlineGain = offlineContext.createGain();
        offlineGain.gain.value = 0.95;

        // Connect nodes
        source.connect(offlineVocal);
        offlineVocal.connect(offlineBass);
        offlineBass.connect(offlineGain);
        offlineGain.connect(offlineContext.destination);

        source.start(0);

        offlineContext.oncomplete = (e) => {
            const processedBuffer = e.renderedBuffer;
            const wav = bufferToWave(processedBuffer);
            const blob = new Blob([wav], { type: 'audio/wav' });
            downloadFile(blob, 'processed-audio.wav');

            downloadBtn.disabled = false;
            downloadBtn.textContent = '⬇ Download Processed Audio';
        };

        offlineContext.startRendering();
    }

    function bufferToWave(audioBuffer) {
        const numberOfChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const format = 1;
        const bitDepth = 16;

        const bytesPerSample = bitDepth / 8;
        const blockAlign = numberOfChannels * bytesPerSample;

        const channelData = [];
        for (let i = 0; i < numberOfChannels; i++) {
            channelData.push(audioBuffer.getChannelData(i));
        }

        const length = audioBuffer.length * numberOfChannels * bytesPerSample + 44;
        const arrayBuffer = new ArrayBuffer(length);
        const view = new DataView(arrayBuffer);

        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, length - 8, true);
        writeString(8, 'WAVE');

        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);

        writeString(36, 'data');
        view.setUint32(40, length - 44, true);

        let offset = 44;
        const volume = 0.95;
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                let s = Math.max(-1, Math.min(1, channelData[channel][i])) * volume;
                s = s < 0 ? s * 0x8000 : s * 0x7FFF;
                view.setInt16(offset, s, true);
                offset += 2;
            }
        }

        return arrayBuffer;
    }

    function downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // New File Button
    newFileBtn.addEventListener('click', () => {
        stop();
        audioBuffer = null;
        audioInput.value = '';
        fileInfo.textContent = '';
        controlsSection.style.display = 'none';
        uploadArea.style.display = 'block';
        vocalSlider.value = 0;
        vocalValue.textContent = '0 dB';
        bassSlider.value = 0;
        bassValue.textContent = '0 dB';
    });
});