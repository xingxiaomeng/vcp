// modules/lyricFetcher.js
// 歌词检索：Spotify/iTunes 校准元数据（含繁体变体）→ lrclib 精准匹配 → 网易云回退

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const https = require('https');

const LRCLIB_SEARCH = 'https://lrclib.net/api/search';
const LRCLIB_GET = 'https://lrclib.net/api/get';
const NETEASE_LYRIC = 'https://music.163.com/api/song/lyric';
const NETEASE_SEARCH = 'https://music.163.com/api/search/get/';
const ITUNES_SEARCH = 'https://itunes.apple.com/search';

const NETEASE_HEADERS = {
    Referer: 'https://music.163.com',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

const LRCLIB_HEADERS = {
    'User-Agent': 'VCPChat-MusicPlayer/1.0 (lyric-fetcher)',
};

const ITUNES_HEADERS = {
    'User-Agent': 'VCPChat-MusicPlayer/1.0 (lyric-fetcher)',
};

const itunesAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 8,
    maxFreeSockets: 4,
    timeout: 6000,
});

const UNKNOWN_ARTIST_RE = /^(未知艺术家|unknown(\s*artist)?|各种艺人|various(\s*artists)?|va)$/i;
const JUNK_TITLE_RE = /\[(cq|mq|hq|sq|320k|flac|ape|wav|dsd|hi[- ]?res|试听|完整版|官方|mv|audio)\]|\((cq|mq|hq|sq|320k|flac|ape|wav|official|audio|lyrics?)\)|【[^】]*】/gi;

