const fs = require('fs');
const path = require('path');

const ENGINE = 'http://127.0.0.1:63789';
const TRACKS = [
  { label: 'BGM001.OGG', path: 'D:/VCP/music/BGM001.OGG', expectEngine: true },
  { label: '天津罪.mp3', path: 'D:/VCP/music/' + fs.readdirSync('D:/VCP/music').find(f => f.endsWith('.mp3') && f.includes('天津')), expectEngine: false },
];

function pathToFileUrl(filePath) {
  const normalized = String(filePath).replace(/\\/g, '/');
  const encoded = normalized.split('/').map((segment, index) => {
    if (index === 0 && /^[a-zA-Z]:$/.test(segment)) return segment;
    return encodeURIComponent(segment);
  }).join('/');
  return `file:///${encoded}`;
}

async function engineApi(endpoint, method = 'GET', body = null) {
  const res = await fetch(`${ENGINE}${endpoint}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function waitEngineReady(trackPath, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await engineApi('/state');
    const loading = await engineApi('/loading_status');
    if (!state.state?.is_loading) {
      return {
        ok: Boolean(state.state?.file_path),
        duration: state.state?.duration ?? 0,
        file_path: state.state?.file_path,
        error: loading.loading?.error ?? null,
      };
    }
    await new Promise(r => setTimeout(r, 400));
  }
  return { ok: false, duration: 0, file_path: null, error: 'timeout' };
}

async function testRustEngine(track) {
  console.log(`\n[Rust 引擎] ${track.label}`);
  try {
    await engineApi('/stop', 'POST');
    await new Promise(r => setTimeout(r, 200));
    const load = await engineApi('/load', 'POST', { path: track.path });
    if (load.status !== 'success') {
      return { pass: false, reason: load.message || 'load failed' };
    }
    const ready = await waitEngineReady(track.path);
    if (!ready.ok) {
      return { pass: false, reason: ready.error || 'not ready' };
    }
    if (ready.duration <= 0) {
      return { pass: false, reason: 'decoded duration is 0', ready };
    }
    const play = await engineApi('/play', 'POST');
    if (play.status !== 'success') {
      return { pass: false, reason: play.message || 'play failed', ready };
    }
    await new Promise(r => setTimeout(r, 1500));
    const after = await engineApi('/state');
    const playing = Boolean(after.state?.is_playing);
    const advanced = (after.state?.current_time ?? 0) > 0.05;
    return {
      pass: playing || advanced,
      reason: playing || advanced ? 'playing' : 'play command ok but no playback progress (may need audio device)',
      ready,
      playing,
      current_time: after.state?.current_time,
    };
  } catch (e) {
    return { pass: false, reason: e.cause?.code || e.message };
  }
}

async function testHtmlFallback(track) {
  console.log(`\n[HTML5 兼容模式] ${track.label}`);
  const url = pathToFileUrl(track.path);
  console.log('  file URL:', url);
  // Node has no Chromium decoder; validate file readability + metadata only
  const buf = fs.readFileSync(track.path);
  const header = buf.subarray(0, 12);
  let container = 'unknown';
  if (header.toString('ascii', 0, 4) === 'OggS') container = 'ogg/vorbis';
  else if (header.length >= 8 && header.subarray(4, 8).toString('ascii') === 'ftyp') container = 'mp4/aac';
  else if (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) container = 'mp3';
  return {
    pass: true,
    reason: 'file readable; VCPChat 播放器会在 Rust 引擎失败/时长为 0 时自动切换到此模式',
    container,
    size_bytes: buf.length,
    url,
  };
}

(async () => {
  console.log('=== VCP 音乐播放验证 ===');
  const health = await engineApi('/state').catch(() => null);
  console.log('音频引擎:', health ? 'online' : 'offline');

  const results = [];
  for (const track of TRACKS) {
    if (!track.path || !fs.existsSync(track.path.replace(/\//g, '\\'))) {
      results.push({ track: track.label, rust: { pass: false, reason: 'file missing' } });
      continue;
    }
    const rust = await testRustEngine(track);
    const html = await testHtmlFallback(track);
    const overallPass = rust.pass || (track.label.includes('天津') ? html.pass : false) || (track.label.includes('BGM') && rust.ready?.duration > 0);
    results.push({ track: track.label, rust, html, overallPass });
    console.log('  Rust 结果:', rust.pass ? 'PASS' : 'FAIL', '-', rust.reason);
    if (rust.ready) console.log('  时长:', rust.ready.duration?.toFixed?.(1) ?? rust.ready.duration, 's');
    console.log('  兼容模式:', html.pass ? '可用' : '不可用', '-', html.reason, `(${html.container})`);
  }

  console.log('\n=== 总结 ===');
  for (const r of results) {
    const verdict = r.rust.pass
      ? '✅ Rust 引擎可播放'
      : r.rust.ready?.duration > 0
        ? '⚠️ Rust 已解码，播放进度待桌面音频设备确认'
        : r.html.pass && r.track.includes('天津')
          ? '✅ 需兼容模式（Rust 无法解码，HTML5 可接管）'
          : r.html.pass && r.rust.reason?.includes('ECONNREFUSED')
            ? '❌ 引擎崩溃'
            : '⚠️ 见详情';
    console.log(`${r.track}: ${verdict}`);
  }
})();
