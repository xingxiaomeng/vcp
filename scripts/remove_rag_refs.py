from pathlib import Path
import json
import re

ROOT = Path(r"D:\VCP\vcp")


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def write(rel, text):
    (ROOT / rel).write_text(text, encoding="utf-8")


def replace_block(rel, pattern, replacement, label):
    text = read(rel)
    text, count = re.subn(pattern, replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f"{label}: expected one block, found {count}")
    write(rel, text)


# Dynamic tool descriptions keep their lowest-threshold static block. General
# embedding classification remains available independently of the removed RAG stack.
dynamic_rel = r"VCPToolBox\modules\dynamicToolRegistry.js"
if "const ragPlugin = options.pluginManager" in read(dynamic_rel):
    replace_block(
        dynamic_rel,
        r"    async _resolveFoldBlocksForInjection\([\s\S]*?\n    }\n\n    _isAvailable",
        """    async _resolveFoldBlocksForInjection(foldObj, options = {}, record = {}) {
        const blocks = asArray(foldObj?.fold_blocks).filter((block) => block && typeof block.content === 'string');
        if (blocks.length === 0) return record.fullDescription || record.description || 'No full description available.';
        const fallbackBlock = [...blocks]
            .sort((a, b) => Number(a.threshold || 0) - Number(b.threshold || 0))
            .find((block) => block.content) || blocks[0];
        return fallbackBlock.content;
    }

    _isAvailable""",
        "dynamic tool fold resolver",
    )

# Remove the knowledge-base VRef protocol while retaining the independent
# EmbeddingUtils-backed semantic-river mode.
replace_block(
    r"VCPToolBox\modules\vcpLoop\toolExecutor.js",
    r"  /\*\*\n   \* 构建 VRef 上下文向量[\s\S]*?\n  }\n\n  /\*\*\n   \* 执行单个工具调用",
    """  /**
   * 执行单个工具调用""",
    "ToolExecutor VRef methods",
)
tool_executor = read(r"VCPToolBox\modules\vcpLoop\toolExecutor.js")
tool_executor = tool_executor.replace("const { pathToFileURL } = require('url');\n", "")
tool_executor = tool_executor.replace("    const { name, args, river, vref, archeryNoReply } = toolCall;", "    const { name, args, river, archeryNoReply } = toolCall;")
tool_executor, count = re.subn(
    r"\n    // === vref 虚拟引用解析 ===[\s\S]*?\n    }\n\n",
    "\n",
    tool_executor,
    count=1,
)
if count != 1:
    raise RuntimeError("ToolExecutor VRef execution block not found")
write(r"VCPToolBox\modules\vcpLoop\toolExecutor.js", tool_executor)

# DailyNoteManager remains a file-management plugin; only its vector
# association command is removed.
replace_block(
    r"VCPToolBox\Plugin\DailyNoteManager\daily-note-manager.js",
    r"// =+\n// Command: associate[\s\S]*?\n}\n\nfunction initialize",
    "function initialize",
    "DailyNoteManager associate command",
)
manager = read(r"VCPToolBox\Plugin\DailyNoteManager\daily-note-manager.js")
manager = manager.replace("// hybridservice 混合插件：list（列出日记）+ organize（整理日记）+ associate（联想关联日记）", "// hybridservice 混合插件：list（列出日记）+ organize（整理日记）")
manager = manager.replace("let associativeDiscovery = null;\n", "")
manager, count = re.subn(
    r"\n    // 延迟加载 AssociativeDiscovery[\s\S]*?\n    }\n\n    console\.log",
    "\n\n    console.log",
    manager,
    count=1,
)
if count != 1:
    raise RuntimeError("DailyNoteManager discovery initialization block not found")
manager = manager.replace("        case 'associate':\n            return await handleAssociateCommand(params);\n", "")
manager = manager.replace("。可用命令: 'list'（列出日记）, 'organize'（整理日记）, 'associate'（联想关联日记）。", "。可用命令: 'list'（列出日记）, 'organize'（整理日记）。")
manager = manager.replace("    associativeDiscovery = null;\n", "")
write(r"VCPToolBox\Plugin\DailyNoteManager\daily-note-manager.js", manager)

manifest_path = ROOT / r"VCPToolBox\Plugin\DailyNoteManager\plugin-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["description"] = "日记管理与整理混合插件，提供列出(list)和整理(organize)功能。"
commands = manifest.get("capabilities", {}).get("invocationCommands", [])
manifest["capabilities"]["invocationCommands"] = [
    command for command in commands if command.get("commandIdentifier") != "associate"
]
for command in manifest["capabilities"]["invocationCommands"]:
    command["description"] = command.get("description", "").replace(" 或 associate 命令", " 命令")
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Remove the HTTP vector-association endpoint but retain all diary CRUD routes.
replace_block(
    r"VCPToolBox\routes\dailyNotesRoutes.js",
    r"\n    // POST /associative-discovery[\s\S]*?\n    }\);\n\n    return router;",
    "\n\n    return router;",
    "daily notes associative-discovery route",
)

order_path = ROOT / r"VCPToolBox\preprocessor_order.json"
order = json.loads(order_path.read_text(encoding="utf-8"))
order = [name for name in order if name not in {"RAGDiaryPlugin", "ContextFoldingV2"}]
order_path.write_text(json.dumps(order, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("RAG coupling references removed from retained runtime modules.")
