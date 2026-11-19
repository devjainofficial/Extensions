#!/system/bin/sh
# SmartTV Orbit - Android TV Daemon
# Listens for Cloud Commands & Manages Smart Power Wake Routines

CURL="/data/local/tmp/curl"
CURL_OPTS="-s --resolve ntfy.sh:443:159.203.148.75 -k"
CMD_TOPIC="https://ntfy.sh/orbit_devja_tv_cmd/raw"
STATUS_TOPIC="https://ntfy.sh/orbit_devja_tv_status"

# Default Routine States: PARAS_ALL_DAY enabled by default (anytime wake)
PARAS_ALL_DAY="1"
PARAS_ENABLED="1"
PARAS_START=500
PARAS_END=700

JINVANI_ENABLED="1"
JINVANI_START=700
JINVANI_END=900

# Feature 3: Night Volume Guard (9:30 PM - 6:00 AM)
NIGHT_GUARD="1"

echo "[Orbit Agent] Daemon started on $(date)"
echo "[Orbit Agent] Initialized: PARAS_ALL_DAY=$PARAS_ALL_DAY, Paras: $PARAS_START-$PARAS_END, Jinvani: $JINVANI_START-$JINVANI_END, NightGuard=$NIGHT_GUARD"

# Worker 1: TV Wake Monitor (Detects screen ON from standby)
monitor_wake() {
    PREV_WAKE="Awake"
    while true; do
        WAKE=$(dumpsys power 2>/dev/null | grep "mWakefulness=" | head -n 1 | cut -d= -f2)
        
        if [ "$PREV_WAKE" != "Awake" ] && [ "$WAKE" = "Awake" ]; then
            echo "[Orbit Agent] TV Turned ON (Transition: $PREV_WAKE -> Awake)"
            
            # Check current time
            HOUR=$(date +%H)
            MIN=$(date +%M)
            HM=$((HOUR * 100 + MIN))
            
            echo "[Orbit Agent] Current TV time: $HOUR:$MIN ($HM)"
            
            # Feature 3: Night Volume Guard check on wake (9:30 PM = 2130, 6:00 AM = 600)
            if [ "$NIGHT_GUARD" = "1" ]; then
                if [ "$HM" -ge 2130 ] || [ "$HM" -lt 600 ]; then
                    echo "[Orbit Routine] Night Volume Guard active ($HOUR:$MIN) - Setting gentle volume 18%..."
                    cmd media_session volume --set 4
                fi
            fi

            # 1. Universal All-Day Paras TV Wake Routine (Anytime the TV turns on)
            if [ "$PARAS_ALL_DAY" = "1" ] && [ "$PARAS_ENABLED" = "1" ]; then
                echo "[Orbit Routine] Launching Default Paras TV Live (Anytime wake)..."
                sleep 2
                am start -a android.intent.action.VIEW -d "https://www.youtube.com/results?search_query=Paras+TV+live" -p com.google.android.youtube.tv
                sleep 3
                input keyevent 23
            
            # 2. Morning Paras TV Routine Check (Time-windowed mode)
            elif [ "$PARAS_ENABLED" = "1" ] && [ "$HM" -ge "$PARAS_START" ] && [ "$HM" -lt "$PARAS_END" ]; then
                echo "[Orbit Routine] Launching Morning Paras TV Live..."
                sleep 2
                am start -a android.intent.action.VIEW -d "https://www.youtube.com/results?search_query=Paras+TV+live" -p com.google.android.youtube.tv
                sleep 3
                input keyevent 23
            
            # 3. Morning Jinvani Channel Routine Check
            elif [ "$JINVANI_ENABLED" = "1" ] && [ "$HM" -ge "$JINVANI_START" ] && [ "$HM" -lt "$JINVANI_END" ]; then
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
            CRICKET:*|HOTSTAR_CRICKET:*)
                echo "[Orbit Cloud] Launching Hotstar Live Cricket..."
                am start -a android.intent.action.VIEW -d "hotstar://sports" in.startv.hotstar || \
                am start -a android.intent.action.VIEW -d "https://www.hotstar.com/in/sports/cricket" in.startv.hotstar || \
                monkey -p in.startv.hotstar -c android.intent.category.LAUNCHER 1
                ;;
            NIGHT_GUARD:*)
                STATE="${LINE#NIGHT_GUARD:}"
                NIGHT_GUARD="$STATE"
                echo "[Orbit Routine] Night Guard set to $NIGHT_GUARD"
                if [ "$NIGHT_GUARD" = "1" ]; then
                    HOUR=$(date +%H)
                    MIN=$(date +%M)
                    HM=$((HOUR * 100 + MIN))
                    if [ "$HM" -ge 2130 ] || [ "$HM" -lt 600 ]; then
                        cmd media_session volume --set 4
                    fi
                fi
                ;;
            NOTIFY:*)
                MSG="${LINE#NOTIFY:}"
                echo "[Orbit Cloud] Showing on-screen notification: $MSG"
                ENCODED_MSG=$(echo "$MSG" | sed 's/ /%20/g')
                am start -a android.intent.action.VIEW -d "https://tv.gujaratididi.com/alert.html?msg=$ENCODED_MSG"
                ( sleep 10 && input keyevent 4 ) &
                ;;
            PARAS_ALL_DAY:*)
                STATE="${LINE#PARAS_ALL_DAY:}"
                PARAS_ALL_DAY="$STATE"
                echo "[Orbit Routine] Paras All-Day Default set to $PARAS_ALL_DAY"
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
            ROUTINE_CONFIG:*)
                DATA="${LINE#ROUTINE_CONFIG:}"
                RNAME=$(echo "$DATA" | cut -d: -f1)
                RSTART=$(echo "$DATA" | cut -d: -f2)
                REND=$(echo "$DATA" | cut -d: -f3)
                if [ "$RNAME" = "paras" ]; then
                    PARAS_START="$RSTART"
                    PARAS_END="$REND"
                elif [ "$RNAME" = "jinvani" ]; then
                    JINVANI_START="$RSTART"
                    JINVANI_END="$REND"
                fi
                echo "[Orbit Routine] Updated $RNAME time: $RSTART to $REND"
                ;;
            SLEEP_TIMER:*)
                MINS="${LINE#SLEEP_TIMER:}"
                echo "[Orbit Cloud] Setting sleep timer for $MINS minutes..."
                ( sleep $((MINS * 60)) && input keyevent 26 && echo "[Orbit Cloud] Sleep timer turned off TV" ) &
                ;;
            SCREEN:*)
                echo "[Orbit Cloud] Capturing screenshot and uploading..."
                screencap -p /data/local/tmp/screen.png
                $CURL $CURL_OPTS -H "Filename: screen.png" -T /data/local/tmp/screen.png "$STATUS_TOPIC"
                ;;
            SCRIPT:*)
                SCRIPT="${LINE#SCRIPT:}"
                sh -c "$SCRIPT" &
                ;;
            *)
                echo "[Orbit Cloud] Unknown command: $LINE"
                ;;
        esac
    done
    
    echo "[Orbit Agent] Stream interrupted, reconnecting in 3 seconds..."
    sleep 3
done
