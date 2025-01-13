import { Dict, LLMResponse } from "../backend/typing";
import { executejs, executepy } from "../backend/backend";

export class CodeExecutionService {
  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  async executeCode(
    code: string,
    inputs: LLMResponse[],
    language: "python" | "javascript",
    type: "processor" | "evaluator",
    sandbox = true,
  ): Promise<{
    output: any;
    metadata: Dict<any>;
    error?: string;
  }> {
    console.log(`Executing ${type} node with ${language}`);
    console.log("Inputs:", inputs);

    try {
      // Validate required function exists in code
      const functionName = type === "evaluator" ? "evaluate" : "process";
      const findFuncRegex =
        language === "python"
          ? new RegExp(`def\\s+${functionName}\\s*(.*):`)
          : new RegExp(`function\\s+${functionName}\\s*(.*)`);

      if (!code.match(findFuncRegex)) {
        throw new Error(
          `Could not find required function '${functionName}'. Make sure you have defined a '${functionName}' function.`,
        );
      }

      // Execute code based on language
      const executeFunction = language === "python" ? executepy : executejs;
      const executor = language === "python" && !sandbox ? "flask" : "pyodide";

      const result = await executeFunction(
        this.nodeId,
        code,
        inputs,
        "response",
        type,
        undefined,
        executor,
      );

      if (result.error) {
        throw new Error(result.error);
      }

      return {
        output: result.responses?.[0]?.responses?.[0] || "",
        metadata: {
          language,
          type,
          logs: result.logs || [],
          preservedMetadata: inputs[0]?.vars || {},
          metavars: inputs[0]?.metavars || {},
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Code execution failed: ${errorMessage}`);
      throw new Error(`Failed to execute ${type} node: ${errorMessage}`);
    }
  }
}
