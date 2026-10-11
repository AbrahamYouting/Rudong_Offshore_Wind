<#
  一键把本站推送到 GitHub Pages。

  用法（在项目根目录打开 PowerShell）：
    .\发布到GitHub.ps1 -Check                                  # 只检查环境，不改动任何东西
    .\发布到GitHub.ps1 -RepoUrl https://github.com/你/仓库名.git

  可选参数：
    -Name / -Email   提交记录里的名字与邮箱（不填会在运行时询问）

  脚本只做四件事：配置本仓库的 git 身份、提交、把分支改名为 main、推送到你给的仓库。
  它不会删除任何文件，也不会碰你的全局 git 配置（身份只写进当前仓库）。
#>
[CmdletBinding()]
param(
  [string]$RepoUrl = "",
  [string]$Name = "",
  [string]$Email = "",
  [switch]$Check
)

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

function Say([string]$text, [string]$color = "Cyan") { Write-Host $text -ForegroundColor $color }
function Fail([string]$text) { Write-Host $text -ForegroundColor Red; exit 1 }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail "没有找到 git。请先安装 Git for Windows（https://git-scm.com/download/win），或改用 GitHub Desktop。"
}

Say "项目目录：$root"

function GitOutput([string[]]$arguments) {
  try { return (& git @arguments 2>$null) } catch { return $null }
}

# 1) 身份
$currentName = [string](GitOutput @("config", "--get", "user.name"))
$currentEmail = [string](GitOutput @("config", "--get", "user.email"))
if ([string]::IsNullOrWhiteSpace($currentName) -or [string]::IsNullOrWhiteSpace($currentEmail)) {
  if ($Check) {
    Say "[检查] 本仓库还没有配置 git 身份，正式运行时会提示你输入姓名与邮箱。" "Yellow"
  } else {
    if ([string]::IsNullOrWhiteSpace($Name)) { $Name = Read-Host "提交记录里显示的名字（建议用 GitHub 昵称）" }
    if ([string]::IsNullOrWhiteSpace($Email)) { $Email = Read-Host "提交记录里的邮箱（建议用 GitHub 注册邮箱）" }
    if ([string]::IsNullOrWhiteSpace($Name) -or [string]::IsNullOrWhiteSpace($Email)) { Fail "名字或邮箱为空，已取消。" }
    git config user.name $Name
    git config user.email $Email
    Say "已配置本仓库身份：$Name / $Email"
  }
} else {
  Say "身份已配置：$currentName / $currentEmail"
}

# 2) 远端
$remoteNames = @(GitOutput @("remote"))
$remote = ""
if ($remoteNames -contains "origin") { $remote = [string](GitOutput @("remote", "get-url", "origin")) }
if ([string]::IsNullOrWhiteSpace($remote)) {
  if ([string]::IsNullOrWhiteSpace($RepoUrl)) {
    if ($Check) {
      Say "[检查] 还没有配置 origin，正式运行时会要求你提供仓库地址。" "Yellow"
      $RepoUrl = "（未提供）"
    } else {
      Say "请先在 GitHub 网页上新建一个公开仓库（不要勾选 Add a README），然后回到这里。" "Yellow"
      $RepoUrl = Read-Host "粘贴仓库地址（形如 https://github.com/用户名/仓库名.git）"
      if ([string]::IsNullOrWhiteSpace($RepoUrl)) { Fail "没有提供仓库地址，已取消。" }
    }
  }
} else {
  Say "远端已存在：$remote"
  $RepoUrl = $remote
}

# 3) 提交
$pending = (git status --porcelain | Measure-Object -Line).Lines
Say "待提交的变更：$pending 项"
if ($Check) {
  Say "[检查] 正式运行时会执行：git add -A、git commit、git branch -M main、git push -u origin main" "Yellow"
} else {
  git add -A
  git commit -m "如东 800MW 海上风电互动网站：站点、测试与设计文档" | Out-Null
  if ($LASTEXITCODE -ne 0) { Say "没有新的变更需要提交，继续。" "Yellow" }
  git branch -M main
  if ([string]::IsNullOrWhiteSpace($remote)) { git remote add origin $RepoUrl }
  Say "开始推送，若提示输入密码，请粘贴 Personal Access Token（不是账号密码）。"
  git push -u origin main
  if ($LASTEXITCODE -ne 0) {
    Fail "推送失败。常见原因：仓库地址写错、没有用 token、或没有权限。可改用 GitHub Desktop 发布。"
  }
  Say "推送完成 ✔" "Green"
}

Say ""
Say "最后一步（只需一次）：打开仓库网页 → Settings → Pages → Source 选择 GitHub Actions。"
Say "之后每次推送，网页会在 1 分钟内自动更新。"
Say "网址形如：https://你的用户名.github.io/仓库名/"
