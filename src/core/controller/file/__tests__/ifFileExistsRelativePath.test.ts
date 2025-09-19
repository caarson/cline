import { Controller } from "@core/controller"
import { BooleanResponse, StringRequest } from "@shared/proto/cline/common"
import * as pathUtils from "@utils/path"
import { expect } from "chai"
import { afterEach, beforeEach, describe, it } from "mocha"
import * as sinon from "sinon"
import { ifFileExistsRelativePath } from "../ifFileExistsRelativePath"

describe("ifFileExistsRelativePath", () => {
	let sandbox: sinon.SinonSandbox
	let mockController: Controller
	let getWorkspacePathStub: sinon.SinonStub

	beforeEach(() => {
		sandbox = sinon.createSandbox()

		// Create a mock controller
		mockController = {} as any

		// Stub getWorkspacePath utility
		getWorkspacePathStub = sandbox.stub(pathUtils, "getWorkspacePath")

		// Capture errors through global sink for reliable assertions
		;(globalThis as any).__testErrorSink = (..._args: any[]) => {}
	})

	afterEach(() => {
		sandbox.restore()
		delete (globalThis as any).__testErrorSink
	})

	it("should return BooleanResponse with boolean value", async () => {
		getWorkspacePathStub.resolves("/workspace")

		const request = StringRequest.create({
			value: "src/test.ts",
		})

		const result = await ifFileExistsRelativePath(mockController, request)

		// The result should be a BooleanResponse object
		expect(result).to.have.property("value")
		expect(typeof result.value).to.equal("boolean")
	})

	it("should return false and log error when no workspace path is available", async () => {
		const noWorkspaceScenarios = [null, undefined]

		for (const workspaceValue of noWorkspaceScenarios) {
			getWorkspacePathStub.resolves(workspaceValue)
			const errorCalls: any[] = []
			;(globalThis as any).__testErrorSink = (...args: any[]) => errorCalls.push(args)

			const request = StringRequest.create({
				value: "src/test.ts",
			})

			const result = await ifFileExistsRelativePath(mockController, request)

			expect(result).to.deep.equal(BooleanResponse.create({ value: false }))
			expect(errorCalls.length).to.be.greaterThan(0)
		}
	})

	it("should return false when path is invalid", async () => {
		getWorkspacePathStub.resolves("/workspace")

		const invalidPaths = ["", undefined]

		for (const invalidPath of invalidPaths) {
			const request = StringRequest.create({
				value: invalidPath,
			})

			const result = await ifFileExistsRelativePath(mockController, request)

			expect(result).to.deep.equal(BooleanResponse.create({ value: false }))
		}
	})

	it("should handle valid relative paths correctly", async () => {
		getWorkspacePathStub.resolves("/workspace")

		// Test with valid workspace-relative paths only
		const validPaths = ["src/file.ts", "./src/file.ts", "package.json", ".gitignore", "src/components/ui/Button/Button.tsx"]

		for (const testPath of validPaths) {
			const request = StringRequest.create({
				value: testPath,
			})

			const result = await ifFileExistsRelativePath(mockController, request)

			// Each should return a BooleanResponse
			expect(result).to.have.property("value")
			expect(typeof result.value).to.equal("boolean")
		}

		// Verify that getWorkspacePath was called for each path
		expect(getWorkspacePathStub.callCount).to.equal(validPaths.length)
	})
})
