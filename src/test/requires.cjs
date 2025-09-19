// Runtime require patch for unit tests (CommonJS to avoid ESM loader issues)
const Module = require("module")
const originalRequire = Module.prototype.require
const path = require("path")
const fs = require("fs")

// Map TS path aliases to runtime compiled directory when running precompiled tests
const aliasPrefixes = {
	"@/": "src/",
	"@core/": "src/core/",
	"@api/": "src/core/api/",
	"@generated/": "src/generated/",
	"@hosts/": "src/hosts/",
	"@integrations/": "src/integrations/",
	"@packages/": "src/packages/",
	"@services/": "src/services/",
	"@shared/": "src/shared/",
	"@utils/": "src/utils/",
}

function tryFileVariants(baseNoExt) {
	// Prefer compiled JS variants first
	const jsFile = baseNoExt + ".js"
	if (fs.existsSync(jsFile)) return jsFile
	if (fs.existsSync(baseNoExt) && fs.statSync(baseNoExt).isDirectory()) {
		const idxJs = path.join(baseNoExt, "index.js")
		if (fs.existsSync(idxJs)) return idxJs
	}
	// Fallback to source TS variants
	const tsFile = baseNoExt + ".ts"
	if (fs.existsSync(tsFile)) return tsFile
	if (fs.existsSync(baseNoExt) && fs.statSync(baseNoExt).isDirectory()) {
		const idxTs = path.join(baseNoExt, "index.ts")
		if (fs.existsSync(idxTs)) return idxTs
	}
	return null
}

function resolveAlias(p) {
	for (const prefix in aliasPrefixes) {
		if (p.startsWith(prefix)) {
			const rel = p.replace(prefix, aliasPrefixes[prefix])
			const cwd = process.cwd()
			// Try compiled output first
			const compiledBase = path.join(cwd, "out/unit", rel)
			const resolvedCompiled = tryFileVariants(compiledBase)
			if (resolvedCompiled) return resolvedCompiled
			// Fallback to source
			const sourceBase = path.join(cwd, rel)
			const resolvedSource = tryFileVariants(sourceBase)
			if (resolvedSource) return resolvedSource
		}
	}
	return null
}

Module.prototype.require = function (p) {
	if (!p) {
		return {}
	}
	if (p === "vscode") {
		return require("./vscode-mock")
	}
	if (p === "execa") {
		// Provide a lazy ESM import shim so CommonJS compiled code can still use execa
		return new Proxy(
			{},
			{
				get(_t, prop) {
					if (prop === "then") {
						return undefined
					} // allow await checks to skip
					return async (...args) => {
						const mod = await import("execa").catch((e) => {
							throw new Error("Failed dynamic import of execa: " + e.message)
						})
						const target = mod[prop]
						if (typeof target === "function") {
							return target.apply(mod, args)
						}
						return target
					}
				},
			},
		)
	}
	if (p === "@sap-ai-sdk/orchestration") {
		return new Proxy(
			{},
			{
				get(_t, prop) {
					if (prop === "then") {
						return undefined
					}
					return async (...args) => {
						const mod = await import("@sap-ai-sdk/orchestration").catch((e) => {
							throw new Error("Failed dynamic import of @sap-ai-sdk/orchestration: " + e.message)
						})
						const target = mod[prop]
						if (typeof target === "function") {
							return target.apply(mod, args)
						}
						return target
					}
				},
			},
		)
	}
	if (p === "serialize-error") {
		// The library exports serializeError named; provide compatible facade
		return new Proxy(
			{},
			{
				get(_t, prop) {
					if (prop === "then") {
						return undefined
					}
					return async (...args) => {
						const mod = await import("serialize-error").catch((e) => {
							throw new Error("Failed dynamic import of serialize-error: " + e.message)
						})
						const target = mod[prop]
						if (typeof target === "function") {
							return target.apply(mod, args)
						}
						return target
					}
				},
			},
		)
	}
	if (p === "os-name") {
		return (...args) => import("os-name").then((mod) => mod.default(...args))
	}
	if (p === "@integrations/checkpoints") {
		return {}
	}
	if (p === "@integrations/checkpoints/MultiRootCheckpointManager") {
		return { MultiRootCheckpointManager: class {} }
	}
	// Handle aliased imports when running against compiled JS
	if (p.startsWith("@")) {
		const resolved = resolveAlias(p)
		if (resolved) {
			return originalRequire.call(this, resolved)
		}
	}
	// If a direct require of a source .ts file slipped through (absolute path under src), redirect to compiled JS
	try {
		if (p.startsWith(process.cwd()) && p.includes(path.sep + "src" + path.sep) && p.endsWith(".ts")) {
			const relFromRoot = p.substring(process.cwd().length + 1) // remove leading cwd + separator
			const jsCandidate = path.join(process.cwd(), "out/unit", relFromRoot).replace(/\.ts$/, ".js")
			if (fs.existsSync(jsCandidate)) {
				return originalRequire.call(this, jsCandidate)
			}
		}
	} catch {}
	return originalRequire.call(this, p)
}

// Load compiled path util if available to register String.prototype.toPosix
try {
	const compiledPathUtil = path.join(process.cwd(), "out/unit/src/utils/path.js")
	if (fs.existsSync(compiledPathUtil)) {
		require(compiledPathUtil)
	}
} catch {}
