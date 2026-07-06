import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    // Só ativa com --coverage (o CI envia o lcov pro SonarCloud).
    coverage: {
      include: ["src/**"],
      exclude: ["src/**/*.test.ts", "src/test/**"],
      reporter: ["text-summary", "lcov"],
    },
    // unit: sem dependência de Postgres. integration: precisa de DATABASE_URL real.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          exclude: [...defaultExclude, "**/*.integration.test.ts"],
        },
      },
      {
        extends: true,
        test: { name: "integration", include: ["**/*.integration.test.ts"] },
      },
    ],
  },
});
