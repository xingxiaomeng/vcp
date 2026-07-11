// modules/lyricFetcher.js
// 歌词检索：优先 lrclib（标题/歌手/时长精准匹配），失败再回退网易云

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const LRCLIB_SEARCH = 'https://lrclib.net/api/search';
const LRCLIB_GET = 'https://lrclib.net/api/get';
const NETEASE_LYRIC = 'https://music.163.com/api/song/lyric';
const NETEASE_SEARCH = 'https://music.163.com/api/search/get/';

const NETEASE_HEADERS = {
    Referer: 'https://music.163.com',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

const LRCLIB_HEADERS = {
    'User-Agent': 'VCPChat-MusicPlayer/1.0 (lyric-fetcher)',
};

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

function titleSimilarity(queryTitle, candidateTitle) {
    const qCompact = compactKey(queryTitle);
    const cCompact = compactKey(candidateTitle);
    if (!qCompact || !cCompact) return 0;
    if (qCompact === cCompact) return 1;

    const qNorm = normalizeKey(queryTitle);
    const cNorm = normalizeKey(candidateTitle);
    if (qNorm === cNorm) return 0.98;

    const dice = diceCoefficient(queryTitle, candidateTitle);
    // 包含关系按长度比降权，避免 Super 匹配 Super Star Remix
    let contain = 0;
    if (cCompact.includes(qCompact) || qCompact.includes(cCompact)) {
        contain = Math.min(qCompact.length, cCompact.length) / Math.max(qCompact.length, cCompact.length);
    }
    return Math.max(dice, contain * 0.9);
}

function artistSimilarity(queryArtist, candidateArtist) {
    if (!queryArtist) return 0.5; // 无艺人时中性
    const qClean = cleanArtistName(queryArtist);
    const cClean = cleanArtistName(candidateArtist);
    const q = compactKey(qClean);
    const c = compactKey(cClean);
    if (!q || !c) return 0;

    // 短英文艺人（SHE / S.H.E / BTS）只允许精确字母匹配，避免 she ⊂ shesh
    const qLetters = q.replace(/[^a-z0-9\u4e00-\u9fff]/gi, '');
    const cLetters = c.replace(/[^a-z0-9\u4e00-\u9fff]/gi, '');
    if (qLetters.length > 0 && qLetters.length <= 4 && /^[a-z0-9]+$/i.test(qLetters)) {
        return cLetters === qLetters ? 1 : 0;
    }

    if (q === c || normalizeKey(qClean) === normalizeKey(cClean)) return 1;

    const dice = diceCoefficient(qClean, cClean);
    const ratio = Math.min(q.length, c.length) / Math.max(q.length, c.length);
    // 周杰伦 vs 周杰伦alnk → ratio 低，强惩罚
    if (c.includes(q) || q.includes(c)) {
        if (ratio >= 0.85) return Math.max(dice, 0.9);
        if (ratio >= 0.65) return Math.max(dice * 0.7, 0.35);
        return Math.min(dice, 0.15);
    }
    return dice >= 0.88 ? dice : dice * 0.5;
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

async function searchLrcLib(title, artist) {
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

    if (artist && title) {
        await trySearch({ track_name: title, artist_name: artist });
    }
    await trySearch({ q: artist ? `${title} ${artist}` : title });

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

    if (!queryTitle) return null;

    const query = { queryTitle, queryArtist, queryDurationSec };
    console.log(
        `[LyricFetcher] Lookup "${queryTitle}" / "${queryArtist || '-'}"`
        + (queryDurationSec ? ` dur=${queryDurationSec.toFixed(1)}s` : '')
    );

    // —— 1) lrclib 主路径 ——
    const lrcLibItems = await searchLrcLib(queryTitle, queryArtist);
    const lrcLibCandidates = lrcLibItems
        .map(lrcLibToCandidate)
        .map((c) => ({ candidate: c, ...scoreMatch(query, c) }))
        .sort((a, b) => b.score - a.score);

    const lrcLibMin = queryArtist ? 95 : 110;
    for (const row of lrcLibCandidates.slice(0, 6)) {
        if (row.score < lrcLibMin && row.titleSim < 0.9) continue;
        if (row.titleSim < 0.72) continue;
        if (queryArtist && row.artistSim < 0.7) continue;

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

    // —— 2) 网易云回退（加强艺人/官方度过滤）——
    const neteaseSongs = await searchNetEase(queryTitle, queryArtist);
    const neteaseCandidates = neteaseSongs
        .map(netEaseToCandidate)
        .map((c) => ({ candidate: c, ...scoreMatch(query, c) }))
        .sort((a, b) => b.score - a.score);

    const neteaseMin = queryArtist ? 100 : 120;
    for (const row of neteaseCandidates.slice(0, 5)) {
        if (row.score < neteaseMin) continue;
        if (row.titleSim < 0.78) continue;
        if (queryArtist && row.artistSim < 0.85) continue;

        console.log(
            `[LyricFetcher] netease try score=${row.score.toFixed(1)} id=${row.candidate.id} `
            + `"${row.candidate.artists.join('/')} - ${row.candidate.title}"`
        );

        const content = await getNetEaseLyric(row.candidate.id);
        if (content) {
            try {
                await saveLyricFile(lyricDir, queryArtist || row.candidate.artists[0] || '', parsed.title, content);
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
        console.log(`[LyricFetcher] No lyric candidates for "${queryTitle}"`);
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
