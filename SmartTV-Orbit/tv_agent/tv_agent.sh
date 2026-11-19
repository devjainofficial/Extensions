#!/system/bin/sh
# SmartTV Orbit - Cloud TV Agent Daemon

CURL="/data/local/tmp/curl"
CURL_OPTS="-s -k --resolve ntfy.sh:443:159.203.148.75"
CMD_TOPIC="https://ntfy.sh/orbit_devja_tv_cmd/raw"
STATUS_TOPIC="https://ntfy.sh/orbit_devja_tv_status"

echo "[Orbit Agent] Starting TV Orbit Daemon..."

# State tracking
PREV_WAKE=""
PARAS_ENABLED="1"
JINVANI_ENABLED="1"

# Background Worker 1: TV Power / Wake & Scheduled Routine Detector
monitor_wake() {
    echo "[Orbit Agent] Wake monitor started."
    while true; do
        WAKE=$(dumpsys power 2>/dev/null | grep "mWakefulness=" | head -n 1 | cut -d= -f2)
        
        if [ "$PREV_WAKE" != "Awake" ] && [ "$WAKE" = "Awake" ]; then
            echo "[Orbit Agent] TV Turned ON (Transition: $PREV_WAKE -> Awake)"
            
            # Check current time
            HOUR=$(date +%H)
            MIN=$(date +%M)
            HM=$((HOUR * 100 + MIN))
            
            echo "[Orbit Agent] Current TV time: $HOUR:$MIN ($HM)"
            
            # Morning 5:00 AM - 6:59 AM -> Paras TV
            if [ "$PARAS_ENABLED" = "1" ] && [ "$HM" -ge 500 ] && [ "$HM" -lt 700 ]; then
                echo "[Orbit Routine] Launching Morning Paras TV Live..."
                sleep 2
                am start -a android.intent.action.VIEW -d "https://www.youtube.com/results?search_query=Paras+TV+live" -p com.google.android.youtube.tv
                sleep 3
                input keyevent 23
            
            # Morning 7:00 AM - 8:59 AM -> Jinvani Channel
            elif [ "$JINVANI_ENABLED" = "1" ] && [ "$HM" -ge 700 ] && [ "$HM" -lt 900 ]; then
                echo "[Orbit Routine] Launching Morning Jinvani Channel Live..."
                sleep 2
                am start -a android.intent.action.VIEW -d "https://www.youtube.com/results?search_query=Jinvani+channel+live" -p com.google.android.youtube.tv
                sleep 3
                input keyevent 23
            fi
        fi
        
        PREV_WAKE="$WAKE"
        sleep 2
    done
}

# Start wake monitor in background subshell
monitor_wake &

# Worker 2: Cloud Relay Listener (Listens for real-time remote commands)
echo "[Orbit Agent] Connecting to Cloud Relay ($CMD_TOPIC)..."

while true; do
    # Stream events line by line using curl SSE/raw
    $CURL $CURL_OPTS -N "$CMD_TOPIC" | while read -r LINE; do
        # Ignore empty lines or heartbeats
        [ -z "$LINE" ] && continue
        echo "[Orbit Cloud] Command received: $LINE"
        
        case "$LINE" in
            KEY:*)
                KEY_CODE="${LINE#KEY:}"
                input keyevent "$KEY_CODE"
                ;;
            VOL:*)
                VOL_LEVEL="${LINE#VOL:}"
                cmd media_session volume --set "$VOL_LEVEL"
                ;;
            TYPE:*)
                TEXT="${LINE#TYPE:}"
                input text "$TEXT"
                ;;
            URL:*)
                URL="${LINE#URL:}"
                am start -a android.intent.action.VIEW -d "$URL" -p com.google.android.youtube.tv
                sleep 3
                input keyevent 23
                ;;
            LAUNCH_APP:*)
                PKG="${LINE#LAUNCH_APP:}"
                monkey -p "$PKG" -c android.intent.category.LAUNCHER 1
                ;;
            ROUTINE_TOGGLE:*)
                DATA="${LINE#ROUTINE_TOGGLE:}"
                RNAME="${DATA%%:*}"
                RSTATE="${DATA##*:}"
                if [ "$RNAME" = "paras" ]; then
                    PARAS_ENABLED="$RSTATE"
                elif [ "$RNAME" = "jinvani" ]; then
                    JINVANI_ENABLED="$RSTATE"
                fi
                echo "[Orbit Routine] Toggled $RNAME to $RSTATE"
                ;;
            SCREEN:*)
                echo "[Orbit Cloud] Capturing screenshot..."
                screencap -p /data/local/tmp/screen.png
                ;;
            *)
                echo "[Orbit Cloud] Unknown command: $LINE"
                ;;
        esac
    done
    
    echo "[Orbit Agent] Stream interrupted, reconnecting in 3 seconds..."
    sleep 3
done
