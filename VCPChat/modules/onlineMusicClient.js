// modules/onlineMusicClient.js
// Spotube 模式：目录元数据搜索（iTunes / 可选 Spotify）+ 可播音源换源（网易云优先，YouTube/Piped 次选）

const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const http = require('http');
const https = require('https');
const net = require('net');
const crypto = require('crypto');
const { URL } = require('url');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const NETEASE_HEADERS = {
    Referer: 'https://music.163.com',
    'User-Agent': UA,
    'Content-Type': 'application/json',
};

// B 站 WBI 签名（搜索等接口强制要求，否则 -412）
const MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52,
];
let biliWbiCache = { imgKey: '', subKey: '', cookies: '', expiresAt: 0 };

const PIPED_INSTANCES = [
    'https://api.piped.private.coffee',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.meuz.xyz',
    'https://api.piped.projectsegfau.lt',
];

let configPath = null;
let spotifyTokenCache = { accessToken: '', expiresAt: 0 };
let streamProxyServer = null;
let streamProxyPort = 0;
const streamProxyCache = new Map(); // videoOrSongKey -> { url, expiresAt, source }
let cachedProxy = { url: '', checkedAt: 0, axiosProxy: null };
let proxyResolvePromise = null;

const COMMON_PROXY_PORTS = [7890, 7897, 10809, 10808, 20171, 8888, 1080];

function init(appDataRoot) {
    configPath = path.join(appDataRoot, 'online-music.json');
}

function parseProxyUrl(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;
    try {
        const withScheme = /^[a-z]+:\/\//i.test(text) ? text : `http://${text}`;
        const u = new URL(withScheme);
        if (!u.hostname || !u.port) return null;
        return {
            protocol: (u.protocol || 'http:').replace(':', ''),
            host: u.hostname,
            port: Number(u.port),
            auth: u.username
                ? { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password || '') }
                : undefined,
            href: `${u.protocol}//${u.host}`,
        };
    } catch (_) {
        return null;
    }
}

function proxyToAxios(parsed) {
    if (!parsed) return undefined;
    const proxy = {
        protocol: parsed.protocol || 'http',
        host: parsed.host,
        port: parsed.port,
    };
    if (parsed.auth) proxy.auth = parsed.auth;
    return proxy;
}

async function portOpen(host, port, timeoutMs = 250) {
    return new Promise((resolve) => {
        const socket = net.connect({ host, port });
        const done = (ok) => {
            try { socket.destroy(); } catch (_) {}
            resolve(ok);
        };
        const timer = setTimeout(() => done(false), timeoutMs);
        socket.once('connect', () => {
            clearTimeout(timer);
            done(true);
        });
        socket.once('error', () => {
            clearTimeout(timer);
            done(false);
        });
    });
}

async function detectProxyUrl(config) {
    if (config.proxyEnabled === false) return '';

    const configured = String(config.proxyUrl || '').trim();
    if (configured) return configured;

    const envRaw = process.env.HTTPS_PROXY
        || process.env.HTTP_PROXY
        || process.env.ALL_PROXY
        || process.env.https_proxy
        || process.env.http_proxy
        || process.env.all_proxy
        || '';
    if (envRaw) return envRaw;

    // 自动探测本机常见代理端口（Clash / V2 等）
    for (const port of COMMON_PROXY_PORTS) {
        // eslint-disable-next-line no-await-in-loop
        if (await portOpen('127.0.0.1', port)) {
            return `http://127.0.0.1:${port}`;
        }
    }
    return '';
}

async function getAxiosProxy() {
    const now = Date.now();
    if (cachedProxy.checkedAt && now - cachedProxy.checkedAt < 60000) {
        return cachedProxy.axiosProxy;
    }
    if (proxyResolvePromise) return proxyResolvePromise;

    proxyResolvePromise = (async () => {
        const config = await loadConfig();
        const url = await detectProxyUrl(config);
        const parsed = parseProxyUrl(url);
        cachedProxy = {
            url: parsed?.href || '',
            checkedAt: Date.now(),
            axiosProxy: proxyToAxios(parsed),
        };
        if (cachedProxy.url) {
            console.log(`[OnlineMusic] Using proxy ${cachedProxy.url}`);
            if (configPath && !config.proxyUrl) {
                try {
                    await saveConfig({ proxyUrl: cachedProxy.url, proxyEnabled: true });
                } catch (_) {}
            }
        }
        return cachedProxy.axiosProxy;
    })();

    try {
        return await proxyResolvePromise;
    } finally {
        proxyResolvePromise = null;
    }
}

async function axiosGet(url, options = {}) {
    const { forceDirect, ...rest } = options;
    const proxy = forceDirect ? null : await getAxiosProxy();
    return axios.get(url, {
        ...rest,
        proxy: proxy || false,
    });
}

async function loadConfig() {
    const defaults = {
        spotifyClientId: '',
        spotifyClientSecret: '',
        preferredAudioSource: 'auto', // auto | netease | youtube | bilibili
        // 本机代理，例如 http://127.0.0.1:7890；留空则自动探测常见端口 / 环境变量
        proxyUrl: '',
        proxyEnabled: true,
        // 在线下载默认目录（可在保存对话框中每次改）
        downloadDir: '',
    };
    if (!configPath) return defaults;
    try {
        if (await fs.pathExists(configPath)) {
            return { ...defaults, ...(await fs.readJson(configPath)) };
        }
    } catch (_) {}
    return defaults;
}

