// Plugin/DailyNoteManager/daily-note-manager.js
// hybridservice 混合插件：list（列出日记）+ organize（整理日记）

const fs = require('fs').promises;
const path = require('path');

// --- Runtime State ---
let pluginConfig = {};
let debugMode = false;
let dailyNoteRootPath = '';
let configuredExtension = 'txt';

// --- 写入队列：串行化 organize 操作，防止并发同名文件冲突 ---
let _writeQueue = Promise.resolve();
function withWriteLock(fn) {
    let release;
    const queued = new Promise(resolve => { release = resolve; });
    const prev = _writeQueue;
    _writeQueue = queued;
    return prev.then(() => fn().finally(release));
}

// 忽略的文件夹列表
const IGNORED_FOLDERS = ['MusicDiary'];
// 归档文件夹名
const ARCHIVE_FOLDER = '已整理';

// --- Debug Logging (to stderr) ---
function debugLog(message, ...args) {
    if (debugMode) {
        console.error(`[DailyNoteManager][Debug] ${message}`, ...args);
    }
}

// --- Helper: Sanitize Path Component ---
function sanitizePathComponent(name) {
    if (!name || typeof name !== 'string') {
        return 'Untitled';
    }
    let sanitized = name
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/[\x00-\x1f\x7f]/g, '')
        .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
        .replace(/[\u200b-\u200d\ufeff]/g, '')
        .replace(/\s+/g, '_')
        .replace(/^[._]+|[._]+$/g, '')
        .replace(/_+/g, '_');

    const windowsReserved = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i;
    if (windowsReserved.test(sanitized)) {
        sanitized = '_' + sanitized;
    }
    const MAX_FOLDER_NAME_LENGTH = 100;
    if (sanitized.length > MAX_FOLDER_NAME_LENGTH) {
        sanitized = sanitized.substring(0, MAX_FOLDER_NAME_LENGTH).replace(/[._]+$/g, '');
    }
    return sanitized || 'Untitled';
}

// --- Helper: Path Safety Check ---
function isPathWithinBase(targetPath, basePath) {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedBase = path.resolve(basePath);
    return resolvedTarget === resolvedBase ||
        resolvedTarget.startsWith(resolvedBase + path.sep);
}

// --- Helper: Extract date from diary filename ---
function extractDateFromFilename(filename) {
    // 新格式: YYYY-MM-DD-HH_MM_SS...
    const newFormatMatch = filename.match(/^(\d{4})-(\d{2})-(\d{2})-/);
    if (newFormatMatch) {
        return `${newFormatMatch[1]}-${newFormatMatch[2]}-${newFormatMatch[3]}`;
    }
    // 旧格式: YYYY.MM.DD...
    const oldFormatMatch = filename.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    if (oldFormatMatch) {
        return `${oldFormatMatch[1]}-${oldFormatMatch[2]}-${oldFormatMatch[3]}`;
    }
    return null;
}

// --- Helper: Parse date string to comparable value ---
function parseDateToNum(dateStr) {
    return parseInt(dateStr.replace(/-/g, ''), 10);
}

// --- Helper: Tag Processing (aligned with DailyNote plugin) ---
function detectTagLine(content) {
    const lines = content.split('\n');
    if (lines.length === 0) {
        return { hasTag: false, lastLine: '', contentWithoutLastLine: content };
    }
    const lastLine = lines[lines.length - 1].trim();
    const tagPattern = /^Tag:\s*.+/i;
    const hasTag = tagPattern.test(lastLine);
    const contentWithoutLastLine = hasTag ? lines.slice(0, -1).join('\n') : content;
    return { hasTag, lastLine, contentWithoutLastLine };
}

function fixTagFormat(tagLine) {
    let fixed = tagLine.trim();
    fixed = fixed.replace(/^tag:\s*/i, 'Tag: ');
    if (!fixed.startsWith('Tag: ')) {
        fixed = 'Tag: ' + fixed;
    }
    const tagContent = fixed.substring(5).trim();
    let normalizedContent = tagContent
        .replace(/[\uff1a]/g, '')
        .replace(/[\uff0c]/g, ', ')
        .replace(/[\u3001]/g, ', ')
        .replace(/[。.]+$/g, '');
    normalizedContent = normalizedContent
        .replace(/,\s*/g, ', ')
        .replace(/,\s{2,}/g, ', ')
        .replace(/\s+,/g, ',');
    normalizedContent = normalizedContent.replace(/\s{2,}/g, ' ').trim();
    return 'Tag: ' + normalizedContent;
}