function sanitizeFileName(str) {
    return String(str || '').replace(/[\\/:"*?<>|]/g, '_').trim();
}

function isUnknownArtist(artist) {
    const a = String(artist || '').trim();
    return !a || UNKNOWN_ARTIST_RE.test(a);
}

function splitTitleArtist(rawTitle, rawArtist) {
    let title = String(rawTitle || '').trim();
    let artist = isUnknownArtist(rawArtist) ? '' : String(rawArtist || '').trim();

    title = title.replace(/\.(mp3|flac|wav|m4a|ogg|aac|wma|ape|dsf|dff|alac|aiff|opus|wv)$/i, '');
    title = title.replace(JUNK_TITLE_RE, ' ').replace(/\s+/g, ' ').trim();

    if (!artist) {
        const parts = title.split(/\s[-–—_]\s/);
        if (parts.length >= 2) {
            const maybeArtist = parts[0].trim();
            const maybeTitle = parts.slice(1).join(' - ').trim();
            if (maybeArtist && maybeTitle && maybeArtist.length <= 48) {
                artist = maybeArtist;
                title = maybeTitle;
            }
        }
    }

    const titleCore = title
        .replace(/\s*[\(\[（].*?[\)\]）]\s*/g, ' ')
        .replace(/\s+(feat\.?|ft\.?|with)\s+.+$/i, ' ')
        .replace(/\s+/g, ' ')
        .trim() || title;

    return { title, artist, titleCore };
}

function normalizeKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFKC')
        .replace(/[’'`]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function compactKey(text) {
    return normalizeKey(text).replace(/\s+/g, '');
}

/** 去掉艺人名尾部垃圾：周杰伦- / 周杰伦、 / SHE. */
function cleanArtistName(name) {
    return String(name || '')
        .replace(/[-–—_/、.．\s]+$/g, '')
        .replace(/^[-–—_/、.\s]+/g, '')
        .trim();
}

function diceCoefficient(a, b) {
    const s1 = compactKey(a);
    const s2 = compactKey(b);
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;
    if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1 : 0;
    const bigrams = new Map();
    for (let i = 0; i < s1.length - 1; i++) {
        const bg = s1.slice(i, i + 2);
        bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
    }
    let matches = 0;
    for (let i = 0; i < s2.length - 1; i++) {
        const bg = s2.slice(i, i + 2);
        const count = bigrams.get(bg) || 0;
        if (count > 0) {
            bigrams.set(bg, count - 1);
            matches += 1;
        }
    }
    return (2 * matches) / (s1.length - 1 + (s2.length - 1));
}

function titleCoreForMatch(title) {
    return String(title || '')
        .replace(/\s*[\(\[（][^\)\]）]*[\)\]）]/g, ' ')
        .replace(/\s+(feat\.?|ft\.?|with)\s+.+$/i, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function titleSimilarity(queryTitle, candidateTitle) {
    const qCompact = compactKey(queryTitle);
    const cCompact = compactKey(candidateTitle);
    if (!qCompact || !cCompact) return 0;
    if (qCompact === cCompact) return 1;

    // 去掉 feat./括号后比较：圣诞星 ≈ 圣诞星 (feat. 杨瑞代)
    const qCore = compactKey(titleCoreForMatch(queryTitle));
    const cCore = compactKey(titleCoreForMatch(candidateTitle));
    if (qCore && cCore && qCore === cCore) return 0.97;

    const qNorm = normalizeKey(queryTitle);
    const cNorm = normalizeKey(candidateTitle);
    if (qNorm === cNorm) return 0.98;

    const dice = diceCoefficient(queryTitle, candidateTitle);
    // 包含关系按长度比降权，避免 Super 匹配 Super Star Remix
    let contain = 0;
    if (cCompact.includes(qCompact) || qCompact.includes(cCompact)) {
        contain = Math.min(qCompact.length, cCompact.length) / Math.max(qCompact.length, cCompact.length);
    }
    if (qCore && cCore && (cCore.includes(qCore) || qCore.includes(cCore))) {
        contain = Math.max(
            contain,
            Math.min(qCore.length, cCore.length) / Math.max(qCore.length, cCore.length)
        );
    }
    return Math.max(dice, contain * 0.9);
}

function expandArtistNames(name) {
    const raw = cleanArtistName(name);
    const out = new Set();
    if (!raw) return [];
    out.add(raw);
    const withoutParen = raw.replace(/[（(][^）)]*[）)]/g, ' ').replace(/\s+/g, ' ').trim();
    if (withoutParen) out.add(withoutParen);
    for (const m of raw.matchAll(/[（(]([^）)]+)[）)]/g)) {
        if (m[1].trim()) out.add(m[1].trim());
    }
    for (const part of raw.split(/[\/&,、]/)) {
        const p = cleanArtistName(part);
        if (p) out.add(p);
    }
    return Array.from(out);
}

function artistSimilarity(queryArtist, candidateArtist) {
    if (!queryArtist) return 0.5; // 无艺人时中性
    let best = 0;
    for (const qRaw of expandArtistNames(queryArtist)) {
        for (const cRaw of expandArtistNames(candidateArtist)) {
            const qClean = cleanArtistName(qRaw);
            const cClean = cleanArtistName(cRaw);
            const q = compactKey(qClean);
            const c = compactKey(cClean);
            if (!q || !c) continue;

            // 短英文艺人（SHE / S.H.E / BTS）只允许精确字母匹配，避免 she ⊂ shesh
            const qLetters = q.replace(/[^a-z0-9\u4e00-\u9fff]/gi, '');
            const cLetters = c.replace(/[^a-z0-9\u4e00-\u9fff]/gi, '');
            if (qLetters.length > 0 && qLetters.length <= 4 && /^[a-z0-9]+$/i.test(qLetters)) {
                best = Math.max(best, cLetters === qLetters ? 1 : 0);
                continue;
            }

            if (q === c || normalizeKey(qClean) === normalizeKey(cClean)) {
                best = Math.max(best, 1);
                continue;
            }

            const dice = diceCoefficient(qClean, cClean);
            const ratio = Math.min(q.length, c.length) / Math.max(q.length, c.length);
            // 周杰伦 vs 周杰伦alnk → ratio 低，强惩罚
            let score = dice;
            if (c.includes(q) || q.includes(c)) {
                if (ratio >= 0.85) score = Math.max(dice, 0.9);
                else if (ratio >= 0.65) score = Math.max(dice * 0.7, 0.35);
                else score = Math.min(dice, 0.15);
            } else {
                score = dice >= 0.88 ? dice : dice * 0.5;
            }
            best = Math.max(best, score);
        }
    }
    return best;
}

function bestArtistSimilarity(queryArtist, artistNames) {
    if (!queryArtist) return 0.5;
    let best = 0;
    for (const name of artistNames || []) {
        best = Math.max(best, artistSimilarity(queryArtist, name));
    }
    return best;
}

function durationScore(querySec, candidateSec) {
    if (!(querySec > 0) || !(candidateSec > 0)) return 0;
    const diff = Math.abs(querySec - candidateSec);
    if (diff <= 2) return 1;
    if (diff <= 5) return 0.85;
    if (diff <= 10) return 0.55;
    if (diff <= 20) return 0.25;
    return 0;
}

function hasBadVersion(name, queryTitle) {
    const n = String(name || '');
    const q = String(queryTitle || '');
    if (!/live/i.test(q) && /\blive\b/i.test(n)) return true;
    if (!/(cover|翻自|翻唱)/i.test(q) && /(cover|翻自|翻唱)/i.test(n)) return true;
    if (/伴奏|instrumental|karaoke/i.test(n)) return true;
    return false;
}

function scoreMatch({ queryTitle, queryArtist, queryDurationSec }, candidate) {
    const titleSim = titleSimilarity(queryTitle, candidate.title);
    const artistSim = bestArtistSimilarity(queryArtist, candidate.artists);
    const durSim = durationScore(queryDurationSec, candidate.durationSec);

    let score = titleSim * 100 + artistSim * 80 + durSim * 35;

    if (queryArtist && artistSim < 0.45) {
        // 有艺人却对不上：大幅降权，防止乱配
        score *= 0.25;
    }
    if (titleSim < 0.55) {
        score *= 0.35;
    }
    if (hasBadVersion(candidate.title, queryTitle)) {
        score -= 25;
    }
    if (candidate.qualityBonus) score += candidate.qualityBonus;

    return { score, titleSim, artistSim, durSim };
}

function itunesToCandidate(item) {
    return {
        source: 'itunes',
        id: item.trackId,
        title: item.trackName || '',
        artists: [item.artistName].filter(Boolean),
        album: item.collectionName || '',
        durationSec: (Number(item.trackTimeMillis) || 0) / 1000,
        qualityBonus: 12,
        raw: item,
    };
}

function spotifyToCandidate(item) {
    return {
        source: 'spotify',
        id: item.id,
        title: item.name || '',
        artists: (item.artists || []).map((a) => a.name).filter(Boolean),
        album: item.album?.name || '',
        durationSec: (Number(item.duration_ms) || 0) / 1000,
        qualityBonus: 14,
        raw: item,
    };
}

let spotifyTokenCache = { accessToken: '', expiresAt: 0 };

async function loadLyricMusicConfig(options = {}) {
    if (options.spotifyClientId && options.spotifyClientSecret) {
        return {
            spotifyClientId: options.spotifyClientId,
            spotifyClientSecret: options.spotifyClientSecret,
        };
    }
    try {
        const onlineMusicClient = require('./onlineMusicClient');
        return await onlineMusicClient.loadConfig();
    } catch (_) {
        return {};
    }
}

async function getSpotifyAccessToken(config) {
    if (!config?.spotifyClientId || !config?.spotifyClientSecret) return null;
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
                'User-Agent': ITUNES_HEADERS['User-Agent'],
            },
            timeout: 10000,
            proxy: false,
        }
    );
    spotifyTokenCache = {
        accessToken: response.data.access_token,
        expiresAt: Date.now() + (Number(response.data.expires_in) || 3600) * 1000,
    };
    return spotifyTokenCache.accessToken;
}

