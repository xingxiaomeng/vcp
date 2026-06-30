// Musicmodules/music-local-fallback.js
// Chromium HTML5 audio fallback when the Rust engine fails or crashes.

function setupLocalFallback(app) {
    app.useLocalAudioFallback = false;
    app.fallbackDuration = 0;

    app.pathToFileUrl = (filePath) => {
        if (!filePath) return '';
        if (filePath.startsWith('file://')) return filePath;
        const normalized = String(filePath).replace(/\\/g, '/');
        const encoded = normalized.split('/').map((segment, index) => {
            if (index === 0 && /^[a-zA-Z]:$/.test(segment)) return segment;
            return encodeURIComponent(segment);
        }).join('/');
        return `file:///${encoded}`;
    };

    app.enableLocalAudioFallback = (track, reason) => {
        console.warn('[Music] Enabling local HTML5 audio fallback:', reason, track?.path);
        app.useLocalAudioFallback = true;
        app.stopStatePolling();
        app.isTrackLoading = false;

        if (track?.path) {
            app.pendingTrackPath = track.path;
            app.phantomAudio.loop = false;
            app.phantomAudio.src = app.pathToFileUrl(track.path);
            app.phantomAudio.load();
        }
    };

    app.syncFallbackProgress = () => {
        if (!app.useLocalAudioFallback || !app.phantomAudio) return;
        const audio = app.phantomAudio;
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
        app.fallbackDuration = audio.duration;
        app.lastKnownDuration = audio.duration;
        app.lastKnownCurrentTime = audio.currentTime;
        app.lastStateUpdateTime = Date.now();
        const percent = (audio.currentTime / audio.duration) * 100;
        app.progress.style.width = `${percent}%`;
        app.currentTimeEl.textContent = app.formatTime(audio.currentTime);
        app.durationEl.textContent = app.formatTime(audio.duration);
    };

    app.bindFallbackAudioEvents = () => {
        if (!app.phantomAudio || app._fallbackEventsBound) return;
        app._fallbackEventsBound = true;

        app.phantomAudio.addEventListener('loadedmetadata', () => app.syncFallbackProgress());
        app.phantomAudio.addEventListener('timeupdate', () => app.syncFallbackProgress());
        app.phantomAudio.addEventListener('ended', () => {
            if (!app.useLocalAudioFallback) return;
            app.isPlaying = false;
            app.playPauseBtn.classList.remove('is-playing');
            document.body.classList.remove('music-playing');
            app.nextTrack();
        });
        app.phantomAudio.addEventListener('error', () => {
            if (!app.useLocalAudioFallback) return;
            const code = app.phantomAudio.error?.code;
            console.error('[Music] Local fallback playback error, code:', code);
            app.trackArtist.textContent = '本地解码失败 — 文件可能损坏或格式不受支持';
        });
    };

    app.isEngineUnavailableError = (message) => {
        if (!message) return false;
        const text = String(message).toLowerCase();
        return text.includes('econnrefused')
            || text.includes('audio engine')
            || text.includes('fetch failed')
            || text.includes('音频引擎')
            || text.includes('timed out');
    };

    app.stopFallbackPolling = () => {
        if (app.fallbackPollTimer) {
            clearInterval(app.fallbackPollTimer);
            app.fallbackPollTimer = null;
        }
    };

    app.startFallbackPolling = () => {
        app.stopStatePolling?.();
        app.stopFallbackPolling();
        app.fallbackPollTimer = setInterval(() => app.syncFallbackProgress(), 250);
    };

    app.playTrackLocal = async () => {
        if (!app.phantomAudio?.src || app.phantomAudio.src.startsWith('data:')) {
            throw new Error('No local fallback source loaded');
        }
        app.isChangingState = true;
        app.lastCommandTime = Date.now();
        app.expectedPlayingState = true;
        app.isPlaying = true;
        document.body.classList.add('music-playing');
        app.playPauseBtn.classList.add('is-playing');
        await app.phantomAudio.play();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        app.startFallbackPolling();
        if (app.wnpAdapter) app.wnpAdapter.sendUpdate();
    };

    app.pauseTrackLocal = async () => {
        app.isChangingState = true;
        app.lastCommandTime = Date.now();
        app.expectedPlayingState = false;
        app.isPlaying = false;
        document.body.classList.remove('music-playing');
        app.playPauseBtn.classList.remove('is-playing');
        app.phantomAudio.pause();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        app.stopFallbackPolling();
        if (app.wnpAdapter) app.wnpAdapter.sendUpdate();
    };

    app.tryLocalFallbackPlayback = async (track, andPlay, reason) => {
        if (!track?.path || track.isRemote || /^https?:\/\//i.test(track.path)) {
            return false;
        }
        app.enableLocalAudioFallback(track, reason);
        app.bindFallbackAudioEvents();
        if (andPlay) {
            try {
                await app.playTrackLocal();
            } catch (error) {
                console.error('[Music] Local fallback playback failed:', error);
                app.trackArtist.textContent = '本地播放失败 — 请确认文件存在且格式受支持';
                return false;
            }
        }
        return true;
    };
}
