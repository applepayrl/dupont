from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen


ALLOWED_HOSTS = {"www.sec.gov", "data.sec.gov"}
USER_AGENT = "Company Analyzer local-dev contact@example.com"


class AnalyzerHandler(SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/sec?"):
            self.proxy_sec()
            return
        super().do_GET()

    def proxy_sec(self):
        query = parse_qs(urlparse(self.path).query)
        target = query.get("url", [""])[0]
        parsed = urlparse(target)

        if parsed.scheme != "https" or parsed.netloc not in ALLOWED_HOSTS:
            self.send_text(403, "SEC URL is not allowed")
            return

        request = Request(
            target,
            headers={
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
            },
        )

        try:
            with urlopen(request, timeout=30) as response:
                body = response.read()
                self.send_response(response.status)
                self.send_cors_headers()
                self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
                self.send_header("Cache-Control", "public, max-age=21600")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except HTTPError as error:
            self.send_text(error.code, error.read().decode("utf-8", "replace"))
        except Exception as error:
            self.send_text(502, f"SEC proxy failed: {error}")

    def send_text(self, status, text):
        encoded = text.encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 4174), AnalyzerHandler)
    print("Serving Company Analyzer on http://127.0.0.1:4174")
    server.serve_forever()
