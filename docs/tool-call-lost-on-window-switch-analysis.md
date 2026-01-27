# Tool Call 信息切换窗口丢失 - 原因分析与修复

## 现象

切换窗口（或切换会话、刷新页面、导航离开再回来）后，chatbot 中曾经展示的 **tool call 信息**（如 `image_generate`、`browser_use_task` 的参数、步骤、结果等）丢失，只保留助手回复的纯文本。

---

## 数据流梳理

### 1. 发送消息与流式响应

- 用户发送消息 → 调用 `/api/chatbot`（或 `/api/chatbot-public`）→ 服务端 `chatCompletionStream`。
- 流式事件包括：`message`、`tool_call_start`、`tool_call_step`、`tool_call_complete`、`tool_call_error`、`final_message`。
- 前端通过 SSE 消费这些事件，更新 React state 中的 `messages`：在占位 assistant 消息上不断追加 `toolCalls`（以及 `steps`），最终在 `final_message` 时固定 `toolCalls` 并完成打字机效果。

### 2. 持久化到 Acontext

- 在 `final_message` 时，服务端调用 `storeMessageInAcontext(acontextSessionId, "assistant", event.message)`。
- **仅存储了 `event.message`（助手最终文本）**，**没有存储 `event.toolCalls`**。
- `storeMessageInAcontext` 的 message blob 仅为 `{ role, content }`，没有 `tool_calls` 字段。

### 3. 重新加载消息（切换会话 / 刷新 / 导航回来）

- 切换会话：`handleLoadSessionMessages(targetSessionId)` → `GET /api/chat-sessions/:id/messages` → `loadMessages` → `loadMessagesFromAcontext`。
- 刷新或从其他页返回并重新挂载 `ChatbotPanel` 且带 `initialSessionId` 时，同样会触发 `handleLoadSessionMessages`，即从 API 拉取消息。
- API 的 messages 来自 **Acontext** `sessions.getMessages`。  
- `loadMessagesFromAcontext` 将 Acontext 返回的每条消息映射为 `ChatMessage`，其中：  
  `toolCalls: (msg.tool_calls as ToolInvocation[] | undefined) || undefined`。  
- 因为存的时候**从未写入 `tool_calls`**，所以 `msg.tool_calls` 始终不存在，加载后的 assistant 消息的 `toolCalls` 恒为 `undefined`，UI 上就不显示任何 tool call 信息。

### 4. 小结

- **Tool call 数据只存在于前端 React state**：来自本次会话的 SSE 流式更新。
- **Acontext 里只存了 `role` + `content`**，没有存 `tool_calls`。
- 一旦发生**重新拉取消息**（切换会话、切换窗口后刷新、导航离开再回来等），消息来源变为 Acontext，**没有 tool_calls** → 前端展示的 tool call 信息全部丢失。

---

## 相关代码位置

| 环节 | 位置 | 说明 |
|------|------|------|
| 存 assistant 消息 | `app/api/chatbot/route.ts` 512–519 行 | `storeMessageInAcontext(..., "assistant", event.message)`，未传 `toolCalls` |
| 存 assistant 消息（public） | `app/api/chatbot-public/route.ts` 461–466、555–560 行 | 同上 |
| 存储实现 | `lib/acontext-integration.ts` `storeMessageInAcontext` | blob 仅 `{ role, content }`，无 `tool_calls` |
| 加载消息 | `lib/acontext-integration.ts` `loadMessagesFromAcontext` | 从 `msg.tool_calls` 映射 `toolCalls`，若未存则恒为 `undefined` |
| 加载入口 | `lib/chat-session.ts` `loadMessages` | 调用 `loadMessagesFromAcontext`，可能带 `editStrategies` |
| 前端拉取 | `components/chatbot-panel.tsx` `handleLoadSessionMessages` | `GET /api/chat-sessions/:id/messages` → `setMessages(data.messages)` |
| Tool call 展示 | `components/chatbot-panel.tsx` `ToolCallsDisplay` | 依赖 `message.toolCalls`，无则占位也不显示 |

---

## Edit strategies 的次要影响

