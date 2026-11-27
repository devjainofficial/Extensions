#!/system/bin/sh
# SmartTV Orbit - Android TV Daemon
# Listens for Cloud Commands, Manages Smart Power Wake Routines & Broadcasts Live TV Status

trap '' HUP INT TERM

# Ensure full path access for system binaries (am, input, cmd, monkey, screencap, dumpsys, curl)
export PATH="/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"

if command -v curl >/dev/null 2>&1; then
    CURL="curl"
else
    CURL="/data/local/tmp/curl"
fi
CURL_OPTS="-s --resolve ntfy.adminforge.de:443:195.201.173.232 -k"
CURL_OPTS_BACKUP="-s --resolve ntfy.tedomum.fr:443:163.172.185.142 -k"
CMD_TOPIC="https://ntfy.adminforge.de/orbit_devja_tv_cmd/raw"
STATUS_TOPIC="https://ntfy.adminforge.de/orbit_devja_tv_status"
STATUS_TOPIC_BACKUP="https://ntfy.tedomum.fr/orbit_devja_tv_status"

# Default Routine States: PARAS_ALL_DAY enabled by default (anytime wake)
PARAS_ALL_DAY="1"
PARAS_ENABLED="1"
PARAS_START=500
PARAS_END=700

JINVANI_ENABLED="1"
JINVANI_START=700
JINVANI_END=900

# Night Volume Guard (9:30 PM - 6:00 AM)
NIGHT_GUARD="1"

# Feature 4: Daily Care & Medication Reminders
MED_MORNING_ENABLED="1"
MED_MORNING_TIME=830      # 8:30 AM
MED_NIGHT_ENABLED="1"
MED_NIGHT_TIME=2030       # 8:30 PM

LAST_MORNING_ALERT_DATE=""
LAST_NIGHT_ALERT_DATE=""

echo "[Orbit Agent] Daemon started on $(date)"
echo "[Orbit Agent] Initialized: PARAS_ALL_DAY=$PARAS_ALL_DAY, Paras: $PARAS_START-$PARAS_END, Jinvani: $JINVANI_START-$JINVANI_END, NightGuard=$NIGHT_GUARD"

# Helper: Publish Live TV Status (Feature 2)
publish_tv_status() {
    WAKE=$(dumpsys power 2>/dev/null | grep "mWakefulness=" | head -n 1 | cut -d= -f2 | tr -d ' \r\n')
    [ -z "$WAKE" ] && WAKE="Unknown"

    FOCUS_RAW=$(dumpsys window 2>/dev/null | grep "mCurrentFocus" | head -n 1)
    PKG=$(echo "$FOCUS_RAW" | sed 's/.*u0 \([^/]*\).*/\1/' | tr -d ' \r\n')
    [ -z "$PKG" ] && PKG="Unknown"

    APP_NAME="Unknown"
    case "$PKG" in
        com.google.android.youtube.tv)
            APP_NAME="YouTube TV"
            ;;
        org.smarttube.stable)
            APP_NAME="SmartTube"
            ;;
        in.startv.hotstar)
            APP_NAME="JioHotstar"
            ;;
        com.spocky.projengmenu)
            APP_NAME="Projectivy Home"
            ;;
        com.tcl.partnercustomizer|com.google.android.tvlauncher)
            APP_NAME="TV Home Screen"
            ;;
        com.termux)
            APP_NAME="Background System"
            ;;
        com.android.chrome)
            APP_NAME="Chrome"
            ;;
        com.google.android.apps.tv.dreamx)
            APP_NAME="Ambient Screensaver"
            ;;
        *)
            if [ "$PKG" != "Unknown" ]; then
                APP_NAME="$PKG"
            fi
            ;;
    esac

    VOL=$(dumpsys audio 2>/dev/null | grep -A 6 'STREAM_MUSIC:' | grep 'streamVolume:' | head -n 1 | cut -d: -f2 | tr -d ' \r\n')
    [ -z "$VOL" ] && VOL="30"

    # Extract active WiFi SSID and signal
    WIFI_RAW=$(cmd wifi status 2>/dev/null | grep 'Wifi is connected to' | head -n 1)
    if [ -n "$WIFI_RAW" ]; then
        WIFI_SSID=$(echo "$WIFI_RAW" | cut -d'"' -f2 | tr -d '\\')
        WIFI_RSSI=$(cmd wifi status 2>/dev/null | grep 'RSSI:' | head -n 1 | sed 's/.*RSSI: //' | cut -d',' -f1 | tr -d ' \r\n')
    else
        WIFI_SSID="Disconnected"
        WIFI_RSSI="0"
    fi
    [ -z "$WIFI_SSID" ] && WIFI_SSID="Disconnected"
    [ -z "$WIFI_RSSI" ] && WIFI_RSSI="0"

    TIME_NOW=$(date +"%I:%M %p")

    STATUS_JSON="{\"type\":\"tv_status\",\"power\":\"$WAKE\",\"pkg\":\"$PKG\",\"app\":\"$APP_NAME\",\"volume\":$VOL,\"wifi\":\"$WIFI_SSID\",\"rssi\":$WIFI_RSSI,\"time\":\"$TIME_NOW\"}"
    echo "[Orbit Agent] Publishing Live Status: $STATUS_JSON"
    $CURL $CURL_OPTS -H "Title: TV_STATUS" -d "$STATUS_JSON" "$STATUS_TOPIC" < /dev/null >/dev/null 2>&1
    $CURL $CURL_OPTS_BACKUP -H "Title: TV_STATUS" -d "$STATUS_JSON" "$STATUS_TOPIC_BACKUP" < /dev/null >/dev/null 2>&1
}

