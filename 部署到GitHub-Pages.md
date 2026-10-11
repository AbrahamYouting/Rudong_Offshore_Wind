# 把网站发布到 GitHub Pages

发布后的网址形式：`https://<你的用户名>.github.io/<仓库名>/`
例如用户名叫 `zhangsan`、仓库名叫 `rudong-offshore-wind`，网址就是
`https://zhangsan.github.io/rudong-offshore-wind/`。

站点只用相对路径、没有构建步骤，所以放在子目录里也能正常打开。

---

## 发布前你需要知道的三件事

1. 这个仓库目前**还没有任何提交**（`git log` 为空），也**没有配置 git 身份**，这是推送前必须补的一步。
2. 免费版 GitHub Pages 需要**公开仓库**（public）。
3. 仓库里已经放好了自动化发布配置：`.github/workflows/pages.yml`。你只要推送代码，GitHub 会自动把 `site/` 目录发布上线（自动排除 `tests/` 和 `screenshots/`）。

---

## 路线 A：用 GitHub Desktop（推荐，最省事）

1. 下载安装 [GitHub Desktop](https://desktop.github.com/)，用 GitHub 账号登录。
2. 菜单 `File → Add local repository…`，选择本文件夹
   `D:\ASEUstudy\大二上\习概课程设计\如东海上风电宣传项目·习概课程设计`
   （**注意要选到含 `.git` 的这一层**：`.git` 就在这个文件夹里，不要再往上选父目录
   `…\习概课程设计`，那里没有 `.git`，GitHub Desktop 会提示"not a Git repository"）。
3. 首次会要求填写姓名与邮箱（会写进提交记录），填你自己的即可。
4. 左下角填写提交信息，例如 `如东 800MW 海上风电互动网站`，点 **Commit to master**。
5. 点上方 **Publish repository**，仓库名建议 `rudong-offshore-wind`，
   **取消勾选 "Keep this code private"**（Pages 免费版需要公开），然后发布。
6. 打开网页版仓库 → `Settings` → 左侧 `Pages` → **Source 选 `GitHub Actions`** → 保存。
7. 仓库 `Actions` 标签页会跑一次 `部署到 GitHub Pages`，约 1 分钟变绿，网址出现在
   `Settings → Pages` 顶部和 `deploy` 步骤的输出里。

以后每次改完站点，GitHub Desktop 提交并 push 一次，线上会在 1 分钟内自动更新。

---

## 路线 B：用命令行

**最省事的做法**：不要手敲命令，直接在本项目文件夹里右键 → 在终端中打开（或在 PowerShell 里 `cd` 到项目目录），运行：

```powershell
.\发布到GitHub.ps1 -Check                                            # 只体检，什么都不改
.\发布到GitHub.ps1 -RepoUrl https://github.com/用户名/仓库名.git      # 正式发布
```

脚本会依次询问（只需一次）：提交用的名字与邮箱、仓库地址；然后自动完成提交、把分支改名为 `main`、推送。它不会删除文件，也不会改你的全局 git 配置（身份只写进本仓库）。
推送时会要求输入密码，**密码位置要填 Personal Access Token**（不是账号密码）。

> 注意：`发布到GitHub.ps1` 存为 UTF-8 with BOM，如果要用记事本另存，请保持该编码，否则 Windows PowerShell 读中文会乱码。

### 手工命令（不跑脚本时）

先配置身份（只需一次，把名字与邮箱换成你自己的）：

```powershell
git config --global user.name "你的名字"
git config --global user.email "你的邮箱@example.com"
```

然后在项目根目录执行：

```powershell
git add -A
git commit -m "如东 800MW 海上风电互动网站：站点、测试与设计文档"
git branch -M main
git remote add origin https://github.com/<你的用户名>/rudong-offshore-wind.git
git push -u origin main
```

>`git push` 会要求输入用户名与密码，**密码位置要填 Personal Access Token**
>（GitHub → Settings → Developer settings → Personal access tokens → Fine-grained token，
>勾选该仓库的 `Contents: Read and write`）。没有 token 的话，路线 A 或 C 更省事。

推送完成后，同样去 `Settings → Pages → Source: GitHub Actions` 启用一次。

---

## 路线 C：完全不装 git（网页上传）

适合只想先上线、暂时不折腾命令行的情况。

1. 在 GitHub 网页上 `New repository`：名字 `rudong-offshore-wind`，选 **Public**，不要勾 Add README，创建。
2. 解压项目根目录里的 `如东海上风电网站-部署包.zip`（里面是站点本体，`index.html` 在最外层）。
3. 在仓库页面点 `Add file → Upload files`，把解压出来的
   `index.html`、`assets/`、`vendor/`、`README.md` 一起拖进去，提交。
4. `Settings → Pages` → **Source 选 `Deploy from a branch`** →
   Branch 选 `main`，Folder 选 `/ (root)` → 保存。
5. 等 1 分钟，访问 `https://<你的用户名>.github.io/rudong-offshore-wind/`。

注意：这条路线不会发布 `_site/tests`、`screenshots`，也不含自动发布配置；
以后更新站点需要重新上传对应文件。若之后想改成自动发布，把
`.github/workflows/pages.yml` 也上传到仓库，再把 Source 切成 `GitHub Actions` 即可。

---

## 上线后检查清单

- [ ] 打开网址能看到序章（海面上的 200 台风机剪影会动）
- [ ] 手机上打开，折叠菜单能展开收起
- [ ] 拖动时间轴、点风机部件、播放送电都正常
- [ ] `https://<用户名>.github.io/<仓库名>/assets/data.js` 能打开（说明资源都发布了）
- [ ] 网址是 https 的（GitHub Pages 自动签发证书，首次可能要等几分钟）

## 常见问题

| 现象 | 原因与处理 |
| --- | --- |
| Actions 里报 `Get Pages site failed` | 还没在 `Settings → Pages` 里把 Source 设为 `GitHub Actions` |
| 网址打开是 404 | 仓库不是公开的，或 Pages 还没构建完（等 1–2 分钟再刷新） |
| 页面打开但样式全丢 | 上传时目录层级错了，`assets/` 必须与 `index.html` 同级 |
| 部署成功但内容没更新 | 浏览器缓存，强制刷新（Ctrl+F5）；或 Actions 还在跑 |
| 国内访问慢 | GitHub Pages 服务器在境外，这是正常现象；课堂演示建议用本地 `index.html` |

## 关于自定义域名（可选）

想用 `rudong-wind.cn` 这类自己的域名时：在 `Settings → Pages → Custom domain`
填写域名，然后到域名服务商添加 DNS 记录（`CNAME` 指向 `<用户名>.github.io`），
勾选 `Enforce HTTPS`。域名本身一年几十元。
**注意**：GitHub Pages 服务器在境外，因此**不需要 ICP 备案**；但如果你想用国内服务器，
那就必须备案（约 2–3 周）。课程作业阶段，免费子域名完全够用。
