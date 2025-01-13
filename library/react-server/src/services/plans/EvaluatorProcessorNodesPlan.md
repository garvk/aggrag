# Integration Plan for JavaScript Processor/Evaluator Nodes in API Flow

### A. Add Node Type Handlers

- Add cases for "processor" and "evaluator" in the executeNodeByType switch statement

```142:185:library/react-server/src/services/ColoredFlowExecutor.ts
    switch (node.type) {
      case "textfields":
        // Filter out fields that are marked as not visible
        visibleFields = Object.entries(node.data.fields || {})
          .filter(([key, _]) => {
            const visibility = node.data.fields_visibility || {};
            return visibility[key] !== false; // Only include if not explicitly set to false
          })
          .reduce((acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          }, {} as Dict<string>);

        return {
          type: "textfields",
          output: visibleFields,
          nodeId: node.id,
        };
      // return {
      //   type: "textfields",
      //   output: node.data.fields,
      //   nodeId: node.id,
      // };

      case "uploadfilefields":
        // For file fields, we want to pass the file paths through
        return {
          type: "uploadfilefields",
          output: node.data.fields || {},
          nodeId: node.id,
        };

      case "split":
        return await this.executeSplitNode(node, context);

      case "join":
      case "joinNode":
        return await this.executeJoinNode(node, context);

      case "prompt":
      case "promptNode":
        return await this.executePromptNode(node, context);
      // Add other node type handlers here

```

### B. Create Execution Methods

1. Create `executeProcessorNode` method:

   - Accept node and context parameters
   - Extract code from node.data
   - Get incoming colored edges
   - Process input data from context
   - Execute JavaScript/Python code using existing executejs/executepy functions
   - Return standardized output format

2. Create `executeEvaluatorNode` method:
   - Similar structure to processor node
   - Different output format focusing on evaluation results

## 2. Update Node Type Definitions

### A. Add Type Definitions

```typescript
interface ProcessorNodeData {
  code: string;
  language: "python" | "javascript";
  sandbox: boolean;
}

interface EvaluatorNodeData {
  code: string;
  language: "python" | "javascript";
  sandbox: boolean;
}
```

### B. Update Existing Node Types

- Add processor and evaluator to node type union

## 3. Code Execution Service

### A. Create Shared Execution Logic

1. Create `CodeExecutionService` class:

   ```typescript
   class CodeExecutionService {
     executeCode(
       nodeId: string,
       code: string,
       inputs: LLMResponse[],
       language: "python" | "javascript",
       type: "processor" | "evaluator",
       sandbox: boolean,
     ): Promise<{
       output: any;
       metadata: any;
       error?: string;
     }>;
   }
   ```

2. Reuse existing execution functions:

```238:295:library/react-server/src/CodeEvaluatorNode.tsx
  // Runs the code evaluator/processor over the inputs, returning the results as a Promise.
  // Errors are raised as a rejected Promise.
  const run = (
    inputs: LLMResponse[],
    script_paths?: string[],
    runInSandbox?: boolean,
  ) => {
    if (runInSandbox === undefined) runInSandbox = sandbox;

    // Double-check that the code includes an 'evaluate' or 'process' function, whichever is needed:
    const find_func_regex =
      node_type === "evaluator"
        ? progLang === "python"
          ? /def\s+evaluate\s*(.*):/
          : /function\s+evaluate\s*(.*)/
        : progLang === "python"
          ? /def\s+process\s*(.*):/
          : /function\s+process\s*(.*)/;
    if (codeText.search(find_func_regex) === -1) {
      const req_func_name = node_type === "evaluator" ? "evaluate" : "process";
      const err_msg = `Could not find required function '${req_func_name}'. Make sure you have defined an '${req_func_name}' function.`;
      return Promise.reject(new Error(err_msg)); // hard fail
    }

    const codeTextOnRun = codeText + "";
    const execute_route = progLang === "python" ? executepy : executejs;
    let executor: PythonInterpreter | undefined =
      progLang === "python" ? "pyodide" : undefined;

    // Enable running Python in Flask backend (unsafe) if running locally and the user has turned off the sandbox:
    if (progLang === "python" && IS_RUNNING_LOCALLY && !runInSandbox)
      executor = "flask";
    return execute_route(
      id,
      codeTextOnRun,
      inputs,
      "response",
      node_type,
      script_paths,
      executor,
    ).then(function (json) {
      json = json as EvaluatedResponsesResults;
      // Check if there's an error; if so, bubble it up to user and exit:
      if (json.error) {
        if (json.logs) json.logs.push(json.error);
      } else {
        setCodeTextOnLastRun(codeTextOnRun);
      }

      return {
        code, // string
        responses: json?.responses, // array of ResponseInfo Objects
        error: json?.error, // undefined or, if present, a string of the error message
        logs: json?.logs, // an array of strings representing console.logs/prints made during execution
      };
    });
  };
```

