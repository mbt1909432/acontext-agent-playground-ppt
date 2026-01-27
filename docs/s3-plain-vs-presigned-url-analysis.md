# Chatbot 图片链接：Plain S3 URL vs 预签名 URL 分析

## 现象

- **Chatbot 输出的链接**：纯 S3 对象 URL，无查询参数  
  `https://s3.us-east-2.amazonaws.com/acontext-assets/disks/.../2026/01/27/xxx.jpg`
- **实际可访问的链接**：带 AWS 签名查询参数的预签名 URL（Presigned URL）  
  `https://s3.us-east-2.amazonaws.com/.../xxx.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...&X-Amz-Date=...&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&x-id=GetObject&X-Amz-Signature=...`

直接打开前者会 403，后者在有效期内可正常访问。

---

## 数据流（链接从哪里来）

1. **生成图片**：用户触发生成 → 调用 `image_generate` 工具 → 图片上传到 Acontext Disk。
2. **获取 URL**：`image_generate` 在上传后调用 **Acontext `disks.artifacts.get`**，并传 `withPublicUrl: true`。
3. **API 返回**：Acontext 返回 `result.public_url`。本应用**直接使用该值**，不做任何改写或本地预签名。
4. **交给模型**：工具结果 `{ artifactPath, publicUrl, text, message }` 原样作为 tool result 传给 LLM。
5. **系统提示词**：要求助手在回复中使用 “Image link (publicUrl if present; otherwise artifactPath)”。
6. **Chatbot 输出**：模型在 Markdown 里写 `[点击欣赏第一张](url)`，其中的 `url` 即上一步的 `publicUrl`（或没有时的 `artifactPath`）。

因此，**chatbot 里展示的链接完全来源于 Acontext API 的 `public_url`**。

---

## 根本原因

**Acontext 的 `disks.artifacts.get` 在 `withPublicUrl: true` 时，返回的 `public_url` 是「纯 S3 对象 URL」**，而不是「带 X-Amz-* 的预签名 URL」。

- **Plain URL**：仅 `https://...amazonaws.com/bucket/key`，稳定、不过期，但对 **private bucket** 无权限，直接访问会 403。
- **Presigned URL**：同一 base URL + `?X-Amz-Algorithm=...&X-Amz-Signature=...&X-Amz-Expires=3600` 等。  
  由服务端用 AWS 凭据对请求做签名，在 `X-Amz-Expires` 秒内可无需额外认证访问。

`acontext-assets` 为 **private**，因此：
- 用 plain URL → 403；
- 用 presigned URL → 在有效期内可访问。

本应用侧没有 S3 凭据、也没有自己做 `getSignedUrl`，只是透传 Acontext 的 `public_url`，所以**为何是 plain 而非 presigned，取决于 Acontext 后端实现**。

---

## 相关代码位置

| 环节 | 位置 | 说明 |
|------|------|------|
| 调 `artifacts.get` 取 `public_url` | `lib/acontext-image-generate-tool.ts` 446–455 行 | `withPublicUrl: true`，使用 `result.public_url` |
| 工具结果包含 `publicUrl` | 同上 476–484 行 | 返回 `{ artifactPath, publicUrl, ... }` |
| 透传 `public_url` | `app/api/acontext/artifacts/content/route.ts` | `metaOnly` 时 `artifacts.get`，返回 `publicUrl: artifactsGetResult.public_url` |
| 使用 `public_url` 拉内容 | `lib/acontext-integration.ts` 1151–1158 行 | `getAcontextArtifactContent` 里 `fetch(result.public_url)` |

---

## 为何需要第二个链接（预签名）

- 第一个链接（plain）：**标识**对象，可存储、可展示，但**不能直接用来在浏览器中打开/下载**（private bucket）。
- 第二个链接（presigned）：**临时可访问**的下载链接，带签名、有时效（如 3600 秒），适合「立即点击查看/下载」。

因此要在 UI 里让用户「点开即能看到图」，就必须使用预签名 URL；仅给 plain URL 会 403。

---

## 可行的解决方向

1. **Acontext 后端调整（治本）**  
   - 让 `disks.artifacts.get` 在 `withPublicUrl: true` 时返回 **presigned URL** 而不是 plain URL；  
   - 或新增字段，例如 `presigned_url` / `download_url`，专门用于短期访问。  
   本应用只需继续用 `public_url`（或新字段），chatbot 输出的链接即可直接访问。

2. **本应用侧不直接暴露 S3，走代理**  
   - 不把 S3（无论 plain 还是 presigned）直接给前端；  
   - Chatbot 输出改为类似 `/api/acontext/artifacts/content?filePath=...&diskId=...` 的链接；  
   - 后端用现有 `getAcontextArtifactContent` 拉内容（若 Acontext 内部用 presigned 拉 S3），再转发给前端。  
   这样链接永远指向自家 API，不暴露 S3；但需要改提示词/工具结果中「图片链接」的形态。

3. **本应用自己做预签名（仅当有 S3 凭据时）**  
   - 若我们有 bucket 名、key、以及 AWS 凭据，可以在后端对 `public_url` 解析出 key，再调用 `getSignedUrl` 生成 presigned URL；  
   - 当前实现**没有**这一步，且依赖 Acontext 管理存储，通常不直接握有 S3 凭据，因此仅作可选方向。

---

## 小结

- Chatbot 输出的图片链接 **来自 Acontext `disks.artifacts.get` 的 `public_url`**，本应用未改写、未预签名。
- 当前 `public_url` 为 **plain S3 URL**，对 private bucket 会 403；**可访问的是带 X-Amz-* 的 presigned URL**。
- 要从根本上让 chat 中的链接「点开即能看」，需要 **Acontext 在 `withPublicUrl: true` 时提供预签名 URL**，或通过代理/自有 API 提供可访问的下载链接。
