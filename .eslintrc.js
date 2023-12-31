module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: [
      "./tsconfig.json",
      "./packages/client/tsconfig.json",
      "./packages/shared/tsconfig.json",
      "./packages/snap/tsconfig.json",
      "./apps/demo/tsconfig.json",
      "./apps/site/tsconfig.json",
    ],
  },
  plugins: ["@typescript-eslint", "solid"],
  env: {
    browser: true,
    es2021: true,
  },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:solid/typescript", "prettier"],
  overrides: [
    {
      env: {
        node: true,
      },
      files: [".eslintrc.{js,cjs}"],
      parserOptions: {
        sourceType: "script",
      },
    },
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  ignorePatterns: ["vite.config.ts", ".eslintrc.js", "**/declarations"],
  rules: {
    "@typescript-eslint/no-floating-promises": "error",
  },
};
