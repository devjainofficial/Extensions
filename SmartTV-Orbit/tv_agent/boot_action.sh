#!/system/bin/sh
# SmartTV Orbit - Boot Action Script
# Runs upon TV startup (via Termux + Projectivy Autostart)
# Option A: Zero-Flicker Wallpaper Boot

# 1. Immediately return to Home Screen wallpaper so Termux is completely hidden from the user!
am start -a android.intent.action.MAIN -c android.intent.category.HOME < /dev/null 2>&1

# 2. Start background TV daemon if not running
if ! ps -A 2>/dev/null | grep -q 'tv_agent.sh'; then
    nohup sh /data/local/tmp/tv_agent.sh > /data/local/tmp/tv_agent.log 2>&1 &
fi

# 3. Always set sound to 20 on startup
echo "[Orbit Boot] Setting default startup volume to 20..."
cmd media_session volume --stream 3 --set 20 < /dev/null 2>&1

# 4. Wait for internet connection (check for up to 10 seconds)
CONNECTED=0
i=0
while [ $i -lt 10 ]; do
    if ping -c 1 -w 1 8.8.8.8 > /dev/null 2>&1; then
        CONNECTED=1
        break
    fi
    sleep 1
    i=$((i + 1))
done

# 5. Action based on connectivity
if [ "$CONNECTED" = "1" ]; then
    # Reinforce volume 20 right as video starts
    cmd media_session volume --stream 3 --set 20 < /dev/null 2>&1
    # Clear any previous YouTube error state and launch Paras TV Live
    /system/bin/am force-stop com.google.android.youtube.tv < /dev/null 2>&1
    sleep 1
    am start -a android.intent.action.VIEW -d "https://www.youtube.com/@parasnetwork/live" -p com.google.android.youtube.tv < /dev/null
else
    # Fallback: ensure Home screen is shown
    am start -a android.intent.action.MAIN -c android.intent.category.HOME < /dev/null 2>&1
fi
