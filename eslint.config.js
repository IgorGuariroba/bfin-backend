import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
    },
  },
  // Fronteira do core (ADR-0013, herdada do bfin-app no decommission #191):
  // src/core é agnóstico de framework e ORM. A dependência aponta para dentro —
  // todo mundo importa o core; o core não importa ninguém.
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["fastify", "fastify/*"],
              message: "src/core não importa framework (ADR-0013).",
            },
            {
              group: ["drizzle-orm", "drizzle-orm/*", "postgres"],
              message:
                "src/core não conhece ORM — acesso a dados só via portas implementadas em src/adapters (ADR-0013).",
            },
            {
              group: [
                "**/adapters/**",
                "**/lib/**",
                "**/routes/**",
                "**/db/**",
              ],
              message:
                "Dependência aponta para dentro: src/core não importa adapters, lib, routes ou db (ADR-0013).",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ["dist/**"],
  },
);