async function saveConfig(partial) {
    const current = await loadConfig();
    const next = { ...current, ...partial };
    if (configPath) {
        await fs.ensureDir(path.dirname(configPath));
        await fs.writeJson(configPath, next, { spaces: 2 });
    }
    return next;
}

function compact(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFKC')
        .replace(/[^\p{L}\p{N}]+/gu, '');
}

function titleScore(a, b) {
    const x = compact(a);
    const y = compact(b);
    if (!x || !y) return 0;
    if (x === y) return 1;
    if (x.includes(y) || y.includes(x)) {
        const ratio = Math.min(x.length, y.length) / Math.max(x.length, y.length);
        // 短歌名出现在长 YouTube 标题中：晴天 ⊂ 周杰伦...晴天...Official
        if (Math.min(x.length, y.length) >= 2) {
            return Math.max(ratio, 0.82);
        }
        return ratio;
    }
    return 0;
}

function artistScore(a, b) {
    const x = compact(String(a || '').replace(/[（(][^）)]*[）)]/g, ''));
    const y = compact(String(b || '').replace(/[（(][^）)]*[）)]/g, ''));
    if (!x || !y) return 0.4;
    if (x === y) return 1;
    if (x.includes(y) || y.includes(x)) {
        return Math.max(0.75, Math.min(x.length, y.length) / Math.max(x.length, y.length));
    }
    return 0;
}

function isJunkArtist(name) {
    const n = String(name || '');
    const flat = compact(n);
    return /[-–—_/、.．]\s*$/.test(n)
        || /alnk|asasblue|阿图|伤感|抖音|remix|cover|街道办/.test(flat)
        || /dj\b/i.test(n)
        || (n.length > 20 && !/^[\u4e00-\u9fffA-Za-z0-9\s.]+$/.test(n));
}

function isJunkTitle(name) {
    return /(正式版|伤感版|抖音|cover|翻唱|live\s*版|伴奏)/i.test(String(name || ''));
}

async function searchItunes(query, limit = 500) {
    const capped = Math.min(Math.max(Number(limit) || 500, 1), 500);
    const countries = ['cn', 'us', 'jp', 'tw', 'hk', 'kr', 'gb', 'sg', 'my', 'ca', 'au', 'de', 'fr'];
    const seen = new Set();
    const merged = [];

    for (const country of countries) {
        if (merged.length >= capped) break;
        try {
            // eslint-disable-next-line no-await-in-loop
            const response = await axios.get('https://itunes.apple.com/search', {
                params: {
                    term: query,
                    entity: 'song',
                    limit: 200, // iTunes 单次上限 200，靠多区合并凑满
                    country,
                    lang: 'zh_cn',
                },
                timeout: 12000,
                headers: { 'User-Agent': UA },
            });
            const results = Array.isArray(response.data?.results) ? response.data.results : [];
            for (const item of results) {
                if (!item.trackName || !item.artistName || !item.trackId) continue;
                const id = `itunes:${item.trackId}`;
                if (seen.has(id)) continue;
                seen.add(id);
                merged.push({
                    id,
                    provider: 'itunes',
                    title: item.trackName,
                    artist: item.artistName,
                    album: item.collectionName || '',
                    albumArt: String(item.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
                    durationMs: item.trackTimeMillis || 0,
                    previewUrl: item.previewUrl || '',
                    externalUrl: item.trackViewUrl || '',
                });
                if (merged.length >= capped) break;
            }
        } catch (error) {
            console.warn(`[OnlineMusic] iTunes search (${country}) failed:`, error.message);
        }
    }
    return merged;
}

async function getSpotifyToken(config) {
    if (!config.spotifyClientId || !config.spotifyClientSecret) return null;
    if (spotifyTokenCache.accessToken && Date.now() < spotifyTokenCache.expiresAt - 30000) {
        return spotifyTokenCache.accessToken;
    }
    const basic = Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString('base64');
    const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
            headers: {
                Authorization: `Basic ${basic}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': UA,
            },
            timeout: 12000,
        }
    );
    spotifyTokenCache = {
        accessToken: response.data.access_token,
        expiresAt: Date.now() + (Number(response.data.expires_in) || 3600) * 1000,
    };
    return spotifyTokenCache.accessToken;
}

async function searchSpotify(query, limit = 50, config) {
    const token = await getSpotifyToken(config);
    if (!token) return [];
    const capped = Math.min(Math.max(Number(limit) || 50, 1), 500);
    const seen = new Set();
    const merged = [];

    for (let offset = 0; offset < capped; offset += 50) {
        const pageSize = Math.min(50, capped - offset);
        // eslint-disable-next-line no-await-in-loop
        const response = await axios.get('https://api.spotify.com/v1/search', {
            params: { q: query, type: 'track', limit: pageSize, offset },
            headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA },
            timeout: 12000,
        });
        const items = response.data?.tracks?.items || [];
        if (!items.length) break;
        for (const item of items) {
            const id = `spotify:${item.id}`;
            if (seen.has(id)) continue;
            seen.add(id);
            merged.push({
                id,
                provider: 'spotify',
                title: item.name,
                artist: (item.artists || []).map((a) => a.name).join(' / '),
                album: item.album?.name || '',
                albumArt: item.album?.images?.[0]?.url || item.album?.images?.[1]?.url || '',
                durationMs: item.duration_ms || 0,
                previewUrl: item.preview_url || '',
                externalUrl: item.external_urls?.spotify || '',
            });
        }
        const total = Number(response.data?.tracks?.total) || 0;
        if (offset + items.length >= total) break;
    }
    return merged;
}

async function searchOnline(query, options = {}) {
    const q = String(query || '').trim();
    if (!q) return { results: [], metaSource: '', total: 0 };

    // 尽量拉全：默认 500（iTunes 单区上限 200，多区合并去重）
    const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 500);
    const config = await loadConfig();

    let results = [];
    let metaSource = 'itunes';

    try {
        const spotify = await searchSpotify(q, limit, config);
        if (spotify.length) {
            results = spotify;
            metaSource = 'spotify';
        }
    } catch (error) {
        console.warn('[OnlineMusic] Spotify search failed:', error.message);
    }

    if (!results.length) {
        results = await searchItunes(q, limit);
        metaSource = 'itunes';
    }

    return { results, metaSource, total: results.length };
}

async function searchNetEaseSongs(query, limit = 30) {
    const songs = [];
    const seen = new Set();

    const pushBatch = (batch) => {
        for (const song of batch || []) {
            if (song?.id != null && !seen.has(song.id)) {
                seen.add(song.id);
                songs.push(song);
            }
        }
    };

    try {
        const response = await axios.get('https://music.163.com/api/search/get/', {
            params: { s: query, type: 1, limit },
            headers: NETEASE_HEADERS,
            timeout: 12000,
        });
        pushBatch(response.data?.result?.songs);
    } catch (error) {
        console.warn('[OnlineMusic] NetEase search failed:', error.message);
    }

    try {
        const response = await axios.post(
            'https://music.163.com/api/cloudsearch/pc',
            new URLSearchParams({ s: query, type: '1', limit: String(limit), offset: '0', total: 'true' }).toString(),
            {
                headers: {
                    ...NETEASE_HEADERS,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 12000,
            }
        );
        pushBatch(response.data?.result?.songs);
    } catch (error) {
        console.warn('[OnlineMusic] NetEase cloudsearch failed:', error.message);
    }

    return songs;
}

async function getNetEasePlayUrl(songId) {
    const response = await axios.get('https://music.163.com/api/song/enhance/player/url', {
        params: { id: songId, ids: `[${songId}]`, br: 320000 },
        headers: NETEASE_HEADERS,
        timeout: 12000,
        validateStatus: () => true,
    });
    const row = response.data?.data?.[0];
    // code 200 且有 url 才可用；-110/VIP 等直接放弃，避免 outer 链落到反爬 HTML
    if (row?.url && (row.code === 200 || row.code == null)) {
        return {
            url: String(row.url).replace(/^http:\/\//i, 'https://'),
            bitrate: row.br || 0,
            size: row.size || 0,
            source: 'netease',
            songId: String(songId),
            mimeType: 'audio/mpeg',
        };
    }

    // outer url fallback：仅接受明确的媒体 CDN 跳转
    try {
        const outer = await axios.get(`https://music.163.com/song/media/outer/url?id=${songId}.mp3`, {
            headers: NETEASE_HEADERS,
            timeout: 12000,
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400,
            proxy: false,
        });
        const location = outer.headers?.location;
        if (location && /^https?:\/\//i.test(location)
            && !/music\.163\.com\/(404|error|login)/i.test(location)
            && /(\.mp3(\?|$)|m\d+\.music\.126\.net|jdymusic)/i.test(location)) {
            return {
                url: String(location).replace(/^http:\/\//i, 'https://'),
                bitrate: 0,
                size: 0,
                source: 'netease',
                songId: String(songId),
                mimeType: 'audio/mpeg',
            };
        }
    } catch (_) {}
    return null;
}

