#!/bin/sh
set -eu
TOKEN="${FARMTG_CAPTCHA_TOKEN:-$1}"
if [ -z "$TOKEN" ]; then
  echo "usage: $0 <captcha_token>" >&2
  echo "or set FARMTG_CAPTCHA_TOKEN before running." >&2
  exit 2
fi
printf "%s" "$TOKEN" > /opt/farmtg/.farmtg_captcha_token
chmod 600 /opt/farmtg/.farmtg_captcha_token
rm -f /opt/farmtg/.challenge_state.json /opt/farmtg/.farmtg_human_pass
pm2 restart farmtg --update-env
sleep 4
echo "--- farmtg recent log ---"
tail -n 120 /root/.pm2/logs/farmtg-out.log