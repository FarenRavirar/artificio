"""T3.3 (spec 084) — Modo 2b: renderiza URL via Camoufox (Firefox anti-deteccao,
daijro/camoufox) e imprime {"html": ..., "status": ...} em JSON no stdout.
Contrato de I/O com camoufoxClient.ts: argv[1] = URL, stdout = 1 linha JSON,
stderr = log/erro. Processo curto-vida (1 URL por invocacao) — mais lento que
patchright (~42s/challenge, dado de mercado citado na spec), so chamado
quando o Modo 2a (patchright) ja falhou.
"""

import json
import sys

from camoufox.sync_api import Camoufox

NAVIGATION_TIMEOUT_MS = 60_000


def fetch_rendered(url: str) -> dict:
    with Camoufox(headless=True, geoip=True) as browser:
        page = browser.new_page()
        response = page.goto(url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS)
        html = page.content()
        status = response.status if response else 0
        return {"html": html, "status": status}


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "URL ausente em argv[1]"}), file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    try:
        result = fetch_rendered(url)
        print(json.dumps(result))
    except Exception as error:  # noqa: BLE001
        # Subprocess isolado (1 URL por invocacao) — erro vira stderr/exit != 0
        # pro chamador (camoufoxClient.ts) tratar, nunca propaga stack Python.
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