function pickBestNetEaseSong(songs, title, artist, durationMs) {
    const qArtist = compact(artist);
    const scored = songs.map((song) => {
        const songTitle = song.name || '';
        const artists = (song.artists || []).map((a) => a.name);
        const songArtist = artists.join(' / ');
        const primaryArtist = artists[0] || '';
        const t = titleScore(title, songTitle);
        const a = Math.max(
            artistScore(artist, songArtist),
            ...artists.map((name) => artistScore(artist, name))
        );
        const cleanNames = artists.map((name) => String(name || '').replace(/[-–—_/、.．\s]+$/g, '').trim());
        const exactArtist = Boolean(
            qArtist
            && cleanNames.some((name, idx) => compact(name) === qArtist && !isJunkArtist(artists[idx]))
        );
        const dur = (song.duration || 0);
        let score = t * 100 + a * 70;
        if (exactArtist) score += 35;
        if (durationMs > 0 && dur > 0) {
            const diff = Math.abs(durationMs - dur) / 1000;
            if (diff <= 3) score += 25;
            else if (diff <= 8) score += 12;
            else if (diff <= 20) score += 4;
            else score -= 10;
        }
        if (artists.some(isJunkArtist) || isJunkArtist(songArtist)) score -= 60;
        if (isJunkTitle(songTitle) && !isJunkTitle(title)) score -= 25;
        if (artists.length > 2 && !exactArtist) score -= 15;
        // 多人合作且查询是单人时降权（周杰伦- + A-LNK）
        if (qArtist && artists.length >= 2 && !exactArtist) score -= 25;
        const hasOfficial = (song.artists || []).some((x) => (x.id || 0) > 0);
        if (hasOfficial) score += 8;
        if (qArtist && compact(String(primaryArtist).replace(/[-–—_/、.．\s]+$/g, '')) === qArtist && !isJunkArtist(primaryArtist)) {
            score += 20;
        }
        return { song, score, t, a, exactArtist };
    }).sort((x, y) => y.score - x.score);

    const best = scored[0];
    if (!best || best.t < 0.78 || best.score < 110) return null;
    if (artist) {
        if (!best.exactArtist && best.a < 0.92) return null;
        if (best.score < 160 && !best.exactArtist) return null;
    }
    return best.song;
}

