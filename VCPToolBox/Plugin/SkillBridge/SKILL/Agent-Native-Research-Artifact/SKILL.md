---
name: Agent-Native-Research-Artifact
description: >
  Agent-Native Research Artifact (ARA) 技能包集合。包含 Universal ARA Compiler（论文/代码/笔记→结构化研究制品）、
  Research Manager（研究过程记录与渐进结晶）、Rigor Reviewer（ARA 语义级质量审查）。
  TRIGGERS: compile, ARA, research artifact, 编译论文, 研究制品, 知识提取, level2 review, 研究管理
---

# Agent-Native Research Artifact (ARA)

本目录是 **ARA 技能族** 的入口，包含三个子技能。按任务选择对应 `SKILL.md` 全文阅读：

| 子技能 | 路径 | 用途 |
|--------|------|------|
| **compiler** | `SKILL/Agent-Native-Research-Artifact/compiler/SKILL.md` | 将 PDF、仓库、代码目录、笔记等编译为完整 ARA |
| **research-manager** | `SKILL/Agent-Native-Research-Artifact/research-manager/SKILL.md` | 研究过程记录、事件路由、渐进结晶 |
| **rigor-reviewer** | `SKILL/Agent-Native-Research-Artifact/rigor-reviewer/SKILL.md` | ARA Level 2 语义审查与评分 |

## 快速路由

- 用户要求 **compile / 生成 ARA / 编译论文或仓库** → 读 `compiler/SKILL.md`
- 用户要求 **记录研究过程 / 写 journey / 结晶知识** → 读 `research-manager/SKILL.md`
- 用户要求 **审查 ARA / level2 / 质量审计** → 读 `rigor-reviewer/SKILL.md`

使用 FileOperator ReadFile 读取上述路径（Windows 绝对路径见 SkillBridge 索引）。
