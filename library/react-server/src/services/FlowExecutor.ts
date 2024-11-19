interface Node {
  id: string;
  type: string;
  data: any;
}

interface Edge {
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

interface Flow {
  nodes: Node[];
  edges: Edge[];
}

export class FlowExecutor {
  private nodes: Map<string, Node>;
  private edges: Map<string, Edge[]>;
  private entryNodes: Set<string>;
  private outputNodes: Set<string>;

  constructor(flow: Flow) {
    this.nodes = new Map(flow.nodes.map((node) => [node.id, node]));
    this.edges = new Map();
    this.entryNodes = new Set();
    this.outputNodes = new Set();

    // Build edge map
    flow.edges.forEach((edge) => {
      if (!this.edges.has(edge.source)) {
        this.edges.set(edge.source, []);
      }
      this.edges.get(edge.source)!.push(edge);
    });

    // Identify entry and output nodes
    this.identifySpecialNodes(flow);
  }

  private identifySpecialNodes(flow: Flow): void {
    const hasIncomingEdges = new Set(flow.edges.map((e) => e.target));
    const hasOutgoingEdges = new Set(flow.edges.map((e) => e.source));

    this.nodes.forEach((node, id) => {
      if (!hasIncomingEdges.has(id)) {
        this.entryNodes.add(id);
      }
      if (!hasOutgoingEdges.has(id)) {
        this.outputNodes.add(id);
      }
    });
  }

  private async executeNode(
    nodeId: string,
    executionContext: Map<string, any>,
  ): Promise<any> {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    // Execute node based on its type
    const result = await this.executeNodeByType(node, executionContext);
    console.log("Node", nodeId);
    console.log("node execution result", result);
    // Store result in execution context
    executionContext.set(nodeId, result);

    return result;
  }

  private async executeNodeByType(
    node: Node,
    context: Map<string, any>,
  ): Promise<any> {
    switch (node.type) {
      case "processor":
        // return await this.executeProcessor(node, context);
        break;

      case "evaluator":
      case "evalNode":
      case "llmeval":
        // return await this.executeEvaluator(node, context);
        break;

      case "prompt":
      case "promptNode":
        // return await this.executePromptNode(node, context);
        break;

      case "textfields":
      case "textFieldsNode":
        return await this.executeTextFieldsNode(node, context);
        break;

      case "join":
        // return await this.executeJoinNode(node, context);
        break;

      case "vis":
      case "visNode":
        // return await this.executeVisualizationNode(node, context);
        break;

      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  public async execute(): Promise<Map<string, any>> {
    const executionContext = new Map<string, any>();
    const visited = new Set<string>();

    // Start execution from entry nodes
    for (const entryNodeId of this.entryNodes) {
      await this.executeFlow(entryNodeId, executionContext, visited);
    }

    return executionContext;
  }

  private async executeFlow(
    currentNodeId: string,
    executionContext: Map<string, any>,
    visited: Set<string>,
  ): Promise<void> {
    if (visited.has(currentNodeId)) return;

    // Execute current node
    await this.executeNode(currentNodeId, executionContext);
    visited.add(currentNodeId);

    // Get outgoing edges
    const outgoingEdges = this.edges.get(currentNodeId) || [];

    // Execute all downstream nodes
    for (const edge of outgoingEdges) {
      await this.executeFlow(edge.target, executionContext, visited);
    }
  }

  // // Implementation of node type executions
  // private async executeProcessor(node: Node, context: Map<string, any>): Promise<any> {
  //   // Reference the processor execution from backend.ts
  //   const inputResponses = await this.getNodeInputs(node, context);
  //   return await run_over_responses(node.data.process_func, inputResponses, "processor");
  // }

  // private async executeEvaluator(node: Node, context: Map<string, any>): Promise<any> {
  //   // Reference LLMEvalNode.tsx for evaluation logic
  //   const inputNodeIds = this.getInputNodeIds(node);
  //   return await run(inputNodeIds);
  // }

  // private async executePromptNode(node: Node, context: Map<string, any>): Promise<any> {
  //   const template = node.data.prompt;
  //   const llms = node.data.llms;
  //   // Get inputs from connected nodes
  //   const inputs = await this.getNodeInputs(node, context);
  //   return await this.runLLMPrompt(template, llms, inputs);
  // }

  private async executeTextFieldsNode(
    node: Node,
    context: Map<string, any>,
  ): Promise<any> {
    // Text fields node simply outputs its data
    return {
      type: "textfields",
      output: node.data.fields,
      nodeId: node.id,
    };
  }

  // private async executeJoinNode(node: Node, context: Map<string, any>): Promise<any> {
  //   // Combine inputs from all source nodes
  //   const inputs = await this.getNodeInputs(node, context);
  //   return this.combineInputs(inputs);
  // }

  // private async executeVisualizationNode(node: Node, context: Map<string, any>): Promise<any> {
  //   // Visualization nodes process their inputs for display
  //   const inputs = await this.getNodeInputs(node, context);
  //   return this.processVisualizationData(inputs, node.data.visualizationType);
  // }

  // // Helper methods
  // private async getNodeInputs(node: Node, context: Map<string, any>): Promise<any[]> {
  //   const inputEdges = Array.from(this.edges.entries())
  //     .flatMap(([source, edges]) => edges)
  //     .filter(edge => edge.target === node.id);

  //   const inputs = await Promise.all(
  //     inputEdges.map(edge => context.get(edge.source))
  //   );

  //   return inputs;
  // }

  // private getInputNodeIds(node: Node): string[] {
  //   return Array.from(this.edges.entries())
  //     .flatMap(([source, edges]) => edges)
  //     .filter(edge => edge.target === node.id)
  //     .map(edge => edge.source);
  // }
}
