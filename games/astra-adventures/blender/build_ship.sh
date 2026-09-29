#!/bin/sh
# Rebuild the Jupiter Class IV end to end: geometry + UV + buffer bakes, paint, normal bake + GLB export.
set -e
cd "$(dirname "$0")"
PY=${PY:-/tmp/bvenv/bin/python}
$PY ship_bake.py 4096 2>&1 | grep -v "^Fra:\|Deprecat\|use_nodes\|Info" | tail -4
$PY ship_tex.py 2>&1 | grep -v Deprecat | tail -3
$PY ship_export.py "$@" 2>&1 | grep "exported\|normal baked"
