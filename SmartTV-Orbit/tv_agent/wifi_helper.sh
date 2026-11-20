#!/system/bin/sh
# SmartTV Orbit - Wi-Fi Manager Helper
# Scans nearby networks, formats as clean JSON, and connects to selected Wi-Fi

ACTION="$1"
shift

case "$ACTION" in
    scan)
        cmd wifi start-scan >/dev/null 2>&1
        sleep 2
        
        # Parse list-scan-results
        # Line format: BSSID Frequency RSSI Age(sec) SSID [Flags]
        cmd wifi list-scan-results 2>/dev/null | awk '
        NR > 1 {
            bssid = $1;
            freq = $2;
            rssi = $3;
            age = $4;
            flags = $NF;
            
            # Combine middle columns for SSID
            ssid = "";
            for (i = 5; i < NF; i++) {
                ssid = (ssid == "" ? $i : ssid " " $i);
            }
            
            # Skip empty or hidden SSIDs
            if (ssid == "" || ssid == "[ESS]") next;
            
            # Determine security
            sec = "open";
            if (flags ~ /WPA3/) {
                sec = "wpa3";
            } else if (flags ~ /WPA|RSN|WEP/) {
                sec = "wpa2";
            }
            
            # Keep highest RSSI for duplicate SSIDs
            if (!(ssid in best_rssi) || rssi > best_rssi[ssid]) {
                best_rssi[ssid] = rssi;
                best_sec[ssid] = sec;
            }
        }
        END {
            printf "[";
            first = 1;
            for (s in best_rssi) {
                if (!first) printf ",";
                first = 0;
                # Escape quotes in SSID
                clean_s = s;
                gsub(/"/, "\\\"", clean_s);
                printf "{\"ssid\":\"%s\",\"rssi\":%d,\"sec\":\"%s\"}", clean_s, best_rssi[s], best_sec[s];
            }
            printf "]\n";
        }'
        ;;

    connect|connect_b64)
        if [ "$ACTION" = "connect_b64" ]; then
            SEC="$1"
            B64_SSID="$2"
            B64_PASS="$3"
            SSID=$(echo "$B64_SSID" | base64 -d 2>/dev/null)
            [ -z "$SSID" ] && SSID="$B64_SSID"
            if [ -n "$B64_PASS" ]; then
                PASS=$(echo "$B64_PASS" | base64 -d 2>/dev/null)
            else
                PASS=""
            fi
        else
            SSID="$1"
            SEC="$2"
            PASS="$3"
        fi
        
        [ -z "$SEC" ] && SEC="wpa2"
        
        echo "[WiFi Helper] Connecting to: $SSID ($SEC)..."
        
        if [ "$SEC" = "open" ] || [ -z "$PASS" ]; then
            cmd wifi connect-network "$SSID" open >/dev/null 2>&1
        else
            cmd wifi connect-network "$SSID" "$SEC" "$PASS" >/dev/null 2>&1
        fi
        
        # Wait up to 10 seconds for connection
        CONNECTED=0
        for i in 1 2 3 4 5 6 7 8 9 10; do
            sleep 1
            CURR=$(cmd wifi status 2>/dev/null | grep 'Wifi is connected to' | head -n 1)
            if echo "$CURR" | grep -q "$SSID"; then
                CONNECTED=1
                break
            fi
        done
        
        if [ "$CONNECTED" = "1" ]; then
            echo "{\"status\":\"connected\",\"ssid\":\"$SSID\"}"
        else
            echo "{\"status\":\"failed\",\"ssid\":\"$SSID\"}"
        fi
        ;;

    status)
        RAW=$(cmd wifi status 2>/dev/null)
        CURR=$(echo "$RAW" | grep 'Wifi is connected to' | head -n 1)
        if [ -n "$CURR" ]; then
            SSID=$(echo "$CURR" | cut -d'"' -f2 | tr -d '\\')
            RSSI=$(echo "$RAW" | grep 'RSSI:' | head -n 1 | sed 's/.*RSSI: //' | cut -d',' -f1 | tr -d ' \r\n')
            IP=$(echo "$RAW" | grep 'IP:' | head -n 1 | sed 's/.*IP: //' | cut -d' ' -f1 | tr -d ' \r\n')
            echo "{\"connected\":true,\"ssid\":\"$SSID\",\"rssi\":$RSSI,\"ip\":\"$IP\"}"
        else
            echo "{\"connected\":false}"
        fi
        ;;
esac
