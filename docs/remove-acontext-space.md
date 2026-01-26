# Acontext Space 功能移除指南

本文档详细说明如何从项目中移除 Acontext Space 相关功能。

## 概述

Acontext Space 功能用于为每个用户创建长期存在的 Space，用于存储和检索学习到的技能（SOP blocks）。移除此功能后，系统将不再：
- 为每个用户创建和管理 Space
- 在创建 session 时绑定 Space
- 从 Space 中搜索已学习的技能
- 通过 API 获取用户的技能列表

## 需要移除/修改的文件清单

### 1. 核心函数文件

#### `lib/acontext-integration.ts`

**需要移除的函数：**
- `getOrCreateUserSpaceId(userId: string)` (227-311行)
  - 移除整个函数及其所有实现
  - 包括 Space 创建逻辑和数据库映射逻辑

- `searchRelevantSkills(query: string, spaceId: string)` (439-551行)
  - 移除整个函数
  - 如果其他地方有调用，需要一并移除调用代码

**需要修改的函数：**
- `createAcontextSessionDirectly(userId: string, title?: string)` (1646-1742行)
  - 移除 `getOrCreateUserSpaceId` 的调用 (1657行)
  - 移除 `spaceId` 变量的声明和使用
  - 移除 session 创建时的 `spaceId` 参数绑定 (1675-1679行)
  - 移除保存 `acontext_space_id` 到数据库的代码 (1719行)
  - 移除日志中的 `spaceId` 输出 (1668行)

**需要移除的导入：**
- 无（此文件不导入 space 相关函数）

**需要移除的注释：**
- 函数注释中关于 Space 的描述

#### `lib/acontext-experience-search-tool.ts`

**需要修改的函数：**
- `runExperienceSearch(args: ExperienceSearchToolArgs, userId: string)` (47-199行)
  - 移除 `getOrCreateUserSpaceId` 的导入 (9行)
  - 移除获取 `spaceId` 的代码 (81-89行)
  - 移除 `client.spaces.experienceSearch` 调用 (97-100行)
  - 如果无法获取 Space，直接返回空结果
  - **建议**：考虑移除整个文件，或修改为返回空结果的占位实现

**需要移除的导入：**
```typescript
import { getOrCreateUserSpaceId } from "@/lib/acontext-integration";
```

**注意**：如果完全移除此文件，还需要：
- 移除 `getExperienceSearchToolSchema` 导出
- 移除 `isExperienceSearchToolName` 函数
- 更新所有引用此文件的地方

#### `lib/openai-client.ts`

**需要修改的函数：**
- `executeToolCall(...)` (119-176行)
  - 移除 `isExperienceSearchToolName` 的导入 (13-14行)
  - 移除 `runExperienceSearch` 的导入 (13行)
  - 移除 `experience_search` 工具的执行逻辑 (143-151行)
  - 移除函数参数注释中关于 `experience_search` 的描述 (116行)

**需要移除的导入：**
```typescript
import {
  runExperienceSearch,
  isExperienceSearchToolName,
} from "@/lib/acontext-experience-search-tool";
```

**需要移除的代码块：**
```typescript
if (isExperienceSearchToolName(name)) {
  if (!userId) {
    throw new Error("User ID is required for experience_search tool");
  }
  const args = JSON.parse(argsJson || "{}");
  console.log("[openai-client] executeToolCall: calling runExperienceSearch with query:", args.query);
  const result = await runExperienceSearch(args, userId);
  console.log("[openai-client] executeToolCall: runExperienceSearch returned:", JSON.stringify(result, null, 2).substring(0, 500));
  return result;
}
```

#### `lib/acontext-todo-tool.ts`

**需要修改的函数：**
- `createTodoList(sessionId: string, userId: string, ...)` (约 125-134行)
  - 移除自动添加 `experience_search` 任务的代码
  - 移除任务内容 "Search for relevant skills and experiences (using experience_search tool)"

**需要移除的代码：**
```typescript
// Automatically add the first task: search for skills
const searchTask: TodoItem = {
  id: "task_search_skills",
  content: "Search for relevant skills and experiences (using experience_search tool)",
  status: "pending",
  createdAt: now,
  updatedAt: now,
};
todos.push(searchTask);
```