async function searchSpotifyForLyricMatch(title, artist, config) {
    const token = await getSpotifyAccessToken(config);
    if (!token) return [];

    const queries = [];
    const push = (q) => {
        const s = String(q || '').replace(/\s+/g, ' ').trim();
        if (s && !queries.includes(s)) queries.push(s);
    };
    if (artist) {
        push(`track:${title} artist:${artist}`);
        push(`${title} ${artist}`);
    }
    push(title);

    const map = new Map();
    for (const q of queries.slice(0, 2)) {
        try {
            const response = await axios.get('https://api.spotify.com/v1/search', {
                params: { q, type: 'track', limit: 20 },
                headers: {
                    Authorization: `Bearer ${token}`,
                    'User-Agent': ITUNES_HEADERS['User-Agent'],
                },
                timeout: 10000,
                proxy: false,
            });
            for (const item of response.data?.tracks?.items || []) {
                if (item?.id && !map.has(item.id)) map.set(item.id, item);
            }
        } catch (error) {
            console.warn('[LyricFetcher] Spotify search failed:', error.message);
        }
    }
    return Array.from(map.values());
}

async function searchItunesForLyricMatch(title, artist) {
    const term = String(artist ? `${title} ${artist}` : title).replace(/\s+/g, ' ').trim();
    if (!term) return [];

    const countries = ['cn', 'tw', 'hk', 'us', 'jp'];
    const pages = await Promise.all(countries.map(async (country) => {
        try {
            const response = await axios.get(ITUNES_SEARCH, {
                params: {
                    term,
                    entity: 'song',
                    limit: 25,
                    country,
                    lang: 'zh_cn',
                },
                timeout: 6000,
                headers: ITUNES_HEADERS,
                httpsAgent: itunesAgent,
                proxy: false,
            });
            return Array.isArray(response.data?.results) ? response.data.results : [];
        } catch (error) {
            console.warn(`[LyricFetcher] iTunes search (${country}) failed:`, error.message);
            return [];
        }
    }));

    const map = new Map();
    for (const results of pages) {
        for (const item of results) {
            if (!item?.trackId || !item.trackName || !item.artistName) continue;
            if (!map.has(item.trackId)) map.set(item.trackId, item);
        }
    }
    return Array.from(map.values());
}

