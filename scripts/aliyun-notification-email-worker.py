#!/usr/bin/env python3
"""Deliver queued registration-change emails through a configured SMTP relay."""

import email.message
import html
import json
import os
import smtplib
import subprocess
import sys


def psql(sql: str) -> str:
    result = subprocess.run(
        ["docker", "exec", "-i", "lilly-stage-db", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-Atq"],
        input=sql,
        text=True,
        capture_output=True,
        check=True,
    )
    return result.stdout.strip()


def quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"]
missing = [name for name in required if not os.environ.get(name)]
if missing:
    print("SMTP not configured: " + ",".join(missing))
    sys.exit(0)

claim_sql = """
with candidates as (
  select o.id from public.notification_email_outbox o
  where (o.status='pending' or (o.status='failed' and o.attempts<5))
  order by o.created_at for update skip locked limit 20
), claimed as (
  update public.notification_email_outbox o set status='sending',attempts=o.attempts+1,last_error=null
  where o.id in(select id from candidates)
  returning o.*
)
select coalesce(json_agg(json_build_object(
  'id',c.id,'recipient',u.email,'meeting',m.name,'message',n.message,
  'changes',n.change_details,'createdAt',n.created_at
)),'[]'::json)::text
from claimed c
join public.notifications n on n.id=c.notification_id
join public.meetings m on m.id=c.meeting_id
join auth.users u on u.id=c.recipient_user_id;
"""
items = json.loads(psql(claim_sql) or "[]")
if not items:
    print("No queued email")
    sys.exit(0)

host = os.environ["SMTP_HOST"]
port = int(os.environ.get("SMTP_PORT", "465"))
use_ssl = os.environ.get("SMTP_SSL", "true").lower() in ("1", "true", "yes")
server = smtplib.SMTP_SSL(host, port, timeout=30) if use_ssl else smtplib.SMTP(host, port, timeout=30)
try:
    if not use_ssl and os.environ.get("SMTP_STARTTLS", "true").lower() in ("1", "true", "yes"):
        server.starttls()
    server.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
    for item in items:
        try:
            changes = item.get("changes") or []
            rows = "".join(
                f"<tr><td>{html.escape(str(change.get('label') or change.get('field') or '字段'))}</td>"
                f"<td>{html.escape(str(change.get('before') or '未填写'))}</td>"
                f"<td>{html.escape(str(change.get('after') or '未填写'))}</td></tr>"
                for change in changes
            )
            body = (
                f"<h2>{html.escape(str(item['meeting']))}</h2>"
                f"<p>{html.escape(str(item['message']))}</p>"
                + ("<table border='1' cellpadding='6'><tr><th>字段</th><th>原值</th><th>新值</th></tr>" + rows + "</table>" if rows else "")
            )
            message = email.message.EmailMessage()
            message["Subject"] = f"[礼来会议管理平台] {item['message']}"
            message["From"] = os.environ["SMTP_FROM"]
            message["To"] = item["recipient"]
            message.set_content(str(item["message"]))
            message.add_alternative(body, subtype="html")
            server.send_message(message)
            psql(f"update public.notification_email_outbox set status='sent',sent_at=now(),last_error=null where id={quote(str(item['id']))}::uuid;")
        except Exception as exc:  # keep other recipients moving
            psql(f"update public.notification_email_outbox set status='failed',last_error={quote(str(exc)[:1000])} where id={quote(str(item['id']))}::uuid;")
finally:
    server.quit()

print(f"Processed {len(items)} queued email(s)")
