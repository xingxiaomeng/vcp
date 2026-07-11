// Musicmodules/music-online.js
// Spotube 模式：联网搜歌（目录元数据）→ 换源解析 → 加入播放列表并播放

function setupOnlineSearch(app) {
    app.isOnlineSearchActive = false;
    app.isOnlineSearching = false;
    app.onlineSearchResults = [];
    app.onlineMetaSource = '';

    app.updateOnlineSearchUi = () => {
        app.onlineSearchBtn?.classList.toggle('active', app.isOnlineSearchActive);
        if (app.isOnlineSearchActive) {
            app.isSemanticSearchActive = false;
            app.semanticSearchBtn?.classList.remove('active');
            app.searchInput.placeholder = '联网搜索歌曲，例如：周杰伦 新歌';
        } else if (!app.isSemanticSearchActive) {
            app.searchInput.placeholder = '搜索歌曲...';
        }
    };

    app.exitOnlineSearchView = () => {
        app.onlineSearchResults = [];
        app.onlineMetaSource = '';
        app.currentFilteredTracks = null;
        app.renderPlaylist();
    };

    app.renderOnlineSearchResults = (results) => {
        if (!app.playlistEl) return;
        app.playlistEl.innerHTML = '';

        if (!results.length) {
            const li = document.createElement('li');
            li.className = 'no-lyrics';
            li.textContent = '未找到在线结果';
            app.playlistEl.appendChild(li);
            return;
        }

        const header = document.createElement('li');
        header.className = 'online-result-header';
        header.textContent = `在线结果 · ${app.onlineMetaSource || 'catalog'}（点击播放）`;
        app.playlistEl.appendChild(header);

        results.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'online-result-item';
            li.dataset.onlineIndex = String(index);

            const art = document.createElement('img');
            art.className = 'online-result-art';
            art.src = item.albumArt || '../assets/icon.png';
            art.alt = '';
            art.loading = 'lazy';
            art.onerror = () => { art.style.visibility = 'hidden'; };

            const meta = document.createElement('div');
            meta.className = 'online-result-meta';
            meta.innerHTML = `
                <div class="online-result-title">${escapeHtml(item.title || '未知标题')}</div>
                <div class="online-result-sub">${escapeHtml(item.artist || '未知艺术家')}${item.album ? ' · ' + escapeHtml(item.album) : ''}</div>
            `;

            const badge = document.createElement('span');
            badge.className = 'online-result-badge';
            badge.textContent = item.provider === 'spotify' ? 'Spotify' : 'iTunes';

            li.appendChild(art);
            li.appendChild(meta);
            li.appendChild(badge);
            li.addEventListener('click', () => app.playOnlineSearchResult(item));
            app.playlistEl.appendChild(li);
        });
    };

    app.performOnlineSearch = async (query) => {
        if (!app.api?.searchOnlineMusic) {
            app.playlistEl.innerHTML = '<li class="no-lyrics">当前环境不支持联网搜索</li>';
            return;
        }
        const q = String(query || '').trim();
        if (!q || app.isOnlineSearching) return;

        app.isOnlineSearching = true;
        app.onlineSearchBtn?.classList.add('loading');
        app.playlistEl.innerHTML = '<li class="no-lyrics">正在联网搜索...</li>';

        try {
            const payload = await app.api.searchOnlineMusic({ query: q, limit: 25 });
            if (payload?.error) {
                app.playlistEl.innerHTML = `<li class="no-lyrics">搜索失败: ${escapeHtml(payload.error)}</li>`;
                return;
            }
            app.onlineSearchResults = payload?.results || [];
            app.onlineMetaSource = payload?.metaSource || '';
            app.renderOnlineSearchResults(app.onlineSearchResults);
        } catch (error) {
            console.error('[Music] Online search failed:', error);
            app.playlistEl.innerHTML = `<li class="no-lyrics">搜索失败: ${escapeHtml(error.message || '未知错误')}</li>`;
        } finally {
            app.isOnlineSearching = false;
            app.onlineSearchBtn?.classList.remove('loading');
        }
    };

    app.playOnlineSearchResult = async (meta) => {
        if (!meta || !app.api?.resolveOnlineMusicTrack) return;

        const loading = document.createElement('li');
        loading.className = 'no-lyrics';
        loading.textContent = `正在解析并缓存音源: ${meta.title}...`;
        app.playlistEl.prepend(loading);

        try {
            const result = await app.api.resolveOnlineMusicTrack(meta);
            if (!result || result.status !== 'success' || !result.track) {
                throw new Error(result?.message || '解析失败');
            }

            const track = result.track;
            const existingIndex = app.playlist.findIndex((t) =>
                (t.externalId && t.externalId === track.externalId)
                || (t.source === 'online' && t.title === track.title && t.artist === track.artist)
            );

            let index = existingIndex;
            if (index === -1) {
                app.playlist.push(track);
                index = app.playlist.length - 1;
                app.api.saveMusicPlaylist?.(app.playlist);
            } else {
                app.playlist[index] = { ...app.playlist[index], ...track };
            }

            app.isOnlineSearchActive = false;
            app.updateOnlineSearchUi();
            app.exitOnlineSearchView();
            await app.loadTrack(index, true);
        } catch (error) {
            console.error('[Music] Play online track failed:', error);
            loading.textContent = `无法播放: ${error.message || '音源不可用'}`;
            setTimeout(() => {
                if (loading.parentNode) loading.remove();
            }, 2500);
        }
    };

    if (app.onlineSearchBtn) {
        app.onlineSearchBtn.onclick = () => {
            app.isOnlineSearchActive = !app.isOnlineSearchActive;
            app.updateOnlineSearchUi();
            if (!app.isOnlineSearchActive) {
                app.exitOnlineSearchView();
                const query = app.searchInput.value.toLowerCase();
                app.currentFilteredTracks = query
                    ? app.playlist.filter((t) =>
                        (t.title || '').toLowerCase().includes(query)
                        || (t.artist || '').toLowerCase().includes(query))
                    : null;
                app.renderPlaylist(app.currentFilteredTracks);
            } else if (app.searchInput.value.trim()) {
                app.performOnlineSearch(app.searchInput.value.trim());
            } else {
                app.playlistEl.innerHTML = '<li class="no-lyrics">输入歌名/歌手后按 Enter 联网搜索</li>';
            }
        };
    }
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
