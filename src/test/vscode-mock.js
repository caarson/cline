// Minimal vscode mock for unit tests
module.exports = {
	workspace: {
		getConfiguration: () => ({ get: () => undefined }),
		onDidChangeConfiguration: () => ({ dispose() {} }),
	},
	window: {
		showInformationMessage: () => Promise.resolve(),
		showWarningMessage: () => Promise.resolve(),
		showErrorMessage: () => Promise.resolve(),
		createOutputChannel: () => ({ appendLine() {}, show() {}, dispose() {} }),
	},
	Uri: {
		file: (p) => ({ fsPath: p, toString: () => p }),
	},
	commands: {
		registerCommand: () => ({ dispose() {} }),
		executeCommand: () => Promise.resolve(),
	},
	EventEmitter: class {
		constructor() {
			this.listeners = []
		}
		event = (cb) => {
			this.listeners.push(cb)
			return { dispose() {} }
		}
		fire(data) {
			this.listeners.forEach((l) => l(data))
		}
		dispose() {
			this.listeners = []
		}
	},
	Position: class {},
	Range: class {},
	Selection: class {},
	TextEditorRevealType: {},
	ThemeIcon: class {},
	env: { clipboard: { writeText: () => Promise.resolve() } },
}