function processTags(contentText, externalTag) {
    const detection = detectTagLine(contentText);

    if (externalTag && typeof externalTag === 'string' && externalTag.trim() !== '') {
        const fixedTag = fixTagFormat(externalTag);
        const contentBody = detection.hasTag ? detection.contentWithoutLastLine : contentText;
        return contentBody.trimEnd() + '\n' + fixedTag;
    }

    if (detection.hasTag) {
        const fixedTag = fixTagFormat(detection.lastLine);
        return detection.contentWithoutLastLine.trimEnd() + '\n' + fixedTag;
    }

    throw new Error("Tag is missing. Please provide a 'Tag' argument or add a 'Tag:' line at the end of the 'Content'.");
}

// ============================================================
// Command: list
// 列出指定文件夹中某日期范围内的所有日记
// ============================================================
async function handleListCommand(args) {
    const folder = args.folder || args.Folder;
    const startDate = args.startDate || args.StartDate || args.start_date;
    const endDate = args.endDate || args.EndDate || args.end_date;

    debugLog(`Processing 'list' command - folder: ${folder}, startDate: ${startDate}, endDate: ${endDate}`);

    if (!folder || !startDate || !endDate) {
        return { status: "error", error: "参数不完整：需要 folder, startDate, endDate。" };
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return { status: "error", error: "日期格式错误，请使用 YYYY-MM-DD 格式。" };
    }

    const startNum = parseDateToNum(startDate);
    const endNum = parseDateToNum(endDate);
    if (startNum > endNum) {
        return { status: "error", error: `起始日期 ${startDate} 不能晚于结束日期 ${endDate}。` };
    }

    const sanitizedFolder = sanitizePathComponent(folder);
    const dirPath = path.join(dailyNoteRootPath, sanitizedFolder);

    if (!isPathWithinBase(dirPath, dailyNoteRootPath)) {
        return { status: "error", error: "安全错误：检测到无效的文件夹路径。" };
    }
    if (IGNORED_FOLDERS.includes(sanitizedFolder)) {
        return { status: "error", error: `不允许访问被忽略的文件夹: ${sanitizedFolder}` };
    }

    try {
        await fs.access(dirPath);
    } catch {
        return { status: "error", error: `文件夹不存在: ${sanitizedFolder}` };
    }

    try {
        const files = await fs.readdir(dirPath);
        const diaryFiles = files
            .filter(f => f.toLowerCase().endsWith('.txt') || f.toLowerCase().endsWith('.md'))
            .sort();

        const results = [];

        for (const file of diaryFiles) {
            const dateStr = extractDateFromFilename(file);
            if (!dateStr) {
                debugLog(`跳过无法解析日期的文件: ${file}`);
                continue;
            }

            const fileNum = parseDateToNum(dateStr);
            if (fileNum < startNum || fileNum > endNum) continue;

            const filePath = path.join(dirPath, file);
            let content = '';
            try {
                content = await fs.readFile(filePath, 'utf-8');
            } catch (readErr) {
                console.error(`[DailyNoteManager] 读取文件失败 ${filePath}: ${readErr.message}`);
                continue;
            }

            const relativeUrl = path.join(sanitizedFolder, file).replace(/\\/g, '/');
            results.push({ url: relativeUrl, date: dateStr, filename: file, content });
        }

        debugLog(`在 ${sanitizedFolder} 中找到 ${results.length} 条日记（${startDate} ~ ${endDate}）`);

        if (results.length === 0) {
            return {
                status: "success",
                result: `在「${sanitizedFolder}」文件夹中，日期范围 ${startDate} ~ ${endDate} 内未找到任何日记文件。`
            };
        }

        let output = `在「${sanitizedFolder}」中找到 ${results.length} 条日记（${startDate} ~ ${endDate}）：\n\n`;
        for (const entry of results) {
            output += `--- [${entry.url}] ---\n`;
            output += entry.content;
            if (!entry.content.endsWith('\n')) output += '\n';
            output += '\n';
        }

        return { status: "success", result: output.trimEnd() };

    } catch (error) {
        console.error(`[DailyNoteManager] list 命令错误:`, error);
        return { status: "error", error: `读取文件夹失败: ${error.message}` };
    }
}