function pickResolvedMetadata(query, scored, albumHint = '') {
    const best = scored[0];
    if (!best) return null;

    const minScore = query.queryArtist ? 100 : 115;
    if (best.score < minScore) return null;
    if (best.titleSim < 0.78) return null;
    if (query.queryArtist && best.artistSim < 0.72) return null;
    if (query.queryDurationSec > 0 && best.durSim > 0 && best.durSim < 0.55) return null;

    const resolvedTitle = String(best.candidate.title || '').trim();
    const resolvedArtist = cleanArtistName(best.candidate.artists[0] || query.queryArtist || '');
    if (!resolvedTitle) return null;

    return {
        queryTitle: resolvedTitle,
        queryArtist: resolvedArtist || query.queryArtist,
        queryDurationSec: best.candidate.durationSec || query.queryDurationSec,
        album: best.candidate.album || albumHint || '',
        score: best.score,
        titleSim: best.titleSim,
        artistSim: best.artistSim,
        durSim: best.durSim,
        source: best.candidate.source,
    };
}

function scoreCatalogCandidates(query, candidates, albumHint = '') {
    return candidates
        .map((c) => {
            const row = { candidate: c, ...scoreMatch(query, c) };
            if (albumHint && c.album) {
                const albumSim = titleSimilarity(albumHint, c.album);
                if (albumSim >= 0.85) row.score += 10;
                else if (albumSim >= 0.65) row.score += 4;
            }
            return row;
        })
        .sort((a, b) => b.score - a.score);
}

/** 简繁同曲：时长接近且去 feat 后字数相同 */
function isLikelyScriptVariant(anchor, candidate) {
    if (!(anchor?.queryDurationSec > 0) || !(candidate?.durationSec > 0)) return false;
    if (Math.abs(anchor.queryDurationSec - candidate.durationSec) > 3) return false;
    const aCore = titleCoreForMatch(anchor.queryTitle);
    const cCore = titleCoreForMatch(candidate.title);
    if (!aCore || !cCore) return false;
    if (aCore.length !== cCore.length) return false;
    if (compactKey(aCore) === compactKey(cCore)) return false; // 已是同一写法
    return true;
}

