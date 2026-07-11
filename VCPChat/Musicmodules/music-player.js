// Musicmodules/music-player.js
// 核心播放逻辑

function setupPlayer(app) {
    app.trackPathsMatch = (enginePath, trackPath) => {
        if (!enginePath || !trackPath) return false;
        if (app.pathsEqual(enginePath, trackPath)) return true;
        const left = app.normalizePathForCompare(enginePath);
        const right = app.normalizePathForCompare(trackPath);
        return Boolean(left && right && left.split('/').pop() === right.split('/').pop());
    };

    app.waitForEngineTrackReady = async (track, requestId, timeoutMs = 8000) => {
        const timeoutAt = Date.now() + timeoutMs;
        let pollInterval = 50;

        while (Date.now() < timeoutAt) {
            if (requestId !== app.pendingLoadRequestId) return false;

            let loadingStatus = null;
            try {
                loadingStatus = await app.api.getMusicLoadingStatus?.();
            } catch (error) {
                console.error('[Music.js] Engine loading status poll failed:', error);
                return 'engine_down';
            }

            const loadError = loadingStatus?.loading?.error;
            if (loadError) {
                console.error('[Music.js] Track load failed:', loadError);
                return false;
            }

            if (loadingStatus?.loading?.is_loading === false) {
                let stateResult;
                try {
                    stateResult = await app.api.getMusicState();
                } catch (error) {
                    console.error('[Music.js] Engine state poll failed:', error);
                    return 'engine_down';
                }

                if (stateResult?.status === 'error' && app.isEngineUnavailableError(stateResult.message)) {
                    return 'engine_down';
                }

                if (stateResult?.status === 'success' && stateResult.state) {
                    const state = stateResult.state;
                    app.updateUIWithState(state);

                    if (app.trackPathsMatch(state.file_path, track.path)) {
                        return true;
                    }

                    if ((state.duration ?? 0) > 0 && state.file_path) {
                        return true;
                    }

                    if (!state.file_path) {
                        return false;
                    }
                }
            }

            await new Promise(r => setTimeout(r, pollInterval));
            pollInterval = Math.min(pollInterval + 25, 200);
        }

        console.warn('[Music.js] waitForEngineTrackReady timed out for:', track.title);
        return false;
    };

    app.loadTrack = async (trackIndex, andPlay = true) => {
        const requestId = ++app.pendingLoadRequestId;
        app.isPreloadingNext = false;

        if (app.playlist.length === 0) {
            app.trackTitle.textContent = '未选择歌曲';
            app.trackArtist.textContent = '未知艺术家';
            app.trackBitrate.textContent = '';
            const defaultArtUrl = `url('../assets/${app.currentTheme === 'light' ? 'musiclight.jpeg' : 'musicdark.jpeg'}')`;
            app.albumArt.style.backgroundImage = defaultArtUrl;
            app.updateBlurredBackground('none');
            app.renderPlaylist(app.currentFilteredTracks);
            return;
        }

        app.currentTrackIndex = trackIndex;
        let track = app.playlist[trackIndex];
        if (!track) {
            console.error('[Music.js] Invalid track index:', trackIndex);
            return;
        }
        app.pendingTrackPath = track.path;
        app.isTrackLoading = true;
        const switchingLocalToLocal = app.isLocalTrack(track) && app.useLocalAudioFallback;
        if (!switchingLocalToLocal) {
            app.deactivateLocalAudioFallback?.();
        }

        try {
            // 在线曲目：仅在需要播放或本地缓存缺失时刷新（避免启动时卡住播放键）
            const needsOnlineRefresh = track.source === 'online' && app.api?.refreshOnlineMusicTrack && (
                andPlay
                || track.cachedLocally !== true
                || !track.path
                || /^https?:\/\//i.test(String(track.path))
            );
            if (needsOnlineRefresh) {
                try {
                    const refreshed = await app.api.refreshOnlineMusicTrack(track);
                    if (requestId !== app.pendingLoadRequestId) return;
                    if (refreshed?.status === 'success' && refreshed.track?.path) {
                        track = { ...track, ...refreshed.track };
                        app.playlist[trackIndex] = track;
                        app.pendingTrackPath = track.path;
                    }
                } catch (error) {
                    console.warn('[Music.js] Online track refresh failed:', error?.message || error);
                }
            }

            app.trackTitle.textContent = app.stripAudioExtension(track.title) || '未知标题';
            app.trackArtist.textContent = track.artist || '未知艺术家';
            app.trackBitrate.textContent = track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : '';

            const defaultArtUrl = `url('../assets/${app.currentTheme === 'light' ? 'musiclight.jpeg' : 'musicdark.jpeg'}')`;
            if (track.albumArt) {
                const art = String(track.albumArt);
                const albumArtUrl = app.getAlbumArtCssUrl?.(art)
                    || (/^https?:\/\//i.test(art)
                        ? `url('${art.replace(/'/g, '%27')}')`
                        : `url('file://${art.replace(/\\/g, '/')}')`);
                app.albumArt.style.backgroundImage = albumArtUrl;
                app.updateBlurredBackground(albumArtUrl);
            } else {
                app.albumArt.style.backgroundImage = defaultArtUrl;
                app.updateBlurredBackground('none');
            }

            app.renderPlaylist(app.currentFilteredTracks);
            app.fetchAndDisplayLyricsForTrack(track);
            app.updateMediaSessionMetadata();
            if (app.wnpAdapter) app.wnpAdapter.sendUpdate();

            if (app.isLocalTrack(track)) {
                app.stopStatePolling?.();
                app.api?.musicPause?.().catch(() => {});
                app.useLocalAudioFallback = false;
                app.bindFallbackAudioEvents();
                const localReady = await app.loadLocalTrackFast(track, andPlay, requestId);
                if (requestId !== app.pendingLoadRequestId) return;
                if (localReady) return;

                console.warn('[Music.js] Local fast path failed, falling back to Rust engine:', track.path);
            }

            // 在线曲目：本地缓存文件走 HTML5；反代流也优先 HTML5（Rust 解不了 B 站 fMP4）
            if (track.source === 'online') {
                const pathText = String(track.path || '');
                const isCachedFile = track.cachedLocally || !/^https?:\/\//i.test(pathText);
                const isProxy = /^https?:\/\/127\.0\.0\.1(?::\d+)?\/online-stream\//i.test(pathText);
                if (isCachedFile || isProxy) {
                    app.stopStatePolling?.();
                    app.api?.musicPause?.().catch(() => {});
                    app.useLocalAudioFallback = false;
                    app.bindFallbackAudioEvents();
                    const onlineReady = await app.loadLocalTrackFast(track, andPlay, requestId);
                    if (requestId !== app.pendingLoadRequestId) return;
                    if (onlineReady) return;
                    console.warn('[Music.js] Online HTML5 path failed, falling back to Rust engine:', track.path);
                }
            }

            try {
                await app.api?.cancelMusicPreload?.();
            } catch (e) {}

            app.useLocalAudioFallback = false;
            app.bindFallbackAudioEvents();

            const result = await app.api.musicLoad(track);
            if (requestId !== app.pendingLoadRequestId) return;

            if (result && result.status === 'success') {
                if (result.track?.path) {
                    track = { ...track, ...result.track };
                    app.playlist[trackIndex] = track;
                    app.pendingTrackPath = track.path;
                }
                app.updateUIWithState(result.state);

                const ready = await app.waitForEngineTrackReady(track, requestId);
                if (requestId !== app.pendingLoadRequestId) return;
                if (ready === true) {
                    let finalState;
                    try {
                        finalState = await app.api.getMusicState();
                    } catch (_) {
                        finalState = null;
                    }
                    const decodedDuration = finalState?.state?.duration ?? 0;
                    if (decodedDuration <= 0) {
                        const ok = await app.tryLocalFallbackPlayback(
                            track,
                            andPlay,
                            '引擎未能解码此文件（可能为特殊封装格式）'
                        );
                        if (!ok && andPlay) {
                            app.trackArtist.textContent = '加载失败 — 请确认文件存在且格式受支持';
                        }
                        return;
                    }
                    app.useLocalAudioFallback = false;
                    if (andPlay) await app.playTrack({ allowReload: false });
                } else {
                    const fallbackReason = ready === 'engine_down'
                        ? '音频引擎崩溃或未响应'
                        : 'Rust 引擎加载失败';
                    const ok = await app.tryLocalFallbackPlayback(track, andPlay, fallbackReason);
                    if (!ok && andPlay) {
                        console.error('[Music.js] Track not ready for playback:', track.title, track.path);
                        app.trackArtist.textContent = '加载失败 — 请确认文件存在且格式受支持';
                    }
                }
            } else {
                console.error('Failed to load track:', result?.message);
                const ok = await app.tryLocalFallbackPlayback(
                    track,
                    andPlay,
                    result?.message || 'engine load failed'
                );
                if (!ok && andPlay) {
                    app.trackArtist.textContent = '加载失败 — 请确认文件存在且格式受支持';
                }
            }
        } catch (error) {
            console.error('[Music.js] loadTrack failed:', error);
            if (andPlay) {
                app.trackArtist.textContent = `加载失败 — ${error.message || '未知错误'}`;
            }
        } finally {
            if (requestId === app.pendingLoadRequestId) {
                app.isTrackLoading = false;
            }
        }
    };

    app.playTrack = async (options = {}) => {
        const allowReload = options.allowReload !== false;
        if (app.playlist.length === 0) {
            if (app.trackArtist) app.trackArtist.textContent = '播放列表为空';
            return;
        }

        const idx = Number.isInteger(app.currentTrackIndex) ? app.currentTrackIndex : 0;
        const track = app.playlist[idx];
        if (!track) {
            if (allowReload) await app.loadTrack(0, true);
            return;
        }

        // 加载卡住时不再静默忽略，改为重新加载并播放
        if (app.isTrackLoading) {
            console.warn('[Music.js] Play while loading — retry loadTrack');
            app.isTrackLoading = false;
            if (allowReload) await app.loadTrack(idx, true);
            return;
        }

        const src = String(app.phantomAudio?.src || '');
        const hasHtml5Src = Boolean(src)
            && !src.startsWith('data:')
            && !src.startsWith('about:')
            && src !== window.location.href;

        if (app.useLocalAudioFallback || hasHtml5Src) {
            app.useLocalAudioFallback = true;
            try {
                await app.playTrackLocal();
                return;
            } catch (error) {
                console.error('Local fallback play failed:', error);
                app.useLocalAudioFallback = false;
                if (allowReload) {
                    await app.loadTrack(idx, true);
                    return;
                }
            }
        }

        try {
            const result = await app.api.musicPlay();
            if (result?.status === 'success') {
                app.isChangingState = true;
                app.lastCommandTime = Date.now();
                app.expectedPlayingState = true;
                app.isPlaying = true;
                document.body.classList.add('music-playing');
                app.playPauseBtn.classList.add('is-playing');
                app.phantomAudio.loop = true;
                if (!hasHtml5Src) {
                    app.phantomAudio.play().catch((e) => console.error('Phantom audio play failed:', e));
                }

                if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
                app.startStatePolling();
                if (app.wnpAdapter) app.wnpAdapter.sendUpdate();
                return;
            }

            console.warn('[Music.js] musicPlay failed, reloading track:', result?.message);
            if (allowReload) await app.loadTrack(idx, true);
            else if (app.trackArtist) app.trackArtist.textContent = result?.message || '无法播放';
        } catch (error) {
            console.error('[Music.js] playTrack failed:', error);
            if (allowReload) await app.loadTrack(idx, true);
        }
    };

    app.pauseTrack = async () => {
        if (app.useLocalAudioFallback) {
            await app.pauseTrackLocal();
            return;
        }
        const result = await app.api.musicPause();
        if (result.status === 'success') {
            app.isChangingState = true;
            app.lastCommandTime = Date.now();
            app.expectedPlayingState = false;
            app.isPlaying = false;
            document.body.classList.remove('music-playing');
            app.playPauseBtn.classList.remove('is-playing');
            app.phantomAudio.pause();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
            app.stopStatePolling();
            if (app.wnpAdapter) app.wnpAdapter.sendUpdate();
        }
    };

    app.prevTrack = () => {
        app.currentTrackIndex = (app.currentTrackIndex - 1 + app.playlist.length) % app.playlist.length;
        app.loadTrack(app.currentTrackIndex);
    };

    app.nextTrack = () => {
        const activeList = app.currentFilteredTracks || app.playlist;
        if (app.lastShuffleList !== activeList) {
            app.shuffleQueue = [];
            app.lastShuffleList = activeList;
        }

        if (activeList.length <= 1) {
            if (activeList.length === 1) {
                const idx = app.playlist.indexOf(activeList[0]);
                if (idx !== -1) app.loadTrack(idx);
            }
            return;
        }

        const previousTrackIndex = app.currentTrackIndex;

        switch (app.playModes[app.currentPlayMode]) {
            case 'repeat':
                const currentTrack = app.playlist[app.currentTrackIndex];
                const currentPos = activeList.indexOf(currentTrack);
                if (currentPos !== -1) {
                    const nextPos = (currentPos + 1) % activeList.length;
                    app.currentTrackIndex = app.playlist.indexOf(activeList[nextPos]);
                } else {
                    app.currentTrackIndex = app.playlist.indexOf(activeList[0]);
                }
                break;
            case 'repeat-one': break;
            case 'shuffle':
                if (app.shuffleQueue.length === 0) {
                    app.shuffleQueue = Array.from({ length: activeList.length }, (_, i) => i);
                    for (let i = app.shuffleQueue.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [app.shuffleQueue[i], app.shuffleQueue[j]] = [app.shuffleQueue[j], app.shuffleQueue[i]];
                    }
                    if (app.shuffleQueue.length > 1 && app.playlist.indexOf(activeList[app.shuffleQueue[0]]) === app.currentTrackIndex) {
                        app.shuffleQueue.push(app.shuffleQueue.shift());
                    }
                }
                const nextIdx = app.shuffleQueue.shift();
                app.currentTrackIndex = app.playlist.indexOf(activeList[nextIdx]);
                break;
        }

        // 防御性保护：如果不是单曲循环模式，但计算出的下一首仍然是当前歌曲，
        // 则强制跳到列表中的下一首。这可以防止由于 gapless 事件竞争等原因
        // 导致的意外"单曲循环"行为。
        if (app.playModes[app.currentPlayMode] !== 'repeat-one'
            && app.currentTrackIndex === previousTrackIndex
            && activeList.length > 1) {
            console.warn('[Music.js] nextTrack: computed same track in non-repeat-one mode, forcing advance');
            const currentTrackForFix = app.playlist[app.currentTrackIndex];
            const currentPosForFix = activeList.indexOf(currentTrackForFix);
            const forcedNextPos = (currentPosForFix !== -1)
                ? (currentPosForFix + 1) % activeList.length
                : 0;
            app.currentTrackIndex = app.playlist.indexOf(activeList[forcedNextPos]);
        }

        app.loadTrack(app.currentTrackIndex);
    };

    app.handleNeedsPreload = async () => {
        if (app.useLocalAudioFallback || app.isPreloadingNext) return;
        const activeList = app.currentFilteredTracks || app.playlist;
        if (activeList.length === 0) return;

        let nextTrackToPreload = null;
        switch (app.playModes[app.currentPlayMode]) {
            case 'repeat':
                const currentTrack = app.playlist[app.currentTrackIndex];
                const currentPos = activeList.indexOf(currentTrack);
                nextTrackToPreload = activeList[currentPos !== -1 ? (currentPos + 1) % activeList.length : 0];
                break;
            case 'repeat-one':
                nextTrackToPreload = app.playlist[app.currentTrackIndex];
                break;
            case 'shuffle':
                if (app.shuffleQueue.length === 0) {
                    // Generate a new shuffle queue if empty
                    app.shuffleQueue = Array.from({ length: activeList.length }, (_, i) => i);
                    for (let i = app.shuffleQueue.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [app.shuffleQueue[i], app.shuffleQueue[j]] = [app.shuffleQueue[j], app.shuffleQueue[i]];
                    }
                    // Avoid starting with the current track
                    if (app.shuffleQueue.length > 1 && app.playlist.indexOf(activeList[app.shuffleQueue[0]]) === app.currentTrackIndex) {
                        app.shuffleQueue.push(app.shuffleQueue.shift());
                    }
                }
                
                if (app.shuffleQueue.length > 0) {
                    nextTrackToPreload = activeList[app.shuffleQueue[0]];
                }
                break;
        }

        if (nextTrackToPreload && nextTrackToPreload.path) {
            // If we are in repeat-one mode and there's only one track,
            // we still want to preload it for gapless looping.
            // But if we are NOT in repeat-one and there's only one track, we don't need to preload.
            if (activeList.length <= 1 && app.playModes[app.currentPlayMode] !== 'repeat-one') {
                return;
            }

            app.isPreloadingNext = true;
            try {
                await app.api.queueNextMusicTrack({
                    path: nextTrackToPreload.path,
                    username: nextTrackToPreload.username,
                    password: nextTrackToPreload.password
                });
            } catch (e) {
                console.error('[Music.js] Preload failed:', e);
            } finally {
                setTimeout(() => { app.isPreloadingNext = false; }, 500);
            }
        }
    };

    app.pollState = async () => {
        const result = await app.api.getMusicState();
        if (result.status === 'success') app.updateUIWithState(result.state);
    };

    app.syncTrackIndexByPath = (path) => {
        if (!path) return;
        const normalizedPath = app.normalizePathForCompare(path);
        const index = app.playlist.findIndex(t => app.pathsEqual(t.path, path));
        if (index !== -1) {
            console.log('[Music.js] Syncing track index to:', index, 'path:', normalizedPath);
            app.currentTrackIndex = index;
            const track = app.playlist[index];
            app.pendingTrackPath = track.path;
            app.isTrackLoading = false; // gapless 切歌后后端已经加载好了，重置加载标志
            app.trackTitle.textContent = app.stripAudioExtension(track.title) || '未知标题';
            app.trackArtist.textContent = track.artist || '未知艺术家';
            app.trackBitrate.textContent = track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : '';
            
            const defaultArtUrl = `url('../assets/${app.currentTheme === 'light' ? 'musiclight.jpeg' : 'musicdark.jpeg'}')`;
            if (track.albumArt) {
                const albumArtUrl = app.getAlbumArtCssUrl?.(track.albumArt)
                    || `url('file://${String(track.albumArt).replace(/\\/g, '/')}')`;
                app.albumArt.style.backgroundImage = albumArtUrl;
                app.updateBlurredBackground(albumArtUrl);
            } else {
                app.albumArt.style.backgroundImage = defaultArtUrl;
                app.updateBlurredBackground('none');
            }

            app.renderPlaylist(app.currentFilteredTracks);
            app.fetchAndDisplayLyricsForTrack(track);
            app.updateMediaSessionMetadata();

            // 如果是随机播放，从队列中移除当前已开始播放的这首歌，防止之后再次随机到它
            if (app.playModes[app.currentPlayMode] === 'shuffle') {
                const activeList = app.currentFilteredTracks || app.playlist;
                const posInActiveList = activeList.indexOf(track);
                if (posInActiveList !== -1) {
                    const queueIndex = app.shuffleQueue.indexOf(posInActiveList);
                    if (queueIndex !== -1) {
                        console.log('[Music.js] Removing synced track from shuffle queue at index:', queueIndex);
                        app.shuffleQueue.splice(queueIndex, 1);
                    }
                }
            }

            if (app.wnpAdapter) app.wnpAdapter.sendUpdate();
        } else {
            // 路径匹配失败 —— 尝试文件名模糊匹配作为降级
            // 后端可能返回带 \\?\ 前缀或不同斜杠方向的路径
            const fileName = normalizedPath ? normalizedPath.split('/').pop() : null;
            if (fileName) {
                const fuzzyIndex = app.playlist.findIndex(t => {
                    const tNorm = app.normalizePathForCompare(t.path);
                    return tNorm && tNorm.split('/').pop() === fileName;
                });
                if (fuzzyIndex !== -1) {
                    console.log('[Music.js] Syncing track index (fuzzy match) to:', fuzzyIndex);
                    app.currentTrackIndex = fuzzyIndex;
                    const track = app.playlist[fuzzyIndex];
                    app.pendingTrackPath = track.path;
                    app.isTrackLoading = false;
                    app.trackTitle.textContent = app.stripAudioExtension(track.title) || '未知标题';
                    app.trackArtist.textContent = track.artist || '未知艺术家';
                    app.trackBitrate.textContent = track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : '';
                    
                    const defaultArtUrl = `url('../assets/${app.currentTheme === 'light' ? 'musiclight.jpeg' : 'musicdark.jpeg'}')`;
                    if (track.albumArt) {
                        const albumArtUrl = app.getAlbumArtCssUrl?.(track.albumArt)
                            || `url('file://${String(track.albumArt).replace(/\\/g, '/')}')`;
                        app.albumArt.style.backgroundImage = albumArtUrl;
                        app.updateBlurredBackground(albumArtUrl);
                    } else {
                        app.albumArt.style.backgroundImage = defaultArtUrl;
                        app.updateBlurredBackground('none');
                    }
                    
                    app.renderPlaylist(app.currentFilteredTracks);
                    app.fetchAndDisplayLyricsForTrack(track);
                    app.updateMediaSessionMetadata();

                    // 同样处理模糊匹配的情况
                    if (app.playModes[app.currentPlayMode] === 'shuffle') {
                        const activeList = app.currentFilteredTracks || app.playlist;
                        const posInActiveList = activeList.indexOf(track);
                        if (posInActiveList !== -1) {
                            const queueIndex = app.shuffleQueue.indexOf(posInActiveList);
                            if (queueIndex !== -1) {
                                console.log('[Music.js] Removing synced track (fuzzy) from shuffle queue at index:', queueIndex);
                                app.shuffleQueue.splice(queueIndex, 1);
                            }
                        }
                    }

                    if (app.wnpAdapter) app.wnpAdapter.sendUpdate();
                } else {
                    console.warn('[Music.js] syncTrackIndexByPath: no match found for', normalizedPath);
                }
            } else {
                console.warn('[Music.js] syncTrackIndexByPath: no match found for', path);
            }
        }
    };

    app.startStatePolling = () => {
        if (app.statePollInterval) clearInterval(app.statePollInterval);
        app.statePollInterval = setInterval(app.pollState, 250);
    };

    app.stopStatePolling = () => {
        clearInterval(app.statePollInterval);
        app.statePollInterval = null;
    };
}
