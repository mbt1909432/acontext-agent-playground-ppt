# Skills 功能总结

## 概述

Skills（技能）是 Acontext PPT Girl 项目中实现的核心功能之一，它允许 AI Agent 从过往的成功任务中学习并存储可重用的技能。这些技能以 SOP（Standard Operating Procedure，标准操作程序）块的形式存储在 Acontext Space 中，使 Agent 能够"记住"如何完成特定类型的任务，并在未来遇到类似情况时直接复用。

## 核心概念

### 1. Skills 的本质

- **存储形式**：Skills 以 SOP blocks 的形式存储在用户的 Acontext Space 中
- **学习方式**：Agent 在完成任务后，可以将成功的操作流程自动或手动保存为技能
- **复用机制**：通过语义搜索（experienceSearch）找到相关的已学习技能，并在新任务中应用

### 2. Acontext Space

- **作用**：每个用户都有一个专属的 Space，作为长期记忆和知识库
- **存储内容**：
  - SOP blocks（技能）
  - 任务经验
  - 用户偏好
- **映射关系**：通过 `user_acontext_spaces` 表维护用户 ID 与 Space ID 的映射关系

## 功能组件

### 1. Experience Search Tool (`experience_search`)

**位置**：`lib/acontext-experience-search-tool.ts`

**功能**：
- 允许 Agent 在执行任务前搜索已学习的相关技能
- 使用语义搜索匹配用户查询与已存储的技能
- 返回匹配的技能列表，包括标题、摘要、使用场景等信息

**使用场景**：
- Agent 在执行复杂任务前，先搜索是否有现成的技能可以复用
- Todo 工具创建任务列表时，自动添加"搜索相关技能"作为第一个任务

**工具 Schema**：
```typescript
{
  name: "experience_search",
  description: "Search for learned skills and procedures from past successful task completions...",
  parameters: {
    query: string  // 描述任务或问题的搜索查询
  }
}
```

**返回格式**：
```typescript
{
  skills: Array<{
    title: string;           // 技能标题
    summary: string;         // 技能摘要
    content?: string;        // 详细内容
    use_when?: string;       // 使用场景
    preferences?: string;    // 偏好设置
  }>;
  query: string;            // 搜索查询
  count: number;            // 找到的技能数量
}
```

### 2. Skills API 端点

**位置**：`app/api/acontext/skills/route.ts`

**功能**：
- 提供 GET 接口获取用户已学习的所有技能
- 支持多种检索方法（降级策略）：
  1. `client.blocks.list`（如果 SDK 支持）
  2. `client.spaces.blocks.list`
  3. `experienceSearch`（fallback 方法）

**响应格式**：
```typescript
{
  learnedCount: number;
  skills: Array<{
    title: string;
    summary: string;
    createdAt: string;
  }>;
}
```

**错误处理**：
- 未配置 Acontext：返回 `disabledReason: "Acontext is not configured."`
- 无 Space 映射：返回 `disabledReason: "No Acontext Space found for this user yet."`
- 检索失败：返回详细的错误信息

### 3. Skills UI 组件

**位置**：`components/acontext-skills-card.tsx`

**功能**：
- 在聊天界面中显示用户已学习的技能列表
- 实时从 API 获取技能数据
- 展示技能标题、摘要和创建时间

**显示内容**：
- 已学习技能总数
- 每个技能的卡片（标题、摘要、创建时间）
- 加载状态和错误提示

### 4. 集成函数

**位置**：`lib/acontext-integration.ts`

**关键函数**：

#### `searchRelevantSkills(query: string, spaceId: string)`
- 在 Space 中搜索相关技能
- 返回格式化的技能列表
- 用于在对话中动态检索技能

#### `getOrCreateUserSpaceId(userId: string)`
- 获取或创建用户的 Space
- 确保每个用户都有专属的知识库
- 在创建 Session 时自动关联 Space

## 工作流程

### 1. 技能学习流程

```
用户请求任务
    ↓
Agent 执行任务
    ↓
任务成功完成
    ↓
Acontext 自动/手动提取 SOP
    ↓
保存为 SOP block 到 Space
    ↓
技能学习完成
```

### 2. 技能复用流程

```
用户请求新任务
    ↓
Agent 调用 experience_search
    ↓
在 Space 中搜索相关技能
    ↓
找到匹配的技能
    ↓
Agent 应用技能完成任务
```

### 3. Todo 工具集成

当创建复杂任务的 Todo 列表时，系统会自动添加第一个任务：
- **任务 ID**：`task_search_skills`
- **内容**：`"Search for relevant skills and experiences (using experience_search tool)"`
- **目的**：确保 Agent 在执行任务前先查找可复用的技能

