#!/usr/bin/env bash
set -Eeuo pipefail

target=/etc/lilly-meetings/mail.env
if [[ $EUID -ne 0 ]]; then echo '请使用 root 运行。' >&2; exit 1; fi

if [[ ${1:-} == --status ]]; then
  if [[ -s $target ]] && [[ $(stat -c '%a' "$target") == 600 ]]; then
    echo 'SMTP配置已安装（内容已隐藏）。'
  else
    echo 'SMTP尚未配置。'
  fi
  exit 0
fi

read -r -p 'SMTP服务器地址：' smtp_host
read -r -p '端口 [465]：' smtp_port
smtp_port=${smtp_port:-465}
read -r -p '连接方式 [ssl/starttls，默认ssl]：' smtp_mode
smtp_mode=${smtp_mode:-ssl}
read -r -p '用户名：' smtp_user
read -r -p '发件人邮箱：' smtp_from
read -r -s -p '密码或授权码（不会显示）：' smtp_pass
echo

[[ $smtp_host =~ ^[A-Za-z0-9.-]+$ ]] || { echo 'SMTP服务器地址格式不正确。' >&2; exit 1; }
[[ $smtp_port =~ ^[0-9]+$ ]] && ((smtp_port>=1 && smtp_port<=65535)) || { echo '端口不正确。' >&2; exit 1; }
[[ $smtp_mode == ssl || $smtp_mode == starttls ]] || { echo '连接方式只能是 ssl 或 starttls。' >&2; exit 1; }
[[ $smtp_user != *$'\n'* && -n $smtp_user && -n $smtp_pass ]] || { echo '用户名和授权码不能为空。' >&2; exit 1; }
[[ $smtp_from =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { echo '发件人邮箱格式不正确。' >&2; exit 1; }

export SMTP_HOST=$smtp_host SMTP_PORT=$smtp_port SMTP_USER=$smtp_user SMTP_PASS=$smtp_pass SMTP_FROM=$smtp_from
if [[ $smtp_mode == ssl ]]; then export SMTP_SSL=true SMTP_STARTTLS=false; else export SMTP_SSL=false SMTP_STARTTLS=true; fi

python3 - <<'PY'
import os, smtplib, ssl
host, port = os.environ['SMTP_HOST'], int(os.environ['SMTP_PORT'])
if os.environ['SMTP_SSL'] == 'true':
    server = smtplib.SMTP_SSL(host, port, timeout=20, context=ssl.create_default_context())
else:
    server = smtplib.SMTP(host, port, timeout=20)
    server.starttls(context=ssl.create_default_context())
try:
    server.login(os.environ['SMTP_USER'], os.environ['SMTP_PASS'])
finally:
    server.quit()
PY

escape_env(){ printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
umask 077
temporary=$(mktemp /etc/lilly-meetings/.mail.env.XXXXXX)
trap 'shred -u "$temporary" 2>/dev/null || true' EXIT
{
  printf 'SMTP_HOST="%s"\n' "$(escape_env "$smtp_host")"
  printf 'SMTP_PORT="%s"\n' "$smtp_port"
  printf 'SMTP_USER="%s"\n' "$(escape_env "$smtp_user")"
  printf 'SMTP_PASS="%s"\n' "$(escape_env "$smtp_pass")"
  printf 'SMTP_FROM="%s"\n' "$(escape_env "$smtp_from")"
  if [[ $smtp_mode == ssl ]]; then printf 'SMTP_SSL="true"\nSMTP_STARTTLS="false"\n'; else printf 'SMTP_SSL="false"\nSMTP_STARTTLS="true"\n'; fi
} >"$temporary"
install -o root -g root -m 0600 "$temporary" "$target"
systemctl start lilly-notification-email.service
echo 'SMTP连接验证成功，配置已加密传输并以0600权限保存；邮件队列工作器已启动。'
