// modules/vcpLoop/toolExecutor.js
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { getEmbeddingsBatch, cosineSimilarity } = require('../../EmbeddingUtils');

const VCP_TIMED_CONTACTS_DIR = path.join(__dirname, '..', '..', 'VCPTimedContacts');

/**
 * 提取消息的纯文本字符串
 */
function getMessageTextContent(msg) {
  if (!msg) return '';
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('\n');
  }
  return '';
}

/**
 * 将多模态消息对象规范化为纯文本消息对象（保留 role 等元数据）
 * 复用 getMessageTextContent 提取文本
 */
function extractTextFromMessage(msg) {
  if (typeof msg.content === 'string') return msg;
  if (Array.isArray(msg.content)) {
    return { ...msg, content: getMessageTextContent(msg) };
  }
  return msg;
}

class ToolExecutor {
  constructor(options) {
    this.pluginManager = options.pluginManager;
    this.webSocketServer = options.webSocketServer;
    this.debugMode = options.debugMode;
    this.vcpToolCode = options.vcpToolCode;
    this.getRealAuthCode = options.getRealAuthCode;
  }

  /**
   * 执行单个工具调用
   * @returns {Promise<{success: boolean, content: Array, error?: string, raw?: any}>}
   */
  async execute(toolCall, clientIp, contextMessages = []) {
    const { name, args, river, archeryNoReply } = toolCall;

    // === river 上下文注入 ===
    // river 协议允许 AI 在工具调用时携带对话上下文，支持四种模式：
    //   full     — 原始多模态消息（含图片等），完整深拷贝
    //   text     — 多模态转纯文本，减少传输体积
    //   last:N   — 仅取最后 N 条消息（纯文本）
    //   semantic:N — 语义折叠，用工具参数作为 query 检索最相关的 N 条消息
    if (this.debugMode) console.log(`[ToolExecutor] Processing tool: ${name}, river mode: ${river}`);
    if (river === 'full') {
      args.river_context = JSON.parse(JSON.stringify(contextMessages));
    } else if (river === 'text') {
      args.river_context = contextMessages.map(msg => extractTextFromMessage(msg));
    }
    // === last:N 模式 — 取最后 N 条消息（纯文本） ===
    else if (river && river.startsWith('last:')) {
      const n = parseInt(river.split(':')[1]) || 10;
      const textOnly = contextMessages.map(msg => extractTextFromMessage(msg));
      args.river_context = textOnly.slice(-n);
    }
    // === semantic:N 模式 — 语义折叠取 Top-N 最相关消息 ===
    else if (river && river.startsWith('semantic:')) {
      const n = parseInt(river.split(':')[1]) || 5;
      
      // 1. 构建查询文本：用工具调用的参数拼接
      const queryParts = [];
      for (const [key, value] of Object.entries(args)) {
        if (key === 'river_context') continue;
        if (typeof value === 'string' && value.length > 0) {
          queryParts.push(value);
        }
      }
      const queryText = queryParts.join(' ').slice(0, 2000);
      
      // 2. 提取每条消息的纯文本
      const textMessages = contextMessages.map((msg, idx) => ({
        index: idx,
        role: msg.role,
        text: getMessageTextContent(msg),
        original: msg
      })).filter(m => m.text.length > 10);
      
      // 3. 尝试语义检索，失败则优雅回退到 last:N（保证工具调用不会因向量化失败而中断）
      try {
        const embeddingConfig = {
          apiKey: process.env.API_KEY,
          apiUrl: process.env.API_URL,
          model: process.env.WhitelistEmbeddingModel || 'google/gemini-embedding-001'
        };
        const allTexts = [
          queryText.slice(0, 1000),
          ...textMessages.map(m => m.text.slice(0, 1000))
        ];
        const allVectors = await getEmbeddingsBatch(allTexts, embeddingConfig);
        const queryVec = allVectors[0];
        const messageVectors = allVectors.slice(1);

        if (!queryVec) {
          throw new Error('Query embedding returned null');
        }

        // 4. 计算余弦相似度并排序
        const scored = textMessages.map((m, i) => ({
          ...m,
          score: messageVectors[i] ? cosineSimilarity(queryVec, messageVectors[i]) : 0
        }));

        scored.sort((a, b) => b.score - a.score);

        // 5. 取 Top-N，按原始顺序排列
        const topN = scored.slice(0, n);
        topN.sort((a, b) => a.index - b.index);

        args.river_context = topN.map(m => ({
          role: m.role,
          content: m.text,
          _river_score: m.score,
          _river_index: m.index
        }));

        if (this.debugMode) {
          console.log(`[ToolExecutor] Semantic river: selected ${topN.length} messages from ${textMessages.length} candidates (via EmbeddingUtils)`);
        }

      } catch (err) {
        console.warn(`[River] Semantic mode failed, falling back to last:${n}:`, err.message);
        // 回退到 last:N
        const textOnly = contextMessages.map(msg => extractTextFromMessage(msg));
        args.river_context = textOnly.slice(-n);
      }
    }
    if (this.debugMode && args.river_context) {
      console.log(`[ToolExecutor] river_context injected: ${args.river_context.length} messages`);
    }

    // 通用未来任务拦截：
    // 任意工具只要携带 timely_contact，就先写入 VCPTimedContacts 由任务调度器到点执行。
    // 到点执行时由 TaskScheduler 注入 __vcp_timed_call 标准元信息；
    // 插件可基于该字段判断原始发起时间、计划触发时间与实际触发时间。
    if (args && Object.prototype.hasOwnProperty.call(args, 'timely_contact')) {
      return await this._scheduleTimedToolCall(toolCall);
    }

    // 验证码校验
    if (this.vcpToolCode) {
      const authResult = await this._verifyAuth(args);
      if (!authResult.valid) {
        return this._createErrorResult(name, authResult.message);
      }
    }

    // 检查插件是否存在
    if (!this.pluginManager.getPlugin(name)) {
      return this._createErrorResult(name, `未找到名为 "${name}" 的插件`);
    }

    // 执行插件
    try {
      if (this.debugMode) console.log(`[ToolExecutor] Calling processToolCall for ${name} with args keys: ${Object.keys(args).join(', ')}`);
      const result = await this.pluginManager.processToolCall(name, args, clientIp, 'post', { archeryNoReply: !!archeryNoReply });
      return this._processResult(name, result);
    } catch (error) {
      return this._createErrorResult(name, `执行错误: ${error.message}`);
    }
  }

