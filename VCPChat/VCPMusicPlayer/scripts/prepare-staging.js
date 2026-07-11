// Assembles a self-contained staging tree for electron-builder portable packaging.
const fs = require('fs-extra');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const STAGING = path.join(__dirname, '..', 'staging');

const COPY_DIRS = [
    'Musicmodules',
    'preloads',
    'styles',
    'assets',
];

const COPY_FILES = [
    'style.css',
];

const COPY_MODULE_FILES = [
    'modules/ipc/musicHandlers.js',
    'modules/ipc/windowHandlers.js',
    'modules/ipc/themeHandlers.js',
    'modules/ipc/ipcContracts.js',
    'modules/lyricFetcher.js',
    'modules/webdavManager.js',
    'modules/musicScannerWorker.js',
    'modules/services/preloadPaths.js',
    'modules/services/windowService.js',
    'modules/services/windowAppIds.js',
    'modules/utils/appSettingsManager.js',
];

const AUDIO_ENGINE_FILES = [
    'audio_engine/audio_server.exe',
    'audio_engine/IRPreset',
];

async function copyItem(relativePath) {
    const src = path.join(ROOT, relativePath);
    const dest = path.join(STAGING, relativePath);
    if (!(await fs.pathExists(src))) {
        console.warn(`[prepare-staging] Skip missing: ${relativePath}`);
        return;
    }
    await fs.copy(src, dest, { overwrite: true, errorOnExist: false });
    console.log(`[prepare-staging] Copied ${relativePath}`);
}

async function main() {
    console.log('[prepare-staging] Cleaning staging directory...');
    await fs.emptyDir(STAGING);

    for (const dir of COPY_DIRS) {
        await copyItem(dir);
    }

    for (const file of COPY_FILES) {
        await copyItem(file);
    }

    for (const file of COPY_MODULE_FILES) {
        await copyItem(file);
    }

    for (const item of AUDIO_ENGINE_FILES) {
        await copyItem(item);
    }

    await fs.copy(
        path.join(__dirname, '..', 'main.js'),
        path.join(STAGING, 'main.js'),
    );

    const pkg = {
        name: 'vcp-music-player',
        version: '1.0.0',
        description: 'VCP 音乐播放器 — 独立便携版',
        author: 'VCP',
        main: 'main.js',
        private: true,
        dependencies: {
            axios: '^1.10.0',
            'fs-extra': '^11.3.2',
            'music-metadata': '^11.4.0',
            'node-fetch': '^3.3.2',
        },
    };
    await fs.writeJson(path.join(STAGING, 'package.json'), pkg, { spaces: 2 });

    const engineExe = path.join(STAGING, 'audio_engine', 'audio_server.exe');
    if (!(await fs.pathExists(engineExe))) {
        console.error('\n[prepare-staging] ERROR: audio_server.exe not found.');
        console.error('Run 编译并部署音频引擎.bat in VCPChat first.\n');
        process.exitCode = 1;
        return;
    }

    console.log('\n[prepare-staging] Staging ready at:', STAGING);
    console.log('Next: cd staging && npm install && npx electron-builder --config ../electron-builder.config.js --win portable --x64\n');
}

main().catch((error) => {
    console.error('[prepare-staging] Failed:', error);
    process.exitCode = 1;
});
