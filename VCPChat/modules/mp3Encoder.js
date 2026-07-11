// modules/mp3Encoder.js
// Convert local audio files to MP3 via Chromium decode + lamejs (no system ffmpeg required).

const fs = require('fs-extra');
const path = require('path');
const { pathToFileURL } = require('url');

function isMp3Buffer(buf) {
    if (!buf || buf.length < 3) return false;
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
    return false;
}

function isHtmlBuffer(buf) {
    if (!buf || buf.length < 12) return false;
    const head = buf.slice(0, 64).toString('utf8').trim().toLowerCase();
    return head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<head');
}

function isMp4Buffer(buf) {
    if (!buf || buf.length < 12) return false;
    // ....ftyp
    return buf.slice(4, 8).toString('ascii') === 'ftyp';
}

function isFlacBuffer(buf) {
    return buf && buf.length >= 4 && buf.slice(0, 4).toString('ascii') === 'fLaC';
}

function isOggBuffer(buf) {
    return buf && buf.length >= 4 && buf.slice(0, 4).toString('ascii') === 'OggS';
}

function isWavBuffer(buf) {
    return buf && buf.length >= 12
        && buf.slice(0, 4).toString('ascii') === 'RIFF'
        && buf.slice(8, 12).toString('ascii') === 'WAVE';
}

function isValidAudioBuffer(buf) {
    if (!buf || buf.length < 16) return false;
    if (isHtmlBuffer(buf)) return false;
    return isMp3Buffer(buf) || isMp4Buffer(buf) || isFlacBuffer(buf) || isOggBuffer(buf) || isWavBuffer(buf);
}

async function isValidAudioFile(filePath) {
    try {
        const fd = fs.openSync(filePath, 'r');
        const head = Buffer.alloc(64);
        try {
            fs.readSync(fd, head, 0, 64, 0);
        } finally {
            fs.closeSync(fd);
        }
        return isValidAudioBuffer(head);
    } catch (_) {
        return false;
    }
}

function sanitizeFilename(name) {
    return String(name || '未命名')
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120) || '未命名';
}

function buildMp3Filename(meta) {
    const artist = sanitizeFilename(meta.artist || '未知艺术家');
    const title = sanitizeFilename(meta.title || '未知标题');
    return `${artist} - ${title}.mp3`;
}

async function convertWithFfmpeg(inputPath, outputPath) {
    const { spawn } = require('child_process');
    const ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';
    await new Promise((resolve, reject) => {
        const child = spawn(ffmpegBin, [
            '-y', '-i', inputPath,
            '-vn', '-codec:a', 'libmp3lame', '-q:a', '2',
            outputPath,
        ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        let err = '';
        child.stderr.on('data', (d) => { err += d.toString(); });
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) resolve();
            else reject(new Error(err.slice(-400) || `ffmpeg exit ${code}`));
        });
    });
    const st = await fs.stat(outputPath);
    if (st.size < 1024) throw new Error('ffmpeg 输出过小');
    return { method: 'ffmpeg' };
}