**需要更新的注释：**
- 更新工具描述中关于 `experience_search` 的提及 (41行)

### 2. API 路由文件

#### `app/api/acontext/skills/route.ts`

**需要修改：**
- 移除从 `user_acontext_spaces` 表查询 `space_id` 的代码 (50-80行)
- 移除所有尝试从 Space 获取技能的代码 (82-132行)：
  - `client.blocks.list(spaceId, ...)`
  - `client.spaces.blocks.list(spaceId, ...)`
  - `client.spaces.experienceSearch(spaceId, ...)`
- 修改返回逻辑，直接返回空结果或禁用状态

**建议修改方案：**
```typescript
export async function GET() {
  // ... 认证代码保持不变 ...
  
  const client = getAcontextClient();
  if (!client) {
    return NextResponse.json({
      learnedCount: 0,
      skills: [],
      disabledReason: "Acontext is not configured.",
    });
  }

  // Space 功能已移除，直接返回空结果
  return NextResponse.json({
    learnedCount: 0,
    skills: [],
    disabledReason: "Skills feature has been disabled (Space removed).",
  });
}
```

#### `app/api/chatbot/route.ts`

**需要修改：**
- 移除系统提示中关于 `experience_search` 的强制要求 (280-302行)
- 移除所有关于 "CRITICAL WORKFLOW RULE" 和 "experience_search" 的指令
- 移除 `getExperienceSearchToolSchema` 的导入 (26行)
- 从工具列表 `availableTools` 中移除 `getExperienceSearchToolSchema` (452行)

**需要移除的导入：**
```typescript
import { getExperienceSearchToolSchema } from "@/lib/acontext-experience-search-tool";
```

#### `app/api/chatbot-public/route.ts`

**需要修改：**
- 移除 `getExperienceSearchToolSchema` 的导入 (26行)
- 从工具列表 `availableTools` 中移除 `getExperienceSearchToolSchema` (383行)
- 移除注释中关于 `experience_search` 的描述 (7行)

**需要移除的导入：**
```typescript
import { getExperienceSearchToolSchema } from "@/lib/acontext-experience-search-tool";
```

#### `app/api/tools/route.ts`

**需要修改：**
- 移除 `getExperienceSearchToolSchema` 的导入 (4行)
- 从工具列表 `schemas` 数组中移除 `getExperienceSearchToolSchema` (28行)

**需要移除的导入：**
```typescript
import { getExperienceSearchToolSchema } from "@/lib/acontext-experience-search-tool";
```

### 3. 类型定义文件

#### `types/chat.ts`

**需要移除的字段：**
- `ChatSession` 接口中的 `acontextSpaceId?: string;` (31行)

### 4. 会话管理文件

#### `lib/chat-session.ts`

**需要修改的函数：**
- `createChatSession(userId: string, title?: string)` (17-59行)
  - 移除返回对象中的 `acontextSpaceId` 字段 (56行)

- `getOrCreateSession(userId: string, sessionId?: string)` (155-223行)
  - 移除返回对象中的 `acontextSpaceId` 字段 (204行)

**需要移除的数据库查询字段：**
- 移除所有 `data.acontext_space_id` 的引用

### 5. 前端组件文件

#### `components/acontext-skills-card.tsx`

**需要检查：**
- 此组件调用 `/api/acontext/skills` API (34行)
- API 将返回空技能列表或 `disabledReason`
- 组件应该能优雅处理以下情况：
  - `learnedCount: 0` 且 `skills: []`
  - `disabledReason` 字段存在时显示友好提示
  - 不需要修改代码，但需要确保 UI 能正确显示"无技能"或"功能已禁用"的状态

**需要更新的内容：**
- 组件标题 (59行)：`"Learned skills (Space)"` 可以改为 `"Learned skills"` 或 `"Skills"`（移除 Space 引用）

**建议：**
- 检查组件是否正确处理 `disabledReason` 字段（已实现，77-81行）
- 确保空状态显示友好（已实现，会显示 `disabledReason`）
- 如果组件有错误处理，确保不会因为空结果而报错（已实现）
- 考虑更新标题以移除 "(Space)" 引用

### 6. 数据库迁移文件