  /**
   * 批量执行工具调用
   */
  async executeAll(toolCalls, clientIp, contextMessages = []) {
    return Promise.all(
      toolCalls.map(tc => this.execute(tc, clientIp, contextMessages))
    );
  }

  _processResult(toolName, result) {
    const formatted = this._formatResult(result);
    
    // WebSocket广播：即使是 archery no-reply 静默结果，也保留 VCPLog 可见性。
    this._broadcast(toolName, 'success', formatted.text);

    // archery no-reply 的“静默”只表示不回灌给 AI / 不触发二次 loop；
    // 用户侧仍应通过 VCPInfo WS 看到工具已被接收，后续真实进度由插件自己的 VCPLog/VCPInfo 继续推送。
    if (result && typeof result === 'object' && result.__vcpArcheryNoReplySilent) {
      try {
        const vcpLogFunctions = this.pluginManager?.getVCPLogFunctions?.();
        if (vcpLogFunctions && typeof vcpLogFunctions.pushVcpInfo === 'function') {
          vcpLogFunctions.pushVcpInfo({
            type: 'TOOL_NO_REPLY_ACCEPTED',
            toolName,
            status: 'success',
            noReply: true,
            message: result.message || `Async no-reply tool "${toolName}" accepted silently.`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (broadcastError) {
        if (this.debugMode) {
          console.warn(`[ToolExecutor] Failed to broadcast no-reply VCPInfo for ${toolName}: ${broadcastError.message}`);
        }
      }
    }
    
    return {
      success: true,
      content: formatted.content,
      raw: result
    };
  }

  _formatResult(result) {
    if (result === undefined || result === null) {
      return { text: '(无返回内容)', content: [{ type: 'text', text: '(无返回内容)' }] };
    }

    // 检查是否为富内容格式
    if (typeof result === 'object') {
      const richContent = result.data?.content || result.content;
      if (Array.isArray(richContent)) {
        const textPart = richContent.find(p => p.type === 'text');
        return {
          text: textPart?.text || '[Rich Content]',
          content: richContent
        };
      }
    }

    const text = typeof result === 'object' 
      ? JSON.stringify(result, null, 2) 
      : String(result);
    
    return {
      text,
      content: [{ type: 'text', text }]
    };
  }

  _createErrorResult(toolName, message) {
    this._broadcast(toolName, 'error', message);
    return {
      success: false,
      error: message,
      content: [{ type: 'text', text: `[错误] ${message}` }]
    };
  }

  _broadcast(toolName, status, content) {
    this.webSocketServer.broadcast({
      type: 'vcp_log',
      data: { tool_name: toolName, status, content }
    }, 'VCPLog');
  }

  async _scheduleTimedToolCall(toolCall) {
    const { name, args } = toolCall;
    const timelyContact = args?.timely_contact;
    const targetDate = this._parseAndValidateTimedContact(timelyContact);
    if (!targetDate) {
      return this._createErrorResult(name, `无效的 'timely_contact' 时间格式: '${timelyContact}'。请使用 YYYY-MM-DD-HH:mm 格式，或可被 Date 解析的未来时间。`);
    }
    if (targetDate === 'past') {
      return this._createErrorResult(name, `无效的 'timely_contact' 时间: '${timelyContact}'。不能设置为过去或当前时间。`);
    }

    if (!this.pluginManager.getPlugin(name)) {
      return this._createErrorResult(name, `未找到名为 "${name}" 的插件`);
    }

    const scheduledArgs = JSON.parse(JSON.stringify(args || {}));
    const requestedAt = this._formatToLocalDateTimeWithOffset(new Date());

    const taskId = `task-${targetDate.getTime()}-${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')}`;
    const taskData = {
      taskId,
      createdAt: requestedAt,
      scheduledLocalTime: this._formatToLocalDateTimeWithOffset(targetDate),
      tool_call: {
        tool_name: name,
        arguments: scheduledArgs
      },
      requestor: `ToolExecutor: ${name}`
    };

    try {
      await fs.mkdir(VCP_TIMED_CONTACTS_DIR, { recursive: true });
      const taskFilePath = path.join(VCP_TIMED_CONTACTS_DIR, `${taskId}.json`);
      await fs.writeFile(taskFilePath, JSON.stringify(taskData, null, 2), 'utf-8');

      const receipt = `任务已成功调度。\n工具: ${name}\n任务ID: ${taskId}\n发起时间: ${requestedAt}\n计划时间: ${taskData.scheduledLocalTime}\n到点执行时系统会注入 __vcp_timed_call 标准元信息。`;
      this._broadcast(name, 'success', receipt);
      return {
        success: true,
        content: [{ type: 'text', text: receipt }],
        raw: {
          status: 'success',
          scheduled: true,
          taskId,
          tool_name: name,
          requestedAt,
          scheduledTime: taskData.scheduledLocalTime
        }
      };
    } catch (error) {
      return this._createErrorResult(name, `创建定时任务失败: ${error.message}`);
    }
  }

  _parseAndValidateTimedContact(value) {
    if (!value) return null;

    const raw = String(value).trim();
    const standardized = raw.replace(/[\/\.]/g, '-');
    const compactMatch = standardized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})-(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);

    let date;
    if (compactMatch) {
      const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw] = compactMatch;
      const year = Number(yearRaw);
      const month = Number(monthRaw);
      const day = Number(dayRaw);
      const hour = Number(hourRaw);
      const minute = Number(minuteRaw);
      const second = secondRaw === undefined ? 0 : Number(secondRaw);

      date = new Date(year, month - 1, day, hour, minute, second);
      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getHours() !== hour ||
        date.getMinutes() !== minute ||
        date.getSeconds() !== second
      ) {
        return null;
      }
    } else {
      date = new Date(raw);
      if (Number.isNaN(date.getTime())) return null;
    }

    if (date.getTime() <= Date.now()) return 'past';
    return date;
  }

  _formatToLocalDateTimeWithOffset(date) {
    const pad = (value, length = 2) => String(value).padStart(length, '0');
    const timezoneOffsetMinutes = date.getTimezoneOffset();
    const offsetSign = timezoneOffsetMinutes > 0 ? '-' : '+';
    const offsetHours = pad(Math.floor(Math.abs(timezoneOffsetMinutes) / 60));
    const offsetMinutes = pad(Math.abs(timezoneOffsetMinutes) % 60);

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${offsetSign}${offsetHours}:${offsetMinutes}`;
  }

  async _verifyAuth(args) {
    const realCode = await this.getRealAuthCode(this.debugMode);
    const provided = args.tool_password;
    delete args.tool_password;

    if (!realCode || provided !== realCode) {
      return { valid: false, message: 'tool_password 验证失败' };
    }
    return { valid: true };
  }
}

module.exports = ToolExecutor;
