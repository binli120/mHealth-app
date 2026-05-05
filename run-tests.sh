#!/bin/sh
# @author: Bin Lee
# @email: blee@healthcompass.cloud

pnpm exec vitest run --reporter=verbose "$@"
