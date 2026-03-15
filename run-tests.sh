#!/bin/sh
export NODE_PATH="node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.13_jiti@2.6.1_jsdom@27.4.0_lightningcss@1.31.1_terser@5.46.0/node_modules/vitest/node_modules:node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.13_jiti@2.6.1_jsdom@27.4.0_lightningcss@1.31.1_terser@5.46.0/node_modules:node_modules/.pnpm/node_modules"
/Users/blee/.nvm/versions/node/v22.15.1/bin/node node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.13_jiti@2.6.1_jsdom@27.4.0_lightningcss@1.31.1_terser@5.46.0/node_modules/vitest/vitest.mjs run --reporter=verbose "$@"
