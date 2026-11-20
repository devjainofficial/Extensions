#!/data/data/com.termux/files/usr/bin/sh
# SmartTV Orbit - Boot Action Script
# Runs upon TV startup inside Termux

export PATH="/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"
LOG="/sdcard/boot.log"

echo "=== [Orbit Boot] Started at $(date) ===" > "$LOG"

# Helper to run commands via local ADB with full shell UID (2000)
adb_cmd() {
    adb -s 127.0.0.1:5555 shell "$@"
}

# 1. Connect local ADB loopback
echo "[Orbit Boot] Connecting local ADB loopback..." >> "$LOG"
adb connect 127.0.0.1:5555 >> "$LOG" 2>&1

# Verify ADB connection (retry up to 5 times)
ADB_OK=0
for attempt in 1 2 3 4 5; do
    if adb -s 127.0.0.1:5555 get-state 2>&1 | grep -q "device"; then
        ADB_OK=1
        echo "[Orbit Boot] Local ADB connected successfully (attempt $attempt)" >> "$LOG"
        break
    fi
    sleep 1
    adb connect 127.0.0.1:5555 >> "$LOG" 2>&1
done

# 2. Immediately hide Termux and return to Home wallpaper
if [ "$ADB_OK" = "1" ]; then
    adb_cmd "input keyevent 3" >> "$LOG" 2>&1
else
    am start -a android.intent.action.MAIN -c android.intent.category.HOME < /dev/null >> "$LOG" 2>&1
fi

# 3. Start background TV daemon under shell UID if not already running
echo "[Orbit Boot] Ensuring tv_agent daemon is running under shell UID..." >> "$LOG"
if [ "$ADB_OK" = "1" ]; then
    adb_cmd "if ! ps -ef | grep -v grep | grep -q 'tv_agent.sh'; then nohup /data/local/tmp/tv_agent.sh > /data/local/tmp/tv_agent.log 2>&1 & fi" >> "$LOG" 2>&1
fi

# 4. Set startup volume to 20
echo "[Orbit Boot] Setting default startup volume to 20..." >> "$LOG"
if [ "$ADB_OK" = "1" ]; then
    adb_cmd "cmd media_session volume --stream 3 --set 20 < /dev/null 2>&1" >> "$LOG" 2>&1
fi

# 5. Wait for internet connection (check for up to 15 seconds)
# Do NOT use ping (raw socket restricted on Android). Use curl HTTP/HTTPS check.
echo "[Orbit Boot] Checking internet connection..." >> "$LOG"
CONNECTED=0
i=0
while [ $i -lt 15 ]; do
    if curl -s --connect-timeout 2 -k -I https://1.1.1.1 >/dev/null 2>&1 || \
       curl -s --connect-timeout 2 -I https://www.google.com >/dev/null 2>&1 || \
       curl -s --connect-timeout 2 http://connectivitycheck.gstatic.com/generate_204 >/dev/null 2>&1; then
        CONNECTED=1
        echo "[Orbit Boot] Internet confirmed active after ${i}s" >> "$LOG"
        break
    fi
    sleep 1
    i=$((i + 1))
done

# 6. Action based on connectivity
if [ "$CONNECTED" = "1" ]; then
    echo "[Orbit Boot] Internet ready - launching Paras TV Live stream..." >> "$LOG"
    if [ "$ADB_OK" = "1" ]; then
        adb_cmd "cmd media_session volume --stream 3 --set 20 < /dev/null 2>&1"
        adb_cmd "am force-stop com.google.android.youtube.tv < /dev/null 2>&1"
        sleep 1
        adb_cmd "am start -a android.intent.action.VIEW -d 'https://www.youtube.com/@parasnetwork/live' -p com.google.android.youtube.tv < /dev/null" >> "$LOG" 2>&1
        sleep 3
        adb_cmd "cmd media_session volume --stream 3 --set 20 < /dev/null 2>&1"
    else
        am start -a android.intent.action.VIEW -d "https://www.youtube.com/@parasnetwork/live" -p com.google.android.youtube.tv < /dev/null >> "$LOG" 2>&1
    fi
else
    echo "[Orbit Boot] Network timeout (${i}s) - falling back to Home screen" >> "$LOG"
    if [ "$ADB_OK" = "1" ]; then
        adb_cmd "input keyevent 3" >> "$LOG" 2>&1
    else
        am start -a android.intent.action.MAIN -c android.intent.category.HOME < /dev/null >> "$LOG" 2>&1
    fi
fi

echo "=== [Orbit Boot] Completed at $(date) ===" >> "$LOG"
