document.addEventListener('DOMContentLoaded', () => {

    // ── ELEMENTS ──────────────────────────────────────────────────────────────
    const audioPlayer     = document.getElementById('audio-player');
    const videoPlayer     = document.getElementById('video-player');
    const playPauseBtn    = document.getElementById('play-pause-btn');
    const prevBtn         = document.getElementById('prev-btn');
    const nextBtn         = document.getElementById('next-btn');
    const githubLoadBtn   = document.getElementById('github-load-btn');
    const muteBtn         = document.getElementById('mute-btn');
    const fullscreenBtn   = document.getElementById('fullscreen-btn');
    const fsOverlayBtn    = document.getElementById('fs-overlay-btn');
    const ccBtn           = document.getElementById('cc-btn');
    const autoCCBtn       = document.getElementById('auto-cc-btn');
    const subtitleInput   = document.getElementById('subtitle-input');
    const subSizeSlider   = document.getElementById('sub-size-slider');
    const videoControls   = document.getElementById('video-controls');

    const progressBar       = document.getElementById('progress-bar');
    const progressContainer = document.querySelector('.progress-bar-wrapper');
    const currentTimeEl     = document.getElementById('current-time');
    const totalTimeEl       = document.getElementById('total-time');

    const songTitle          = document.getElementById('song-title');
    const songArtist         = document.getElementById('song-artist');
    const albumArt           = document.getElementById('album-art');
    const albumArtIcon       = document.getElementById('album-art-icon');

    const fileInput          = document.getElementById('file-input');
    const playlistContainer  = document.getElementById('playlist');
    const playlistTitle      = document.getElementById('playlist-title');
    const searchBar          = document.getElementById('search-bar');
    const volumeSlider       = document.getElementById('volume-slider');
    const togglePlaylistBtn  = document.getElementById('toggle-playlist-btn');

    // Subtitle display elements
    const videoSubOverlay  = document.getElementById('video-sub-overlay');
    const videoSubInterim  = document.getElementById('video-sub-interim');
    const videoSubFinal    = document.getElementById('video-sub-final');
    const audioSubBox      = document.getElementById('audio-sub-box');
    const audioSubLines    = document.getElementById('audio-sub-lines');
    const audioInterimLine = document.getElementById('audio-interim');
    const subStatus        = document.getElementById('sub-status');

    // Debug: verify all subtitle elements exist
    console.log('[Init] Subtitle elements found:', {
        videoSubOverlay: !!videoSubOverlay,
        videoSubInterim: !!videoSubInterim,
        videoSubFinal: !!videoSubFinal,
        audioSubBox: !!audioSubBox,
        audioSubLines: !!audioSubLines,
        audioInterimLine: !!audioInterimLine,
        subStatus: !!subStatus
    });

    // ── STATE ─────────────────────────────────────────────────────────────────
    let playlist         = [];
    let currentSongIndex = -1;
    let currentPlayer    = audioPlayer;
    let ccEnabled        = false;
    let idleTimer        = null;

    // Auto-CC state
    let autoCCActive     = false;
    let subFadeTimer     = null;
    let finalLineCount   = 0;      // how many <p> lines are in audio transcript

    // Path to your Whisper folder worker
    const whisperWorker = new Worker('./Whisper/worker.js', { type: 'module' });

    let audioContext = null;
    let processor = null;
    let source = null;

    whisperWorker.onmessage = (e) => {
        const { status, text } = e.data;
        console.log('[Whisper Worker]', status, text || '', 'Current player:', currentPlayer === videoPlayer ? 'video' : 'audio');
        if (status === 'ready') {
            showToast('✅ AI Model Loaded', 2000);
            console.log('[Whisper] Model is ready for transcription');
        }
        if (status === 'interim') {
            console.log('[Interim] Received text:', text, 'Length:', text ? text.length : 0);
            if (autoCCActive) {
                updateInterim(text);
            } else {
                console.log('[Interim] Ignored - autoCCActive is false');
            }
        }
        if (status === 'final') {
            console.log('[Final] Received text:', text, 'Length:', text ? text.length : 0);
            if (autoCCActive) {
                appendFinalLine(text);
            } else {
                console.log('[Final] Ignored - autoCCActive is false');
            }
        }
        if (status === 'error') {
            console.error('[Whisper Error]', text);
            showToast('❌ Transcription Error: ' + text, 4000);
        }
    };


    // ════════════════════════════════════════════════════════════════
    //  WHISPER AI AUTO-SUBTITLES
    // ════════════════════════════════════════════════════════════════

    // Toast notification — always visible regardless of sub box state
    const toast = document.createElement('div');
    toast.id = 'cc-toast';
    toast.style.cssText = `
        position:fixed; bottom:24px; left:50%; transform:translateX(-50%) translateY(20px);
        background:#1e1e1e; border:1px solid rgba(255,255,255,0.15); color:#fff;
        padding:10px 18px; border-radius:6px; font-size:13px; font-family:'Space Grotesk',sans-serif;
        z-index:9999; opacity:0; transition:opacity 0.25s, transform 0.25s; pointer-events:none;
        white-space:nowrap; box-shadow:0 4px 20px rgba(0,0,0,0.6);
    `;
    document.body.appendChild(toast);
    let toastTimer = null;

    function showToast(msg, duration = 3000) {
        clearTimeout(toastTimer);
        toast.textContent = msg;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        if (duration > 0) {
            toastTimer = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(10px)';
            }, duration);
        }
    }
    function hideToast() {
        clearTimeout(toastTimer);
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(10px)';
    }

    autoCCBtn.addEventListener('click', toggleAutoCC);

    // Debug function - call from console: debugSubtitles()
    window.debugSubtitles = function() {
        console.log('=== SUBTITLE DEBUG ===');
        console.log('autoCCActive:', autoCCActive);
        console.log('currentPlayer:', currentPlayer === videoPlayer ? 'video' : 'audio');
        console.log('');
        console.log('VIDEO ELEMENTS:');
        console.log('  videoSubOverlay.display:', window.getComputedStyle(videoSubOverlay).display);
        console.log('  videoSubOverlay.classList:', videoSubOverlay.className);
        console.log('  videoSubOverlay.visibility:', window.getComputedStyle(videoSubOverlay).visibility);
        console.log('  videoSubOverlay.opacity:', window.getComputedStyle(videoSubOverlay).opacity);
        console.log('  videoSubInterim.textContent:', videoSubInterim.textContent);
        console.log('  videoSubFinal.textContent:', videoSubFinal.textContent);
        console.log('');
        console.log('AUDIO ELEMENTS:');
        console.log('  audioSubBox.display:', window.getComputedStyle(audioSubBox).display);
        console.log('  audioSubBox visibility:', window.getComputedStyle(audioSubBox).visibility);
        console.log('  audioInterimLine.textContent:', audioInterimLine.textContent);
        console.log('  audioInterimLine HTML:', audioInterimLine.outerHTML);
        console.log('  audioSubLines children count:', audioSubLines.children.length);
        console.log('');
        console.log('AUDIO INTERIM LINE STYLES:');
        const interim = window.getComputedStyle(audioInterimLine);
        console.log('  display:', interim.display);
        console.log('  visibility:', interim.visibility);
        console.log('  color:', interim.color);
        console.log('  opacity:', interim.opacity);
    };

    function toggleAutoCC() {
        autoCCActive ? stopAutoCC() : startAutoCC();
    }

    async function startAutoCC() {
        if (currentSongIndex === -1) {
            showToast('⚠ Load a track first', 2500);
            return;
        }

        autoCCActive = true;
        updateAutoCCBtn();
        showSubUI(); // This makes the CC box visible
        console.log('[Auto-CC] Subtitle UI shown, currentPlayer:', currentPlayer === videoPlayer ? 'video' : 'audio');
        showToast('🚀 Loading AI...', 0);

        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        }

        // Only create the source once per player session
        if (!source) {
            source = audioContext.createMediaElementSource(currentPlayer);
            source.connect(audioContext.destination);
        }
        
        // Add AudioWorklet processor for modern audio capture
        try {
            await audioContext.audioWorklet.addModule('./audio-worklet-processor.js');
            processor = new AudioWorkletNode(audioContext, 'audio-processor');
            
            let audioChunkCount = 0;
            // Send audio data from worklet to Whisper worker
            processor.port.onmessage = (e) => {
                if (!autoCCActive) return;
                const { audio } = e.data;
                if (audio) {
                    audioChunkCount++;
                    if (audioChunkCount === 1) {
                        console.log('[Audio] First audio chunk received, length:', audio.length);
                    }
                    if (audioChunkCount % 100 === 0) {
                        console.log('[Audio] Chunks sent to worker:', audioChunkCount);
                    }
                    whisperWorker.postMessage({ audio });
                }
            };
            
            source.connect(processor);
            processor.connect(audioContext.destination);
            processor.port.postMessage({ command: 'start' });
            console.log('[Audio] AudioWorkletNode connected successfully');
        } catch (err) {
            // Fallback to ScriptProcessorNode if AudioWorklet not supported
            console.warn('[Audio] AudioWorklet not supported, falling back to ScriptProcessorNode:', err);
            processor = audioContext.createScriptProcessor(4096, 1, 1);
            source.connect(processor);
            processor.connect(audioContext.destination);
            let audioChunkCount = 0;
            processor.onaudioprocess = (e) => {
                if (!autoCCActive) return;
                const inputData = e.inputBuffer.getChannelData(0);
                audioChunkCount++;
                if (audioChunkCount === 1) {
                    console.log('[Audio] First audio chunk via ScriptProcessor, length:', inputData.length);
                }
                whisperWorker.postMessage({ audio: Array.from(inputData) });
            };
        }

        showSubStatus('● AI Live', 0);
    }

    function stopAutoCC() {
        autoCCActive = false;
        if (processor) {
            // Stop AudioWorklet if it's running
            if (processor.port && processor.port.postMessage) {
                processor.port.postMessage({ command: 'stop' });
            }
            processor.disconnect();
            processor = null;
        }
        updateAutoCCBtn();
        subStatus.textContent = '';
        hideSubUI();
        clearSubDisplay();
        hideToast();
        console.log('[Auto-CC] Stopped');
    }

    // ── Sub display helpers ────────────────────────────────────────

    function showSubUI() {
        console.log('[Sub UI] Showing subtitles for:', currentPlayer === videoPlayer ? 'video' : 'audio');
        if (currentPlayer === videoPlayer) {
            videoSubOverlay.classList.add('active');
            audioSubBox.style.display = 'none';
            console.log('[Sub UI] Video overlay active, classes:', videoSubOverlay.className);
            console.log('[Sub UI] Video overlay display:', window.getComputedStyle(videoSubOverlay).display);
        } else {
            videoSubOverlay.classList.remove('active');
            // Use both style attribute AND ensure it overrides inline style
            audioSubBox.style.removeProperty('display');
            audioSubBox.style.display = 'block';
            // Double check by setting it on the element
            if (audioSubBox.getAttribute('style').includes('display:none')) {
                audioSubBox.removeAttribute('style');
                audioSubBox.style.display = 'block';
            }
            console.log('[Sub UI] Audio box display set to block');
            console.log('[Sub UI] Audio box actual computed display:', window.getComputedStyle(audioSubBox).display);
            console.log('[Sub UI] Audio box inline style:', audioSubBox.getAttribute('style'));
            console.log('[Sub UI] Audio box DOM:', audioSubBox);
            console.log('[Sub UI] Audio interim element:', audioInterimLine);
            console.log('[Sub UI] Audio lines container:', audioSubLines);
        }
    }

    function hideSubUI() {
        videoSubOverlay.classList.remove('active');
        audioSubBox.style.display = 'none';
    }

    function clearSubDisplay() {
        videoSubInterim.textContent = '';
        videoSubFinal.textContent   = '';
        audioInterimLine.textContent = '';
        // Clear all final lines from audio box (keep the interim element)
        Array.from(audioSubLines.querySelectorAll('.final-line')).forEach(el => el.remove());
        finalLineCount = 0;
    }

    function updateInterim(text) {
        console.log('[Interim Update]', 'Player:', currentPlayer === videoPlayer ? 'video' : 'audio', 'Text:', text);
        if (currentPlayer === videoPlayer) {
            videoSubInterim.textContent = text;
            console.log('[Interim] Video interim updated, element:', videoSubInterim, 'content:', videoSubInterim.textContent);
        } else {
            audioInterimLine.textContent = text;
            console.log('[Interim] Audio interim updated, element:', audioInterimLine, 'textContent:', audioInterimLine.textContent);
            console.log('[Interim] Audio interim parent display:', window.getComputedStyle(audioInterimLine.parentElement).display);
            // Keep interim pinned at bottom
            audioSubLines.scrollTop = audioSubLines.scrollHeight;
        }
    }

    function appendFinalLine(text) {
        clearTimeout(subFadeTimer);
        console.log('[Final Line]', 'Player:', currentPlayer === videoPlayer ? 'video' : 'audio', 'Text:', text);

        if (currentPlayer === videoPlayer) {
            // Video: show final line, fade it after a few seconds
            videoSubFinal.textContent   = text;
            videoSubInterim.textContent = '';
            videoSubFinal.classList.remove('fade-out');
            console.log('[Final] Video final updated:', text);
            subFadeTimer = setTimeout(() => {
                videoSubFinal.classList.add('fade-out');
            }, 4000);
        } else {
            // Audio: append a paragraph, keep last 10 lines
            const p = document.createElement('p');
            p.className   = 'sub-line final-line';
            p.textContent = text;
            // Insert before the interim line (which stays at bottom)
            audioSubLines.insertBefore(p, audioInterimLine);
            finalLineCount++;
            console.log('[Final] Audio final added:', text, 'Total lines:', finalLineCount);
            // Trim oldest lines
            const finals = audioSubLines.querySelectorAll('.final-line');
            if (finals.length > 10) finals[0].remove();
            // Dim older lines
            Array.from(audioSubLines.querySelectorAll('.final-line')).forEach((el, i, arr) => {
                const age = arr.length - 1 - i;
                el.style.opacity = Math.max(0.18, 1 - age * 0.1).toFixed(2);
            });
            audioSubLines.scrollTop = audioSubLines.scrollHeight;
            audioInterimLine.textContent = '';
        }
    }

    function showSubStatus(msg, duration) {
        subStatus.textContent = msg;
        if (duration > 0) {
            setTimeout(() => {
                subStatus.textContent = autoCCActive ? '● Live' : '';
            }, duration);
        }
    }

    function updateAutoCCBtn() {
        autoCCBtn.classList.toggle('cc-off', !autoCCActive);
        autoCCBtn.classList.toggle('cc-on',  autoCCActive);
        autoCCBtn.title = autoCCActive ? 'Stop auto-subtitles (A)' : 'Live auto-subtitles — browser speech recognition (A)';
    }


    // ════════════════════════════════════════════════════════════════
    //  IDLE TIMER
    // ════════════════════════════════════════════════════════════════

    function resetIdleTimer() {
        albumArt.classList.remove('hide-ui');
        clearTimeout(idleTimer);
        if (currentPlayer === videoPlayer && !videoPlayer.paused) {
            idleTimer = setTimeout(() => albumArt.classList.add('hide-ui'), 3000);
        }
    }

    albumArt.addEventListener('mousemove', resetIdleTimer);
    albumArt.addEventListener('mouseleave', () => {
        if (currentPlayer === videoPlayer && !videoPlayer.paused) albumArt.classList.add('hide-ui');
    });


    // ════════════════════════════════════════════════════════════════
    //  KEYBOARD SHORTCUTS
    // ════════════════════════════════════════════════════════════════

    window.addEventListener('keydown', (e) => {
        if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
        if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();

        switch (e.code) {
            case 'Space':      togglePlayPause(); break;
            case 'ArrowRight': currentPlayer.currentTime += 5; break;
            case 'ArrowLeft':  currentPlayer.currentTime -= 5; break;
            case 'ArrowUp':
                currentPlayer.volume = Math.min(1, currentPlayer.volume + 0.1);
                volumeSlider.value = currentPlayer.volume;
                updateMuteIcon(); break;
            case 'ArrowDown':
                currentPlayer.volume = Math.max(0, currentPlayer.volume - 0.1);
                volumeSlider.value = currentPlayer.volume;
                updateMuteIcon(); break;
            case 'KeyF':  toggleFullscreen(); break;
            case 'KeyM':  toggleMute(); break;
            case 'KeyC':  if (currentPlayer === videoPlayer) toggleCC(); break;
            case 'KeyA':  toggleAutoCC(); break;
        }
        resetIdleTimer();
    });


    // ════════════════════════════════════════════════════════════════
    //  PLAYER SWITCH  (audio ↔ video)
    // ════════════════════════════════════════════════════════════════

    function setActivePlayer(isVideo) {
        // If we were using Auto-CC, we must disconnect the old source before switching
        if (source) {
            source.disconnect();
            source = null; 
        }

        if (isVideo) {
            currentPlayer = videoPlayer;
            videoPlayer.style.display   = 'block';
            albumArtIcon.style.display  = 'none';
            videoControls.style.display = 'flex';
            fsOverlayBtn.style.display  = 'flex';
        } else {
            currentPlayer = audioPlayer;
            videoPlayer.style.display   = 'none';
            videoPlayer.src             = '';
            albumArtIcon.style.display  = 'flex';
            videoControls.style.display = 'none';
            fsOverlayBtn.style.display  = 'none';
            albumArt.classList.remove('hide-ui');
            clearTimeout(idleTimer);
        }

        // Re-initialize source for the new player if Auto-CC was running
        if (autoCCActive) {
            startAutoCC(); 
        }
    }


    // ════════════════════════════════════════════════════════════════
    //  MEDIA EVENTS
    // ════════════════════════════════════════════════════════════════

    function bindMediaEvents(player) {
        player.addEventListener('play', () => {
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            resetIdleTimer();
        });
        player.addEventListener('pause', () => {
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            albumArt.classList.remove('hide-ui');
            clearTimeout(idleTimer);
        });
        player.addEventListener('timeupdate', updateProgress);
        player.addEventListener('ended', playNextSong);
        player.addEventListener('loadedmetadata', () => {
            totalTimeEl.textContent = formatTime(player.duration);
            const item = playlistContainer.querySelector(`[data-index="${currentSongIndex}"]`);
            if (item) item.querySelector('.playlist-item-duration').textContent = formatTime(player.duration);
        });
        player.addEventListener('error', (e) => {
            if (e.target.error) console.error('Media error:', e.target.error.code);
        });
    }

    bindMediaEvents(audioPlayer);
    bindMediaEvents(videoPlayer);


    // ════════════════════════════════════════════════════════════════
    //  VOLUME & MUTE
    // ════════════════════════════════════════════════════════════════

    volumeSlider.addEventListener('input', (e) => {
        audioPlayer.volume = +e.target.value;
        videoPlayer.volume = +e.target.value;
        audioPlayer.muted  = false;
        videoPlayer.muted  = false;
        updateMuteIcon();
    });
    muteBtn.addEventListener('click', toggleMute);

    function toggleMute() {
        const m = !currentPlayer.muted;
        audioPlayer.muted = m;
        videoPlayer.muted = m;
        updateMuteIcon();
    }

    function updateMuteIcon() {
        const muted = currentPlayer.muted || currentPlayer.volume === 0;
        muteBtn.innerHTML = muted
            ? '<i class="fas fa-volume-xmark"></i>'
            : currentPlayer.volume < 0.5
                ? '<i class="fas fa-volume-low"></i>'
                : '<i class="fas fa-volume-high"></i>';
    }


    // ════════════════════════════════════════════════════════════════
    //  FULLSCREEN
    // ════════════════════════════════════════════════════════════════

    fullscreenBtn.addEventListener('click', toggleFullscreen);
    fsOverlayBtn.addEventListener('click',  toggleFullscreen);

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            albumArt.requestFullscreen().catch(err => console.warn('Fullscreen:', err));
        } else {
            document.exitFullscreen();
        }
    }

    document.addEventListener('fullscreenchange', () => {
        const isFs = !!document.fullscreenElement;
        const icon = isFs ? 'fa-compress' : 'fa-expand';
        fullscreenBtn.innerHTML = `<i class="fas ${icon}"></i>`;
        fsOverlayBtn.innerHTML  = `<i class="fas ${icon}"></i>`;
        albumArt.classList.toggle('is-fullscreen', isFs);
    });


    // ════════════════════════════════════════════════════════════════
    //  MANUAL SUBTITLES  (SRT / VTT)
    // ════════════════════════════════════════════════════════════════

    subtitleInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file || currentPlayer !== videoPlayer) return;
        loadSubtitleFile(file);
    });

    function loadSubtitleFile(file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            let text = evt.target.result;
            if (file.name.toLowerCase().endsWith('.srt')) {
                text = 'WEBVTT\n\n' + text.replace(/(\d+:\d+:\d+),(\d+)/g, '$1.$2');
            }
            while (videoPlayer.firstChild) videoPlayer.removeChild(videoPlayer.firstChild);
            const blob  = new Blob([text], { type: 'text/vtt' });
            const track = document.createElement('track');
            track.kind    = 'subtitles';
            track.srclang = 'en';
            track.src     = URL.createObjectURL(blob);
            track.default = true;
            videoPlayer.appendChild(track);
            ccEnabled = true;
            updateCCState();
        };
        reader.readAsText(file);
    }

    function toggleCC() { ccEnabled = !ccEnabled; updateCCState(); }

    function updateCCState() {
        const tracks = videoPlayer.textTracks;
        for (let i = 0; i < tracks.length; i++) tracks[i].mode = ccEnabled ? 'showing' : 'hidden';
        ccBtn.classList.toggle('cc-off', !ccEnabled);
        ccBtn.innerHTML = ccEnabled
            ? '<i class="fas fa-closed-captioning"></i>'
            : '<i class="fas fa-comment-slash"></i>';
    }

    ccBtn.addEventListener('click', toggleCC);

    subSizeSlider.addEventListener('input', (e) => {
        document.documentElement.style.setProperty('--sub-size', e.target.value + 'rem');
    });


    // ════════════════════════════════════════════════════════════════
    //  CORE CONTROLS
    // ════════════════════════════════════════════════════════════════

    playPauseBtn.addEventListener('click', togglePlayPause);
    nextBtn.addEventListener('click', playNextSong);
    prevBtn.addEventListener('click', playPrevSong);
    searchBar.addEventListener('keyup', filterPlaylist);
    fileInput.addEventListener('change', loadSongsFromLocal);
    githubLoadBtn.addEventListener('click', promptAndLoadFromGitHub);
    togglePlaylistBtn.addEventListener('click', togglePlaylistExpanded);
    progressContainer.addEventListener('click', setProgress);

    function promptAndLoadFromGitHub() {
        const saved = localStorage.getItem('githubRepoPath') || 'ryyReid/music/likedsongs';
        const path  = prompt('Enter GitHub path (user/repo/path/to/songs):', saved);
        if (path && path.trim()) {
            localStorage.setItem('githubRepoPath', path.trim());
            loadSongsFromGitHub(path.trim());
        }
    }

    function loadSongsFromGitHub(repoPath) {
        const cleaned = repoPath.replace(/(^\/|\/$)/g, '').replace(/\/tree\/main/, '');
        const parts   = cleaned.split('/').filter(Boolean);
        if (parts.length < 3) {
            playlistContainer.innerHTML = '<p class="empty-playlist-msg">Invalid path.</p>';
            return;
        }
        const [user, repo, ...rest] = parts;
        playlistContainer.innerHTML = '<p class="empty-playlist-msg">Loading…</p>';

        fetch(`https://api.github.com/repos/${user}/${repo}/contents/${rest.join('/')}`)
            .then(r => r.json())
            .then(data => {
                if (!Array.isArray(data)) { playlistContainer.innerHTML = `<p class="empty-playlist-msg">Error: ${data.message}</p>`; return; }
                playlist = data
                    .filter(i => i.type === 'file' && /\.(mp3|wav|ogg|flac|m4a|aac|mp4|webm|mkv|mov)$/i.test(i.name))
                    .map(i => ({ title: i.name.replace(/\.(mp3|wav|ogg|flac|m4a|aac|mp4|webm|mkv|mov)$/gi,''), artist:'GitHub', url:i.download_url, isVideo:/\.(mp4|webm|mkv|mov)$/i.test(i.name) }));
                renderPlaylist();
                if (playlist.length) { playlistTitle.textContent = 'Songs (GitHub)'; loadSong(0); }
                else playlistContainer.innerHTML = '<p class="empty-playlist-msg">No songs found.</p>';
            })
            .catch(() => { playlistContainer.innerHTML = '<p class="empty-playlist-msg">Could not load from GitHub.</p>'; });
    }

    function loadSongsFromLocal(e) {
        const AUDIO_EXT = /\.(mp3|wav|ogg|flac|m4a|aac|wma|opus|aiff?)$/i;
        const VIDEO_EXT = /\.(mp4|webm|mkv|mov)$/i;
        const STRIP_EXT = /\.(mp3|wav|ogg|flac|m4a|aac|wma|opus|aiff?|mp4|webm|mkv|mov)$/gi;
        const files = Array.from(e.target.files).filter(f =>
            f.type.startsWith('audio/') || f.type.startsWith('video/') ||
            AUDIO_EXT.test(f.name) || VIDEO_EXT.test(f.name)
        );
        if (!files.length) return;
        playlist = files.map(f => {
            const isVideo = (f.type.startsWith('video/') || VIDEO_EXT.test(f.name)) && !AUDIO_EXT.test(f.name);
            return { title: f.name.replace(STRIP_EXT,''), artist: isVideo?'Local Video':'Local File', url: URL.createObjectURL(f), isVideo };
        });
        currentSongIndex = -1;
        renderPlaylist();
        if (playlist.length) { playlistTitle.textContent = 'Songs (Local)'; loadSong(0); }
    }

    function renderPlaylist() {
        playlistContainer.innerHTML = '';
        if (!playlist.length) { playlistTitle.textContent='Songs'; playlistContainer.innerHTML='<p class="empty-playlist-msg">No songs loaded.</p>'; return; }
        playlist.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.dataset.index = index;
            item.innerHTML = `
                <div class="playlist-item-art"><i class="fas ${song.isVideo?'fa-film':'fa-music'}"></i></div>
                <div class="playlist-item-info"><h4>${song.title}</h4><p>${song.artist}</p></div>
                <div class="playlist-item-duration">--:--</div>`;
            item.addEventListener('click', () => playSong(index));
            playlistContainer.appendChild(item);
        });
    }

    function loadSong(index) {
        if (index < 0 || index >= playlist.length) return;
        audioPlayer.pause(); videoPlayer.pause();
        currentSongIndex = index;
        const song = playlist[index];
        setActivePlayer(song.isVideo);
        currentPlayer.src = song.url;
        currentPlayer.load();
        songTitle.textContent  = song.title.replace(/\.(mp3|wav|ogg|flac|m4a|aac|wma|opus|mp4|webm|mkv|mov)$/gi, '');
        songArtist.textContent = song.artist;
        while (videoPlayer.firstChild) videoPlayer.removeChild(videoPlayer.firstChild);
        ccEnabled = false; updateCCState();
        clearSubDisplay();
        updateActivePlaylistItem();
    }

    function playSong(index) { loadSong(index); currentPlayer.play().catch(console.warn); }

    function togglePlayPause() {
        if (currentSongIndex === -1) return;
        currentPlayer.paused ? currentPlayer.play().catch(console.warn) : currentPlayer.pause();
    }

    function playNextSong() { if (playlist.length) playSong((currentSongIndex+1) % playlist.length); }

    function playPrevSong() {
        if (!playlist.length) return;
        currentPlayer.currentTime > 3
            ? (currentPlayer.currentTime = 0)
            : playSong((currentSongIndex - 1 + playlist.length) % playlist.length);
    }

    function formatTime(s) {
        if (isNaN(s)) return '--:--';
        return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
    }

    function updateProgress() {
        if (!currentPlayer.duration) return;
        progressBar.style.width   = `${(currentPlayer.currentTime / currentPlayer.duration)*100}%`;
        currentTimeEl.textContent = formatTime(currentPlayer.currentTime);
    }

    function setProgress(e) {
        if (currentSongIndex===-1 || !isFinite(currentPlayer.duration)) return;
        currentPlayer.currentTime = (e.offsetX / progressContainer.clientWidth) * currentPlayer.duration;
    }

    function updateActivePlaylistItem() {
        document.querySelectorAll('.playlist-item').forEach(item =>
            item.classList.toggle('active', parseInt(item.dataset.index) === currentSongIndex));
    }

    function filterPlaylist() {
        const f = searchBar.value.toLowerCase();
        document.querySelectorAll('.playlist-item').forEach(item => {
            item.style.display = (item.querySelector('h4').textContent.toLowerCase().includes(f) ||
                                  item.querySelector('p').textContent.toLowerCase().includes(f)) ? 'flex' : 'none';
        });
    }

    // ── Mobile toggle ─────────────────────────────────────────────
    const playlistColumn = document.querySelector('.playlist-column');
    const playerColumn   = document.querySelector('.player-column');

    function togglePlaylistExpanded() {
        if (!window.matchMedia('(max-width:768px)').matches) return;
        playlistColumn.classList.toggle('playlist-expanded');
        const exp = playlistColumn.classList.contains('playlist-expanded');
        togglePlaylistBtn.querySelector('i').className = exp ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
        playerColumn.style.opacity       = exp ? '0' : '1';
        playerColumn.style.pointerEvents = exp ? 'none' : 'auto';
    }

    // ── Horizontal resizer ────────────────────────────────────────
    const appContainer = document.querySelector('.app-container');
    document.getElementById('horizontal-resizer').addEventListener('mousedown', () => {
        if (!window.matchMedia('(min-width:769px)').matches) return;
        document.body.style.cursor = 'ew-resize';
        appContainer.style.userSelect = 'none';
        const onMove = (e) => { playlistColumn.style.width = `${Math.min(600,Math.max(200,appContainer.getBoundingClientRect().right-e.clientX))}px`; };
        const onUp   = () => { document.body.style.cursor=''; appContainer.style.userSelect=''; document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
    });
    document.getElementById('vertical-resizer').addEventListener('click', togglePlaylistExpanded);

    // ── Initial load ──────────────────────────────────────────────
    const savedRepo = localStorage.getItem('githubRepoPath');
    savedRepo ? loadSongsFromGitHub(savedRepo) : renderPlaylist();
});
