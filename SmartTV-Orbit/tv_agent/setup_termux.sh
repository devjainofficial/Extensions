#!/system/bin/sh
mkdir -p ~/.termux
echo "extra-keys = []" > ~/.termux/termux.properties
touch ~/.hushlogin
echo "sh /sdcard/boot.sh" > ~/.bashrc
termux-reload-settings 2>/dev/null
echo "[OK] Termux configured successfully!"
