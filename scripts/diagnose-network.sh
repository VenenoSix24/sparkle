#!/usr/bin/env bash
# 掉网现场取证：sparkle 连不通网络时跑一次，把内核/端口/虚拟网卡/系统代理/DNS/出口链路一次抓齐。
# 需要 root 才能看到占用端口的进程（Clash Party 的内核以 root 运行），脚本会自动提示补哪条命令。
# 用法: bash scripts/diagnose-network.sh [混合端口，默认 7890]

set -u
PORT="${1:-7890}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$HOME/Desktop/sparkle-diag-$STAMP.txt"

run() { echo "\$ $*"; eval "$@" 2>&1 | sed 's/^/    /'; echo; }

{
  echo "sparkle 掉网现场取证  $STAMP"
  echo "混合端口: $PORT"
  echo "=============================="

  echo "## 0. 两个客户端各自配置的端口 / 虚拟网卡（同时运行就会互相抢）"
  for file in "$HOME/Library/Application Support/sparkle/mihomo.yaml" "$HOME/Library/Application Support/mihomo-party/work/config.yaml"; do
    [ -f "$file" ] || continue
    echo "    $file"
    awk '/^mixed-port/{print} /^tun:/{f=1; print; next} f&&/^[^ ]/{f=0} f' "$file" | head -8 | sed 's/^/        /'
  done
  echo

  echo; echo "## 1. 内核与 helper 进程（看是否同时跑了两个内核）"
  run "pgrep -fl 'sidecar/mihomo|PrivilegedHelperTools' | cut -c1-160"
  run "ps -eo pid=,user=,etime=,command= | grep -E 'sidecar/mihomo' | grep -v grep | cut -c1-160"

  echo "## 2. 谁占着混合端口（需要 sudo 才能看到 root 内核）"
  run "lsof -nP -iTCP:$PORT -sTCP:LISTEN"
  run "echo '（上面为空不代表没人监听：以 root 运行的内核要 sudo lsof 才看得见）'"
  run "sudo -n lsof -nP -iTCP:$PORT -sTCP:LISTEN 2>/dev/null || echo '（跳过 sudo，手动跑：sudo lsof -nP -iTCP:'$PORT' -sTCP:LISTEN）'"
  if nc -z -G 2 127.0.0.1 "$PORT" 2>/dev/null; then
    echo "    => 127.0.0.1:$PORT 可以建立连接"
  else
    echo "    => 127.0.0.1:$PORT 连不上：没有内核在监听这个端口"
  fi
  echo

  echo "## 3. 内核控制器 API（内核进程活着 ≠ 内核工作正常）"
  live=0
  dead=0
  for sock in /tmp/sparkle-mihomo-api*.sock /tmp/mihomo-party-[0-9]*.sock; do
    [ -S "$sock" ] || continue
    VER="$(curl -s -m 4 --unix-socket "$sock" http://localhost/version 2>/dev/null)"
    if [ -n "$VER" ]; then
      echo "    $sock -> $VER"
      live=$((live + 1))
    else
      dead=$((dead + 1))
    fi
  done
  echo "    响应中的内核 socket: $live，已失效的残留 socket: $dead"
  echo

  echo "## 4. 虚拟网卡与默认路由"
  run "ifconfig | grep -A4 '^utun' | grep -E '^utun|inet '"
  run "netstat -rn -f inet | head -8"

  echo "## 5. 系统代理设置"
  run "scutil --proxy"

  echo "## 6. DNS"
  run "scutil --dns | grep -m6 'nameserver'"
  run "dig +short +time=3 +tries=1 www.apple.com @223.5.5.5"

  echo "## 7. 出口链路（直连 / 走混合端口）"
  run "curl -s -m 8 --noproxy '*' -o /dev/null -w '直连  http_code=%{http_code} time=%{time_total}s\n' https://cp.cloudflare.com/generate_204"
  run "curl -s -m 8 -x http://127.0.0.1:$PORT -o /dev/null -w '代理  http_code=%{http_code} time=%{time_total}s\n' https://cp.cloudflare.com/generate_204"
  run "curl -s -m 8 --noproxy '*' https://api.ip.sb/ip || echo '    （直连取 IP 失败）'"
  run "curl -s -m 8 -x http://127.0.0.1:$PORT https://api.ip.sb/ip || echo '    （走代理取 IP 失败）'"

  echo "## 8. sparkle 内核日志尾部（错误 / 端口 / TUN）"
  LOG="$(ls -t "$HOME/Library/Application Support/sparkle/logs/"core-*.log 2>/dev/null | head -1)"
  if [ -n "$LOG" ]; then
    echo "    $LOG"
    grep -E "level=error|address already in use|TUN|Mixed\(http\+socks\) proxy listening" "$LOG" | tail -20 | sed 's/^/    /'
  else
    echo "    未找到内核日志"
  fi
  echo

  echo "## 9. 判断"
  SIDE="$(pgrep -fl 'sidecar/mihomo' 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$SIDE" -ge 2 ]; then
    echo "    · 同时有 $SIDE 个内核进程：两个客户端（含 Clash Party）默认都用 7890 + TUN，后启动的那个抢不到端口时"
    echo "      内核进程仍然活着、界面仍显示运行中，但实际没有任何代理端口 —— 这就是连不通网的原因。"
  fi
  if ! nc -z -G 2 127.0.0.1 "$PORT" 2>/dev/null; then
    echo "    · 没有内核监听 127.0.0.1:$PORT：内核侧监听已丢失（多见于端口被其它程序抢走 / 启动时绑定失败）。"
  fi
} | tee "$OUT"

echo
echo "报告已保存: $OUT"