- `determineEditStrategies` 可能启用 `remove_tool_result`、`remove_tool_call_params` 等，在 **加载** 时对 Acontext 返回的消息做编辑（如裁剪旧的 tool result、保留最近 N 个 tool call）。
- 这些策略**只影响「已存在于 Acontext 中的」数据**。当前我们**根本没存 `tool_calls`**，因此策略再强也不会「删掉」tool call 展示——**根本没有任何可删的**。
- 修复「存储 tool_calls」之后，若未来策略过于激进（例如 `keep_recent_n_tool_calls` 过小），可能只保留最近若干条 tool call；那是后续调优问题，与本次「切换窗口丢失」根因无关。

---

## Acontext 包与 API

- 本应用使用 `@acontext/acontext` SDK：`sessions.storeMessage`、`sessions.getMessages`。
- `loadMessagesFromAcontext` 已按 `msg.tool_calls` 映射，说明 **getMessages 返回结构中支持 `tool_calls`**（至少本应用这样使用）。
- 因此，**只要我们在 store 时把 `tool_calls` 放进 message blob**，并保证格式与加载时期望一致（如 `ToolInvocation[]`），持久化与回放即可恢复 tool call 信息。  
- SDK 源码未在本地展开（仅 `dist` 等），具体 API 契约以 [Acontext 文档](https://docs.acontext.io/) 为准；若实践发现格式有差，再对应调整存储形状。

---

## 修复方案

1. **扩展 `storeMessageInAcontext`**  
   - 为 **assistant** 消息增加可选参数 `toolCalls?: ToolInvocation[]`。  
   - 当 `role === "assistant"` 且 `toolCalls` 存在且非空时，在 message blob 中加入 `tool_calls: toolCalls`，再调用 `sessions.storeMessage`。  
   - 序列化时保持与现有 `ToolInvocation` 一致（如 `invokedAt` 可为 `Date | string`，JSON 序列化 OK 即可）。

2. **修改 chatbot / chatbot-public 的存储调用**  
   - **流式**：在 `final_message` 分支里，由 `storeMessageInAcontext(..., "assistant", event.message)` 改为同时传入 `event.toolCalls`（若存在）。  
   - **非流式**：在存储 assistant 回复时，同样传入 `completion.toolCalls`（若存在）。

3. **不改变加载逻辑**  
   - `loadMessagesFromAcontext` 已从 `msg.tool_calls` 映射 `toolCalls`，无需修改。  
   - 存储并回写 `tool_calls` 后，切换会话 / 刷新 / 再进入页面时，从 Acontext 拉取的消息即带 `toolCalls`，`ToolCallsDisplay` 可正常展示。

4. **可选后续**  
   - 若 Acontext 对 `tool_calls` 体积或条数有限制，可考虑只存 `id`、`name`、`arguments`、`result`/`error`、`invokedAt` 等展示所需字段，或对 `steps` 做截断；目前先按现有 `ToolInvocation` 全量存储，以修复丢失问题为首要目标。

---

## 小结

- **根因**：assistant 消息持久化时只存了 `content`，未存 `tool_calls`；重新加载消息时仅能从 Acontext 读回 `content`，tool call 信息缺失。  
- **触发场景**：任何会**重新请求** `GET /api/chat-sessions/:id/messages` 并 `setMessages` 的操作（如切换会话、切换窗口后刷新、路由离开再回来）。  
- **修复**：在存储 assistant 消息时一并写入 `tool_calls`，并在流式 / 非流式两条路径都传入 `toolCalls`；加载逻辑已支持，无需改动。

---

## 已实施的修复（代码变更）

- **`lib/acontext-integration.ts`**：`storeMessageInAcontext` 增加可选参数 `toolCalls?: ToolInvocation[]`；当 `role === "assistant"` 且 `toolCalls` 非空时，将 `tool_calls` 写入 message blob。
- **`app/api/chatbot/route.ts`**：流式 `final_message` 与非流式完成处，存储 assistant 消息时传入 `event.toolCalls` / `completion.toolCalls`。
- **`app/api/chatbot-public/route.ts`**：同上。

修复后，新产生的 assistant 消息会带 `tool_calls` 持久化；切换会话或刷新再加载时，`loadMessagesFromAcontext` 可读回 `toolCalls`，`ToolCallsDisplay` 正常展示。**此前已存在的会话**在修复前没有存过 `tool_calls`，历史消息的 tool call 仍无法恢复；仅对新消息生效。