#### `specs/001-chatbot-openai/migration-acontext-space-user.sql`

**操作：**
- 此文件可以保留作为历史记录，或删除
- 需要创建反向迁移脚本来删除表

#### `specs/001-chatbot-openai/migration-acontext.sql`

**需要修改：**
- 移除 `acontext_space_id` 字段的添加 (13-20行)
- 或创建新的迁移脚本移除该字段

### 7. 文档文件

#### `docs/skills-summary.md`

**需要更新：**
- 移除所有关于 Space 的描述
- 移除 `getOrCreateUserSpaceId` 和 `searchRelevantSkills` 的文档
- 更新相关说明

#### `README.md` 和 `README-zh.md`

**需要更新：**
- 移除关于 Space 功能的描述
- 移除相关迁移脚本的说明

## 数据库变更

### 需要删除的表

#### `user_acontext_spaces`
```sql
-- 删除索引
DROP INDEX IF EXISTS idx_user_acontext_spaces_space_id;

-- 删除表
DROP TABLE IF EXISTS user_acontext_spaces;
```

### 需要移除的字段

#### `chat_sessions` 表
```sql
-- 删除索引
DROP INDEX IF EXISTS idx_chat_sessions_acontext_space_id;

-- 删除字段
ALTER TABLE chat_sessions 
DROP COLUMN IF EXISTS acontext_space_id;
```

## 迁移步骤

### 步骤 1: 备份数据（可选）

如果需要保留历史数据，先备份相关表：
```sql
-- 备份 user_acontext_spaces 表
CREATE TABLE user_acontext_spaces_backup AS 
SELECT * FROM user_acontext_spaces;

-- 备份 chat_sessions 中的 acontext_space_id 数据
CREATE TABLE chat_sessions_space_backup AS 
SELECT id, acontext_space_id 
FROM chat_sessions 
WHERE acontext_space_id IS NOT NULL;
```

### 步骤 2: 创建数据库迁移脚本

创建新文件 `specs/001-chatbot-openai/migration-remove-acontext-space.sql`:

```sql
-- Migration: Remove Acontext Space functionality
-- Run this SQL in your Supabase SQL Editor

-- Step 1: Remove index on chat_sessions.acontext_space_id
DROP INDEX IF EXISTS idx_chat_sessions_acontext_space_id;

-- Step 2: Remove acontext_space_id column from chat_sessions
ALTER TABLE chat_sessions 
DROP COLUMN IF EXISTS acontext_space_id;

-- Step 3: Remove index on user_acontext_spaces.space_id
DROP INDEX IF EXISTS idx_user_acontext_spaces_space_id;

-- Step 4: Drop user_acontext_spaces table
DROP TABLE IF EXISTS user_acontext_spaces;
```

### 步骤 3: 修改代码文件

按照上述文件清单逐一修改：

1. **移除函数**：
   - `lib/acontext-integration.ts`: 移除 `getOrCreateUserSpaceId` 和 `searchRelevantSkills`
   
2. **修改函数**：
   - `lib/acontext-integration.ts`: 修改 `createAcontextSessionDirectly`
   - `lib/acontext-experience-search-tool.ts`: 修改或移除 `runExperienceSearch`
   - `app/api/acontext/skills/route.ts`: 简化实现
   - `app/api/chatbot/route.ts`: 移除 experience_search 相关指令和工具注册
   - `app/api/chatbot-public/route.ts`: 移除 experience_search 工具注册
   - `app/api/tools/route.ts`: 移除 experience_search 工具注册
   - `lib/openai-client.ts`: 移除 experience_search 工具执行逻辑
   - `lib/acontext-todo-tool.ts`: 移除自动添加 experience_search 任务
   - `lib/chat-session.ts`: 移除 `acontextSpaceId` 字段

3. **更新类型**：
   - `types/chat.ts`: 移除 `ChatSession.acontextSpaceId`

### 步骤 4: 清理导入语句

检查所有文件，移除不再使用的导入：
- `lib/acontext-experience-search-tool.ts`: 移除 `getOrCreateUserSpaceId` 导入

### 步骤 5: 运行数据库迁移

在 Supabase SQL Editor 中执行迁移脚本：
```sql
-- 执行 migration-remove-acontext-space.sql
```