## 4. Input/Output Processing

### A. Input Handling

1. Process incoming edges similar to JoinNode:

```221:251:library/react-server/src/services/ColoredFlowExecutor.ts
    const incomingColoredEdges = Array.from(this.coloredEdges.values())
      .flat()
      .filter((edge) => edge.target === node.id);

    // Use default format if none specified
    const format =
      node.data?.format || node.data?.joinFormat || JoinFormat.NumList;

    // Create variables dict for input processing
    const variables: Dict<any> = {};

    // Process incoming edges and collect input data
    for (const edge of incomingColoredEdges) {
      const sourceResult = context.get(edge.source);
      if (sourceResult?.output) {
        // Convert object values to array of strings
        if (
          typeof sourceResult.output === "object" &&
          !Array.isArray(sourceResult.output)
        ) {
          const texts = Object.values(sourceResult.output).map((val: unknown) =>
            String(val),
          );
          variables[edge.targetHandle] = texts;
        } else {
          variables[edge.targetHandle] = Array.isArray(sourceResult.output)
            ? sourceResult.output.map((val: unknown) => String(val))
            : [String(sourceResult.output)];
        }
      }
    }
```

2. Standardize input format for both node types

### B. Output Processing

1. For Processor Node:
   -Preserve metadata from input
   -Include processed text/data
   -Maintain variable context

2. For Evaluator Node:

   - Include evaluation scores/results
   - Preserve input context for downstream nodes

## 5. API Integration

1. Extend validation logic in flow.ts:

```1:54:library/react-server/src/backend/flow.ts
import express, { Router } from "express";
import cors from "cors";
import { Node } from "reactflow";
import { ColoredFlowExecutor } from "../services/ColoredFlowExecutor";

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
// app.use(express.json());
app.use(express.json({ limit: "5mb" }));
// Create router for flow endpoints
const router = Router();

router.post("/app/run", async (req, res) => {
  console.log("[/app/run] Received flow execution request");
  try {
    const { flow } = req.body;
    // console.log(`[/app/run] Flow execution request received with flow:`, flow);
    // Validate flow structure
    if (!flow || !flow.nodes || !flow.edges) {
      return res.status(400).json({ error: "Invalid flow structure" });
    }
    console.log(
      `[/app/run] Executing flow with ${flow.nodes.length} nodes and ${flow.edges.length} edges`,
    );
    // Create executor and run flow
    // const executor = new FlowExecutor(flow);
    const executor = new ColoredFlowExecutor(flow);
    const results = await executor.execute();

    // Convert results map to object for response
    const response = Object.fromEntries(results);
    console.log("[/app/run] Flow execution completed successfully");
    res.json({
      success: true,
      results: response,
    });
  } catch (error) {
    // Detailed error logging
    console.error("[/app/run] Flow execution failed:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
router.post("/app/validate", async (req, res) => {
  console.log("[/app/validate] Received flow validation request");
```

2. Add validation for:

   -Code presence
   -Language specification
   -Required input connections

### B. Update API Documentation

1. Add new nodes to supported nodes list:

```111:120:API/README.md
## Supported Nodes with API
Currently the following nodes are supported:
 - Text Fields Node
 - Prompt Node
 - Split Node
 - Join Node
 - File Fields Node


Support for other nodes will be added based on the realised usefulness of the API.
```

2. Document any limitations or special considerations

## 6. Error Handling

1. Add specific error types for:
   -Code execution failures
   -Input validation errors
   -Language/runtime errors
   -Sandbox violations

2. Standardize error response format

## 7. Testing Plan

1. Unit Tests:

   -Code execution for both languages
   -Input/output processing
   -Error handling

2. Integration Tests:
   -Flow execution with colored edges
   -Complex flows with multiple node types
   -API endpoint testing