// ============================================================
// Command: organize
// 整理日记：创建新的合并日记 + 将原始文件归档到「已整理」
// ============================================================
async function handleOrganizeCommand(args) {
    const urls = args.urls || args.Urls || args.URL;
    const maid = args.maid || args.maidName || args.Maid;
    const folder = args.folder || args.Folder || args.folderName || args.FolderName || args.fold || args.Fold;
    const dateString = args.dateString || args.Date || args.date;
    const contentText = args.contentText || args.Content || args.content;
    const tag = args.Tag || args.tag;
    const fileName = args.fileName || args.FileName;

    debugLog(`Processing 'organize' command (queued) - folder: ${folder || 'Not specified'}, maid: ${maid || 'Not specified'}`);

    // 通过写入队列串行化，确保并发调用获得不同时间戳
    return withWriteLock(() => _handleOrganizeInternal(args));
}

async function _handleOrganizeInternal(args) {
    const urls = args.urls || args.Urls || args.URL;
    const maid = args.maid || args.maidName || args.Maid;
    const folder = args.folder || args.Folder || args.folderName || args.FolderName || args.fold || args.Fold;
    const dateString = args.dateString || args.Date || args.date;
    const contentText = args.contentText || args.Content || args.content;
    const tag = args.Tag || args.tag;
    const fileName = args.fileName || args.FileName;

    if (!urls || !maid || !dateString || !contentText) {
        return {
            status: "error",
            error: "参数不完整：需要 urls（待整理的文件URL列表）、maid、Date、Content。"
        };
    }

    const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urlList.length === 0) {
        return { status: "error", error: "urls 列表为空，请至少提供一个要整理的文件URL。" };
    }

    debugLog(`待整理文件数: ${urlList.length}`);

    // ---- Step 1: 创建新的整理后日记 ----
    let newFilePath = '';
    try {
        const processedContent = processTags(contentText, tag);

        const trimmedMaidName = maid.trim();
        const trimmedFolderName = typeof folder === 'string' ? folder.trim() : '';
        let folderName = trimmedFolderName || trimmedMaidName;
        let actualMaidName = trimmedMaidName;
        const tagMatch = trimmedMaidName.match(/^\[(.*?)\](.*)$/);

        if (trimmedFolderName) {
            debugLog(`Explicit folder provided for organize: folder=${folderName}, maid=${actualMaidName}`);
        } else if (tagMatch) {
            folderName = tagMatch[1].trim();
            actualMaidName = tagMatch[2].trim();
            debugLog(`Tagged note: folder=${folderName}, maid=${actualMaidName}`);
        }

        const sanitizedFolderName = sanitizePathComponent(folderName);
        if (IGNORED_FOLDERS.includes(sanitizedFolderName)) {
            return { status: "error", error: `不允许写入被忽略的文件夹: ${sanitizedFolderName}` };
        }

        const datePart = dateString.replace(/[.\\\/\s-]/g, '-').replace(/-+/g, '-');
        const now = new Date();
        const timeStringForFile = `${now.getHours().toString().padStart(2, '0')}_${now.getMinutes().toString().padStart(2, '0')}_${now.getSeconds().toString().padStart(2, '0')}`;

        const dirPath = path.join(dailyNoteRootPath, sanitizedFolderName);
        if (!isPathWithinBase(dirPath, dailyNoteRootPath)) {
            return { status: "error", error: "安全错误：检测到无效的文件夹路径。" };
        }

        let sanitizedOptionalFileName = '';
        if (typeof fileName === 'string' && fileName.trim()) {
            sanitizedOptionalFileName = sanitizePathComponent(fileName.trim());
        }

        const fileNameSuffix = sanitizedOptionalFileName ? `-${sanitizedOptionalFileName}` : '';
        const baseFileNameWithoutExt = `${datePart}-${timeStringForFile}${fileNameSuffix}`;
        const fileExtension = `.${configuredExtension}`;

        let finalFileName = `${baseFileNameWithoutExt}${fileExtension}`;
        let filePath = path.join(dirPath, finalFileName);
        let counter = 1;
        const MAX_RETRY = 50;

        await fs.mkdir(dirPath, { recursive: true });

        // 使用 wx 标志原子性创建文件，防止并发写入同名文件
        const fileContent = `[${datePart}] - ${actualMaidName}\n${processedContent}`;
        while (counter <= MAX_RETRY) {
            try {
                await fs.writeFile(filePath, fileContent, { encoding: 'utf-8', flag: 'wx' });
                break; // 创建成功
            } catch (wxErr) {
                if (wxErr.code === 'EEXIST') {
                    counter++;
                    finalFileName = `${baseFileNameWithoutExt}(${counter})${fileExtension}`;
                    filePath = path.join(dirPath, finalFileName);
                } else {
                    throw wxErr; // 非冲突错误直接抛出
                }
            }
        }
        if (counter > MAX_RETRY) {
            throw new Error(`文件名冲突过多，已尝试 ${MAX_RETRY} 次: ${baseFileNameWithoutExt}`);
        }
        newFilePath = filePath;
        debugLog(`成功创建整理后日记: ${filePath}`);

    } catch (createError) {
        return { status: "error", error: `创建整理后日记失败: ${createError.message}` };
    }

    // ---- Step 2: 将原始文件移动到「已整理」文件夹 ----
    const archiveDir = path.join(dailyNoteRootPath, ARCHIVE_FOLDER);
    if (!isPathWithinBase(archiveDir, dailyNoteRootPath)) {
        return { status: "error", error: "安全错误：归档文件夹路径无效。" };
    }

    await fs.mkdir(archiveDir, { recursive: true });

    const moveResults = [];
    for (const url of urlList) {
        const sourcePath = path.join(dailyNoteRootPath, url.replace(/\//g, path.sep));

        if (!isPathWithinBase(sourcePath, dailyNoteRootPath)) {
            moveResults.push({ url, status: 'error', message: '路径安全检查失败' });
            continue;
        }

        try {
            await fs.access(sourcePath);
        } catch {
            moveResults.push({ url, status: 'error', message: '文件不存在' });
            continue;
        }

        const baseFileName = path.basename(sourcePath);
        const ext = path.extname(baseFileName);
        const nameWithoutExt = path.basename(baseFileName, ext);
        let destPath = path.join(archiveDir, baseFileName);
        let archiveCounter = 1;

        // 归档也用原子性写入检测冲突
        const archiveMaxRetry = 50;
        while (archiveCounter <= archiveMaxRetry) {
            try {
                await fs.access(destPath);
                archiveCounter++;
                destPath = path.join(archiveDir, `${nameWithoutExt}(${archiveCounter})${ext}`);
            } catch {
                break; // 文件不存在，可以使用
            }
        }

        try {
            await fs.rename(sourcePath, destPath);
            moveResults.push({ url, status: 'success', message: `已归档到 ${ARCHIVE_FOLDER}/` });
            debugLog(`已移动: ${sourcePath} -> ${destPath}`);
        } catch {
            try {
                await fs.copyFile(sourcePath, destPath);
                await fs.unlink(sourcePath);
                moveResults.push({ url, status: 'success', message: `已归档到 ${ARCHIVE_FOLDER}/` });
            } catch (copyErr) {
                moveResults.push({ url, status: 'error', message: `归档失败: ${copyErr.message}` });
            }
        }
    }

    const successCount = moveResults.filter(r => r.status === 'success').length;
    const failCount = moveResults.filter(r => r.status === 'error').length;

    let summaryMessage = `日记整理完成！\n`;
    summaryMessage += `✅ 新日记已保存: ${newFilePath}\n`;
    summaryMessage += `📦 归档结果: ${successCount} 个文件成功归档到「${ARCHIVE_FOLDER}」`;
    if (failCount > 0) {
        summaryMessage += `，${failCount} 个文件处理失败`;
        const failDetails = moveResults
            .filter(r => r.status === 'error')
            .map(r => `  - ${r.url}: ${r.message}`)
            .join('\n');
        summaryMessage += `\n失败详情:\n${failDetails}`;
    }

    return { status: failCount > 0 ? "partial" : "success", result: summaryMessage };
}

// ============================================================
// hybridservice Interface
// ============================================================
function initialize(config, dependencies) {
    pluginConfig = config;
    debugMode = config.DebugMode || false;

    // 从环境变量或 config 获取路径
    dailyNoteRootPath = process.env.KNOWLEDGEBASE_ROOT_PATH ||
        (config.PROJECT_BASE_PATH ? path.join(config.PROJECT_BASE_PATH, 'dailynote') :
            path.join(__dirname, '..', '..', 'dailynote'));

    configuredExtension = (process.env.DAILY_NOTE_EXTENSION || 'txt').toLowerCase() === 'md' ? 'md' : 'txt';

    console.log(`[DailyNoteManager] ✅ Initialized (hybridservice). Root: ${dailyNoteRootPath}`);
}

async function processToolCall(args) {
    const { command, ...params } = args;

    debugLog(`processToolCall invoked, command: ${command}`);

    switch (command) {
        case 'list':
            return await handleListCommand(params);
        case 'organize':
            return await handleOrganizeCommand(params);
        default:
            return {
                status: "error",
                error: `未知命令: '${command}'。可用命令: 'list'（列出日记）, 'organize'（整理日记）。`
            };
    }
}

function shutdown() {
    debugLog('Shutting down DailyNoteManager...');
}

module.exports = {
    initialize,
    processToolCall,
    shutdown
};