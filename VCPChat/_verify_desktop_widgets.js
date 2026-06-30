/**
 * VCPDesktop 内置挂件依赖验证（Node 侧）
 * 用法: node _verify_desktop_widgets.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, 'AppData/settings.json'), 'utf8'));
const forum = JSON.parse(fs.readFileSync(path.join(ROOT, 'AppData/UserData/forum.config.json'), 'utf8'));
const auth = Buffer.from(`${forum.username}:${forum.password}`).toString('base64');
const apiBase = settings.vcpServerUrl.replace(/\/v1\/chat\/completions\/?$/i, '').replace(/\/$/, '');

const BUILTIN_WIDGETS = [
  { id: 'builtinWeather', name: '天气预报', type: 'admin-api', endpoint: '/admin_api/weather' },
  { id: 'builtinNews', name: '今日热点', type: 'admin-api', endpoint: '/admin_api/dailyhot' },
  { id: 'builtinTranslate', name: 'AI 翻译', type: 'chat-api' },
  { id: 'builtinMusic', name: '音乐播放条', type: 'audio-engine' },
  { id: 'builtinAppTray', name: '应用托盘', type: 'dock' },
  { id: 'builtinPerformanceMonitor', name: '性能监视器', type: 'perf' },
  { id: 'builtinCpuMonitor', name: 'CPU 监控', type: 'metric', key: 'cpu' },
  { id: 'builtinMemoryMonitor', name: 'RAM 监控', type: 'metric', key: 'memory' },
  { id: 'builtinDiskMonitor', name: '磁盘监控', type: 'metric', key: 'disk' },
  { id: 'builtinNetworkMonitor', name: '网络监控', type: 'metric', key: 'network' },
  { id: 'builtinGpuMonitor', name: 'GPU 监控', type: 'metric', key: 'gpu' },
  { id: 'builtinBatteryMonitor', name: '电池监控', type: 'metric', key: 'battery' },
  { id: 'builtinDockerMonitor', name: 'Docker 监控', type: 'metric', key: 'docker' },
  { id: 'builtinSensorsMonitor', name: '传感器监控', type: 'metric', key: 'sensors' },
  { id: 'builtinProcessMonitor', name: '进程监视器', type: 'metric', key: 'processes' },
];

async function adminFetch(endpoint) {
  const res = await fetch(`${apiBase}${endpoint}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function testChatApi() {
  const res = await fetch(settings.vcpServerUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.vcpApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.topicSummaryModel || 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'say ok' }],
      max_tokens: 8,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, content: data?.choices?.[0]?.message?.content || data?.error?.message || '' };
}

async function testAudioEngine() {
  try {
    const res = await fetch('http://127.0.0.1:63789/state');
    const data = await res.json();
    return { ok: res.ok, playing: data?.state?.is_playing, hasEngine: true };
  } catch (e) {
    return { ok: false, hasEngine: false, error: e.message };
  }
}

async function testMetrics() {
  const dm = require('./modules/ipc/desktopMetrics');
  const caps = await dm.getCapabilities();
  const snap = await dm.getSnapshot({});
  return { caps, snap };
}

(async () => {
  console.log('=== VCPDesktop 挂件验证 ===');
  console.log('Admin API:', apiBase);

  const metrics = await testMetrics();
  const audio = await testAudioEngine();
  const chat = await testChatApi();
  const weather = await adminFetch('/admin_api/weather');
  const news = await adminFetch('/admin_api/dailyhot');
  const dockItems = JSON.parse(fs.readFileSync(path.join(ROOT, 'AppData/DesktopData/dock.json'), 'utf8')).items.length;

  for (const w of BUILTIN_WIDGETS) {
    let verdict = '✅';
    let detail = '';

    switch (w.type) {
      case 'admin-api':
        if (w.id === 'builtinWeather') {
          if (weather.ok && weather.data?.daily) detail = `city=${weather.data.city || '?'}`;
          else { verdict = '⚠️'; detail = weather.data?.error || `HTTP ${weather.status}`; }
        } else if (w.id === 'builtinNews') {
          if (news.ok && news.data?.success && news.data.data?.length) detail = `${news.data.data.length} 条`;
          else { verdict = '⚠️'; detail = news.data?.error || `HTTP ${news.status}`; }
        }
        break;
      case 'chat-api':
        if (chat.ok) detail = `model=${settings.topicSummaryModel}`;
        else { verdict = '❌'; detail = chat.content || `HTTP ${chat.status}`; }
        break;
      case 'audio-engine':
        if (audio.hasEngine) detail = audio.ok ? '引擎在线' : '引擎异常';
        else { verdict = '⚠️'; detail = audio.error || '引擎未启动'; }
        break;
      case 'dock':
        detail = `${dockItems} 个应用`;
        break;
      case 'perf':
        detail = '需桌面窗口运行';
        break;
      case 'metric': {
        const status = metrics.caps.metrics[w.key];
        if (status === 'supported') {
          const val = metrics.snap[w.key];
          if (w.key === 'cpu') detail = `${val?.usagePct ?? '--'}%`;
          else if (w.key === 'memory') detail = `${val?.usagePct ?? '--'}%`;
          else if (w.key === 'disk') detail = val?.summary ? '有数据' : '无数据';
          else if (w.key === 'network') detail = val?.interfaces?.length ? `${val.interfaces.length} 网卡` : '无数据';
          else if (w.key === 'processes') detail = `${val?.running ?? '--'} 进程`;
          else detail = status;
        } else {
          verdict = status === 'provider_missing' ? '⚠️' : '⚠️';
          detail = status;
        }
        break;
      }
      default:
        detail = 'unknown';
    }

    console.log(`${verdict} ${w.name} (${w.id}) — ${detail}`);
  }

  console.log('\n=== 总结 ===');
  if (!weather.ok) console.log('天气: 需在 VCPToolBox/config.env 配置 WeatherKey 并运行 WeatherReporter 插件');
  if (!news.ok) console.log('热点: 运行 node VCPToolBox/Plugin/DailyHot/daily-hot.js 生成缓存');
  if (!audio.hasEngine) console.log('音乐: 启动 VCPChat 或 audio_server.exe');
  console.log('GPU/传感器: 可选安装 LibreHardwareMonitorLib.dll 到 VCPChat/vendor/LibreHardwareMonitor/');
})();
