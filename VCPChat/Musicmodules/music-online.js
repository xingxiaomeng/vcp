// Musicmodules/music-online.js
// Spotube 模式：联网搜歌（目录元数据）→ 换源解析 → 加入播放列表并播放 / 下载 MP3

function setupOnlineSearch(app) {
    app.isOnlineSearchActive = false;
    app.isOnlineSearching = false;
    app.isOnlineDownloading = false;
    app.isOnlineResolving = false;
    app.onlineSearchResults = [];
    app.onlineMetaSource = '';
    app.onlineDownloadDir = '';
    app.onlineResultPage = 0;
    app.onlineResultPageSize = 20;
    app.onlineResolvingKey = '';
    app.onlinePlayingKey = '';
    app.onlineLastQuery = '';

    app.getOnlineResultKey = (item) => {
        if (!item) return '';
        if (item.externalId) return String(item.externalId);
        return `${item.title || ''}|${item.artist || ''}|${item.album || ''}`;
    };

    app.loadOnlineDownloadDir = async () => {
        try {
            const cfg = await app.api?.getOnlineMusicConfig?.();
            app.onlineDownloadDir = cfg?.downloadDir || '';
        } catch (_) {
            app.onlineDownloadDir = '';
        }
    };

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
        app.onlineResultPage = 0;
        app.onlineResolvingKey = '';
        app.onlinePlayingKey = '';
        app.isOnlineResolving = false;
        app.currentFilteredTracks = null;
        app.renderPlaylist();
    };

    /** 侧栏切换等场景：切到本地列表，但保留联网搜索结果缓存 */
    app.leaveOnlineSearchMode = () => {
        if (!app.isOnlineSearchActive) return;
        app.isOnlineSearchActive = false;
        app.updateOnlineSearchUi();
        app.onlineResolvingKey = '';
        app.isOnlineResolving = false;
    };

    app.getOnlineResultPageCount = () => {
        const total = app.onlineSearchResults?.length || 0;
        const size = Math.max(1, Number(app.onlineResultPageSize) || 20);
        return Math.max(1, Math.ceil(total / size));
    };

    app.setOnlineResultPage = (page) => {
        const maxPage = app.getOnlineResultPageCount() - 1;
        app.onlineResultPage = Math.max(0, Math.min(Number(page) || 0, maxPage));
        app.renderOnlineSearchResults(app.onlineSearchResults);
        app.playlistEl?.scrollTo?.({ top: 0, behavior: 'smooth' });
    };

    app.renderOnlineSearchResults = (results) => {
        if (!app.playlistEl) return;
        app.playlistEl.innerHTML = '';

        const all = Array.isArray(results) ? results : [];
        if (!all.length) {
            const li = document.createElement('li');
            li.className = 'no-lyrics';
            li.textContent = '未找到在线结果';
            app.playlistEl.appendChild(li);
            return;
        }

        const pageSize = Math.max(1, Number(app.onlineResultPageSize) || 20);
        const total = all.length;
        const pageCount = Math.max(1, Math.ceil(total / pageSize));
        if (app.onlineResultPage >= pageCount) app.onlineResultPage = pageCount - 1;
        if (app.onlineResultPage < 0) app.onlineResultPage = 0;
        const page = app.onlineResultPage;
        const start = page * pageSize;
        const pageItems = all.slice(start, start + pageSize);

        const header = document.createElement('li');
        header.className = 'online-result-header';
        const dirHint = app.onlineDownloadDir
            ? `下载目录: ${app.onlineDownloadDir}`
            : '下载时可自选保存路径';
        header.innerHTML = `
            <span class="online-result-header-text">在线结果 · ${escapeHtml(app.onlineMetaSource || 'catalog')} · 共 ${total} 条（点击播放）</span>
            <button type="button" class="online-dir-btn" title="设置默认下载目录">${escapeHtml(dirHint)}</button>
        `;
        header.querySelector('.online-dir-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!app.api?.chooseOnlineMusicDownloadDir) return;
            const result = await app.api.chooseOnlineMusicDownloadDir();
            if (result?.status === 'success' && result.downloadDir) {
                app.onlineDownloadDir = result.downloadDir;
                app.renderOnlineSearchResults(app.onlineSearchResults);
            }
        });
        app.playlistEl.appendChild(header);

        if (pageCount > 1) {
            const pager = document.createElement('li');
            pager.className = 'online-result-pager';
            pager.innerHTML = `
                <button type="button" class="online-page-btn" data-act="first" title="首页">«</button>
                <button type="button" class="online-page-btn" data-act="prev" title="上一页">‹</button>
                <span class="online-page-info">第 ${page + 1} / ${pageCount} 页 · ${start + 1}-${Math.min(start + pageSize, total)}</span>
                <button type="button" class="online-page-btn" data-act="next" title="下一页">›</button>
                <button type="button" class="online-page-btn" data-act="last" title="末页">»</button>
            `;
            const go = (act) => {
                if (act === 'first') app.setOnlineResultPage(0);
                else if (act === 'prev') app.setOnlineResultPage(page - 1);
                else if (act === 'next') app.setOnlineResultPage(page + 1);
                else if (act === 'last') app.setOnlineResultPage(pageCount - 1);
            };
            pager.querySelectorAll('.online-page-btn').forEach((btn) => {
                const act = btn.getAttribute('data-act');
                if ((act === 'first' || act === 'prev') && page <= 0) btn.disabled = true;
                if ((act === 'next' || act === 'last') && page >= pageCount - 1) btn.disabled = true;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    go(act);
                });
            });
            app.playlistEl.appendChild(pager);
        }

        pageItems.forEach((item, localIndex) => {
            const index = start + localIndex;
            const li = document.createElement('li');
            const itemKey = app.getOnlineResultKey(item);
            const isResolving = app.onlineResolvingKey && app.onlineResolvingKey === itemKey;
            const isPlaying = app.onlinePlayingKey && app.onlinePlayingKey === itemKey;
            li.className = 'online-result-item';
            if (isResolving) li.classList.add('is-resolving');
            if (isPlaying) li.classList.add('is-playing', 'active');
            li.dataset.onlineIndex = String(index);
            li.dataset.onlineKey = itemKey;

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

            const actions = document.createElement('div');
            actions.className = 'online-result-actions';

            const badge = document.createElement('span');
            badge.className = 'online-result-badge';
            badge.textContent = isResolving
                ? '解析中'
                : (isPlaying ? '播放中' : (item.provider === 'spotify' ? 'Spotify' : 'iTunes'));

            const dlBtn = document.createElement('button');
            dlBtn.type = 'button';
            dlBtn.className = 'online-download-btn';
            dlBtn.title = '下载为 MP3';
            dlBtn.textContent = '下载';
            dlBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                app.downloadOnlineSearchResult(item, dlBtn);
            });

            actions.appendChild(badge);
            actions.appendChild(dlBtn);

            li.appendChild(art);
            li.appendChild(meta);
            li.appendChild(actions);
            li.addEventListener('click', () => app.playOnlineSearchResult(item));
            app.playlistEl.appendChild(li);
        });

        if (pageCount > 1) {
            const pagerBottom = document.createElement('li');
            pagerBottom.className = 'online-result-pager online-result-pager-bottom';
            pagerBottom.innerHTML = `
                <button type="button" class="online-page-btn" data-act="prev" ${page <= 0 ? 'disabled' : ''}>上一页</button>
                <span class="online-page-info">第 ${page + 1} / ${pageCount} 页</span>
                <button type="button" class="online-page-btn" data-act="next" ${page >= pageCount - 1 ? 'disabled' : ''}>下一页</button>
            `;
            pagerBottom.querySelectorAll('.online-page-btn').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const act = btn.getAttribute('data-act');
                    if (act === 'prev') app.setOnlineResultPage(page - 1);
                    if (act === 'next') app.setOnlineResultPage(page + 1);
                });
            });
            app.playlistEl.appendChild(pagerBottom);
        }
    };

    app.performOnlineSearch = async (query) => {
        if (!app.api?.searchOnlineMusic) {
            app.playlistEl.innerHTML = '<li class="no-lyrics">当前环境不支持联网搜索</li>';
            return;
        }
        const q = String(query || '').trim();
        if (!q || app.isOnlineSearching) return;

        app.isOnlineSearching = true;
        app.onlineResultPage = 0;
        app.onlineLastQuery = q;
        app.onlineResolvingKey = '';
        app.onlinePlayingKey = '';
        app.onlineSearchBtn?.classList.add('loading');
        app.playlistEl.innerHTML = '<li class="no-lyrics">正在联网搜索全部结果...</li>';

        try {
            await app.loadOnlineDownloadDir();
            const payload = await app.api.searchOnlineMusic({ query: q, limit: 500 });
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

    app.downloadOnlineSearchResult = async (meta, buttonEl) => {
        if (!meta || !app.api?.downloadOnlineMusicTrack || app.isOnlineDownloading) return;

        app.isOnlineDownloading = true;
        const prevText = buttonEl?.textContent;
        if (buttonEl) {
            buttonEl.disabled = true;
            buttonEl.textContent = '解析中';
        }

        try {
            const result = await app.api.downloadOnlineMusicTrack({ meta });
            if (result?.status === 'cancelled') return;
            if (!result || result.status !== 'success') {
                throw new Error(result?.message || '下载失败');
            }
            if (result.path) {
                app.onlineDownloadDir = result.path.replace(/[\\/][^\\/]+$/, '');
            }
            if (buttonEl) buttonEl.textContent = '完成';
            const tip = document.createElement('li');
            tip.className = 'no-lyrics online-download-tip';
            tip.textContent = `已保存: ${result.path}`;
            app.playlistEl?.prepend(tip);
            setTimeout(() => tip.remove(), 4000);
        } catch (error) {
            console.error('[Music] Download online track failed:', error);
            if (buttonEl) buttonEl.textContent = '失败';
            const tip = document.createElement('li');
            tip.className = 'no-lyrics online-download-tip';
            tip.textContent = `下载失败: ${error.message || '未知错误'}`;
            app.playlistEl?.prepend(tip);
            setTimeout(() => tip.remove(), 4000);
        } finally {
            app.isOnlineDownloading = false;
            if (buttonEl) {
                buttonEl.disabled = false;
                setTimeout(() => {
                    if (buttonEl.textContent === '完成' || buttonEl.textContent === '失败') {
                        buttonEl.textContent = prevText || '下载';
                    }
                }, 1600);
            }
        }
    };

    app.playOnlineSearchResult = async (meta) => {
        if (!meta || !app.api?.resolveOnlineMusicTrack || app.isOnlineResolving) return;

        const itemKey = app.getOnlineResultKey(meta);
        app.isOnlineResolving = true;
        app.onlineResolvingKey = itemKey;
        // 保留搜索结果列表，仅刷新当前项的「解析中」状态
        if (app.onlineSearchResults?.length) {
            app.renderOnlineSearchResults(app.onlineSearchResults);
        }

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

            // 播放时不退出联网搜索，避免结果被清空
            app.onlinePlayingKey = itemKey;
            app.onlineResolvingKey = '';
            await app.loadTrack(index, true);
        } catch (error) {
            console.error('[Music] Play online track failed:', error);
            const tip = document.createElement('li');
            tip.className = 'no-lyrics online-download-tip';
            tip.textContent = `无法播放: ${error.message || '音源不可用'}`;
            app.playlistEl?.prepend(tip);
            setTimeout(() => tip.remove(), 2500);
        } finally {
            app.isOnlineResolving = false;
            app.onlineResolvingKey = '';
            if (app.isOnlineSearchActive && app.onlineSearchResults?.length) {
                app.renderOnlineSearchResults(app.onlineSearchResults);
            }
        }
    };

    if (app.onlineSearchBtn) {
        app.onlineSearchBtn.onclick = () => {
            app.isOnlineSearchActive = !app.isOnlineSearchActive;
            app.updateOnlineSearchUi();
            if (!app.isOnlineSearchActive) {
                // 切回本地列表，但保留搜索结果缓存，方便再次打开
                app.onlineResolvingKey = '';
                app.isOnlineResolving = false;
                const query = app.searchInput.value.toLowerCase();
                app.currentFilteredTracks = query
                    ? app.playlist.filter((t) =>
                        (t.title || '').toLowerCase().includes(query)
                        || (t.artist || '').toLowerCase().includes(query))
                    : null;
                app.renderPlaylist(app.currentFilteredTracks);
            } else if (app.onlineSearchResults?.length) {
                app.renderOnlineSearchResults(app.onlineSearchResults);
            } else if (app.searchInput.value.trim()) {
                app.performOnlineSearch(app.searchInput.value.trim());
            } else {
                app.playlistEl.innerHTML = '<li class="no-lyrics">输入歌名/歌手后按 Enter 联网搜索</li>';
            }
        };
    }

    app.loadOnlineDownloadDir();
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