async function convertWithElectron(inputPath, outputPath, BrowserWindow) {
    const lamePath = path.join(__dirname, '..', 'node_modules', 'lamejs', 'lame.min.js');
    if (!(await fs.pathExists(lamePath))) {
        throw new Error('缺少 lamejs，无法编码 MP3');
    }

    const win = new BrowserWindow({
        show: false,
        width: 64,
        height: 64,
        webPreferences: {
            offscreen: true,
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false,
        },
    });

    const workDir = path.dirname(outputPath);
    await fs.ensureDir(workDir);
    const tmpHtml = path.join(workDir, `.vcp-mp3-encode-${process.pid}-${Date.now()}.html`);
    const lameUrl = pathToFileURL(lamePath).href;
    const html = `<!doctype html><html><head><meta charset="utf-8">
<script src="${lameUrl}"></script>
</head><body><script>
const fs = require('fs');
const path = require('path');
window.__ready = typeof lamejs !== 'undefined' && !!lamejs.Mp3Encoder;
window.__encodeToFile = async (inputPath, outputPath, bitrate) => {
  if (!window.__ready) throw new Error('lamejs 未加载');
  const buf = fs.readFileSync(inputPath);
  const head = buf.slice(0, 64).toString('utf8').trim().toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    throw new Error('音源是 HTML 页面而非音频');
  }
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let audioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(ab);
  } catch (e) {
    await ctx.close();
    throw new Error('音频解码失败: ' + (e && e.message ? e.message : 'unsupported'));
  }
  await ctx.close();

  const channels = Math.min(2, audioBuffer.numberOfChannels || 1);
  const sampleRate = audioBuffer.sampleRate || 44100;
  const leftF = audioBuffer.getChannelData(0);
  const rightF = channels > 1 ? audioBuffer.getChannelData(1) : leftF;
  const to16 = (arr) => {
    const out = new Int16Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      const s = Math.max(-1, Math.min(1, arr[i]));
      out[i] = s < 0 ? (s * 0x8000) : (s * 0x7fff);
    }
    return out;
  };
  const left = to16(leftF);
  const right = to16(rightF);
  const enc = new lamejs.Mp3Encoder(channels, sampleRate, bitrate || 192);
  const block = 1152;
  const parts = [];
  for (let i = 0; i < left.length; i += block) {
    const l = left.subarray(i, i + block);
    const r = right.subarray(i, i + block);
    const chunk = channels === 1 ? enc.encodeBuffer(l) : enc.encodeBuffer(l, r);
    if (chunk && chunk.length) parts.push(Buffer.from(chunk));
  }
  const flush = enc.flush();
  if (flush && flush.length) parts.push(Buffer.from(flush));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.concat(parts));
  return { duration: audioBuffer.duration, sampleRate, channels, size: fs.statSync(outputPath).size };
};
</script></body></html>`;

    await fs.writeFile(tmpHtml, html, 'utf8');
    try {
        await win.loadFile(tmpHtml);
        for (let i = 0; i < 50; i++) {
            const ready = await win.webContents.executeJavaScript('window.__ready === true', true);
            if (ready) break;
            await new Promise((r) => setTimeout(r, 50));
        }
        const ready = await win.webContents.executeJavaScript('window.__ready === true', true);
        if (!ready) throw new Error('lamejs 加载失败');

        const result = await win.webContents.executeJavaScript(
            `window.__encodeToFile(${JSON.stringify(inputPath)}, ${JSON.stringify(outputPath)}, 192)`,
            true
        );
        if (!result?.size || result.size < 1024) {
            throw new Error('MP3 编码失败或文件过小');
        }
        return { method: 'electron-lame', ...result };
    } finally {
        try { await fs.remove(tmpHtml); } catch (_) {}
        if (!win.isDestroyed()) win.destroy();
    }
}

async function convertToMp3(inputPath, outputPath, { BrowserWindow } = {}) {
    if (!inputPath || !(await fs.pathExists(inputPath))) {
        throw new Error('音源文件不存在');
    }
    await fs.ensureDir(path.dirname(outputPath));

    if (!(await isValidAudioFile(inputPath))) {
        throw new Error('音源不是有效音频文件（可能是版权拦截页）');
    }

    const head = Buffer.alloc(16);
    const fd = fs.openSync(inputPath, 'r');
    try {
        fs.readSync(fd, head, 0, 16, 0);
    } finally {
        fs.closeSync(fd);
    }

    if (isMp3Buffer(head)) {
        await fs.copy(inputPath, outputPath, { overwrite: true });
        return { method: 'copy-mp3' };
    }

    try {
        return await convertWithFfmpeg(inputPath, outputPath);
    } catch (_) {
        // fall through
    }

    if (!BrowserWindow) {
        throw new Error('无法转码为 MP3：未找到 ffmpeg');
    }
    return convertWithElectron(inputPath, outputPath, BrowserWindow);
}

module.exports = {
    isMp3Buffer,
    isValidAudioBuffer,
    isValidAudioFile,
    convertToMp3,
    sanitizeFilename,
    buildMp3Filename,
};