# Worker 1: TV Wake Monitor & Care Reminders
monitor_wake() {
    PREV_WAKE=""
    echo "[Orbit Agent] Wake & Care monitor started..."
    
    TICK_COUNTER=0

    while true; do
        WAKE=$(dumpsys power 2>/dev/null | grep "mWakefulness=" | head -n 1 | cut -d= -f2 | tr -d ' \r\n')
        TCL_POWER=$(getprop sys.tcl.tv.power_status 2>/dev/null)
        
        # Check current time
        HOUR=$(date +%H)
        MIN=$(date +%M)
        HM=$((HOUR * 100 + MIN))
        TODAY=$(date +%Y-%m-%d)

        # 1. Check if TV transitioned from non-Awake to Awake
        if [ "$PREV_WAKE" != "Awake" ] && [ "$WAKE" = "Awake" ]; then
            echo "[Orbit Agent] TV Turned ON (Transition: $PREV_WAKE -> Awake | TCL: $TCL_POWER)"
            echo "[Orbit Agent] Current TV time: $HOUR:$MIN ($HM)"
            
            # Default startup sound to 30 on TV power on
            echo "[Orbit Routine] Setting default TV sound to 30 on wake..."
            cmd media_session volume --stream 3 --set 30 < /dev/null 2>&1
            
            # Feature 3: Night Volume Guard check on wake (9:30 PM = 2130, 6:00 AM = 600)
            if [ "$NIGHT_GUARD" = "1" ]; then
                if [ "$HM" -ge 2130 ] || [ "$HM" -lt 600 ]; then
                    echo "[Orbit Routine] Night Volume Guard active ($HOUR:$MIN) - Setting gentle volume 18%..."
                    cmd media_session volume --stream 3 --set 18 < /dev/null 2>&1
                fi
            fi

            # Wait up to 10 seconds for Wi-Fi / Internet to be active before launching stream
            echo "[Orbit Routine] Checking network connectivity before opening live stream..."
            NET_OK=0
            net_i=0
            while [ $net_i -lt 10 ]; do
                if $CURL $CURL_OPTS -I "https://ntfy.adminforge.de" >/dev/null 2>&1 || \
                   $CURL -s --connect-timeout 2 -k -I "https://1.1.1.1" >/dev/null 2>&1; then
                    NET_OK=1
                    break
                fi
                sleep 1
                net_i=$((net_i + 1))
            done

            # Channel Routine Selection:
            if [ "$JINVANI_ENABLED" = "1" ] && [ "$HM" -ge "$JINVANI_START" ] && [ "$HM" -lt "$JINVANI_END" ]; then
                echo "[Orbit Routine] Launching Morning Jinvani Channel Live ($JINVANI_START-$JINVANI_END)..."
                am force-stop com.google.android.youtube.tv < /dev/null 2>&1
                sleep 1
                am start -a android.intent.action.VIEW -d "https://www.youtube.com/watch?v=9RHUshUYFmU" com.google.android.youtube.tv/com.google.android.apps.youtube.tv.activity.ShellActivity < /dev/null || \
                am start -a android.intent.action.VIEW -d "https://www.youtube.com/watch?v=9RHUshUYFmU" -p com.google.android.youtube.tv < /dev/null
            elif [ "$PARAS_ENABLED" = "1" ]; then
                echo "[Orbit Routine] Launching Default Paras TV Live (Direct stream)..."
                am force-stop com.google.android.youtube.tv < /dev/null 2>&1
                sleep 1
                am start -a android.intent.action.VIEW -d "https://www.youtube.com/@parasnetwork/live" com.google.android.youtube.tv/com.google.android.apps.youtube.tv.activity.ShellActivity < /dev/null || \
                am start -a android.intent.action.VIEW -d "https://www.youtube.com/@parasnetwork/live" -p com.google.android.youtube.tv < /dev/null
            fi

            # Reinforce volume 30 right after opening initial channel on wake
            sleep 3
            cmd media_session volume --stream 3 --set 30 < /dev/null 2>&1

            # Publish fresh status after waking
            sleep 4
            publish_tv_status
        fi

        # 2. Feature 4: Daily Scheduled Medication Reminders (Trigger when TV is Awake)
        if [ "$WAKE" = "Awake" ]; then
            # Morning Medicine Reminder
            if [ "$MED_MORNING_ENABLED" = "1" ] && [ "$HM" -eq "$MED_MORNING_TIME" ]; then
                if [ "$LAST_MORNING_ALERT_DATE" != "$TODAY" ]; then
                    echo "[Orbit Reminder] Firing Morning Medication Alert on TV!"
                    LAST_MORNING_ALERT_DATE="$TODAY"
                    am start -a android.intent.action.VIEW -d "https://tv.gujaratididi.com/alert.html?type=med&title=Morning%20Medication&msg=Dad,%20please%20take%20your%20morning%20medicines%20💊" -p com.microsoft.emmx < /dev/null
                    ( sleep 13 && input keyevent 4 < /dev/null ) &
                fi
            fi

            # Night Medicine Reminder
            if [ "$MED_NIGHT_ENABLED" = "1" ] && [ "$HM" -eq "$MED_NIGHT_TIME" ]; then
                if [ "$LAST_NIGHT_ALERT_DATE" != "$TODAY" ]; then
                    echo "[Orbit Reminder] Firing Night Medication Alert on TV!"
                    LAST_NIGHT_ALERT_DATE="$TODAY"
                    am start -a android.intent.action.VIEW -d "https://tv.gujaratididi.com/alert.html?type=med&title=Night%20Medication&msg=Dad,%20time%20for%20your%20night%20medicines%20💊" -p com.microsoft.emmx < /dev/null
                    ( sleep 13 && input keyevent 4 < /dev/null ) &
                fi
            fi
        fi

        # 3. Periodic Live Status broadcast (every ~40 seconds while awake)
        TICK_COUNTER=$((TICK_COUNTER + 1))
        if [ "$TICK_COUNTER" -ge 20 ]; then
            TICK_COUNTER=0
            if [ "$WAKE" = "Awake" ]; then
                publish_tv_status
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
        
        # Security Verification: Ensure command carries valid secret auth token
        SECRET_TOKEN="ORBIT_SEC_2309"
        if echo "$LINE" | grep -q "^AUTH:"; then
            CMD_TOKEN=$(echo "$LINE" | cut -d'|' -f1 | cut -d':' -f2)
            if [ "$CMD_TOKEN" != "$SECRET_TOKEN" ]; then
                echo "[Orbit Security] Unauthorized command rejected (bad token: $CMD_TOKEN)"
                continue
            fi
            # Strip the AUTH prefix: e.g. AUTH:ORBIT_SEC_2309|KEY:19 -> KEY:19
            LINE=$(echo "$LINE" | sed 's/^AUTH:[^|]*|//')
            echo "[Orbit Cloud] Authenticated command accepted: $LINE"
        else
            echo "[Orbit Security] Rejected unsigned command (no AUTH token): $LINE"
            continue
        fi
        
        case "$LINE" in
            KEY:24|VOL_UP|VOL_UP:*)
                cmd media_session volume --show --stream 3 --adj raise < /dev/null 2>&1
                (sleep 0.4 && publish_tv_status) &
                ;;
            KEY:25|VOL_DOWN|VOL_DOWN:*)
                cmd media_session volume --show --stream 3 --adj lower < /dev/null 2>&1
                (sleep 0.4 && publish_tv_status) &
                ;;
            KEY:164|MUTE|MUTE:*)
                CUR_VOL=$(dumpsys audio 2>/dev/null | grep -A 6 'STREAM_MUSIC:' | grep 'streamVolume:' | head -n 1 | cut -d: -f2 | tr -d ' \r\n')
                if [ "$CUR_VOL" != "0" ] && [ -n "$CUR_VOL" ]; then
                    PREV_MUTE_VOL="$CUR_VOL"
                    cmd media_session volume --show --stream 3 --set 0 < /dev/null 2>&1
                else
                    RESTORE_VOL="${PREV_MUTE_VOL:-30}"
                    cmd media_session volume --show --stream 3 --set "$RESTORE_VOL" < /dev/null 2>&1
                fi
                (sleep 0.4 && publish_tv_status) &
                ;;
            KEY:85|PLAY_PAUSE|PLAY_PAUSE:*)
                input keyevent 85 < /dev/null
                ;;
            KEY:89|REWIND|REWIND:*)
                input keyevent 89 < /dev/null || input keyevent 21 < /dev/null
                ;;
            KEY:90|FAST_FORWARD|FAST_FORWARD:*)
                input keyevent 90 < /dev/null || input keyevent 22 < /dev/null
                ;;
            KEY:26|POWER|POWER:*)
                input keyevent 26 < /dev/null
                sleep 2
                publish_tv_status
                ;;
            KEY:*)
                KEY_CODE="${LINE#KEY:}"
                input keyevent "$KEY_CODE" < /dev/null
                ;;
            VOL:*)
                VOL_LEVEL="${LINE#VOL:}"
                cmd media_session volume --show --stream 3 --set "$VOL_LEVEL" < /dev/null 2>&1
                (sleep 0.4 && publish_tv_status) &
                ;;
            TYPE:*)
                TEXT="${LINE#TYPE:}"
                input text "$TEXT" < /dev/null
                ;;
            URL:*)
                URL="${LINE#URL:}"
                echo "[Orbit Cloud] Push-to-TV Opening URL: $URL"
                # Ensure TV is awake (preserves current volume)
                input keyevent 224 < /dev/null
                
                # Check URL destination
                case "$URL" in
                    *hotstar.com*|*hotstar:*)
                        # Normalize star-plus url without hyphen for Android TV deep linking
                        HOTSTAR_URL=$(echo "$URL" | sed 's/star-plus/starplus/g')
                        am start -a android.intent.action.VIEW -d "$HOTSTAR_URL" in.startv.hotstar < /dev/null || \
                        am start -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER in.startv.hotstar < /dev/null
                        sleep 2.5
                        # Auto-confirm profile if "Who's watching?" profile picker is presented
                        input keyevent 23 < /dev/null
                        case "$HOTSTAR_URL" in
                            *starplus*)
                                sleep 1.5
                                # Pick random serial: 0 to 2 rows down, 1 to 5 columns right (never stays on top one)
                                R_DOWN=$((RANDOM % 3))
                                R_RIGHT=$((RANDOM % 5 + 1))
                                echo "[Orbit Routine] Star Plus: Random serial selector (down: $R_DOWN, right: $R_RIGHT)..."
                                r_i=0
                                while [ $r_i -lt $R_DOWN ]; do
                                    input keyevent 20 < /dev/null
                                    sleep 0.25
                                    r_i=$((r_i + 1))
                                done
                                r_j=0
                                while [ $r_j -lt $R_RIGHT ]; do
                                    input keyevent 22 < /dev/null
                                    sleep 0.25
                                    r_j=$((r_j + 1))
                                done
                                sleep 0.4
                                # Open selected serial
                                input keyevent 23 < /dev/null
                                sleep 1.5
                                # Play latest episode
                                input keyevent 23 < /dev/null
                                ;;
                            *sports*|*cricket*)
                                sleep 1.5
                                input keyevent 23 < /dev/null
                                ;;
                        esac
                        ;;
                    *jinvanichannelofficial*|*jinvani*|*9RHUshUYFmU*)
                        echo "[Orbit Cloud] Opening Official Jinvani Live Stream (9RHUshUYFmU)..."
                        am start -a android.intent.action.VIEW -d "https://www.youtube.com/watch?v=9RHUshUYFmU" com.google.android.youtube.tv/com.google.android.apps.youtube.tv.activity.ShellActivity < /dev/null || \
                        am start -a android.intent.action.VIEW -d "https://www.youtube.com/watch?v=9RHUshUYFmU" -p com.google.android.youtube.tv < /dev/null
                        ;;
                    *)
                        am start -a android.intent.action.VIEW -d "$URL" com.google.android.youtube.tv/com.google.android.apps.youtube.tv.activity.ShellActivity < /dev/null || \
                        am start -a android.intent.action.VIEW -d "$URL" -p com.google.android.youtube.tv < /dev/null
                        case "$URL" in
                            *search_query=*)
                                sleep 3.0
                                # Directly play the top searched result (do not jump down a row)
                                input keyevent 23 < /dev/null
                                ;;
                        esac
                        ;;
                esac
                # Immediate cloud broadcast: playback initiated and achieved on TV
                $CURL $CURL_OPTS -d "{\"type\":\"action_done\",\"url\":\"$URL\",\"status\":\"playing\"}" "$STATUS_TOPIC" < /dev/null 2>&1 &
                $CURL $CURL_OPTS_BACKUP -d "{\"type\":\"action_done\",\"url\":\"$URL\",\"status\":\"playing\"}" "$STATUS_TOPIC_BACKUP" < /dev/null 2>&1 &
                sleep 2
                publish_tv_status
                ;;
            LAUNCH_APP:*)
                PKG="${LINE#LAUNCH_APP:}"
                echo "[Orbit Cloud] Launching app: $PKG"
                input keyevent 224 < /dev/null
                am start -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER "$PKG" < /dev/null || \
                monkey -p "$PKG" 1 < /dev/null
                sleep 3
                publish_tv_status
                ;;
            CRICKET:*|HOTSTAR_CRICKET:*)
                echo "[Orbit Cloud] Launching Hotstar Live Cricket..."
                input keyevent 224 < /dev/null
                am start -a android.intent.action.VIEW -d "hotstar://sports" in.startv.hotstar < /dev/null || \
                am start -a android.intent.action.VIEW -d "https://www.hotstar.com/in/sports/cricket" in.startv.hotstar < /dev/null || \
                am start -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER in.startv.hotstar < /dev/null
                sleep 3
                publish_tv_status
                ;;
            STATUS|STATUS:*)
                echo "[Orbit Cloud] Status request received"
                publish_tv_status
                ;;
            WIFI_SCAN|WIFI_SCAN:*)
                echo "[Orbit Cloud] Wi-Fi Scan requested..."
                NETWORKS=$(/data/local/tmp/wifi_helper.sh scan 2>/dev/null)
                [ -z "$NETWORKS" ] && NETWORKS="[]"
                PAYLOAD="{\"type\":\"wifi_scan_results\",\"networks\":$NETWORKS}"
                $CURL $CURL_OPTS -H "Title: TV_WIFI_SCAN" -d "$PAYLOAD" "$STATUS_TOPIC" < /dev/null >/dev/null 2>&1
                $CURL $CURL_OPTS_BACKUP -H "Title: TV_WIFI_SCAN" -d "$PAYLOAD" "$STATUS_TOPIC_BACKUP" < /dev/null >/dev/null 2>&1
                ;;
            WIFI_CONNECT:*)
                PAYLOAD="${LINE#WIFI_CONNECT:}"
                # Format: WIFI_CONNECT:<sec>|<b64_ssid>|<b64_pass>
                SEC=$(echo "$PAYLOAD" | cut -d'|' -f1)
                B64_SSID=$(echo "$PAYLOAD" | cut -d'|' -f2)
                B64_PASS=$(echo "$PAYLOAD" | cut -d'|' -f3)
                echo "[Orbit Cloud] Connecting Wi-Fi: sec=$SEC, b64_ssid=$B64_SSID"
                RESULT=$(/data/local/tmp/wifi_helper.sh connect_b64 "$SEC" "$B64_SSID" "$B64_PASS" 2>/dev/null)
                $CURL $CURL_OPTS -H "Title: TV_WIFI_CONNECT" -d "$RESULT" "$STATUS_TOPIC" < /dev/null >/dev/null 2>&1
                $CURL $CURL_OPTS_BACKUP -H "Title: TV_WIFI_CONNECT" -d "$RESULT" "$STATUS_TOPIC_BACKUP" < /dev/null >/dev/null 2>&1
                sleep 2
                publish_tv_status
                ;;
            SCREEN|SCREEN:*)
                echo "[Orbit Cloud] Screen peek requested - capturing..."
                screencap -p /data/local/tmp/screen.png < /dev/null
                $CURL $CURL_OPTS -H "Filename: screen.png" -H "Title: TV_SCREEN" -T /data/local/tmp/screen.png "$STATUS_TOPIC" < /dev/null
                publish_tv_status
                ;;
            NOTIFY:*)
                MSG="${LINE#NOTIFY:}"
                echo "[Orbit Cloud] Showing on-screen notification: $MSG"
                input keyevent 224 < /dev/null
                ENCODED_MSG=$(echo "$MSG" | sed 's/ /%20/g')
                am start -a android.intent.action.VIEW -d "https://tv.gujaratididi.com/alert.html?type=msg&title=Message%20from%20Family&msg=$ENCODED_MSG" -p com.microsoft.emmx < /dev/null
                ( sleep 13 && input keyevent 4 < /dev/null ) &
                ;;
            ALERT:*)
                PAYLOAD="${LINE#ALERT:}"
                # Format: ALERT:type|title|message
                A_TYPE=$(echo "$PAYLOAD" | cut -d'|' -f1)
                A_TITLE=$(echo "$PAYLOAD" | cut -d'|' -f2)
                A_MSG=$(echo "$PAYLOAD" | cut -d'|' -f3)
                [ -z "$A_TYPE" ] && A_TYPE="msg"
                [ -z "$A_TITLE" ] && A_TITLE="Family Reminder"
                [ -z "$A_MSG" ] && A_MSG="Check your phone"
                echo "[Orbit Cloud] Showing rich alert ($A_TYPE | $A_TITLE): $A_MSG"
                input keyevent 224 < /dev/null
                ENC_TITLE=$(echo "$A_TITLE" | sed 's/ /%20/g')
                ENC_MSG=$(echo "$A_MSG" | sed 's/ /%20/g')
                am start -a android.intent.action.VIEW -d "https://tv.gujaratididi.com/alert.html?type=$A_TYPE&title=$ENC_TITLE&msg=$ENC_MSG" -p com.microsoft.emmx < /dev/null
                ( sleep 13 && input keyevent 4 < /dev/null ) &
                ;;
            REMINDER_CONFIG:*)
                DATA="${LINE#REMINDER_CONFIG:}"
                # Format: REMINDER_CONFIG:morning:1:0830 or REMINDER_CONFIG:night:1:2030
                SLOT=$(echo "$DATA" | cut -d: -f1)
                ENABLE=$(echo "$DATA" | cut -d: -f2)
                TIME_VAL=$(echo "$DATA" | cut -d: -f3)
                if [ "$SLOT" = "morning" ]; then
                    MED_MORNING_ENABLED="$ENABLE"
                    [ -n "$TIME_VAL" ] && MED_MORNING_TIME="$TIME_VAL"
                    echo "[Orbit Reminder] Updated Morning Reminder: enabled=$MED_MORNING_ENABLED, time=$MED_MORNING_TIME"
                elif [ "$SLOT" = "night" ]; then
                    MED_NIGHT_ENABLED="$ENABLE"
                    [ -n "$TIME_VAL" ] && MED_NIGHT_TIME="$TIME_VAL"
                    echo "[Orbit Reminder] Updated Night Reminder: enabled=$MED_NIGHT_ENABLED, time=$MED_NIGHT_TIME"
                fi
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
                        cmd media_session volume --stream 3 --set 18 < /dev/null 2>&1
                    fi
                fi
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
                ( sleep $((MINS * 60)) && input keyevent 26 < /dev/null && echo "[Orbit Cloud] Sleep timer turned off TV" ) &
                ;;
            SCRIPT:*)
                SCRIPT="${LINE#SCRIPT:}"
                sh -c "$SCRIPT" < /dev/null &
                ;;
            *)
                echo "[Orbit Cloud] Unknown command: $LINE"
                ;;
        esac
    done
    
    echo "[Orbit Agent] Stream interrupted, reconnecting in 3 seconds..."
    sleep 3
done
