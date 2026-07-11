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

    app.deactivateLocalAudioFallback = () => {
        app.stopFallbackPolling();
        app.useLocalAudioFallback = false;
        app.fallbackDuration = 0;

        const audio = app.phantomAudio;
        if (!audio) return;

        audio.pause();
        audio.loop = false;
        audio.removeAttribute('src');
        audio.src = app.createSilentAudio();
        audio.load();
    };

    app.enableLocalAudioFallback = (track, reason, options = {}) => {
        const { keepLoadingState = false } = options;
        if (reason) {
            console.log('[Music] Using local HTML5 audio path:', reason, track?.path);
        }
        app.stopFallbackPolling();
        app.useLocalAudioFallback = true;
        app.stopStatePolling?.();
        if (!keepLoadingState) {
            app.isTrackLoading = false;
        }

        if (track?.path) {
            app.pendingTrackPath = track.path;
            app.phantomAudio.pause();
            app.phantomAudio.loop = false;
            // 在线本地代理流直接用 http URL；本地文件转 file://
            app.phantomAudio.src = /^https?:\/\//i.test(track.path)
                ? track.path
                : app.pathToFileUrl(track.path);
            app.phantomAudio.volume = Number.parseFloat(app.volumeSlider?.value ?? '1');
            app.phantomAudio.load();
        }
    };

    app.waitForFallbackMetadata = (timeoutMs = 2500, options = {}) => new Promise((resolve) => {
        const audio = app.phantomAudio;
        if (!audio) {
            resolve(false);
            return;
        }

        const acceptWithoutDuration = Boolean(options.acceptWithoutDuration);
        const hasDuration = () => Number.isFinite(audio.duration) && audio.duration > 0;
        const isReady = () => hasDuration() || (acceptWithoutDuration && audio.readyState >= 2);

        if (isReady()) {
            if (hasDuration()) app.syncFallbackProgress();
            resolve(true);
            return;
        }

        const finish = (ok) => {
            cleanup();
            if (ok && hasDuration()) app.syncFallbackProgress();
            resolve(ok);
        };

        const cleanup = () => {
            clearTimeout(timer);
            audio.removeEventListener('loadedmetadata', onReady);
            audio.removeEventListener('canplay', onReady);
            audio.removeEventListener('error', onError);
        };

        const onReady = () => finish(isReady());
        const onError = () => finish(false);
        const timer = setTimeout(() => finish(isReady()), timeoutMs);

        audio.addEventListener('loadedmetadata', onReady);
        audio.addEventListener('canplay', onReady);
        audio.addEventListener('error', onError, { once: true });
    });

    app.loadLocalTrackFast = async (track, andPlay, requestId) => {
        if (!track?.path) return false;

        const isOnlineStream = track.source === 'online'
            && /^https?:\/\/127\.0\.0\.1(?::\d+)?\/online-stream\//i.test(String(track.path));

        app.enableLocalAudioFallback(track, null, { keepLoadingState: true });
        app.bindFallbackAudioEvents();

        const ready = await app.waitForFallbackMetadata(
            isOnlineStream ? 8000 : 2500,
            { acceptWithoutDuration: isOnlineStream }
        );
        if (requestId !== app.pendingLoadRequestId) return false;

        if (!ready) {
            app.useLocalAudioFallback = false;
            return false;
        }

        // 在线 fMP4 可能拿不到 duration，用曲目元数据兜底
        if (isOnlineStream) {
            const metaDur = Number(track.durationMs || 0) / 1000 || Number(track.duration || 0);
            if ((!Number.isFinite(app.phantomAudio.duration) || app.phantomAudio.duration <= 0) && metaDur > 0) {
                app.fallbackDuration = metaDur;
                app.lastKnownDuration = metaDur;
                if (app.durationEl) app.durationEl.textContent = app.formatTime(metaDur);
            }
        }

        app.isTrackLoading = false;
        if (andPlay) {
            try {
                await app.playTrackLocal();
            } catch (error) {
                console.error('[Music] Local fast playback failed:', error);
                app.trackArtist.textContent = '本地播放失败 — 请确认文件存在且格式受支持';
                return false;
            }
        }
        return true;
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
        const pathText = String(track?.path || '');
        const isOnlineLocalProxy = track?.source === 'online'
            && /^https?:\/\/127\.0\.0\.1(?::\d+)?\/online-stream\//i.test(pathText);
        if (!pathText) return false;
        if (!isOnlineLocalProxy && (track.isRemote || /^https?:\/\//i.test(pathText))) {
            return false;
        }
        app.enableLocalAudioFallback(track, reason);
        app.bindFallbackAudioEvents();
        await app.waitForFallbackMetadata(isOnlineLocalProxy ? 8000 : 2500);
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
