// Currently coloredFlowExecutor wont handle parallel flows. Plus its an experimental feature
interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  data?: {
    colored?: boolean;
  };
}

interface Node {
  id: string;
  type: string;
  data: any;
}

interface Flow {
  nodes: Node[];
  edges: Edge[];
}

export class ColoredFlowExecutor {
  private nodes: Map<string, Node>;
  private coloredEdges: Map<string, Edge[]>;
  private regularEdges: Map<string, Edge[]>;
  private entryNodes: Set<string>;
  private outputNodes: Set<string>;

  constructor(flow: Flow) {
    console.log("Initializing ColoredFlowExecutor with provided flow data.");
    this.nodes = new Map(flow.nodes.map((node) => [node.id, node]));
    this.coloredEdges = new Map();
    this.regularEdges = new Map();
    this.entryNodes = new Set();
    this.outputNodes = new Set();

    // Separate colored and regular edges
    flow.edges.forEach((edge) => {
      const edgeMap = edge.data?.colored
        ? this.coloredEdges
        : this.regularEdges;
      if (!edgeMap.has(edge.source)) {
        edgeMap.set(edge.source, []);
      }
      edgeMap.get(edge.source)!.push(edge);
    });

    this.identifySpecialNodes(flow);

    console.log(`Colored edges:`, this.coloredEdges);
    // console.log(`Regular edges:`, this.regularEdges);
    console.log(`Input nodes:`, this.entryNodes);
    console.log(`Output nodes:`, this.outputNodes);
  }

  private identifySpecialNodes(flow: Flow): void {
    console.log("Identifying entry and output nodes.");
    const hasIncomingEdges = new Set(flow.edges.map((e) => e.target));
    const hasOutgoingEdges = new Set(flow.edges.map((e) => e.source));

    this.nodes.forEach((_, id) => {
      if (!hasIncomingEdges.has(id)) {
        this.entryNodes.add(id);
        console.log(`Node ${id} added as entry node.`);
      }
      if (!hasOutgoingEdges.has(id)) {
        this.outputNodes.add(id);
        console.log(`Node ${id} added as output node.`);
      }
    });
  }

  private async executeNode(
    nodeId: string,
    executionContext: Map<string, any>,
  ): Promise<any> {
    console.log(`Executing node ${nodeId}.`);
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);

    // Execute node based on its type
    const result = await this.executeNodeByType(node, executionContext);
    executionContext.set(nodeId, result);

