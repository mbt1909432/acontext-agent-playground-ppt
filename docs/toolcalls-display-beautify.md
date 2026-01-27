# ToolCallsDisplay 美化拆解

> 只改 className 与少量结构，逻辑不变。  
> 文件：`components/chatbot-panel.tsx`，`ToolCallsDisplay`（约 L552–763）。

---

## 一、全页模式 (isFullPage) — 折叠条

### 1. 外层容器 `div.mt-3.space-y-2.border-t...`

| 位置 | 当前 | 改为 |
|------|------|------|
| 类名 | `mt-3 space-y-2 border-t border-border pt-3` | `mt-3 space-y-2 border-t border-border pt-3`（不变） |

### 2. 折叠按钮 `button`（“Tools Invoked: N” 那一行）

| 位置 | 当前 | 改为 |
|------|------|------|
| 类名 | `flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2 transition-colors hover:bg-accent` | `flex w-full items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 transition-all duration-200 hover:border-primary/40 hover:bg-primary/10 hover:shadow-sm` |
| 说明 | 圆角与卡片一致；轻 primary 边框与背景；hover 时边框、背景、阴影略加强。 | |

### 3. 左侧：图标 + 文案 的容器

| 位置 | 当前 | 改为 |
|------|------|------|
| 类名 | `flex items-center gap-2` | `flex items-center gap-2.5` |

### 4. Wrench 图标

| 位置 | 当前 | 改为 |
|------|------|------|
| 类名 | `h-3.5 w-3.5 text-primary` | `h-4 w-4 text-primary flex-shrink-0 rounded-full bg-primary/10 p-1` |
| 说明 | 略放大；加圆形浅 primary 背景，更易识别为「工具」。 | |

### 5. 文案 “Tools Invoked: N”

| 位置 | 当前 | 改为 |
|------|------|------|
| 类名 | `text-xs text-muted-foreground` | `text-xs font-medium text-foreground`；数字部分单独包一层：`<span className="text-primary font-semibold">{toolCalls.length}</span>` |
| 结构 | `<span className="...">Tools Invoked: {toolCalls.length}</span>` | `<span className="...">Tools Invoked: <span className="text-primary font-semibold">{toolCalls.length}</span></span>` |

### 6. 箭头（ChevronUp / ChevronDown）

| 位置 | 当前 | 改为 |
|------|------|------|
| 结构 | `{expanded ? <ChevronUp ... /> : <ChevronDown ... />}` | 只保留 `<ChevronDown>`, 加类名 `transition-transform duration-200`，并在**父 button 或包一层 div** 上给箭头加：`className={expanded ? "rotate-180" : ""}` |
| 箭头类名 | `h-3.5 w-3.5 text-muted-foreground` | `h-4 w-4 text-muted-foreground transition-transform duration-200`；展开时 `rotate-180` |
| 说明 | 用旋转替代 up/down 切换，动效更顺。 | |

---

## 二、全页模式 — 展开区域

### 7. 展开内容的外层 `div.space-y-3`

| 位置 | 当前 | 改为 |
|------|------|------|
| 类名 | `space-y-3` | `space-y-3 pt-1 animate-fade-in` |
| 说明 | 使用项目已有的 `animate-fade-in`，展开时有淡入。 | |

### 8. 每个 Tool 的 `Card`

| 位置 | 当前 | 改为 |
|------|------|------|
| 组件 | `<Card>` | 继续用 `<Card>`，覆盖类名：`className="rounded-lg border border-border/80 bg-card shadow-sm"`，覆盖默认 `rounded-xl`、`shadow`，使更轻、与上方条衔接。 |

### 9. `CardContent`

| 位置 | 当前 | 改为 |
|------|------|------|
| 类名 | `pt-4 space-y-2` | `p-4 space-y-2.5`（或 `pt-3 px-4 pb-4 space-y-2.5`），与 `Card` 的 `p-6 pt-0` 通过 className 覆盖。 |

### 10. 工具名行（Tool Name + Error）

| 位置 | 当前 | 改为 |
|------|------|------|
| 容器 | `div.flex.items-center.gap-2` | `div.flex items-center gap-2 border-l-2 border-primary pl-2.5` |
| 工具名 | `text-xs font-mono text-primary` | `text-sm font-mono font-medium text-primary` |
| Error | `ml-auto text-xs text-destructive` | `ml-auto text-xs font-medium text-destructive`（可再加 `px-1.5 py-0.5 rounded bg-destructive/10` 做成小 badge，可选） |

### 11. Parameters 块

| 位置 | 当前 | 改为 |
|------|------|------|
| 容器 | `rounded border bg-muted/50 p-2` | `rounded-lg border border-border/80 bg-muted/30 p-2.5` |
| 标题 | `mb-1 text-xs text-muted-foreground` | `mb-1.5 text-xs font-medium text-muted-foreground` |
| pre | `text-xs font-mono overflow-x-auto break-words whitespace-pre-wrap` | 不变 |

### 12. Steps 块（`toolCall.steps`）