async function resolveViaNetEase(track) {
    const title = track.title || '';
    const artist = track.artist || '';
    const queries = [];
    if (artist) queries.push(`${artist} ${title}`, `${title} ${artist}`);
    queries.push(title);

    const seen = new Set();
    const songs = [];
    for (const q of queries.slice(0, 3)) {
        const batch = await searchNetEaseSongs(q, 30);
        for (const song of batch) {
            if (song?.id != null && !seen.has(song.id)) {
                seen.add(song.id);
                songs.push(song);
            }
        }
    }

    const best = pickBestNetEaseSong(songs, title, artist, track.durationMs || 0);
    if (!best) return null;
    return getNetEasePlayUrl(best.id);
}

async function pipedGet(pathname, params) {
    let lastError = null;
    const instances = await getAxiosProxy() ? PIPED_INSTANCES : PIPED_INSTANCES.slice(0, 2);
    for (const base of instances) {
        try {
            const response = await axiosGet(`${base}${pathname}`, {
                params,
                timeout: 12000,
                headers: { 'User-Agent': UA },
            });
            return { base, data: response.data };
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('All Piped instances failed');
}

function getMixinKey(orig) {
    return MIXIN_KEY_ENC_TAB.map((i) => orig[i]).join('').slice(0, 32);
}

function encWbi(params, imgKey, subKey) {
    const mixinKey = getMixinKey(imgKey + subKey);
    const wts = Math.round(Date.now() / 1000);
    const next = { ...params, wts };
    const sorted = Object.keys(next).sort().reduce((acc, k) => {
        acc[k] = String(next[k]).replace(/[!'()*]/g, '');
        return acc;
    }, {});
    const query = Object.entries(sorted)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    const w_rid = crypto.createHash('md5').update(query + mixinKey).digest('hex');
    return { ...sorted, w_rid };
}

function makeBuvid3() {
    const hex = [...crypto.randomBytes(16)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}infoc`.toUpperCase();
}

async function getBiliWbiSession() {
    const now = Date.now();
    if (biliWbiCache.imgKey && biliWbiCache.expiresAt > now) {
        return biliWbiCache;
    }
    const nav = await axios.get('https://api.bilibili.com/x/web-interface/nav', {
        timeout: 10000,
        headers: {
            'User-Agent': UA,
            Referer: 'https://www.bilibili.com/',
        },
        proxy: false,
        validateStatus: () => true,
    });
    let cookies = (nav.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');
    if (!/buvid3=/i.test(cookies)) {
        cookies = `buvid3=${makeBuvid3()}${cookies ? `; ${cookies}` : ''}`;
    }
    const imgUrl = nav.data?.data?.wbi_img?.img_url || '';
    const subUrl = nav.data?.data?.wbi_img?.sub_url || '';
    const imgKey = imgUrl.split('/').pop().split('.')[0] || '';
    const subKey = subUrl.split('/').pop().split('.')[0] || '';
    if (!imgKey || !subKey) {
        throw new Error('无法获取 B 站 WBI 密钥');
    }
    biliWbiCache = {
        imgKey,
        subKey,
        cookies,
        expiresAt: now + 6 * 60 * 60 * 1000,
    };
    return biliWbiCache;
}

async function probeMediaUrl(url, { fetchDirect = false, referer = '' } = {}) {
    try {
        const response = await axiosGet(url, {
            responseType: 'stream',
            timeout: 8000,
            headers: {
                'User-Agent': UA,
                Range: 'bytes=0-2047',
                Referer: referer || 'https://www.bilibili.com/',
                Accept: '*/*',
            },
            validateStatus: () => true,
            forceDirect: fetchDirect,
        });
        const ok = response.status >= 200 && response.status < 300;
        if (response.data?.destroy) response.data.destroy();
        return ok;
    } catch (_) {
        return false;
    }
}

async function resolveViaBilibili(track) {
    const title = track.title || '';
    const artist = track.artist || '';
    const queries = [];
    if (artist) queries.push(`${artist} ${title}`, `${title} ${artist} 官方`);
    queries.push(`${title} 歌词`, title);

    let session;
    try {
        session = await getBiliWbiSession();
    } catch (error) {
        console.warn('[OnlineMusic] bilibili wbi init failed:', error.message);
        return null;
    }

    const withCookie = {
        'User-Agent': UA,
        Referer: 'https://www.bilibili.com',
        Origin: 'https://www.bilibili.com',
        Cookie: session.cookies,
    };

    const seen = new Set();
    const candidates = [];

    for (const q of queries.slice(0, 3)) {
        try {
            const params = encWbi({
                search_type: 'video',
                keyword: q,
                page: 1,
            }, session.imgKey, session.subKey);
            const response = await axios.get('https://api.bilibili.com/x/web-interface/wbi/search/type', {
                params,
                timeout: 12000,
                headers: {
                    ...withCookie,
                    Referer: `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}`,
                },
                proxy: false,
                validateStatus: () => true,
            });
            if (response.data?.code && response.data.code !== 0) {
                console.warn('[OnlineMusic] bilibili search code:', response.data.code, response.data.message);
                // 密钥可能过期，清缓存后重试一次
                if (response.data.code === -412 || response.data.code === -403) {
                    biliWbiCache.expiresAt = 0;
                }
                continue;
            }
            const list = response.data?.data?.result || [];
            for (const item of list) {
                const bvid = item.bvid;
                if (!bvid || seen.has(bvid)) continue;
                seen.add(bvid);
                const videoTitle = String(item.title || '').replace(/<[^>]+>/g, '');
                const t = titleScore(title, videoTitle);
                const a = artistScore(artist, videoTitle);
                // 排除明显无关（教程/封面/游戏等）
                if (/(教程|教学|游戏|cover\s*dance|翻跳|合集|演唱会全程|全场)/i.test(videoTitle)
                    && !/(歌词|官方|mv)/i.test(videoTitle)) {
                    continue;
                }
                // 搜索结果时长（可能是 "05:12" 或秒）
                let durationSec = 0;
                if (typeof item.duration === 'number') durationSec = item.duration;
                else if (typeof item.duration === 'string' && item.duration.includes(':')) {
                    const parts = item.duration.split(':').map((x) => Number(x) || 0);
                    durationSec = parts.reduce((acc, n) => acc * 60 + n, 0);
                }
                let score = t * 100 + a * 50 + (/官方|mv|高音质|flac|歌词/i.test(videoTitle) ? 12 : 0);
                const expectSec = (track.durationMs || 0) / 1000;
                if (expectSec > 30 && durationSec > 0) {
                    const diff = Math.abs(expectSec - durationSec);
                    if (diff <= 8) score += 40;
                    else if (diff <= 20) score += 20;
                    else if (diff <= 45) score += 5;
                    else if (durationSec > expectSec * 2.2 || durationSec < expectSec * 0.45) score -= 80;
                    else score -= 25;
                }
                candidates.push({
                    bvid,
                    aid: item.aid,
                    videoTitle,
                    durationSec,
                    score,
                    t,
                    a,
                });
            }
        } catch (error) {
            console.warn('[OnlineMusic] bilibili search failed:', error.message);
        }
    }

    candidates.sort((x, y) => y.score - x.score);
    const expectSec = (track.durationMs || 0) / 1000;
    for (const hit of candidates.slice(0, 8)) {
        if (hit.t < 0.4) continue;
        try {
            const view = await axios.get('https://api.bilibili.com/x/web-interface/view', {
                params: { bvid: hit.bvid },
                timeout: 10000,
                headers: withCookie,
                proxy: false,
            });
            const viewData = view.data?.data || {};
            const cid = viewData.cid;
            if (!cid) continue;

            const realDur = Number(viewData.duration) || hit.durationSec || 0;
            if (expectSec > 30 && realDur > 0) {
                const diff = Math.abs(expectSec - realDur);
                // 拒绝合集/电影等超长视频，避免下到几十 MB 却不是单曲
                if (realDur > expectSec * 2.5 || realDur < expectSec * 0.4 || diff > 120) {
                    console.warn(`[OnlineMusic] bilibili skip ${hit.bvid}: duration ${realDur}s vs expect ${expectSec.toFixed(0)}s`);
                    continue;
                }
            }

            let mediaUrl = null;
            let bitrate = 0;
            for (const fnval of [16, 4048]) {
                const play = await axios.get('https://api.bilibili.com/x/player/playurl', {
                    params: { bvid: hit.bvid, cid, qn: 64, fnval, fourk: 1 },
                    timeout: 10000,
                    headers: {
                        ...withCookie,
                        Referer: `https://www.bilibili.com/video/${hit.bvid}`,
                    },
                    proxy: false,
                    validateStatus: () => true,
                });
                const data = play.data?.data || {};
                const audio = (data.dash?.audio || [])
                    .slice()
                    .sort((a, b) => (Number(b.bandwidth) || 0) - (Number(a.bandwidth) || 0))[0];
                mediaUrl = audio?.baseUrl || audio?.base_url || data.durl?.[0]?.url || null;
                bitrate = Number(audio?.bandwidth || 0);
                if (mediaUrl) break;
            }
            if (!mediaUrl) continue;

            const referer = `https://www.bilibili.com/video/${hit.bvid}`;
            const ok = await probeMediaUrl(mediaUrl, {
                fetchDirect: true,
                referer,
            });
            if (!ok) continue;

            return {
                url: mediaUrl,
                bitrate,
                size: 0,
                source: 'bilibili',
                videoId: hit.bvid,
                referer,
                mimeType: 'audio/mp4',
                fetchDirect: true,
            };
        } catch (error) {
            console.warn('[OnlineMusic] bilibili resolve failed:', error.message);
        }
    }
    return null;
}

