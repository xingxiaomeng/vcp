// VCPMusicPlayer/main.js — Standalone portable music player shell
const { app, ipcMain, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');

const AUDIO_ENGINE_URL = 'http://127.0.0.1:63789';
const isPackaged = app.isPackaged;

// Packaged: main.js sits at the app root next to Musicmodules/ and audio_engine/.
// Dev: main.js lives in VCPMusicPlayer/, shared code is in the parent VCPChat/.
const APP_ROOT = isPackaged ? __dirname : path.join(__dirname, '..');

const PORTABLE_ROOT = isPackaged
    ? path.dirname(process.execPath)
    : path.join(__dirname, '..');

const APP_DATA_ROOT = path.join(PORTABLE_ROOT, 'AppData');
const SETTINGS_FILE = path.join(APP_DATA_ROOT, 'settings.json');
const AUDIO_ENGINE_DIR = path.join(APP_ROOT, 'audio_engine');

process.env.VCP_DATA_PATH = APP_DATA_ROOT;
process.env.VCP_APP_DATA = path.join(AUDIO_ENGINE_DIR, 'AppData');

let audioEngineProcess = null;
let audioEngineStopPromise = null;
let isAudioEngineStopping = false;
let openChildWindows = [];

const musicHandlers = require(path.join(APP_ROOT, 'modules', 'ipc', 'musicHandlers'));
const windowHandlers = require(path.join(APP_ROOT, 'modules', 'ipc', 'windowHandlers'));
const themeHandlers = require(path.join(APP_ROOT, 'modules', 'ipc', 'themeHandlers'));
const AppSettingsManager = require(path.join(APP_ROOT, 'modules', 'utils', 'appSettingsManager'));

let fetchImpl = typeof globalThis.fetch === 'function'
    ? globalThis.fetch.bind(globalThis)
    : null;

async function ensureFetch() {
    if (fetchImpl) return fetchImpl;
    const module = await import('node-fetch');
    fetchImpl = module.default;
    return fetchImpl;
}

async function waitForAudioEngineReady(timeoutMs = 15000) {
    const fetch = await ensureFetch();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${AUDIO_ENGINE_URL}/state`, {
                signal: AbortSignal.timeout(1000),
            });
            if (response.ok) return;
        } catch (_) {}
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('Audio Engine timed out.');
}

function startAudioEngine() {
    return new Promise(async (resolve, reject) => {
        try {
            if (audioEngineProcess && !audioEngineProcess.killed) {
                await waitForAudioEngineReady(3000);
                resolve();
                return;
            }

            try {
                await waitForAudioEngineReady(1000);
                resolve();
                return;
            } catch (_) {}

            const binaryName = process.platform === 'win32' ? 'audio_server.exe' : 'audio_server';
            const rustBinaryPath = path.join(AUDIO_ENGINE_DIR, binaryName);

            if (!fs.existsSync(rustBinaryPath)) {
                reject(new Error(`音频引擎未找到: ${rustBinaryPath}。请先运行「编译并部署音频引擎.bat」。`));
                return;
            }

            audioEngineStopPromise = null;
            isAudioEngineStopping = false;

            audioEngineProcess = spawn(rustBinaryPath, ['--port', '63789'], {
                cwd: AUDIO_ENGINE_DIR,
                env: { ...process.env, VCP_APP_DATA: process.env.VCP_APP_DATA },
            });

            let settled = false;
            const finishReady = () => {
                if (settled) return;
                settled = true;
                clearTimeout(readyTimeout);
                resolve();
            };
            const finishError = (error) => {
                if (settled) return;
                settled = true;
                clearTimeout(readyTimeout);
                reject(error);
            };

            const readyTimeout = setTimeout(() => {
                finishError(new Error('Audio Engine timed out.'));
            }, 15000);

            audioEngineProcess.stdout.on('data', (data) => {
                const output = data.toString().trim();
                if (output.includes('RUST_AUDIO_ENGINE_READY')) finishReady();
            });

            audioEngineProcess.stderr.on('data', (data) => {
                const logLine = data.toString().trim();
                if (logLine && !logLine.includes('GET /state HTTP/1.1')) {
                    const logMethod = isAudioEngineStopping ? console.warn : console.error;
                    logMethod(`[AudioEngine STDERR]: ${logLine}`);
                }
            });

            audioEngineProcess.on('close', (code) => {
                clearTimeout(readyTimeout);
                audioEngineProcess = null;
                audioEngineStopPromise = null;
                isAudioEngineStopping = false;
                if (!settled) finishError(new Error(`Audio Engine exited before ready (code ${code}).`));
            });

            audioEngineProcess.on('error', finishError);

            try {
                await waitForAudioEngineReady(15000);
                finishReady();
            } catch (error) {
                finishError(error);
            }
        } catch (error) {
            reject(error);
        }
    });
}

async function stopAudioEngine() {
    if (!audioEngineProcess || audioEngineProcess.killed) return;
    if (audioEngineStopPromise) return audioEngineStopPromise;

    isAudioEngineStopping = true;
    const processRef = audioEngineProcess;
    const exitPromise = new Promise((resolve) => processRef.once('close', resolve));

    audioEngineStopPromise = (async () => {
        try {
            const fetch = await ensureFetch();
            const controller = new AbortController();
            const shutdownTimer = setTimeout(() => controller.abort(), 2000);
            try {
                await fetch(`${AUDIO_ENGINE_URL}/shutdown`, { method: 'POST', signal: controller.signal });
            } catch (_) {
            } finally {
                clearTimeout(shutdownTimer);
            }

            await Promise.race([exitPromise, new Promise((resolve) => setTimeout(resolve, 2500))]);

            if (audioEngineProcess === processRef && !processRef.killed) {
                processRef.kill();
                await Promise.race([exitPromise, new Promise((resolve) => setTimeout(resolve, 2000))]);
            }
        } finally {
            if (audioEngineProcess !== processRef || processRef.killed) {
                audioEngineStopPromise = null;
            }
        }
    })();

    return audioEngineStopPromise;
}

function registerMinimalIpc() {
    ipcMain.handle('get-platform', () => process.platform);
    ipcMain.handle('path:dirname', (_event, p) => path.dirname(p));
    ipcMain.handle('path:extname', (_event, p) => path.extname(p));
    ipcMain.handle('path:basename', (_event, p, ext) => path.basename(p, ext));
    ipcMain.on('open-external-link', (_event, url) => {
        if (url) shell.openExternal(url);
    });
}

async function bootstrap() {
    const gotLock = app.requestSingleInstanceLock();
    if (!gotLock) {
        app.quit();
        return;
    }

    app.on('second-instance', async () => {
        try {
            await musicHandlers.createOrFocusMusicWindow();
        } catch (error) {
            console.error('[VCPMusicPlayer] Failed to focus existing window:', error);
        }
    });

    await fs.ensureDir(APP_DATA_ROOT);
    await fs.ensureDir(path.join(APP_DATA_ROOT, 'MusicCoverCache'));
    await fs.ensureDir(path.join(APP_DATA_ROOT, 'lyric'));
    await fs.ensureDir(process.env.VCP_APP_DATA);

    registerMinimalIpc();
    windowHandlers.initialize(null, openChildWindows);

    const settingsManager = new AppSettingsManager(SETTINGS_FILE);
    themeHandlers.initialize({
        mainWindow: null,
        openChildWindows,
        projectRoot: APP_ROOT,
        APP_DATA_ROOT_IN_PROJECT: APP_DATA_ROOT,
        settingsManager,
    });

    musicHandlers.initialize({
        mainWindow: null,
        openChildWindows,
        APP_DATA_ROOT_IN_PROJECT: APP_DATA_ROOT,
        startAudioEngine,
        stopAudioEngine,
    });

    startAudioEngine().catch((err) => {
        console.warn('[VCPMusicPlayer] Audio engine pre-warm failed (HTML5 fallback still available):', err.message);
    });

    await musicHandlers.createOrFocusMusicWindow();
}

app.whenReady().then(bootstrap).catch((error) => {
    console.error('[VCPMusicPlayer] Failed to start:', error);
    app.quit();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async (event) => {
    if (app.isQuitting) return;
    event.preventDefault();
    app.isQuitting = true;
    try {
        await stopAudioEngine();
    } finally {
        app.quit();
    }
});
