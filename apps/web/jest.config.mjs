import nextJest from "next/jest.js"

const createJestConfig = nextJest({ dir: "./" })

/** @type {import('jest').Config} */
export default createJestConfig({
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // same aliases as tsconfig.json "paths"
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@workspace/ui/(.*)$": "<rootDir>/../../packages/ui/src/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
})
