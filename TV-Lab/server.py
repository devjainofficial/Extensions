import os
import sys
import json
import urllib.parse
import subprocess
import shlex
from http.server import HTTPServer, BaseHTTPRequestHandler
import mimetypes

TV_IP = "10.218.252.142:5555"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("TV_LAB_PORT", 8080))

def run_adb(args, binary=False):
    cmd = ["adb", "-s", TV_IP] + args
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
        out = res.stdout
        err = res.stderr.decode('utf-8', errors='ignore')
        if "device not found" in err or "device unauthorized" in err:
            # Try reconnecting once
            subprocess.run(["adb", "connect", TV_IP], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
            out = res.stdout
        if binary:
            return out
        return out.decode('utf-8', errors='ignore').strip()
    except Exception as e:
        if binary:
            return b""
        return f"Error: {e}"

def get_tv_status():
    status = {"connected": False, "app": "Unknown", "ip": TV_IP, "animation": "1.0"}
    res = subprocess.run(["adb", "devices"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    devices_out = res.stdout.decode('utf-8', errors='ignore')
    if TV_IP in devices_out and "device" in devices_out:
        status["connected"] = True
    else:
        # attempt connect
        subprocess.run(["adb", "connect", TV_IP], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        res = subprocess.run(["adb", "devices"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if TV_IP in res.stdout.decode('utf-8', errors='ignore'):
            status["connected"] = True

    if status["connected"]:
        # Get focused window
        focus_out = run_adb(["shell", "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'"])
        lines = [l.strip() for l in focus_out.splitlines() if l.strip()]
        if lines:
            status["app"] = lines[0].replace("mCurrentFocus=Window{", "").split(" ")[-1].replace("}", "")
        
        # Get animation scale
        anim = run_adb(["shell", "settings get global window_animation_scale"])
        status["animation"] = anim if anim else "1.0"
    return status

class TVLabHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Quiet standard HTTP logs
        pass

    def send_json(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/" or path == "/index.html":
            html_path = os.path.join(os.path.dirname(__file__), "index.html")
            if os.path.exists(html_path):
                with open(html_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, "index.html not found")
            return

        if path == "/api/status":
            self.send_json(get_tv_status())
            return

        if path == "/api/key":
            code = query.get("code", [""])[0]
            if code:
                run_adb(["shell", "input", "keyevent", code])
                self.send_json({"success": True, "code": code})
            else:
                self.send_json({"error": "Missing key code"}, 400)
            return

        if path == "/api/launch":
            app = query.get("app", [""])[0]
            apps = {
                "projectivy": ["am", "start", "-n", "com.spocky.projengmenu/.ui.home.MainActivity"],
                "tvbro": ["am", "start", "-n", "com.phlox.tvwebbrowser/.activity.main.MainActivity"],
                "edge": ["am", "start", "-n", "com.microsoft.emmx/com.microsoft.ruby.Main"],
                "smarttube": ["monkey", "-p", "org.smarttube.stable", "1"],
                "plex": ["monkey", "-p", "com.plexapp.android", "1"],
                "home": ["input", "keyevent", "3"],
                "settings": ["input", "keyevent", "176"],
                "youtube": ["monkey", "-p", "com.google.android.youtube.tv", "1"]
            }
            if app in apps:
                run_adb(["shell"] + apps[app])
                self.send_json({"success": True, "app": app})
            else:
                self.send_json({"error": "Unknown app"}, 400)
            return

        if path == "/api/screenshot":
            png_bytes = run_adb(["exec-out", "screencap", "-p"], binary=True)
            if png_bytes and len(png_bytes) > 100:
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.end_headers()
                self.wfile.write(png_bytes)
            else:
                self.send_error(500, "Screenshot capture failed")
            return

        self.send_error(404, "Endpoint not found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/type":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(body)
                text = data.get("text", "")
                press_enter = data.get("enter", False)
                if text:
                    safe = text.replace(" ", "%s")
                    run_adb(["shell", f"input text {shlex.quote(safe)}"])
                if press_enter:
                    run_adb(["shell", "input", "keyevent", "66"])
                self.send_json({"success": True, "text": text})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        if path == "/api/tap":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(body)
                x = int(data.get("x", 0))
                y = int(data.get("y", 0))
                run_adb(["shell", "input", "tap", str(x), str(y)])
                self.send_json({"success": True, "x": x, "y": y})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        if path == "/api/speed":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(body)
                scale = str(data.get("scale", "1.0"))
                run_adb(["shell", "settings", "put", "global", "window_animation_scale", scale])
                run_adb(["shell", "settings", "put", "global", "transition_animation_scale", scale])
                run_adb(["shell", "settings", "put", "global", "animator_duration_scale", scale])
                self.send_json({"success": True, "scale": scale})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        if path == "/api/sideload":
            # Direct path install
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(body)
                apk_path = data.get("path", "")
                if os.path.exists(apk_path):
                    res = run_adb(["install", "-r", "-d", "-g", apk_path])
                    self.send_json({"success": True, "output": res})
                else:
                    self.send_json({"error": "File not found on PC"}, 400)
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        self.send_error(404, "Endpoint not found")

def main():
    print(f"Connecting to TV at {TV_IP}...")
    subprocess.run(["adb", "connect", TV_IP])
    server = HTTPServer(("0.0.0.0", PORT), TVLabHandler)
    print(f"==================================================")
    print(f"  TCL Google TV Experiment Lab is LIVE!")
    print(f"  Open in browser: http://localhost:{PORT}")
    print(f"==================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down TV Lab server...")
        server.server_close()

if __name__ == "__main__":
    main()
