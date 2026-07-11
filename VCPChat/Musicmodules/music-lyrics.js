// Musicmodules/music-lyrics.js
// 歌词获取、解析、渲染、动画
//
// 策略：
// 1) 先检测本地歌词（同目录 .lrc / AppData/lyric 缓存）
// 2) 有则解析并滚动播放
// 3) 无则联网检索；仍无则显示「本地音乐暂无歌词」/「暂无歌词」
// 歌词流程不阻塞音频播放

function setupLyrics(app) {
    app.lyricsRequestToken = app.lyricsRequestToken || 0;
    app._localLyricsMissCache = app._localLyricsMissCache || new Set();

    app.showNoLyricsMessage = (isLocal) => {
        app.currentLyrics = [];
        app.currentLyricIndex = -1;
        app.lyricsList.innerHTML = isLocal
            ? '<li class="no-lyrics">本地音乐暂无歌词</li>'
            : '<li class="no-lyrics">暂无歌词</li>';
        app.lyricsList.style.transform = 'translateY(0px)';
    };

    app.fetchAndDisplayLyricsForTrack = async (track) => {
        if (!track) return;

        const requestToken = ++app.lyricsRequestToken;
        app.resetLyrics(true);
        if (!app.api?.getMusicLyrics) {
            app.showNoLyricsMessage(app.isLocalTrack?.(track));
            return;
        }

        const title = app.stripAudioExtension(track.title) || track.title;
        const artist = track.artist || '';
        const isLocal = typeof app.isLocalTrack === 'function' ? app.isLocalTrack(track) : false;
        const cacheKey = isLocal ? app.normalizePathForCompare(track.path) : '';

        // 已知无歌词的本地曲：直接提示，不重复检索（不阻塞播放）
        if (cacheKey && app._localLyricsMissCache.has(cacheKey)) {
            app.showNoLyricsMessage(true);
            return;
        }

        // —— 1) 检测本地歌词（sidecar / lyric 目录缓存）——
        let lrcContent = null;
        try {
            lrcContent = await app.api.getMusicLyrics({
                artist,
                title,
                path: track.path,
            });
        } catch (error) {
            console.warn('[Music] Local lyric lookup failed:', error);
        }

        if (requestToken !== app.lyricsRequestToken) return;

        if (lrcContent) {
            if (cacheKey) app._localLyricsMissCache.delete(cacheKey);
            app.currentLyrics = app.parseLrc(lrcContent);
            if (app.currentLyrics.length > 0) {
                app.renderLyrics();
                return;
            }
        }

        // —— 2) 联网检索歌词 ——
        if (!app.api.fetchMusicLyrics) {
            if (cacheKey) app._localLyricsMissCache.add(cacheKey);
            app.showNoLyricsMessage(isLocal);
            return;
        }

        app.lyricsList.innerHTML = isLocal
            ? '<li class="no-lyrics">正在检索歌词...</li>'
            : '<li class="no-lyrics">正在网络上搜索歌词...</li>';

        try {
            const fetchedLrc = await app.api.fetchMusicLyrics({ artist, title });
            if (requestToken !== app.lyricsRequestToken) return;

            if (fetchedLrc) {
                if (cacheKey) app._localLyricsMissCache.delete(cacheKey);
                app.currentLyrics = app.parseLrc(fetchedLrc);
                if (app.currentLyrics.length > 0) {
                    app.renderLyrics();
                    return;
                }
            }

            if (cacheKey) app._localLyricsMissCache.add(cacheKey);
            app.showNoLyricsMessage(isLocal);
        } catch (error) {
            if (requestToken !== app.lyricsRequestToken) return;
            console.error('[Music] Failed to fetch lyrics from network:', error);
            if (cacheKey) app._localLyricsMissCache.add(cacheKey);
            app.lyricsList.innerHTML = isLocal
                ? '<li class="no-lyrics">本地音乐暂无歌词</li>'
                : '<li class="no-lyrics">歌词获取失败</li>';
        }
    };

    app.fetchAndDisplayLyrics = (artist, title) => {
        app.fetchAndDisplayLyricsForTrack({ artist, title, path: null, isRemote: true });
    };

    app.parseLrc = (lrcContent) => {
        const lyricsMap = new Map();
        const lines = String(lrcContent || '').split('\n');
        const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/g;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const text = trimmedLine.replace(timeRegex, '').trim();
            if (text) {
                let match;
                timeRegex.lastIndex = 0;
                while ((match = timeRegex.exec(trimmedLine)) !== null) {
                    const minutes = parseInt(match[1], 10);
                    const seconds = parseInt(match[2], 10);
                    const milliseconds = parseInt(match[3].padEnd(3, '0'), 10);
                    const time = (minutes * 60 + seconds + milliseconds / 1000) * app.lyricSpeedFactor + app.lyricOffset;
                    const timeKey = time.toFixed(4);

                    if (lyricsMap.has(timeKey)) {
                        if (!lyricsMap.get(timeKey).translation) {
                            lyricsMap.get(timeKey).translation = text;
                        }
                    } else {
                        lyricsMap.set(timeKey, { time, original: text, translation: '' });
                    }
                }
            }
        }

        return Array.from(lyricsMap.values()).sort((a, b) => a.time - b.time);
    };

    app.renderLyrics = () => {
        app.lyricsList.innerHTML = '';
        const fragment = document.createDocumentFragment();
        app.currentLyrics.forEach((line, index) => {
            const li = document.createElement('li');

            const originalSpan = document.createElement('span');
            originalSpan.textContent = line.original;
            originalSpan.className = 'lyric-original';
            li.appendChild(originalSpan);

            if (line.translation) {
                const translationSpan = document.createElement('span');
                translationSpan.textContent = line.translation;
                translationSpan.className = 'lyric-translation';
                li.appendChild(translationSpan);
            }

            li.dataset.index = index;
            fragment.appendChild(li);
        });
        app.lyricsList.appendChild(fragment);
    };

    app.animateLyrics = () => {
        if (app.currentLyrics.length === 0 || !app.isPlaying) return;

        // 本地 HTML5 快播路径直接读 currentTime，保证歌词跟唱
        let estimatedTime;
        if (app.useLocalAudioFallback && app.phantomAudio) {
            estimatedTime = Number(app.phantomAudio.currentTime) || 0;
            app.lastKnownCurrentTime = estimatedTime;
            app.lastStateUpdateTime = Date.now();
        } else {
            const elapsedTime = (Date.now() - app.lastStateUpdateTime) / 1000;
            estimatedTime = app.lastKnownCurrentTime + elapsedTime;
        }

        let newLyricIndex = -1;
        for (let i = 0; i < app.currentLyrics.length; i++) {
            if (estimatedTime >= app.currentLyrics[i].time) {
                newLyricIndex = i;
            } else {
                break;
            }
        }

        if (newLyricIndex !== app.currentLyricIndex) {
            app.currentLyricIndex = newLyricIndex;
        }

        const allLi = app.lyricsList.querySelectorAll('li');
        allLi.forEach((li, index) => {
            const distance = Math.abs(index - app.currentLyricIndex);
            if (index === app.currentLyricIndex) {
                li.classList.add('active');
                li.style.opacity = 1;
            } else {
                li.classList.remove('active');
                li.style.opacity = Math.max(0.1, 1 - distance * 0.22).toFixed(2);
            }
        });

        if (app.currentLyricIndex > -1) {
            const currentLine = app.currentLyrics[app.currentLyricIndex];
            const nextLine = app.currentLyrics[app.currentLyricIndex + 1];
            const currentLineLi = app.lyricsList.querySelector(`li[data-index='${app.currentLyricIndex}']`);
            if (!currentLineLi) return;

            let progress = 0;
            if (nextLine) {
                const timeIntoLine = estimatedTime - currentLine.time;
                const lineDuration = nextLine.time - currentLine.time;
                if (lineDuration > 0) {
                    progress = Math.max(0, Math.min(1, timeIntoLine / lineDuration));
                }
            }

            const nextLineLi = nextLine ? app.lyricsList.querySelector(`li[data-index='${app.currentLyricIndex + 1}']`) : null;
            const currentOffset = currentLineLi.offsetTop;
            const nextOffset = nextLineLi ? nextLineLi.offsetTop : currentOffset;
            const interpolatedOffset = currentOffset + (nextOffset - currentOffset) * progress;

            const goldenRatioPoint = app.lyricsContainer.clientHeight * 0.382;
            const scrollOffset = interpolatedOffset - goldenRatioPoint + (currentLineLi.clientHeight / 2);
            app.lyricsList.style.transform = `translateY(-${scrollOffset}px)`;
        }
    };

    app.resetLyrics = (showLoading = true) => {
        app.currentLyrics = [];
        app.currentLyricIndex = -1;
        app.lyricsList.innerHTML = showLoading
            ? '<li class="no-lyrics">加载歌词中...</li>'
            : '<li class="no-lyrics">暂无歌词</li>';
        app.lyricsList.style.transform = 'translateY(0px)';
    };
}
