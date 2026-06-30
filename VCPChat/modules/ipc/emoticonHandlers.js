// modules/ipc/emoticonHandlers.js

const { ipcMain } = require('electron');
const fs = require('fs-extra');
const path = require('path');
const { URL } = require('url');

let emoticonLibrary = [];
let settingsFilePath;
let emoticonLibraryPath;
let degradedReason = null;
let hasWarnedForCurrentReason = false;

function setDegradedState(reason) {
    emoticonLibrary = [];
    if (degradedReason === reason && hasWarnedForCurrentReason) {
        return;
    }

    degradedReason = reason;
    hasWarnedForCurrentReason = true;
    console.warn(`[EmoticonFixer] Emoji library degraded: ${reason}`);
}

function clearDegradedState() {
    degradedReason = null;
    hasWarnedForCurrentReason = false;
}

function extractFileKeyFromLibraryUrl(url) {
    if (typeof url !== 'string') return null;
    const match = url.match(/\/pw=([^/]+)\/images\//);
    return match ? decodeURIComponent(match[1]) : null;
}

function getLibraryFileKey(library) {
    if (!Array.isArray(library) || library.length === 0) return null;
    return extractFileKeyFromLibraryUrl(library[0]?.url);
}

async function readSettingsFileKey() {
    try {
        const settings = await fs.readJson(settingsFilePath);
        return typeof settings.fileKey === 'string' ? settings.fileKey.trim() : '';
    } catch (error) {
        console.warn(`[EmoticonFixer] Failed to read settings for fileKey: ${error.message}`);
        return '';
    }
}

async function probeEmoticonUrl(url) {
    if (typeof url !== 'string' || !url.trim()) {
        return false;
    }

    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function loadCachedLibrary(expectedFileKey) {
    if (!await fs.pathExists(emoticonLibraryPath)) {
        return null;
    }

    try {
        const cached = await fs.readJson(emoticonLibraryPath);
        if (!Array.isArray(cached) || cached.length === 0) {
            return null;
        }

        const cachedFileKey = getLibraryFileKey(cached);
        if (expectedFileKey && cachedFileKey && cachedFileKey !== expectedFileKey) {
            const cacheWorks = await probeEmoticonUrl(cached[0]?.url);
            if (cacheWorks) {
                console.warn(
                    `[EmoticonFixer] settings.fileKey (${expectedFileKey}) differs from cache (${cachedFileKey}); keeping working cache.`
                );
                return cached;
            }
            console.warn(
                `[EmoticonFixer] Ignoring cached library because fileKey mismatch (${cachedFileKey} != ${expectedFileKey}).`
            );
            return null;
        }

        const cacheWorks = await probeEmoticonUrl(cached[0]?.url);
        if (!cacheWorks) {
            console.warn('[EmoticonFixer] Cached emoticon URL probe failed, will regenerate.');
            return null;
        }

        return cached;
    } catch (error) {
        console.warn(`[EmoticonFixer] Failed to read cache ${emoticonLibraryPath}: ${error.message}`);
        return null;
    }
}

async function ensureEmoticonLibrary(forceRegenerate = false) {
    const expectedFileKey = await readSettingsFileKey();

    if (!forceRegenerate && emoticonLibrary.length > 0) {
        const memoryFileKey = getLibraryFileKey(emoticonLibrary);
        if (!expectedFileKey || !memoryFileKey || memoryFileKey === expectedFileKey) {
            return emoticonLibrary;
        }
        emoticonLibrary = [];
    }

    if (!forceRegenerate) {
        const cached = await loadCachedLibrary(expectedFileKey);
        if (cached) {
            emoticonLibrary = cached;
            clearDegradedState();
            console.log(`[EmoticonFixer] Loaded ${cached.length} items from cache.`);
            return cached;
        }
    }

    return generateEmoticonLibrary();
}

async function initialize(paths) {
    settingsFilePath = paths.SETTINGS_FILE;
    emoticonLibraryPath = path.join(paths.APP_DATA_ROOT_IN_PROJECT, 'emoticon_library.json');
}

async function generateEmoticonLibrary() {
    console.log('[EmoticonFixer] Starting to generate emoticon library...');

    try {
        const settings = await fs.readJson(settingsFilePath);
        const vcpServerUrl = settings.vcpServerUrl;
        if (!vcpServerUrl) {
            setDegradedState('missing vcpServerUrl in settings.json');
            return [];
        }

        const fileKey = typeof settings.fileKey === 'string' ? settings.fileKey.trim() : '';
        if (!fileKey) {
            setDegradedState('missing fileKey in settings.json');
            return [];
        }

        const urlObject = new URL(vcpServerUrl);
        const baseUrl = `${urlObject.protocol}//${urlObject.host}`;

        const forumConfigPath = path.join(path.dirname(settingsFilePath), 'UserData', 'forum.config.json');
        let authHeader = null;
        if (await fs.pathExists(forumConfigPath)) {
            try {
                const forumConfig = await fs.readJson(forumConfigPath);
                if (forumConfig?.username && forumConfig?.password) {
                    authHeader = `Basic ${Buffer.from(`${forumConfig.username}:${forumConfig.password}`).toString('base64')}`;
                }
            } catch (forumConfigError) {
                console.warn(`[EmoticonFixer] Failed to read forum config for emoji API auth: ${forumConfigError.message}`);
            }
        }

        const response = await fetch(`${baseUrl}/admin_api/emojis/list`, {
            method: 'GET',
            headers: authHeader ? { Authorization: authHeader } : {}
        });

        if (!response.ok) {
            const authHint = response.status === 401 || response.status === 403
                ? ' (admin auth required, please login in Forum page)'
                : '';
            setDegradedState(`failed to fetch emoji list: HTTP ${response.status}${authHint}`);
            return [];
        }

        const payload = await response.json();
        if (!payload?.success || !payload?.data || typeof payload.data !== 'object') {
            setDegradedState('invalid emoji list response payload');
            return [];
        }

        const library = [];
        for (const [category, filenames] of Object.entries(payload.data)) {
            if (!Array.isArray(filenames)) continue;

            for (const rawFilename of filenames) {
                const filename = typeof rawFilename === 'string' ? rawFilename.trim() : '';
                if (!filename) continue;

                const encodedFilename = encodeURIComponent(filename);
                const encodedCategory = encodeURIComponent(category);
                const fullUrl = `${baseUrl}/pw=${fileKey}/images/${encodedCategory}/${encodedFilename}`;

                library.push({
                    url: fullUrl,
                    category,
                    filename,
                    searchKey: `${String(category).toLowerCase()}/${filename.toLowerCase()}`
                });
            }
        }

        const sampleWorks = await probeEmoticonUrl(library[0]?.url);
        if (!sampleWorks) {
            setDegradedState('generated emoticon URLs are not reachable (check settings.fileKey vs VCPToolBox Image_Key)');
            console.error(
                `[EmoticonFixer] Generated library failed URL probe: ${library[0]?.url}. ` +
                'Verify settings.json fileKey matches config.env Image_Key.'
            );

            const previousCache = await loadCachedLibrary('');
            if (previousCache) {
                emoticonLibrary = previousCache;
                return previousCache;
            }

            emoticonLibrary = library;
            return library;
        }

        await fs.writeJson(emoticonLibraryPath, library, { spaces: 2 });
        emoticonLibrary = library;
        clearDegradedState();
        console.log(`[EmoticonFixer] Successfully generated emoticon library with ${library.length} items.`);
        return library;
    } catch (error) {
        setDegradedState(error.message || 'unexpected generator error');
        return [];
    }
}

function setupEmoticonHandlers() {
    ensureEmoticonLibrary();

    ipcMain.handle('get-emoticon-library', async () => {
        const library = await ensureEmoticonLibrary();
        return Array.isArray(library) ? library : [];
    });

    ipcMain.on('regenerate-emoticon-library', async () => {
        clearDegradedState();
        emoticonLibrary = [];
        await ensureEmoticonLibrary(true);
    });
}

module.exports = {
    initialize,
    setupEmoticonHandlers,
    getEmoticonLibrary: () => degradedReason ? [] : emoticonLibrary
};
