#!/system/bin/sh
# SmartTV Orbit - Boot Action Script
# Runs upon TV startup (via Termux + Projectivy Autostart)

echo "[Orbit Boot] Startup sequence triggered on $(date)..."

# 1. Start background TV daemon if not running
if ! ps -A 2>/dev/null | grep -q 'tv_agent.sh'; then
    echo "[Orbit Boot] Starting tv_agent daemon..."
    nohup /data/local/tmp/tv_agent.sh > /data/local/tmp/tv_agent.log 2>&1 &
fi

# 2. Wait for internet connection (check for up to 10 seconds)
echo "[Orbit Boot] Checking for internet connectivity..."
CONNECTED=0
i=0
while [ $i -lt 10 ]; do
    if ping -c 1 -w 1 8.8.8.8 > /dev/null 2>&1; then
        CONNECTED=1
        echo "[Orbit Boot] Internet confirmed connected after $i seconds!"
        break
    fi
    sleep 1
    i=$((i + 1))
done

# 3. Action based on connectivity
if [ "$CONNECTED" = "1" ]; then
    echo "[Orbit Boot] Internet active! Launching Paras TV Live stream..."
    am force-stop com.google.android.youtube.tv < /dev/null 2>&1
    sleep 1
    am start -a android.intent.action.VIEW -d "https://www.youtube.com/@parasnetwork/live" -p com.google.android.youtube.tv < /dev/null
else
    echo "[Orbit Boot] Internet NOT connected after 10s. Redirecting gracefully to Home screen..."
    am start -a android.intent.action.MAIN -c android.intent.category.HOME < /dev/null || /system/bin/input keyevent 3 < /dev/null
fi
