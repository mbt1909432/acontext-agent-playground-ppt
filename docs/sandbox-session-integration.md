# 会话级 Sandbox 复用策略 - 执行文档

## 📋 目录
1. [目标与背景](#目标与背景)
2. [架构设计](#架构设计)
3. [数据模型](#数据模型)
4. [API 设计](#api-设计)
5. [实现步骤](#实现步骤)
6. [生命周期管理](#生命周期管理)
7. [错误处理](#错误处理)
8. [测试计划](#测试计划)
9. [性能考虑](#性能考虑)

---

## 目标与背景

### 问题陈述
当前系统在使用 Sandbox 执行任务时，每次任务都需要：
- 创建新的 sandbox
- 重新下载 skill 文件
- 重新准备执行环境
- 任务完成后立即销毁

这导致：
- ❌ **性能问题**：频繁创建/销毁容器开销大
- ❌ **用户体验差**：迭代式任务（如"改颜色"→"改字体"→"加一页"）需要重复准备环境
- ❌ **资源浪费**：临时文件无法在任务间复用

### 解决方案
实现**会话级 Sandbox 复用策略**：
- ✅ 每个 Acontext Session 维护一个活跃的 Sandbox
- ✅ Sandbox 在会话内复用，支持迭代式任务
- ✅ 自动过期回收机制，避免资源泄漏
- ✅ 与现有 Session/Disk 架构无缝集成

---

## 架构设计

### 核心概念

```
┌─────────────────────────────────────────────────────────┐
│                    Acontext Session                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │    Disk      │  │   Sandbox    │  │   Messages   │ │
│  │  (持久化)    │  │   (临时执行)  │  │   (对话历史)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                 │                  │          │
│         └─────────────────┴──────────────────┘          │
│                   统一生命周期管理                        │
└─────────────────────────────────────────────────────────┘
```

### 设计原则

1. **懒创建（Lazy Creation）**
   - Sandbox 只在需要执行代码时才创建
   - 纯对话/查阅 skill 不需要 sandbox

2. **会话绑定（Session Binding）**
   - Sandbox 生命周期与 Acontext Session 绑定
   - 通过 Supabase `chat_sessions` 表存储映射关系

3. **自动回收（Auto Cleanup）**
   - 基于"最后使用时间"的过期机制
   - 默认过期时间：10 分钟无活动
   - Session 删除时自动清理 sandbox

4. **优雅降级（Graceful Degradation）**
   - Sandbox 创建失败不影响对话功能
   - 自动重试机制处理临时故障

---

## 数据模型

### 数据库 Schema 变更

#### 1. 添加 Sandbox 相关字段到 `chat_sessions` 表

```sql
-- Migration: Add Acontext Sandbox fields to chat_sessions table
-- File: specs/001-chatbot-openai/migration-acontext-sandbox.sql

-- Add sandbox tracking fields
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS acontext_sandbox_id TEXT,
ADD COLUMN IF NOT EXISTS acontext_sandbox_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS acontext_sandbox_last_used_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_acontext_sandbox_id 
ON chat_sessions(acontext_sandbox_id) 
WHERE acontext_sandbox_id IS NOT NULL;

-- Add index for cleanup queries (find expired sandboxes)
CREATE INDEX IF NOT EXISTS idx_chat_sessions_sandbox_last_used 
ON chat_sessions(acontext_sandbox_last_used_at) 
WHERE acontext_sandbox_id IS NOT NULL;
```

#### 2. TypeScript 类型定义更新

```typescript
// types/chat.ts
export interface ChatSession {
  id: string;
  userId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  title?: string;
  acontextSessionId?: string;
  acontextDiskId?: string;
  // 新增字段
  acontextSandboxId?: string;
  acontextSandboxCreatedAt?: Date | string;
  acontextSandboxLastUsedAt?: Date | string;
}
```

---

## API 设计

### 核心函数接口

#### 1. `getOrCreateSandboxForSession()`

**功能**：获取或创建会话的活跃 Sandbox

```typescript
/**
 * 获取或创建会话的活跃 Sandbox
 * 
 * @param acontextSessionId - Acontext Session ID
 * @param options - 配置选项
 * @returns Sandbox ID，如果创建失败返回 null
 */
export async function getOrCreateSandboxForSession(
  acontextSessionId: string,
  options?: {
    forceNew?: boolean;           // 强制创建新的 sandbox（默认 false）
    expirationMinutes?: number;    // 过期时间（分钟），默认 10
    userId?: string;              // 用于错误日志
  }
): Promise<string | null>
```

**行为**：
1. 查询 `chat_sessions` 表获取当前 sandbox ID
2. 如果存在且未过期 → 更新 `last_used_at`，返回现有 ID
3. 如果存在但已过期 → `kill()` 旧 sandbox，创建新的
4. 如果不存在 → 创建新的 sandbox
5. 更新数据库记录

#### 2. `updateSandboxLastUsed()`

**功能**：更新 Sandbox 最后使用时间

```typescript
/**
 * 更新 Sandbox 最后使用时间
 * 
 * @param acontextSessionId - Acontext Session ID
 */
export async function updateSandboxLastUsed(
  acontextSessionId: string
): Promise<void>
```

**行为**：
- 更新 `acontext_sandbox_last_used_at` 字段
- 如果 sandbox 不存在，静默失败（不抛错）

#### 3. `cleanupExpiredSandboxes()`

**功能**：清理过期的 Sandbox（后台任务）

```typescript
/**
 * 清理所有过期的 Sandbox
 * 
 * @param expirationMinutes - 过期时间（分钟），默认 10
 * @returns 清理的 sandbox 数量
 */
export async function cleanupExpiredSandboxes(
  expirationMinutes: number = 10
): Promise<number>
```

**行为**：
1. 查询所有 `last_used_at` 超过阈值的记录
2. 对每个过期 sandbox：
   - 调用 `acontext.sandboxes.kill()`
   - 清空数据库字段
3. 返回清理数量

#### 4. `cleanupSandboxForSession()`

**功能**：清理指定会话的 Sandbox

```typescript
/**
 * 清理指定会话的 Sandbox
 * 
 * @param acontextSessionId - Acontext Session ID
 * @param updateDatabase - 是否更新数据库（默认 true）
 */
export async function cleanupSandboxForSession(
  acontextSessionId: string,
  updateDatabase: boolean = true
): Promise<void>
```

**行为**：
- 调用 `acontext.sandboxes.kill()`
- 清空数据库字段（如果 `updateDatabase` 为 true）

---

## 实现步骤

### Phase 1: 数据库迁移

**文件**：`specs/001-chatbot-openai/migration-acontext-sandbox.sql`

1. ✅ 创建迁移 SQL 文件
2. ✅ 添加字段：`acontext_sandbox_id`, `acontext_sandbox_created_at`, `acontext_sandbox_last_used_at`
3. ✅ 添加索引
4. ✅ 在 Supabase 中执行迁移

### Phase 2: 类型定义更新

**文件**：`types/chat.ts`

1. ✅ 更新 `ChatSession` 接口，添加 sandbox 相关字段

### Phase 3: 核心函数实现

**文件**：`lib/acontext-sandbox-manager.ts`（新建）

1. ✅ 实现 `getOrCreateSandboxForSession()`
2. ✅ 实现 `updateSandboxLastUsed()`
3. ✅ 实现 `cleanupExpiredSandboxes()`
4. ✅ 实现 `cleanupSandboxForSession()`
5. ✅ 添加错误处理和日志

**关键实现细节**：

```typescript
// 伪代码示例
async function getOrCreateSandboxForSession(sessionId: string) {
  // 1. 查询数据库
  const session = await getSessionFromDB(sessionId);
  
  // 2. 检查现有 sandbox
  if (session.acontextSandboxId) {
    // 检查是否过期
    const lastUsed = new Date(session.acontextSandboxLastUsedAt);
    const now = new Date();
    const minutesSinceLastUse = (now - lastUsed) / (1000 * 60);
    
    if (minutesSinceLastUse < EXPIRATION_MINUTES) {
      // 未过期，更新使用时间并返回
      await updateSandboxLastUsed(sessionId);
      return session.acontextSandboxId;
    } else {
      // 已过期，清理旧 sandbox
      await cleanupSandboxForSession(sessionId);
    }
  }
  
  // 3. 创建新 sandbox
  const sandbox = await acontext.sandboxes.create();
  
  // 4. 更新数据库
  await updateSessionSandbox(sessionId, {
    sandboxId: sandbox.id,
    createdAt: new Date(),
    lastUsedAt: new Date(),
  });
  
  return sandbox.id;
}
```

### Phase 4: 集成到现有流程

**文件**：`lib/acontext-integration.ts`

1. ✅ 导出 sandbox 管理函数
2. ✅ 在 `createAcontextSessionDirectly()` 中初始化（但不创建 sandbox，保持懒创建）
3. ✅ 在 `deleteAcontextSession()` 中添加 sandbox 清理逻辑

**文件**：`lib/chat-session.ts`

1. ✅ 在 `getOrCreateSession()` 中加载 sandbox 信息
2. ✅ 在 `createChatSession()` 中初始化字段（null）

### Phase 5: Tool 调用集成

**文件**：`app/api/chatbot-public/route.ts`（或相关路由）

1. ✅ 在调用 `bash_execution_sandbox` 或 `text_editor_sandbox` 前：
   - 调用 `getOrCreateSandboxForSession()` 获取 sandbox ID
   - 将 sandbox ID 传递给 tool（如果 tool 需要）
2. ✅ 在 tool 调用成功后：
   - 调用 `updateSandboxLastUsed()` 更新使用时间

**注意**：需要确认 Acontext Sandbox Tools 是否需要显式传递 sandbox ID，还是自动从 session 上下文获取。

### Phase 6: 后台清理任务（可选）

**文件**：`lib/background-tasks.ts`（新建，或集成到现有 cron）

1. ✅ 实现定期清理任务（如每 5 分钟运行一次）
2. ✅ 调用 `cleanupExpiredSandboxes()`
3. ✅ 记录清理日志

**部署方式**：
- Next.js API Route + Vercel Cron（推荐）
- 或 Supabase Edge Function + pg_cron

---

## 生命周期管理

### Sandbox 生命周期状态

```
┌─────────────┐
│   不存在     │
└──────┬──────┘
       │ 需要执行代码
       ▼
┌─────────────┐
│   已创建     │ ←──┐
└──────┬──────┘    │
       │           │ 使用中
       │ 执行命令  │
       ▼           │
┌─────────────┐   │
│   活跃中     │───┘
└──────┬──────┘
       │
       ├─→ 10分钟无活动 → [过期] → kill() → [不存在]
       │
       └─→ Session删除 → kill() → [不存在]
```

### 过期策略

**默认过期时间**：10 分钟

**过期判断逻辑**：
```typescript
const isExpired = (lastUsedAt: Date, expirationMinutes: number): boolean => {
  const now = new Date();
  const minutesSinceLastUse = (now.getTime() - lastUsedAt.getTime()) / (1000 * 60);
  return minutesSinceLastUse >= expirationMinutes;
};
```

**过期后的行为**：
1. 下次 `getOrCreateSandboxForSession()` 调用时检测到过期
2. 自动 `kill()` 旧 sandbox
3. 创建新的 sandbox
4. 更新数据库记录

### Session 删除时的清理

在 `deleteAcontextSession()` 中添加：

```typescript
// 清理关联的 sandbox
if (session.acontextSandboxId) {
  await cleanupSandboxForSession(acontextSessionId, false); // 数据库会在 session 删除时自动清理
}
```

---

## 错误处理

### 错误场景与处理策略

| 场景 | 处理策略 | 用户影响 |
|------|---------|---------|
| Sandbox 创建失败 | 记录错误日志，返回 `null`，对话继续 | 无法执行代码，但可以继续对话 |
| Sandbox 已不存在（被外部删除） | 检测到后创建新的 | 透明恢复，用户无感知 |
| 数据库更新失败 | 记录错误日志，但 sandbox 已创建 | Sandbox 可用，但下次可能重复创建 |
| `kill()` 失败 | 记录警告日志，继续清理数据库字段 | 可能留下僵尸 sandbox，后台任务会清理 |

### 错误日志格式

```typescript
console.error("[SandboxManager] Operation failed", {
  operation: "getOrCreateSandboxForSession",
  sessionId: acontextSessionId,
  error: error.message,
  stack: error.stack,
  context: { userId, forceNew },
});
```

### 优雅降级

- **Sandbox 不可用时**：系统应能继续提供对话功能
- **Tool 调用失败时**：返回友好的错误消息给用户
- **不阻塞主流程**：所有 sandbox 操作都应该是非阻塞的

---

## 测试计划

### 单元测试

**文件**：`lib/__tests__/acontext-sandbox-manager.test.ts`

1. ✅ `getOrCreateSandboxForSession()`
   - 测试：首次调用创建新 sandbox
   - 测试：重复调用复用现有 sandbox
   - 测试：过期后自动创建新的
   - 测试：`forceNew=true` 强制创建新的

2. ✅ `updateSandboxLastUsed()`
   - 测试：正常更新
   - 测试：sandbox 不存在时静默失败

3. ✅ `cleanupExpiredSandboxes()`
   - 测试：清理过期 sandbox
   - 测试：不过期的 sandbox 不被清理

4. ✅ `cleanupSandboxForSession()`
   - 测试：正常清理
   - 测试：sandbox 不存在时静默失败

### 集成测试

**场景 1：迭代式任务**
```
1. 用户："生成 PPT"
   → 创建 sandbox #1
2. 用户："改颜色"
   → 复用 sandbox #1
3. 用户："改字体"
   → 复用 sandbox #1
4. 等待 11 分钟
5. 用户："加一页"
   → sandbox #1 已过期，创建 sandbox #2
```

**场景 2：Session 删除**
```
1. 创建 session + sandbox
2. 执行一些命令
3. 删除 session
4. 验证 sandbox 已被 kill()
```

**场景 3：错误恢复**
```
1. 创建 sandbox
2. 手动 kill sandbox（模拟外部删除）
3. 再次调用 getOrCreateSandboxForSession()
4. 验证自动创建新的 sandbox
```

### 性能测试

- **创建延迟**：测量 `getOrCreateSandboxForSession()` 的响应时间
- **复用优势**：对比"每次新建" vs "复用"的执行时间
- **并发测试**：多个 session 同时创建 sandbox 的稳定性

---

## 性能考虑

### 优化点

1. **数据库查询优化**
   - 使用索引加速查询
   - 批量清理过期 sandbox（避免 N+1 查询）

2. **缓存策略**（可选）
   - 在内存中缓存"活跃 sandbox ID"（Redis 或内存 Map）
   - 减少数据库查询频率
   - 注意：需要处理多实例部署的缓存同步

3. **异步清理**
   - 过期检测和清理放在后台任务
   - 不阻塞主流程

### 资源限制

- **Sandbox 数量上限**：受 Acontext 账户限制
- **并发 Sandbox**：理论上每个活跃 session 一个
- **清理频率**：建议每 5-10 分钟运行一次清理任务

### 监控指标

建议监控：
- 活跃 sandbox 数量
- Sandbox 创建/销毁频率
- 平均 sandbox 生命周期
- 清理任务执行时间
- 错误率

---

## 后续优化（Future Work）

1. **Sandbox 预热**：预测用户可能需要执行代码，提前创建
2. **多 Sandbox 支持**：一个 session 维护多个 sandbox（不同用途）
3. **Sandbox 快照**：保存 sandbox 状态，支持快速恢复
4. **资源使用监控**：跟踪每个 sandbox 的 CPU/内存使用

---

## 附录

### 相关文件清单

**新增文件**：
- `specs/001-chatbot-openai/migration-acontext-sandbox.sql`
- `lib/acontext-sandbox-manager.ts`
- `lib/__tests__/acontext-sandbox-manager.test.ts`
- `lib/background-tasks.ts`（可选）

**修改文件**：
- `types/chat.ts`
- `lib/acontext-integration.ts`
- `lib/chat-session.ts`
- `app/api/chatbot-public/route.ts`（或相关路由）

### 参考文档

- [Acontext Sandbox API 文档](https://docs.acontext.io/store/sandbox)
- [SANDBOX_SKILL_FEATURES_0.1.1.md](../SANDBOX_SKILL_FEATURES_0.1.1.md)
- 现有 Disk 管理实现（`lib/acontext-integration.ts`）

---

**文档版本**：1.0  
**最后更新**：2024-12-19  
**作者**：AI Assistant

