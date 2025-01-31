// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "../../../vitest.shared.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      testTimeout: 600000,
      hookTimeout: 60000,
      fileParallelism: false,
      include: ["test/**/*.spec.ts"],
      exclude: ["./node_modules/**/*"],
      globalSetup: ["./test/utils/setup.ts"],
      fakeTimers: {
        toFake: [
          "setTimeout",
          "clearTimeout",
          "setImmediate",
          "clearImmediate",
          "setInterval",
          "clearInterval",
          "Date",
        ],
      },
    },
  })
);