async function resolveViaYouTube(track) {
    const q = [track.artist, track.title].filter(Boolean).join(' ');
    const search = await pipedGet('/search', { q, filter: 'all' });
    const rawItems = Array.isArray(search.data?.items) ? search.data.items : [];
    const items = rawItems.filter((item) => item && (item.type === 'stream' || item.url));

    const ranked = items.map((item) => {
        const videoTitle = item.title || '';
        const videoId = String(item.url || item.id || '')
            .replace(/^\/watch\?v=/, '')
            .replace(/^.*v=/, '')
            .replace(/&.*$/, '')
            .replace(/^\//, '');
        const t = titleScore(track.title, videoTitle);
        const a = artistScore(track.artist, videoTitle);
        return { videoId, videoTitle, score: t * 100 + a * 40, t };
    }).filter((x) => x.videoId && x.videoId.length >= 6 && x.t >= 0.4)
        .sort((x, y) => y.score - x.score);

    // YouTube 媒体链不稳定：只试前 2 个，快速失败
    for (const best of ranked.slice(0, 2)) {
        let streams;
        try {
            streams = await pipedGet(`/streams/${best.videoId}`);
        } catch (_) {
            continue;
        }
        const audioStreams = Array.isArray(streams.data?.audioStreams) ? streams.data.audioStreams : [];
        const videoStreams = Array.isArray(streams.data?.videoStreams) ? streams.data.videoStreams : [];

        const candidates = [
            ...audioStreams
                .filter((s) => s?.url)
                .sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0)),
            ...videoStreams
                .filter((s) => s?.url && !s.videoOnly && String(s.mimeType || '').includes('mp4')),
        ];

        for (const media of candidates.slice(0, 2)) {
            const fetchDirect = /piped/i.test(String(media.url));
            const okDirect = await probeMediaUrl(media.url, { fetchDirect: true });
            const okProxy = okDirect ? true : await probeMediaUrl(media.url, { fetchDirect: false });
            if (!okDirect && !okProxy) continue;

            return {
                url: media.url,
                bitrate: Number(media.bitrate) || 0,
                size: Number(media.contentLength) || 0,
                source: 'youtube',
                videoId: best.videoId,
                mimeType: media.mimeType || '',
                fetchDirect: okDirect ? fetchDirect : false,
            };
        }
    }
    return null;
}

