const path = require('path');

// Run electron-builder from the staging/ directory:
//   npx electron-builder --config ../electron-builder.config.js --win portable --x64
module.exports = {
    appId: 'com.vcp.musicplayer',
    productName: 'VCP Music Player',
    copyright: 'VCP',
    directories: {
        output: path.join(__dirname, 'dist'),
        buildResources: path.join(__dirname, 'staging', 'assets'),
    },
    files: [
        '**/*',
        '!node_modules/electron/**/*',
        '!node_modules/electron-builder/**/*',
        '!node_modules/app-builder-bin/**/*',
        '!node_modules/app-builder-lib/**/*',
        '!node_modules/.cache/**/*',
        '!node_modules/@electron/**/*',
    ],
    // Keep audio_server.exe and Worker scripts outside asar so they can execute.
    asar: false,
    win: {
        target: [{ target: 'portable', arch: ['x64'] }],
        artifactName: 'VCPMusicPlayer-${version}-portable-x64.${ext}',
        signAndEditExecutable: false,
    },
    portable: {
        artifactName: 'VCPMusicPlayer-${version}-portable-x64.${ext}',
    },
    npmRebuild: false,
};