| 位置 | 当前 | 改为 |
|------|------|------|
| 容器 | `rounded border bg-muted/50 p-2` | `rounded-lg border border-border/80 bg-muted/30 p-2.5` |
| 标题 | `mb-2 text-xs text-muted-foreground` | `mb-1.5 text-xs font-medium text-muted-foreground` |
| 每个 Step 的容器 | `rounded border bg-background/50 p-2` | `rounded-md border border-border/60 bg-background/50 p-2` |
| Step 标题 | `mb-1 text-xs text-muted-foreground` | `mb-1 text-[11px] font-medium text-muted-foreground` |
| Step 的 pre | 不变 | 不变 |

### 13. 单步 Fallback（`toolCall.step`）

| 位置 | 当前 | 改为 |
|------|------|------|
| 容器 | `rounded border bg-muted/50 p-2` | `rounded-lg border border-border/80 bg-muted/30 p-2.5` |
| 标题、pre | 不变 | 不变 |

### 14. Tool Result 块（成功）

| 位置 | 当前 | 改为 |
|------|------|------|
| 容器 | `rounded border bg-muted/50 p-2` | `rounded-lg border border-border/80 bg-muted/30 p-2.5` |
| 标题、pre | 不变 | 不变 |

### 15. Tool Error 块、Result: null 块

| 位置 | 当前 | 改为 |
|------|------|------|
| 容器 | 已用 `border-destructive/50 bg-destructive/10` 或 `border-yellow-500/50 bg-yellow-500/10` | 加 `rounded-lg`，其余保持。 |

### 16. Invocation Time

| 位置 | 当前 | 改为 |
|------|------|------|
| 容器 | `text-right` | `text-right pt-1` |
| 文案 | `text-xs text-muted-foreground` | 不变 |

---

## 三、紧凑模式（浮动窗）— 折叠条

### 17. 外层 `div.mt-2.space-y-2...`

| 位置 | 当前 | 改为 |
|------|------|------|
| 类名 | `mt-2 space-y-2 border-t border-border pt-2` | 不变 |

### 18. 折叠按钮

| 位置 | 当前 | 改为 |
|------|------|------|
| 类名 | `flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors` | `flex w-full items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 text-xs font-medium text-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary/10` |
| 文案 | `Used {toolCalls.length} tool(s)` | 数字加重：`Used <span className="text-primary font-semibold">{toolCalls.length}</span> tool(s)` |
| 箭头 | `{expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}` | 只保留 `ChevronDown`，加 `className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}` |

---

## 四、紧凑模式 — 展开区域

### 19. 展开外层

| 位置 | 当前 | 改为 |
|------|------|------|
| 类名 | `space-y-2 text-xs` | `space-y-2 pt-1 text-xs animate-fade-in` |

### 20. 每个 Tool 的块（紧凑模式下不用 Card）

| 位置 | 当前 | 改为 |
|------|------|------|
| 容器 | `rounded border bg-muted/50 p-2 space-y-1` | `rounded-lg border border-border/80 bg-card p-2.5 space-y-1.5 shadow-sm` |
| 工具名 | `font-semibold text-primary` | `font-semibold text-primary border-l-2 border-primary pl-2` |
| Parameters 标题 | `text-muted-foreground` | `text-muted-foreground font-medium` |
| Parameters 的 pre | `text-[10px]...` | 不变 |
| Steps 标题 | `text-muted-foreground` | `text-muted-foreground font-medium` |
| 每个 Step 的容器 | `rounded border bg-background/50 p-1.5` | `rounded-md border border-border/60 bg-muted/30 p-1.5` |
| Step 标题 | `text-[9px] text-muted-foreground mb-0.5` | `text-[9px] font-medium text-muted-foreground mb-0.5` |
| Error / Result / null | 在紧凑模式里保持可读即可；Error 可加 `rounded bg-destructive/10 px-1.5`，其余微调圆角、间距与全页一致。 | 按需 |

---

## 五、箭头旋转的写法（推荐）

为减少分支，**全页与紧凑** 都可统一成一只 `ChevronDown` + 旋转：

```tsx
<ChevronDown
  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
    expanded ? "rotate-180" : ""
  }`}
/>
```

- 全页：`h-4 w-4`
- 紧凑：`h-3.5 w-3.5`

---

## 六、实施顺序建议

1. 全页折叠条： 2 → 3 → 4 → 5 → 6（含箭头改为单 ChevronDown + 旋转）
2. 全页展开： 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16
3. 紧凑折叠条： 17 → 18（含箭头）
4. 紧凑展开： 19 → 20

---

## 七、不改动的部分

- `toolCalls.map`、`toolCall.steps.map`、条件渲染（`toolCall.error`、`toolCall.result`、`toolCall.step` 等）全部保持。
- `formatStepContent`、`Card`/`CardContent` 的引用与 children 结构不变，仅通过 `className` 覆盖。
- 不加新 state、不改 `onClick`、不增新组件。

---

## 八、可选（后续）

- 展开内容用 `grid grid-rows-[0fr]` → `grid-rows-[1fr]` + `overflow-hidden` 做高度过渡，需调整 JSX 结构，这里不拆。
- 工具名左侧竖线 `border-l-2 border-primary` 若与某些长名称重叠，可改为 `pl-2` 或仅 `font-medium` 强调。
- 若 `tailwindcss-animate` 的 `animate-in`、`slide-in-from-top-2` 用于展开块，可替换 `animate-fade-in`，按项目习惯二选一即可。