async function cacheResolvedMedia(resolved) {
    if (!configPath || !resolved?.url) return null;
    const { isValidAudioFile } = require('./mp3Encoder');
    const cacheDir = path.join(path.dirname(configPath), 'online-cache');
    await fs.ensureDir(cacheDir);

    const id = resolved.videoId
        || resolved.songId
        || crypto.createHash('md5').update(resolved.url).digest('hex').slice(0, 16);
    const ext = (resolved.source === 'bilibili' || /mp4|m4a|aac/i.test(resolved.mimeType || ''))
        ? 'm4a'
        : (resolved.source === 'youtube' ? 'm4a' : 'mp3');
    const filePath = path.join(cacheDir, `${resolved.source}-${id}.${ext}`);

    try {
        if (await fs.pathExists(filePath)) {
            const st = await fs.stat(filePath);
            if (st.size > 64 * 1024 && await isValidAudioFile(filePath)) {
                return filePath;
            }
            // 失效缓存（如 HTML 伪文件）删掉重下
            await fs.remove(filePath);
        }
    } catch (_) {}

    const tmpPath = `${filePath}.part`;
    try { await fs.remove(tmpPath); } catch (_) {}

    const forceDirect = resolved.fetchDirect === true
        || resolved.source === 'bilibili'
        || resolved.source === 'netease';
    const response = await axiosGet(resolved.url, {
        responseType: 'stream',
        timeout: 180000,
        forceDirect,
        headers: {
            'User-Agent': UA,
            Referer: resolved.referer
                || (resolved.source === 'bilibili'
                    ? 'https://www.bilibili.com/'
                    : (resolved.source === 'youtube' ? 'https://www.youtube.com/' : 'https://music.163.com/')),
            Accept: '*/*',
        },
        validateStatus: () => true,
    });

    if (!(response.status >= 200 && response.status < 300)) {
        if (response.data?.destroy) response.data.destroy();
        throw new Error(`下载音源失败 HTTP ${response.status}`);
    }

    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
        if (response.data?.destroy) response.data.destroy();
        throw new Error(`音源返回了非音频内容 (${contentType || 'unknown'})`);
    }

    await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(tmpPath);
        response.data.pipe(ws);
        ws.on('finish', resolve);
        ws.on('error', reject);
        response.data.on('error', reject);
    });

    const st = await fs.stat(tmpPath);
    if (st.size < 16 * 1024) {
        try { await fs.remove(tmpPath); } catch (_) {}
        throw new Error('下载音源过小，可能失败');
    }
    if (!(await isValidAudioFile(tmpPath))) {
        try { await fs.remove(tmpPath); } catch (_) {}
        throw new Error('下载内容不是有效音频（可能被版权拦截）');
    }
    await fs.move(tmpPath, filePath, { overwrite: true });
    console.log(`[OnlineMusic] Cached ${resolved.source} -> ${filePath} (${st.size} bytes)`);
    return filePath;
}

