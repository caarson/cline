const tsConfigPaths = require("tsconfig-paths")
const fs = require("fs")
const path = require("path")
const Module = require("module")

const baseUrl = path.resolve(__dirname)

const tsConfig = JSON.parse(fs.readFileSync(path.join(baseUrl, "tsconfig.json"), "utf-8"))

/**
 * The aliases point towards the `src` directory.
 * However, `tsc` doesn't compile paths by itself
 * (https://www.typescriptlang.org/docs/handbook/modules/reference.html#paths-does-not-affect-emit)
 * So we need to use tsconfig-paths to resolve the aliases when running tests,
 * but pointing to `out` instead.
 */
const outPaths = {}
Object.keys(tsConfig.compilerOptions.paths).forEach((key) => {
	const value = tsConfig.compilerOptions.paths[key]
	// Route to the unit-test compiled output to ensure code is fresh for integration runs
	outPaths[key] = value.map((path) => path.replace("src", "out/unit/src"))
})

tsConfigPaths.register({
	baseUrl: baseUrl,
	paths: outPaths,
})

// Ensure console.warn and console.error are stub-friendly in VS Code test runner
// In some runtimes, console methods may be non-writable/bound in a way that Sinon can't intercept reliably.
// We redefine them via accessors that delegate to an internal function reference, which tests can override.
try {
	const originalWarn = console.warn.bind(console)
	const originalError = console.error.bind(console)
	let warnFn = (...args) => originalWarn(...args)
	let errorFn = (...args) => originalError(...args)

	// Only redefine if not already accessor-based to avoid double-wrapping
	const warnDesc = Object.getOwnPropertyDescriptor(console, "warn")
	const errorDesc = Object.getOwnPropertyDescriptor(console, "error")

	if (!warnDesc || (!warnDesc.get && !warnDesc.set)) {
		Object.defineProperty(console, "warn", {
			configurable: true,
			enumerable: true,
			get() {
				return warnFn
			},
			set(fn) {
				warnFn = typeof fn === "function" ? fn : warnFn
			},
		})
	}
	if (!errorDesc || (!errorDesc.get && !errorDesc.set)) {
		Object.defineProperty(console, "error", {
			configurable: true,
			enumerable: true,
			get() {
				return errorFn
			},
			set(fn) {
				errorFn = typeof fn === "function" ? fn : errorFn
			},
		})
	}
} catch {
	// Best-effort: ignore if console methods are not configurable in this environment
}

// Mock the @google/genai module to avoid ESM compatibility issues in tests
// The module is ES6 only, but the integration tests are compiled to commonJS.
const originalRequire = Module.prototype.require
Module.prototype.require = function (id) {
	// Skip loading Playwright e2e test files during integration (vscode-test) runs.
	// These tests are executed separately via Playwright and should not be required by Mocha.
	// If a path under src/test/e2e (or compiled out/unit/src/test/e2e) is requested, return an empty stub.
	try {
		if (typeof id === "string") {
			// Resolve absolute path without throwing for non-existent modules
			let resolved
			try {
				resolved = Module._resolveFilename(id, this)
			} catch {
				resolved = undefined
			}
			if (resolved && /[\\/]test[\\/]e2e[\\/].*\.test\.(c|m)?js$/i.test(resolved)) {
				return {}
			}
		}
	} catch {
		// Fail open if any unexpected error occurs
	}

	// Intercept requires for sinon to normalize reset() behavior across environments
	if (id === "sinon") {
		const sinonLib = originalRequire.call(this, id)
		try {
			const originalReset = typeof sinonLib.reset === "function" ? sinonLib.reset.bind(sinonLib) : undefined
			const hasResetHistory = typeof sinonLib.resetHistory === "function"
			if (hasResetHistory) {
				// Make sinon.reset() also clear call history to avoid cross-test leakage
				sinonLib.reset = (...args) => {
					try {
						sinonLib.resetHistory()
					} catch {}
					return originalReset ? originalReset(...args) : undefined
				}
			}
		} catch {}
		return sinonLib
	}
	// Intercept requires for @google/genai
	if (id === "@google/genai") {
		// Return the mock instead
		const mockPath = path.join(baseUrl, "out/src/core/api/providers/gemini-mock.test.js")
		return originalRequire.call(this, mockPath)
	}
	return originalRequire.call(this, id)
}

// Global safety net: ensure Sinon call history is cleared after each test
try {
	if (typeof afterEach === "function") {
		afterEach(() => {
			try {
				const sinon = require("sinon")
				if (typeof sinon.resetHistory === "function") {
					sinon.resetHistory()
				}
			} catch {}
		})
	}
} catch {}
