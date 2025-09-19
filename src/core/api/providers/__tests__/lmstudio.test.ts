import "should"
import { LmStudioHandler } from "../lmstudio"

describe("LmStudioHandler (GPT-OSS integration)", () => {
	it("getModel should return GPT-OSS 20B model id and context window", () => {
		const handler = new LmStudioHandler({
			lmStudioModelId: "openai/gpt-oss-20b",
			lmStudioMaxTokens: "131072", // hypothetical full context window
		}) as any

		const model = handler.getModel()
		model.id.should.equal("openai/gpt-oss-20b")
		model.info.contextWindow.should.equal(131072)
	})

	it("getModel should handle missing max tokens gracefully", () => {
		const handler = new LmStudioHandler({
			lmStudioModelId: "openai/gpt-oss-120b",
		}) as any

		const model = handler.getModel()
		model.id.should.equal("openai/gpt-oss-120b")
		// Falls back to sane defaults; just ensure it's a positive number
		model.info.contextWindow.should.be.a.Number().and.be.greaterThan(0)
	})
})