async function ensureStreamProxy() {
    if (streamProxyServer && streamProxyPort) return streamProxyPort;

    streamProxyServer = http.createServer(async (req, res) => {
        try {
            const reqUrl = new URL(req.url, 'http://127.0.0.1');
            if (!reqUrl.pathname.startsWith('/online-stream')) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            const key = reqUrl.searchParams.get('key');
            const entry = key ? streamProxyCache.get(key) : null;
            if (!entry?.url) {
                res.writeHead(404);
                res.end('Stream expired');
                return;
            }

            const target = entry.url;
            const headers = {
                'User-Agent': UA,
                Accept: '*/*',
                Referer: entry.referer
                    || (entry.source === 'bilibili'
                        ? 'https://www.bilibili.com'
                        : (entry.source === 'youtube' ? 'https://www.youtube.com/' : 'https://music.163.com/')),
            };
            if (req.headers.range) headers.Range = req.headers.range;

            const tryFetch = async (forceDirect) => axiosGet(target, {
                responseType: 'stream',
                headers,
                timeout: 60000,
                validateStatus: () => true,
                forceDirect,
            });

            // B 站/网易直连；Piped 反代先直连；googlevideo 先代理
            const preferDirect = entry.fetchDirect === true
                || entry.source === 'bilibili'
                || entry.source === 'netease'
                || /piped/i.test(target);
            let upstream = await tryFetch(preferDirect);
            if (!(upstream.status >= 200 && upstream.status < 300)) {
                upstream = await tryFetch(!preferDirect);
            }
            if (!(upstream.status >= 200 && upstream.status < 300)) {
                res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(`Upstream ${upstream.status}`);
                if (upstream.data?.destroy) upstream.data.destroy();
                return;
            }

            const upstreamType = String(upstream.headers['content-type'] || '').toLowerCase();
            const preferredType = entry.mimeType
                || (entry.source === 'bilibili' ? 'audio/mp4' : '')
                || 'audio/mpeg';
            const outHeaders = {
                'Content-Type': (!upstreamType || upstreamType.includes('octet-stream'))
                    ? preferredType
                    : upstream.headers['content-type'],
                'Accept-Ranges': upstream.headers['accept-ranges'] || 'bytes',
                'Access-Control-Allow-Origin': '*',
            };
            if (upstream.headers['content-length']) outHeaders['Content-Length'] = upstream.headers['content-length'];
            if (upstream.headers['content-range']) outHeaders['Content-Range'] = upstream.headers['content-range'];

            res.writeHead(upstream.status, outHeaders);
            upstream.data.pipe(res);
        } catch (error) {
            if (!res.headersSent) res.writeHead(502);
            res.end(`Proxy error: ${error.message}`);
        }
    });

    await new Promise((resolve, reject) => {
        streamProxyServer.once('error', reject);
        streamProxyServer.listen(0, '127.0.0.1', () => {
            streamProxyPort = streamProxyServer.address().port;
            resolve();
        });
    });
    console.log(`[OnlineMusic] Stream proxy on 127.0.0.1:${streamProxyPort}`);
    return streamProxyPort;
}

async function toPlayableTrack(meta, resolved) {
    let playPath = resolved.url;
    let cachedLocally = false;
    let isRemote = true;

    // B 站 fMP4/AAC 无法被 Rust 引擎解码；落地本地后走 HTML5 才能稳定播放。
    // 网易 MP3 同样缓存，避免直链过期。
    if (resolved.source === 'bilibili' || resolved.source === 'netease' || resolved.source === 'youtube') {
        try {
            const cached = await cacheResolvedMedia(resolved);
            if (cached) {
                playPath = cached;
                cachedLocally = true;
                isRemote = false;
            }
        } catch (error) {
            console.warn('[OnlineMusic] cache download failed:', error.message);
        }
    }

    // 缓存失败时，B 站 / YouTube 仍走本地反代（带 Referer）
    if (!cachedLocally && (resolved.source === 'bilibili' || resolved.source === 'youtube')) {
        const key = `${resolved.source}:${resolved.videoId || Date.now()}`;
        streamProxyCache.set(key, {
            url: resolved.url,
            source: resolved.source,
            referer: resolved.referer || '',
            fetchDirect: Boolean(resolved.fetchDirect),
            mimeType: resolved.mimeType || '',
            expiresAt: Date.now() + 15 * 60 * 1000,
        });
        const port = await ensureStreamProxy();
        const ext = /mp4|m4a|aac/i.test(resolved.mimeType || '') ? 'm4a' : 'mp3';
        playPath = `http://127.0.0.1:${port}/online-stream/audio.${ext}?key=${encodeURIComponent(key)}`;
    }

    return {
        path: playPath,
        title: meta.title,
        artist: meta.artist,
        album: meta.album || '',
        albumArt: meta.albumArt || '',
        duration: meta.durationMs ? meta.durationMs / 1000 : 0,
        durationMs: meta.durationMs || 0,
        bitrate: resolved.bitrate || undefined,
        isRemote,
        cachedLocally,
        source: 'online',
        metaProvider: meta.provider,
        audioSource: resolved.source,
        externalId: meta.id,
        neteaseSongId: resolved.songId || '',
        youtubeVideoId: resolved.source === 'youtube' ? (resolved.videoId || '') : '',
        bilibiliBvid: resolved.source === 'bilibili' ? (resolved.videoId || '') : '',
        referer: resolved.referer || '',
        directStreamUrl: resolved.url,
    };
}

async function resolveAndBuildTrack(meta, options = {}) {
    if (!meta?.title) throw new Error('缺少曲目信息');
    const config = await loadConfig();
    const preferred = options.preferredAudioSource || config.preferredAudioSource || 'auto';

    const attempts = [];
    if (preferred === 'youtube') attempts.push('youtube', 'bilibili', 'netease');
    else if (preferred === 'netease') attempts.push('netease', 'bilibili', 'youtube');
    else if (preferred === 'bilibili') attempts.push('bilibili', 'netease', 'youtube');
    else attempts.push('bilibili', 'netease', 'youtube'); // 默认：B站最稳

    let lastError = null;
    for (const source of attempts) {
        try {
            let resolved = null;
            if (source === 'bilibili') resolved = await resolveViaBilibili(meta);
            else if (source === 'youtube') resolved = await resolveViaYouTube(meta);
            else resolved = await resolveViaNetEase(meta);
            if (resolved?.url) {
                return toPlayableTrack(meta, resolved);
            }
        } catch (error) {
            lastError = error;
            console.warn(`[OnlineMusic] resolve via ${source} failed:`, error.message);
        }
    }

    // 最后尝试 iTunes/Spotify 30 秒试听
    if (meta.previewUrl) {
        return {
            path: meta.previewUrl,
            title: `${meta.title}（试听）`,
            artist: meta.artist,
            album: meta.album || '',
            albumArt: meta.albumArt || '',
            duration: 30,
            durationMs: 30000,
            isRemote: true,
            source: 'online',
            metaProvider: meta.provider,
            audioSource: 'preview',
            externalId: meta.id,
        };
    }

    throw lastError || new Error('未找到可播放音源（版权限制或网络不可用）');
}