### 步骤 6: 测试

测试以下功能确保正常工作：
- [ ] 创建新的聊天会话
- [ ] 加载现有会话
- [ ] 发送消息和接收响应
- [ ] 检查 Skills API 返回（应该返回空结果或禁用状态）
- [ ] 检查没有控制台错误

### 步骤 7: 更新文档

- 更新 `README.md` 和 `README-zh.md`
- 更新或删除 `docs/skills-summary.md`
- 更新任何其他相关文档

## 影响分析

### 功能影响

1. **技能学习功能**：
   - ❌ 系统将不再从完成的对话中学习技能
   - ❌ 无法检索已学习的技能

2. **Skills API**：
   - ❌ `/api/acontext/skills` 将返回空结果
   - 前端需要处理此变化

3. **Experience Search Tool**：
   - ❌ `experience_search` 工具将无法工作
   - ❌ 需要从所有工具列表中移除
   - ❌ 系统提示中不再强制要求使用此工具
   - ❌ Todo 工具不再自动添加 experience_search 任务

### 数据影响

1. **已存在的 Space**：
   - Acontext 中的 Space 不会被自动删除
   - 如果需要，可以手动清理

2. **历史数据**：
   - `user_acontext_spaces` 表中的映射关系将丢失
   - `chat_sessions` 中的 `acontext_space_id` 将丢失

### 兼容性

- 现有会话将继续工作（不依赖 Space）
- 新会话将不再绑定 Space
- 需要确保前端代码能处理 `acontextSpaceId` 字段不存在的情况

## 回滚方案

如果需要回滚，需要：

1. **恢复数据库**：
   - 从备份恢复 `user_acontext_spaces` 表
   - 恢复 `chat_sessions.acontext_space_id` 字段

2. **恢复代码**：
   - 从 Git 历史恢复相关函数
   - 恢复类型定义

3. **重新运行迁移**：
   - 执行原始的 `migration-acontext-space-user.sql`
   - 执行 `migration-acontext.sql` 中的 space 相关部分

## 注意事项

1. **Acontext API 调用**：
   - 移除 Space 后，某些 Acontext API 调用可能失败
   - 确保所有 `client.spaces.*` 调用都被移除或处理
   - 特别注意：`client.spaces.experienceSearch`, `client.spaces.blocks.list` 等

2. **Experience Search 工具移除**：
   - 如果完全移除 `experience_search` 工具，考虑删除 `lib/acontext-experience-search-tool.ts` 文件
   - 或者保留文件但修改为返回空结果的占位实现（便于未来恢复）
   - 确保所有工具注册点都已移除该工具

3. **系统提示更新**：
   - `app/api/chatbot/route.ts` 中的系统提示包含强制使用 `experience_search` 的规则
   - 必须完全移除这些规则，否则 Agent 会尝试调用不存在的工具

4. **错误处理**：
   - 检查所有错误处理逻辑，确保不会因为 Space 不存在而报错
   - 如果 Agent 尝试调用 `experience_search`，应该有友好的错误提示

5. **日志清理**：
   - 移除所有关于 Space 的调试日志
   - 移除所有关于 `experience_search` 的日志
   - 更新错误消息

6. **测试覆盖**：
   - 确保所有相关测试用例都已更新
   - 添加测试验证 Space 功能已完全移除
   - 测试 Agent 不再尝试调用 `experience_search` 工具

7. **前端兼容性**：
   - 检查前端是否有显示技能列表的 UI
   - 检查前端是否有调用 `/api/acontext/skills` 的代码
   - 确保前端能优雅处理空技能列表或禁用状态

## 检查清单

在完成移除后，使用此清单验证：

