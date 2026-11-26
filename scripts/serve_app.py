"""Tiny local web server used by the double-click Windows launcher."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
APP_DIRECTORY = ROOT / "work" / "local-runtime"
HOST = "127.0.0.1"
PORT = 4318
HEALTH_PATH = "/__jibjip_health__"
HEALTH_RESPONSE = b"jibjip-ok"


class QuietHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, max-age=0, must-revalidate")
        super().end_headers()

    def do_GET(self) -> None:
        if urlsplit(self.path).path == HEALTH_PATH:
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(HEALTH_RESPONSE)))
            self.end_headers()
            self.wfile.write(HEALTH_RESPONSE)
            return
        super().do_GET()

    def log_message(self, format: str, *args: object) -> None:
        return


class ExclusiveThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = False
    daemon_threads = True


if __name__ == "__main__":
    handler = partial(QuietHandler, directory=str(APP_DIRECTORY))
    try:
        server = ExclusiveThreadingHTTPServer((HOST, PORT), handler)
    except OSError:
        raise SystemExit(0)
    with server:
        server.serve_forever()