/** 播放前刷新直链（网易/YT 链接会过期） */
async function refreshOnlineTrack(track) {
    if (!track || track.source !== 'online') return track;
    if (track.audioSource === 'preview') return track;

    // 本地缓存仍在则直接复用，避免每次重搜/重下
    if (track.cachedLocally && track.path && !/^https?:\/\//i.test(track.path)) {
        try {
            if (await fs.pathExists(track.path)) {
                const st = await fs.stat(track.path);
                if (st.size > 64 * 1024) return track;
            }
        } catch (_) {}
    }

    const meta = {
        id: track.externalId,
        provider: track.metaProvider,
        title: track.title?.replace(/（试听）$/, '') || track.title,
        artist: track.artist,
        album: track.album,
        albumArt: track.albumArt,
        durationMs: track.durationMs || (track.duration ? track.duration * 1000 : 0),
        previewUrl: track.previewUrl,
    };

    if (track.neteaseSongId && track.audioSource === 'netease') {
        try {
            const resolved = await getNetEasePlayUrl(track.neteaseSongId);
            if (resolved?.url) return toPlayableTrack(meta, resolved);
        } catch (_) {}
    }

    return resolveAndBuildTrack(meta, {
        preferredAudioSource: track.audioSource === 'bilibili'
            ? 'bilibili'
            : (track.audioSource === 'youtube' ? 'youtube' : (track.audioSource || 'auto')),
    });
}

/**
 * 解析音源并导出为 MP3 到指定路径。
 * @param {object} meta 搜索元数据
 * @param {string} targetPath 目标 .mp3 路径
 * @param {{ BrowserWindow?: any }} options
 */
async function downloadOnlineTrackAsMp3(meta, targetPath, options = {}) {
    if (!meta?.title) throw new Error('缺少曲目信息');
    if (!targetPath) throw new Error('未指定保存路径');

    const { convertToMp3, buildMp3Filename, isValidAudioFile } = require('./mp3Encoder');
    let outPath = String(targetPath);
    if (!/\.mp3$/i.test(outPath)) {
        outPath = path.join(outPath, buildMp3Filename(meta));
    }

    // 与播放一致：B 站优先（网易常因版权返回空链/HTML）
    let track = null;
    let lastError = null;
    try {
        track = await resolveAndBuildTrack(meta);
    } catch (error) {
        lastError = error;
        console.warn('[OnlineMusic] download resolve failed:', error.message);
    }

    // 若通用解析失败，再单独试网易（仅当能拿到真 MP3）
    if (!track?.path) {
        try {
            const ne = await resolveViaNetEase(meta);
            if (ne?.url) track = await toPlayableTrack(meta, ne);
        } catch (error) {
            lastError = error;
            console.warn('[OnlineMusic] download netease fallback failed:', error.message);
        }
    }
    if (!track?.path) {
        throw lastError || new Error('未能解析可下载音源');
    }

    let sourcePath = track.path;
    if (/^https?:\/\//i.test(sourcePath)) {
        if (track.directStreamUrl) {
            const resolved = {
                url: track.directStreamUrl,
                source: track.audioSource,
                videoId: track.bilibiliBvid || track.youtubeVideoId || '',
                songId: track.neteaseSongId || '',
                referer: track.referer || '',
                mimeType: track.audioSource === 'bilibili' ? 'audio/mp4' : 'audio/mpeg',
                fetchDirect: track.audioSource !== 'youtube',
            };
            sourcePath = await cacheResolvedMedia(resolved);
        } else {
            throw new Error('音源未缓存，无法下载');
        }
    }
    if (!(await fs.pathExists(sourcePath))) {
        throw new Error('本地音源文件不存在');
    }
    if (!(await isValidAudioFile(sourcePath))) {
        try { await fs.remove(sourcePath); } catch (_) {}
        // 坏缓存后强制走 B 站重解析
        track = await resolveAndBuildTrack(meta, { preferredAudioSource: 'bilibili' });
        sourcePath = track.path;
        if (/^https?:\/\//i.test(sourcePath) || !(await isValidAudioFile(sourcePath))) {
            throw new Error('音源文件无效（版权限制或缓存损坏）');
        }
    }

    await fs.ensureDir(path.dirname(outPath));
    const convertResult = await convertToMp3(sourcePath, outPath, {
        BrowserWindow: options.BrowserWindow,
    });

    try {
        await saveConfig({ downloadDir: path.dirname(outPath) });
    } catch (_) {}

    return {
        path: outPath,
        title: track.title || meta.title,
        artist: track.artist || meta.artist,
        audioSource: track.audioSource,
        convertMethod: convertResult?.method || '',
        size: (await fs.stat(outPath)).size,
    };
}

module.exports = {
    init,
    loadConfig,
    saveConfig,
    searchOnline,
    resolveAndBuildTrack,
    refreshOnlineTrack,
    downloadOnlineTrackAsMp3,
};