- [ ] 所有 `getOrCreateUserSpaceId` 调用已移除
- [ ] 所有 `searchRelevantSkills` 调用已移除
- [ ] 所有 `client.spaces.*` 调用已移除或处理
- [ ] `user_acontext_spaces` 表已删除
- [ ] `chat_sessions.acontext_space_id` 字段已删除
- [ ] `ChatSession` 类型中的 `acontextSpaceId` 已移除
- [ ] `experience_search` 工具已从所有 API 路由中移除
- [ ] `experience_search` 工具执行逻辑已从 `openai-client.ts` 移除
- [ ] 系统提示中的 `experience_search` 强制要求已移除
- [ ] Todo 工具中的自动 `experience_search` 任务已移除
- [ ] 所有导入语句已清理（包括 `getExperienceSearchToolSchema`, `runExperienceSearch`, `isExperienceSearchToolName`）
- [ ] Skills API 已更新
- [ ] 文档已更新（README, skills-summary.md, 执行文档.md）
- [ ] 测试通过
- [ ] 无控制台错误
- [ ] 前端代码兼容（如果前端使用 `acontextSpaceId` 或 `experience_search`）
- [ ] `components/acontext-skills-card.tsx` 能正确处理空技能列表和禁用状态

## 相关文件完整列表

### 需要修改的文件：
1. `lib/acontext-integration.ts`
2. `lib/acontext-experience-search-tool.ts`
3. `app/api/acontext/skills/route.ts`
4. `app/api/chatbot/route.ts`
5. `app/api/chatbot-public/route.ts`
6. `app/api/tools/route.ts`
7. `lib/openai-client.ts`
8. `lib/acontext-todo-tool.ts`
9. `types/chat.ts`
10. `lib/chat-session.ts`
11. `components/acontext-skills-card.tsx` (检查，可能需要更新以处理禁用状态)

### 需要删除/更新的文件：
11. `specs/001-chatbot-openai/migration-acontext-space-user.sql` (可选删除)
12. `specs/001-chatbot-openai/migration-acontext.sql` (需要更新)
13. `docs/skills-summary.md` (需要更新或删除)
14. `docs/执行文档.md` (需要更新)
15. `README.md` (需要更新)
16. `README-zh.md` (需要更新)

### 可选删除的文件：
17. `lib/acontext-experience-search-tool.ts` (如果完全移除 experience_search 功能，可以删除整个文件)

### 需要创建的文件：
18. `specs/001-chatbot-openai/migration-remove-acontext-space.sql` (新建)

## 关键要点总结

### 必须移除的核心功能

1. **Space 管理**：
   - ✅ `getOrCreateUserSpaceId()` 函数
   - ✅ `user_acontext_spaces` 数据库表
   - ✅ `chat_sessions.acontext_space_id` 字段

2. **技能搜索**：
   - ✅ `searchRelevantSkills()` 函数
   - ✅ `experience_search` 工具（整个工具）
   - ✅ 所有 `client.spaces.experienceSearch()` 调用
   - ✅ 所有 `client.spaces.blocks.list()` 调用

3. **工具注册**：
   - ✅ 从 `app/api/chatbot/route.ts` 移除
   - ✅ 从 `app/api/chatbot-public/route.ts` 移除
   - ✅ 从 `app/api/tools/route.ts` 移除
   - ✅ 从 `lib/openai-client.ts` 移除执行逻辑

4. **系统提示**：
   - ✅ 移除强制使用 `experience_search` 的规则
   - ✅ 移除所有关于 Space 和技能学习的指令

5. **类型定义**：
   - ✅ `ChatSession.acontextSpaceId` 字段

### 需要特别注意的地方

1. **前端组件** (`components/acontext-skills-card.tsx`)：
   - 组件已能处理空结果和禁用状态
   - 建议更新标题移除 "(Space)" 引用

2. **Todo 工具** (`lib/acontext-todo-tool.ts`)：
   - 移除自动添加的 `experience_search` 任务
   - 更新工具描述

3. **Skills API** (`app/api/acontext/skills/route.ts`)：
   - 修改为返回空结果和禁用原因
   - 保持 API 接口不变（向后兼容）

4. **Experience Search Tool 文件**：
   - 可以选择完全删除 `lib/acontext-experience-search-tool.ts`
   - 或保留为占位实现（返回空结果）

### 测试重点

- [ ] 创建新会话不再尝试创建 Space
- [ ] Agent 不再尝试调用 `experience_search` 工具
- [ ] Skills API 返回正确的禁用状态
- [ ] 前端组件正确显示空状态
- [ ] 没有控制台错误或警告
- [ ] 所有工具调用正常工作（除了 experience_search）

---

**最后更新**: 2024-12-19
**作者**: AI Assistant
**状态**: 待执行

