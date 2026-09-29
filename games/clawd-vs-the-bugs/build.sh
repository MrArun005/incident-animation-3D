#!/bin/bash
# game.html is the artifact body (no <html>/<head>/<body>); this wraps it into a standalone page.
cd "$(dirname "$0")"
{ printf '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0}</style></head><body>\n'; cat game.html; printf '\n</body></html>\n'; } > index.html