function pushLyricVariant(list, seen, variant) {
    if (!variant?.queryTitle) return;
    const key = `${variant.queryTitle}|${variant.queryArtist || ''}|${Math.round(variant.queryDurationSec || 0)}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push(variant);
}

/**
 * Spotify + iTunes 校准，并补充繁体等同曲变体（解决「圣诞星」vs「聖誕星」）。
 */
async function resolveLyricMetadataVariants(query, albumHint = '', options = {}) {
    const variants = [];
    const seen = new Set();
    const config = await loadLyricMusicConfig(options);

    // —— Spotify（常为繁体/官方曲名，利于 lrclib）——
    if (config.spotifyClientId && config.spotifyClientSecret) {
        try {
            const spotifyItems = await searchSpotifyForLyricMatch(query.queryTitle, query.queryArtist, config);
            const spotifyScored = scoreCatalogCandidates(query, spotifyItems.map(spotifyToCandidate), albumHint);
            const spotifyBest = pickResolvedMetadata(query, spotifyScored, albumHint);
            if (spotifyBest) {
                console.log(
                    `[LyricFetcher] Spotify match score=${spotifyBest.score.toFixed(1)} `
                    + `title=${spotifyBest.titleSim.toFixed(2)} artist=${spotifyBest.artistSim.toFixed(2)} `
                    + `"${spotifyBest.queryArtist || '-'} - ${spotifyBest.queryTitle}"`
                );
                pushLyricVariant(variants, seen, spotifyBest);
                // Spotify 多艺人名也加入变体（Jay Chou / 周杰倫）
                const raw = spotifyScored[0]?.candidate;
                if (raw?.artists?.length) {
                    for (const name of raw.artists) {
                        pushLyricVariant(variants, seen, {
                            ...spotifyBest,
                            queryArtist: cleanArtistName(name) || spotifyBest.queryArtist,
                        });
                    }
                    pushLyricVariant(variants, seen, {
                        ...spotifyBest,
                        queryArtist: raw.artists.map((n) => cleanArtistName(n)).filter(Boolean).join(', '),
                    });
                }
            }
        } catch (error) {
            console.warn('[LyricFetcher] Spotify resolve failed:', error.message);
        }
    }

    // —— iTunes ——
    let itunesScored = [];
    try {
        const itunesItems = await searchItunesForLyricMatch(query.queryTitle, query.queryArtist);
        itunesScored = scoreCatalogCandidates(query, itunesItems.map(itunesToCandidate), albumHint);
        const itunesBest = pickResolvedMetadata(query, itunesScored, albumHint);
        if (itunesBest) {
            console.log(
                `[LyricFetcher] iTunes match score=${itunesBest.score.toFixed(1)} `
                + `title=${itunesBest.titleSim.toFixed(2)} artist=${itunesBest.artistSim.toFixed(2)} `
                + `"${itunesBest.queryArtist || '-'} - ${itunesBest.queryTitle}"`
            );
            pushLyricVariant(variants, seen, itunesBest);

            // 补充繁体等同曲（TW/HK 条目）
            const anchor = itunesBest;
            for (const row of itunesScored.slice(0, 12)) {
                if (!isLikelyScriptVariant(anchor, row.candidate)) continue;
                pushLyricVariant(variants, seen, {
                    queryTitle: row.candidate.title,
                    queryArtist: cleanArtistName(row.candidate.artists[0] || anchor.queryArtist),
                    queryDurationSec: row.candidate.durationSec || anchor.queryDurationSec,
                    album: row.candidate.album || anchor.album || '',
                    score: row.score,
                    titleSim: row.titleSim,
                    artistSim: row.artistSim,
                    durSim: row.durSim,
                    source: 'itunes-variant',
                });
            }
        }
    } catch (error) {
        console.warn('[LyricFetcher] iTunes resolve failed:', error.message);
    }

    return variants;
}

async function fetchLrcLibExact({ artist, title, album, durationSec }) {
    if (!artist || !title) return null;
    try {
        const response = await axios.get(LRCLIB_GET, {
            params: {
                artist_name: artist,
                track_name: title,
                album_name: album || undefined,
                duration: durationSec > 0 ? Math.round(durationSec) : undefined,
            },
            headers: LRCLIB_HEADERS,
            timeout: 12000,
        });
        return response.data?.syncedLyrics || response.data?.plainLyrics || null;
    } catch (_) {
        return null;
    }
}

async function searchLrcLib(title, artist, extraQueries = []) {
    const results = [];
    const trySearch = async (params) => {
        try {
            const response = await axios.get(LRCLIB_SEARCH, {
                params,
                headers: LRCLIB_HEADERS,
                timeout: 12000,
            });
            if (Array.isArray(response.data)) results.push(...response.data);
        } catch (error) {
            console.warn('[LyricFetcher] lrclib search failed:', error.message);
        }
    };

    const jobs = [];
    if (artist && title) {
        jobs.push(trySearch({ track_name: title, artist_name: artist }));
    }
    jobs.push(trySearch({ q: artist ? `${title} ${artist}` : title }));

    for (const extra of extraQueries.slice(0, 6)) {
        const t = String(extra?.title || '').trim();
        const a = String(extra?.artist || '').trim();
        if (!t) continue;
        if (a) jobs.push(trySearch({ track_name: t, artist_name: a }));
        jobs.push(trySearch({ q: a ? `${t} ${a}` : t }));
    }

    await Promise.all(jobs);

    // 去重
    const map = new Map();
    for (const item of results) {
        const key = item.id || `${item.artistName}|${item.trackName}|${item.duration}`;
        if (!map.has(key)) map.set(key, item);
    }
    return Array.from(map.values());
}

function lrcLibToCandidate(item) {
    return {
        source: 'lrclib',
        id: item.id,
        title: item.trackName || item.name || '',
        artists: [item.artistName].filter(Boolean),
        durationSec: Number(item.duration) || 0,
        syncedLyrics: item.syncedLyrics || null,
        plainLyrics: item.plainLyrics || null,
        qualityBonus: item.syncedLyrics ? 8 : 0,
        raw: item,
    };
}

async function fetchLrcLibSynced(item) {
    if (item.syncedLyrics) return item.syncedLyrics;
    if (!item.artistName || !item.trackName) return item.plainLyrics || null;
    try {
        const response = await axios.get(LRCLIB_GET, {
            params: {
                artist_name: item.artistName,
                track_name: item.trackName,
                album_name: item.albumName || undefined,
                duration: item.duration ? Math.round(item.duration) : undefined,
            },
            headers: LRCLIB_HEADERS,
            timeout: 12000,
        });
        return response.data?.syncedLyrics || response.data?.plainLyrics || null;
    } catch (_) {
        return item.plainLyrics || null;
    }
}

async function searchNetEase(title, artist) {
    const queries = [];
    const push = (q) => {
        const s = String(q || '').replace(/\s+/g, ' ').trim();
        if (s && !queries.includes(s)) queries.push(s);
    };
    if (artist) {
        push(`${title} ${artist}`);
        push(`${artist} ${title}`);
    }
    push(title);

    const songs = [];
    for (const q of queries.slice(0, 3)) {
        try {
            const response = await axios.get(NETEASE_SEARCH, {
                params: { s: q, type: 1, limit: 20 },
                headers: NETEASE_HEADERS,
                timeout: 10000,
            });
            if (Array.isArray(response.data?.result?.songs)) {
                songs.push(...response.data.result.songs);
            }
        } catch (error) {
            console.warn('[LyricFetcher] NetEase search failed:', error.message);
        }
    }

    const map = new Map();
    for (const song of songs) {
        if (song?.id != null && !map.has(song.id)) map.set(song.id, song);
    }
    return Array.from(map.values());
}

function netEaseToCandidate(song) {
    const artists = (song.artists || []).map((a) => a.name).filter(Boolean);
    const artistIds = (song.artists || []).map((a) => a.id || 0);
    const hasOfficialArtist = artistIds.some((id) => id > 0);
    return {
        source: 'netease',
        id: song.id,
        title: song.name || '',
        artists,
        durationSec: (song.duration || 0) / 1000,
        qualityBonus: (hasOfficialArtist ? 12 : -20) + (song.copyrightId > 0 ? 8 : -8),
        raw: song,
    };
}

async function getNetEaseLyric(songId) {
    try {
        const response = await axios.get(`${NETEASE_LYRIC}?id=${songId}&lv=1&kv=1&tv=-1`, {
            headers: NETEASE_HEADERS,
            timeout: 10000,
        });
        return parseNetEaseLyric(response.data);
    } catch (error) {
        console.warn('[LyricFetcher] NetEase lyric failed:', error.message);
        return null;
    }
}

function parseNetEaseLyric(lyricData) {
    if (!lyricData?.lrc?.lyric) return null;
    const lrc = lyricData.lrc.lyric;
    const meaningful = lrc.split('\n').some((line) => {
        const text = line.replace(/\[[^\]]+\]/g, '').trim();
        return text && !/^作[词曲]|^编曲|^制作|^混音|^出品/i.test(text);
    });
    if (!meaningful) return null;

    const tlyric = lyricData.tlyric?.lyric;
    if (!tlyric) return lrc;

    const tlyricMap = new Map();
    for (const line of tlyric.split('\n')) {
        const match = line.match(/\[(\d{2}:\d{2}[.:]\d{2,3})\](.*)/);
        if (match && match[2].trim()) tlyricMap.set(match[1], match[2].trim());
    }

    const merged = [];
    for (const line of lrc.split('\n')) {
        const match = line.match(/\[(\d{2}:\d{2}[.:]\d{2,3})\](.*)/);
        if (match) {
            merged.push(line);
            const tr = tlyricMap.get(match[1]);
            if (tr) merged.push(`[${match[1]}]${tr}`);
        } else {
            merged.push(line);
        }
    }
    return merged.join('\n');
}

function toDurationSec(options = {}) {
    if (options.durationMs > 0) return Number(options.durationMs) / 1000;
    if (options.duration > 0) {
        const d = Number(options.duration);
        // 兼容误传毫秒
        return d > 10000 ? d / 1000 : d;
    }
    return 0;
}

async function saveLyricFile(lyricDir, artist, title, content) {
    await fs.mkdir(lyricDir, { recursive: true });
    const sanitizedTitle = sanitizeFileName(title);
    const lrcFileName = artist
        ? `${sanitizeFileName(artist)} - ${sanitizedTitle}.lrc`
        : `${sanitizedTitle}.lrc`;
    const lrcFilePath = path.join(lyricDir, lrcFileName);
    await fs.writeFile(lrcFilePath, content, 'utf-8');
    console.log(`[LyricFetcher] Lyric saved to ${lrcFilePath}`);
    return lrcFilePath;
}

async function fetchAndSaveLyrics(artist, title, lyricDir, options = {}) {
    const parsed = splitTitleArtist(title, artist);
    const queryTitle = parsed.titleCore || parsed.title;
    const queryArtist = parsed.artist;
    const queryDurationSec = toDurationSec(options);
    const albumHint = String(options.album || '').trim();

    if (!queryTitle) return null;

    let query = { queryTitle, queryArtist, queryDurationSec };
    console.log(
        `[LyricFetcher] Lookup "${queryTitle}" / "${queryArtist || '-'}"`
        + (queryDurationSec ? ` dur=${queryDurationSec.toFixed(1)}s` : '')
    );

    // —— 0) Spotify / iTunes 元数据校准（含繁体等同曲变体）——
    let metaVariants = [];
    try {
        metaVariants = await resolveLyricMetadataVariants(query, albumHint, options);
        if (metaVariants.length) {
            // 用校准曲名再问一次 lrclib，补全 Jay Chou (周杰倫) 等官方艺人名
            const hintJobs = metaVariants.slice(0, 3).map(async (v) => {
                try {
                    const response = await axios.get(LRCLIB_SEARCH, {
                        params: { q: v.queryTitle },
                        headers: LRCLIB_HEADERS,
                        timeout: 10000,
                    });
                    return Array.isArray(response.data) ? response.data : [];
                } catch (_) {
                    return [];
                }
            });
            const hintPages = await Promise.all(hintJobs);
            const seenHint = new Set(metaVariants.map((v) => `${v.queryTitle}|${v.queryArtist}`));
            for (let i = 0; i < hintPages.length; i++) {
                const anchor = metaVariants[i];
                for (const item of hintPages[i].slice(0, 4)) {
                    if (!item?.trackName || !item?.artistName) continue;
                    if (anchor.queryDurationSec > 0 && item.duration > 0
                        && Math.abs(Number(item.duration) - anchor.queryDurationSec) > 4) {
                        continue;
                    }
                    const key = `${item.trackName}|${item.artistName}`;
                    if (seenHint.has(key)) continue;
                    seenHint.add(key);
                    metaVariants.push({
                        queryTitle: item.trackName,
                        queryArtist: item.artistName,
                        queryDurationSec: Number(item.duration) || anchor.queryDurationSec,
                        album: item.albumName || anchor.album || '',
                        source: 'lrclib-hint',
                    });
                }
            }

            const primary = metaVariants[0];
            query = {
                queryTitle: primary.queryTitle,
                queryArtist: primary.queryArtist,
                queryDurationSec: primary.queryDurationSec || queryDurationSec,
            };

            const exactResults = await Promise.all(metaVariants.slice(0, 8).map(async (v) => {
                const content = await fetchLrcLibExact({
                    artist: v.queryArtist,
                    title: v.queryTitle,
                    album: v.album || albumHint,
                    durationSec: v.queryDurationSec,
                });
                return { v, content };
            }));
            for (const row of exactResults) {
                if (row.content && /\[\d{2}:\d{2}/.test(row.content)) {
                    try {
                        await saveLyricFile(lyricDir, queryArtist || row.v.queryArtist || '', parsed.title, row.content);
                    } catch (error) {
                        console.warn('[LyricFetcher] save failed:', error.message);
                    }
                    return row.content;
                }
            }
        }
    } catch (error) {
        console.warn('[LyricFetcher] metadata resolve failed:', error.message);
    }

    // —— 1) lrclib 主路径（带校准变体搜索）——
    const extraQueries = metaVariants.map((v) => ({ title: v.queryTitle, artist: v.queryArtist }));
    const lrcLibItems = await searchLrcLib(query.queryTitle, query.queryArtist, extraQueries);
    const originalQuery = { queryTitle, queryArtist, queryDurationSec: query.queryDurationSec };
    const lrcLibCandidates = lrcLibItems
        .map(lrcLibToCandidate)
        .map((c) => {
            let best = { candidate: c, ...scoreMatch(query, c) };
            const scoredOriginal = scoreMatch(originalQuery, c);
            if (scoredOriginal.score > best.score) best = { candidate: c, ...scoredOriginal };
            for (const v of metaVariants.slice(0, 4)) {
                const scored = scoreMatch({
                    queryTitle: titleCoreForMatch(v.queryTitle) || v.queryTitle,
                    queryArtist: v.queryArtist,
                    queryDurationSec: v.queryDurationSec || query.queryDurationSec,
                }, c);
                if (scored.score > best.score) best = { candidate: c, ...scored };
            }
            return best;
        })
        .sort((a, b) => b.score - a.score);

    const lrcLibMin = (query.queryArtist || queryArtist) ? 95 : 110;
    for (const row of lrcLibCandidates.slice(0, 8)) {
        if (row.score < lrcLibMin && row.titleSim < 0.9) continue;
        if (row.titleSim < 0.72) {
            const durOk = query.queryDurationSec > 0 && row.durSim >= 0.85;
            const coreLenOk = titleCoreForMatch(queryTitle).length
                === titleCoreForMatch(row.candidate.title).length;
            if (!(durOk && coreLenOk)) continue;
        }
        if ((query.queryArtist || queryArtist) && row.artistSim < 0.7) {
            if (!(query.queryDurationSec > 0 && row.durSim >= 0.85)) continue;
        }

        console.log(
            `[LyricFetcher] lrclib try score=${row.score.toFixed(1)} `
            + `title=${row.titleSim.toFixed(2)} artist=${row.artistSim.toFixed(2)} `
            + `"${row.candidate.artists.join('/')} - ${row.candidate.title}"`
        );

        const content = await fetchLrcLibSynced(row.candidate.raw);
        if (content && /\[\d{2}:\d{2}/.test(content)) {
            try {
                await saveLyricFile(lyricDir, queryArtist || row.candidate.artists[0] || '', parsed.title, content);
            } catch (error) {
                console.warn('[LyricFetcher] save failed:', error.message);
            }
            return content;
        }
    }

    // —— 2) 网易云回退 ——
    const neteaseSongs = await searchNetEase(query.queryTitle, query.queryArtist);
    const neteaseCandidates = neteaseSongs
        .map(netEaseToCandidate)
        .map((c) => ({ candidate: c, ...scoreMatch(query, c) }))
        .sort((a, b) => b.score - a.score);

    const neteaseMin = query.queryArtist ? 100 : 120;
    for (const row of neteaseCandidates.slice(0, 5)) {
        if (row.score < neteaseMin) continue;
        if (row.titleSim < 0.78) continue;
        if (query.queryArtist && row.artistSim < 0.85) continue;

        console.log(
            `[LyricFetcher] netease try score=${row.score.toFixed(1)} id=${row.candidate.id} `
            + `"${row.candidate.artists.join('/')} - ${row.candidate.title}"`
        );

        const content = await getNetEaseLyric(row.candidate.id);
        if (content) {
            try {
                await saveLyricFile(lyricDir, query.queryArtist || row.candidate.artists[0] || '', parsed.title, content);
            } catch (error) {
                console.warn('[LyricFetcher] save failed:', error.message);
            }
            return content;
        }
    }

    if (lrcLibCandidates[0]) {
        console.log(
            `[LyricFetcher] No confident match. Best lrclib: score=${lrcLibCandidates[0].score.toFixed(1)} `
            + `"${lrcLibCandidates[0].candidate.artists.join('/')} - ${lrcLibCandidates[0].candidate.title}"`
        );
    } else {
        console.log(`[LyricFetcher] No lyric candidates for "${query.queryTitle}"`);
    }
    return null;
}

module.exports = {
    fetchAndSaveLyrics,
    splitTitleArtist,
    titleSimilarity,
    artistSimilarity,
    scoreMatch,
    normalizeKey,
    compactKey,
};