    console.log(`Node ${nodeId} executed with result:`, result);
    return result;
  }

  private async executeNodeByType(
    node: Node,
    context: Map<string, any>,
  ): Promise<any> {
    console.log(`Executing node by type: ${node.type}`);
    switch (node.type) {
      case "textfields":
        return {
          type: "textfields",
          output: node.data.fields,
          nodeId: node.id,
        };
      // Add other node type handlers here
      default:
        throw new Error(`Unsupported node type: ${node.type}`);
    }
  }

  public async execute(): Promise<Map<string, any>> {
    console.log("Determining execution order...");
    const executionOrder = this.determineExecutionOrder();
    console.log("Execution order determined:", executionOrder);

    console.log("Starting execution of flow.");
    const executionContext = new Map<string, any>();
    const visited = new Set<string>();

    // Execute nodes in the determined order
    for (const nodeId of executionOrder) {
      if (!visited.has(nodeId)) {
        await this.executeColoredFlow(nodeId, executionContext, visited);
      }
    }

    console.log("Execution of flow completed.");
    return executionContext;
  }

  private async executeColoredFlow(
    currentNodeId: string,
    executionContext: Map<string, any>,
    visited: Set<string>,
  ): Promise<void> {
    if (visited.has(currentNodeId)) return;

    console.log(`Executing colored flow node ${currentNodeId}.`);
    await this.executeNode(currentNodeId, executionContext);
    visited.add(currentNodeId);

    const coloredOutgoingEdges = this.coloredEdges.get(currentNodeId) || [];
    for (const edge of coloredOutgoingEdges) {
      console.log(
        `Following colored edge from ${currentNodeId} to ${edge.target}.`,
      );
      await this.executeColoredFlow(edge.target, executionContext, visited);
    }
  }

  private determineExecutionOrder(): string[] {
    const connectedNodes = this.getConnectedNodes();
    const inDegree = new Map<string, number>();
    const zeroInDegreeQueue: string[] = [];
    const sortedOrder: string[] = [];

    // Initialize inDegree map only for connected nodes
    connectedNodes.forEach((nodeId) => {
      inDegree.set(nodeId, 0);
    });

    // Calculate inDegree for each connected node
    this.coloredEdges.forEach((edges) => {
      edges.forEach((edge) => {
        if (connectedNodes.has(edge.target)) {
          inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }
      });
    });

    // Find entry points (nodes with no incoming colored edges)
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0 && this.coloredEdges.has(nodeId)) {
        zeroInDegreeQueue.push(nodeId);
      }
    });

    // If no entry points found among nodes with outgoing edges,
    // look for isolated entry nodes
    if (zeroInDegreeQueue.length === 0) {
      connectedNodes.forEach((nodeId) => {
        if (inDegree.get(nodeId) === 0) {
          zeroInDegreeQueue.push(nodeId);
        }
      });
    }

    // Process nodes in topological order
    while (zeroInDegreeQueue.length > 0) {
      const nodeId = zeroInDegreeQueue.shift()!;
      sortedOrder.push(nodeId);

      const edges = this.coloredEdges.get(nodeId) || [];
      edges.forEach((edge) => {
        if (connectedNodes.has(edge.target)) {
          const newDegree = inDegree.get(edge.target)! - 1;
          inDegree.set(edge.target, newDegree);
          if (newDegree === 0) {
            zeroInDegreeQueue.push(edge.target);
          }
        }
      });
    }

    // Validate that all connected nodes are included
    if (sortedOrder.length !== connectedNodes.size) {
      throw new Error("Invalid graph structure: not all nodes can be reached");
    }

    return sortedOrder;
  }

  //   private determineExecutionOrder(): string[] {
  //     const inDegree = new Map<string, number>();
  //     const zeroInDegreeQueue: string[] = [];
  //     const sortedOrder: string[] = [];
  //     const connectedNodes = this.getConnectedNodes();

  //     // Initialize inDegree map for only nodes connected by colored edges
  //     this.coloredEdges.forEach((edges, source) => {
  //       if (connectedNodes.has(source)) {
  //         inDegree.set(source, 0); // Ensure all source nodes are in the map
  //         edges.forEach((edge) => {
  //           if (connectedNodes.has(edge.target)) {
  //             inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  //           }
  //         });
  //       }
  //     });

  //     // Find all nodes with zero in-degree within the subgraph of colored edges
  //     inDegree.forEach((degree, nodeId) => {
  //       if (degree === 0 && connectedNodes.has(nodeId)) {
  //         zeroInDegreeQueue.push(nodeId);
  //       }
  //     });

  //     // Process nodes with zero in-degree
  //     while (zeroInDegreeQueue.length) {
  //       const nodeId = zeroInDegreeQueue.shift()!;
  //       sortedOrder.push(nodeId);
  //       const nodeEdges = this.coloredEdges.get(nodeId) || [];

  //       nodeEdges.forEach((edge) => {
  //         if (connectedNodes.has(edge.target)) {
  //           const targetInDegree = inDegree.get(edge.target)! - 1;
  //           inDegree.set(edge.target, targetInDegree);
  //           if (targetInDegree === 0) {
  //             zeroInDegreeQueue.push(edge.target);
  //           }
  //         }
  //       });
  //     }

  //     // Check for cycle
  //     if (sortedOrder.length !== connectedNodes.size) {
  //       throw new Error("Cycle detected in the graph, invalid execution order.");
  //     }

  //     return sortedOrder;
  //   }

  private async executeRegularFlow(
    currentNodeId: string,
    executionContext: Map<string, any>,
    visited: Set<string>,
  ): Promise<void> {
    if (visited.has(currentNodeId)) return;

    console.log(`Executing regular flow node ${currentNodeId}.`);
    await this.executeNode(currentNodeId, executionContext);
    visited.add(currentNodeId);

    const regularOutgoingEdges = this.regularEdges.get(currentNodeId) || [];
    for (const edge of regularOutgoingEdges) {
      console.log(
        `Following regular edge from ${currentNodeId} to ${edge.target}.`,
      );
      await this.executeRegularFlow(edge.target, executionContext, visited);
    }
  }

  private getConnectedNodes(): Set<string> {
    const connectedNodes = new Set<string>();
    this.coloredEdges.forEach((edges, source) => {
      connectedNodes.add(source);
      edges.forEach((edge) => {
        connectedNodes.add(edge.target);
      });
    });
    return connectedNodes;
  }
}
