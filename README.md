# Reading · TXT 阅读编辑器

> 一个**本地运行、无需后端**的中文 TXT 小说阅读器：自动识别编码、自动分章、沉浸式排版，并支持**边读边改、直接保存回原文件**。
>
> Local-first Chinese TXT novel reader with chapter outline, comfortable typography, and built-in editing that saves back to the original file.

## ✨ 特性

- **自动识别编码**：UTF-8 / GBK / GB18030 / Big5 / UTF-16；中文 TXT 不再乱码，可手动切换编码重新解码。
- **自动分章**：按「第X章 / 第X回 / 卷 / 集 / 序章 / 番外 / Chapter N」等规则生成左侧目录，可搜索章节。
- **舒适排版**：可调字号、行距、页宽；日间 / 护眼 / 夜间三种主题；正文首行缩进，接近纸质书阅读体验。
- **边读边改**：点「✎ 编辑」即可直接修改任意段落，改完点「✓ 完成」。
- **保存回原文件**：通过浏览器 File System Access API，直接把修改写回你打开的那个 `.txt`（保持原编码，支持 GBK）。
- **阅读进度记忆**：按文件名自动记住上次读到的章节与滚动位置。
- **大文件友好**：只渲染当前章节，十几 MB、上千章的小说也能流畅打开。
- **纯本地、隐私安全**：文件在浏览器本地读取/解码，不上传任何服务器；无广告、无账号。

## 🚀 使用

### 方式一：本地服务器（推荐，可“直接写回原文件”）

1. 安装 [Python](https://www.python.org/)（Windows 安装时勾选 “Add to PATH”）。
2. 双击 **`start.bat`**，会自动在浏览器打开 `http://localhost:8137/index.html`。
3. 点「打开文件」选择你的 `.txt`，或直接把 txt 拖进窗口。

> 说明：浏览器只有在 **安全上下文（https 或 localhost）** 下才允许网页把修改**写回本地文件**，所以推荐用 `start.bat` 启动。

### 方式二：直接双击 `index.html`

无需 Python 也能用，但浏览器会以“只读打开 + 另存下载”方式工作：可以正常阅读和编辑，保存时会**下载一份副本**，而不是覆盖原文件。

### 方式三：部署到 GitHub Pages（在线使用，也能写回）

这是一个纯静态站点，可直接部署到 GitHub Pages：

1. 仓库 **Settings → Pages**，Source 选 `Deploy from a branch`，分支选 `main`、目录选 `/ (root)`，保存。
2. 稍等片刻，访问 `https://<你的用户名>.github.io/Reading/`。
3. 由于 GitHub Pages 是 **https 安全上下文**，在 Chrome/Edge 中同样支持“**打开本地 txt → 编辑 → 直接保存回原文件**”。

> 注意：网页版只在你的浏览器本地处理文件，不会上传小说内容；但仓库里建议**不要提交有版权的小说 txt**，只放代码即可。

## 🔗 仓库

- GitHub：<https://github.com/yong997/Reading>


## 🗂 目录结构

```
Reading/
├─ index.html          页面结构
├─ css/
│  └─ style.css        主题与排版样式
├─ js/
│  ├─ app.js           核心逻辑（解码/分章/渲染/编辑/保存）
│  └─ gbk-encode.js    GBK 编码表（构建时由 Python 生成，供保存 GBK 使用）
├─ server.js           Node 备用静态服务器（无 Python 时使用）
├─ start.bat           Windows 一键启动本地服务器
└─ README.md
```

## ⚠️ 说明与建议

- 首次保存前，建议先手动备份原 txt（或用「另存副本」导出）。
- 浏览器只能“编码”UTF-8；本项目通过内置的 GBK 编码表实现了 **GBK 写回**，若个别生僻字无法用 GBK 表示，会提示并替换为 `?`（建议保存为 UTF-8）。
- 编辑以“段落”为单位：空白行分隔段落，段落内的换行会保留。
- 建议使用 **Chrome / Edge**（对 File System Access API 与 `contenteditable="plaintext-only"` 支持最好）。

## 🧭 Roadmap

- [ ] 全书查找 / 替换（含正则）
- [ ] 常见 OCR 错别字一键校对
- [ ] 自定义阅读字体
- [ ] 书签与批注

## 📄 License

MIT
