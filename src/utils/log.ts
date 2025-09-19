// Minimal logging utility with optional test sinks for integration reliability
// In production, logs go to console as usual. In tests (especially VS Code integration
// runner), the global sinks provide a reliable hook for assertions without relying on
// stubbing console methods that may be non-configurable or proxied.

export const log = {
	warn: (...args: any[]) => {
		try {
			// Always try to log to console for visibility
			// eslint-disable-next-line no-console
			console.warn(...args)
		} catch {}
		try {
			// Optional test hook
			;(globalThis as any).__testWarnSink?.(...args)
		} catch {}
	},
	error: (...args: any[]) => {
		try {
			// eslint-disable-next-line no-console
			console.error(...args)
		} catch {}
		try {
			// Optional test hook
			;(globalThis as any).__testErrorSink?.(...args)
		} catch {}
	},
}

export type LogSink = (...args: any[]) => void
