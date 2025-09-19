/**
 * Utilities to sanitize model-produced artifacts from text and file contents.
 * Removes channel/control tokens like <|analysis|>, <|thinking|>, ChatML headers, and trims noise.
 * Also extracts fenced code blocks when models include commentary around code.
 */

const LEADING_PATTERNS: RegExp[] = [
	// Repeated channel tokens like <|analysis|><|thinking|> ... at the very start
	/^(?:<\|(?:analysis|assistant|user|system|thinking|deliberate|coT|im_start|im_end|channel)\|>\s*)+/i,
	// OpenAI-style header markers
	/^<\|start_header_id\|>[\s\S]*?<\|end_header_id\|>\s*/i,
	// Odd prefix like "analysis>" or "thinking>" at the very start
	/^\s*(?:analysis|thinking)\s*>\s*/i,
]

/** Remove all occurrences of the known leading artifact patterns at the start of the text. */
function stripLeadingArtifacts(text: string): string {
	let result = text
	let matched = true
	while (matched) {
		matched = false
		for (const re of LEADING_PATTERNS) {
			const before = result
			result = result.replace(re, "")
			if (result !== before) {
				matched = true
			}
		}
	}
	return result
}

/** Remove <thinking> ... </thinking> tags (already handled elsewhere, but safe to repeat) */
function stripThinkingTags(text: string): string {
	return text.replace(/<thinking>\s?/g, "").replace(/\s?<\/thinking>/g, "")
}

/** Remove ChatML style tokens lingering inside content */
function stripInlineChatMl(text: string): string {
	return (
		text
			.replace(/<\|im_start\|>\s*\w+\s*/gi, "")
			.replace(/<\|im_end\|>/gi, "")
			// Remove any lingering ChatML-like channel tokens anywhere in the text
			.replace(/<\|(?:analysis|assistant|user|system|thinking|deliberate|coT|im_start|im_end|channel)\|>/gi, "")
	)
}

/**
 * Extract the content of fenced code blocks. If multiple exist, prefer one labeled with the
 * expected language, otherwise fall back to the longest block. Returns null if none found.
 */
function extractFencedCode(text: string, expectedLanguage?: string): string | null {
	const fenceRe = /```([a-z0-9_+-]*)\s*\n([\s\S]*?)\n```/gi
	const blocks: { lang: string; body: string }[] = []
	// Avoid assignment inside condition per lint rules
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const m = fenceRe.exec(text)
		if (m === null) {
			break
		}
		const lang = (m[1] || "").toLowerCase().trim()
		const body = m[2] || ""
		blocks.push({ lang, body })
	}
	if (blocks.length === 0) {
		return null
	}
	if (expectedLanguage) {
		const preferred = blocks.find((b) => b.lang.includes(expectedLanguage.toLowerCase()))
		if (preferred) {
			return preferred.body.trim()
		}
	}
	// Fallback: choose the longest block
	return blocks.reduce((a, b) => (b.body.length > a.length ? b.body : a), "").trim()
}

/**
 * If the text includes a full HTML document, extract from <!DOCTYPE or <html to </html>.
 */
function extractHtmlDocument(text: string): string | null {
	const lower = text.toLowerCase()
	const startIdx = Math.max(lower.indexOf("<!doctype"), lower.indexOf("<html"))
	const endIdx = lower.lastIndexOf("</html>")
	if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
		return text.slice(startIdx, endIdx + "</html>".length).trim()
	}
	return null
}

/** Sanitize generic assistant text for display in chat. */
export function sanitizeAssistantText(raw: string): string {
	if (!raw) {
		return raw
	}
	let text: string = raw
	text = stripLeadingArtifacts(text)
	text = stripThinkingTags(text)
	text = stripInlineChatMl(text)
	return text
}

/**
 * Sanitize file content before writing: remove artifacts; if fenced code is present, extract it; if HTML doc present, prefer it.
 */
export function sanitizeFileContent(raw: string, expectedLanguage?: string): string {
	if (!raw) {
		return raw
	}
	const text: string = sanitizeAssistantText(raw)
	// Prefer an explicit HTML document if present
	const html = extractHtmlDocument(text)
	if (html) {
		return html
	}
	// Otherwise, prefer fenced code if it exists
	const fenced = extractFencedCode(text, expectedLanguage)
	if (fenced) {
		return fenced
	}
	return text
}
