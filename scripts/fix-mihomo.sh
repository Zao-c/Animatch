#!/bin/bash
set -e
echo "=== Fixing mihomo bind-address ==="
sed -i 's/bind-address: "172.18.0.1"/bind-address: "*"/' /etc/mihomo/config.yaml
grep bind-address /etc/mihomo/config.yaml
echo "=== Restarting mihomo ==="
systemctl restart mihomo
sleep 3
echo "=== Port check ==="
ss -ntlp | grep -E '7890|9090'
echo "=== Proxy test ==="
curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 -x http://127.0.0.1:7890 https://api.bgm.tv
echo ""
echo "done"