## 数据结构

### SOP Block 结构

Skills 在 Acontext 中以 SOP blocks 形式存储，包含以下字段：

- **title**：技能标题
- **summary/description**：技能摘要或描述
- **use_when**：何时使用此技能
- **preferences**：偏好设置
- **tool_sops**：工具操作步骤（数组）
- **content/text**：详细内容
- **created_at**：创建时间

### 数据库映射

**表名**：`user_acontext_spaces`

**字段**：
- `user_id`：Supabase 用户 ID
- `space_id`：Acontext Space ID
- `created_at`：创建时间

## 使用示例

### 1. Agent 搜索技能

```typescript
// Agent 在执行任务前搜索相关技能
const result = await runExperienceSearch(
  { query: "how to create a React component" },
  userId
);

// 返回匹配的技能
console.log(result.skills); // [{ title: "...", summary: "...", ... }]
```

### 2. 前端显示技能列表

```tsx
// 在组件中使用
<AcontextSkillsCard />

// 组件会自动：
// 1. 调用 /api/acontext/skills
// 2. 显示技能列表
// 3. 处理加载和错误状态
```

### 3. 在系统提示词中使用

Agent 的系统提示词中会包含：
- 建议在执行任务前先搜索相关技能
- 说明如何利用已学习的技能提高效率
- 指导何时应该学习新技能

## 技术实现细节

### 1. 多方法降级策略

Skills API 实现了三种检索方法的降级策略，确保在不同 SDK 版本下都能正常工作：

1. **优先方法**：`client.blocks.list(spaceId, { type: "sop" })`
2. **备选方法**：`client.spaces.blocks.list(spaceId, { type: "sop" })`
3. **Fallback**：`client.spaces.experienceSearch(spaceId, { query: "skills procedures workflows" })`

### 2. 数据映射逻辑

从 Acontext API 返回的 block 数据需要映射到统一的技能格式：

```typescript
const skill = {
  title: block.title || block.name || block.props?.title || "Untitled skill",
  summary: block.summary || block.description || constructFromSOPFields(block),
  createdAt: block.created_at || new Date().toISOString()
};
```

### 3. 错误处理

- 所有错误都会被记录到控制台
- 用户友好的错误消息
- 优雅降级（即使技能检索失败，其他功能仍可正常使用）

## 配置要求

### 必需的环境变量

- `ACONTEXT_API_KEY`：Acontext API 密钥
- `ACONTEXT_BASE_URL`：Acontext API 基础 URL（可选，有默认值）

### 数据库要求

- `user_acontext_spaces` 表必须存在
- 用户必须已认证（Supabase Auth）

## 优势与价值

### 1. 知识积累
- Agent 可以从每次成功任务中学习
- 避免重复"发明轮子"
- 建立可重用的知识库

### 2. 效率提升
- 快速找到相关经验
- 减少重复工作
- 提高任务完成质量

### 3. 个性化
- 每个用户有独立的技能库
- 适应不同用户的工作习惯
- 持续改进和优化

### 4. 可观测性
- 技能列表可视化
- 创建时间追踪
- 便于管理和审查

## 未来改进方向

1. **技能管理界面**：允许用户手动编辑、删除技能
2. **技能分类**：按类别组织技能（如"代码生成"、"文档编写"等）
3. **技能评分**：根据使用频率和成功率对技能排序
4. **技能分享**：允许在用户间共享技能
5. **技能版本控制**：追踪技能的演进历史

## 相关文件清单

- `lib/acontext-experience-search-tool.ts` - Experience Search 工具实现
- `lib/acontext-integration.ts` - Skills 搜索集成函数
- `app/api/acontext/skills/route.ts` - Skills API 端点
- `components/acontext-skills-card.tsx` - Skills UI 组件
- `lib/acontext-todo-tool.ts` - Todo 工具（自动添加技能搜索任务）
- `lib/acontext-client.ts` - Acontext 客户端封装

## 总结

Skills 功能是 Acontext PPT Girl 项目的核心创新之一，它实现了 AI Agent 的"记忆"和"学习"能力。通过将成功的任务流程保存为可重用的技能，Agent 能够：

- **积累经验**：从每次任务中学习
- **提高效率**：快速找到并应用相关技能
- **持续改进**：随着使用时间增长，技能库越来越丰富
- **个性化服务**：每个用户都有专属的知识库

这个功能体现了"Main Agent + Tools"架构的优势，通过工具化的方式实现了 Agent 的长期记忆能力，是构建智能、可成长的 AI 助手的关键组件。

