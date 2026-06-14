#!/usr/bin/env python3
"""Tiny static dev server that disables caching.

The app is pure static files, but browsers aggressively cache JS/CSS which makes
iterating painful. This serves everything with `Cache-Control: no-store` so a
reload always fetches the latest. Production/offline use can just open
index.html directly — this is a dev convenience only.

Usage: python3 serve.py [port]   (default 8777)
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    server = ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler)
    print(f"Serving http://127.0.0.1:{port} (no-cache)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()


if __name__ == "__main__":
    main()
