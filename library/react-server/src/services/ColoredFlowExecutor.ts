/**
 * ColoredFlowExecutor Class
 *
 * This class is designed to execute nodes in a flow graph where edges are marked as "colored" to indicate special processing paths.
 * It supports parallel execution of nodes where dependencies allow. This is particularly useful for complex workflows where
 * certain tasks can be performed concurrently, improving efficiency and execution time.
 *
 * Key functionalities:
 * - Separates colored and regular edges during initialization.
 * - Identifies entry and output nodes based on the presence of incoming and outgoing edges.
 * - Executes nodes in topological order based on their dependencies, grouped by levels for parallel execution.
 *
 * Usage:
 * The executor requires a `Flow` object containing nodes and edges on initialization. Nodes will be executed based on the
 * colored edges that define their execution dependencies. Regular edges are ignored for execution order but can be used
 * for other purposes such as data validation or additional side effects in a regular flow context.
 *
 * Example:
 * ```
 * const flow = { nodes: [...], edges: [...] };
 * const executor = new ColoredFlowExecutor(flow);
 * executor.execute().then(context => {
 *   console.log("Execution context:", context);
 * });
 * ```
 *
 * Implementation Details:
 * - `executeNode`: Handles the execution of a single node (see lines 75-89).
 * - `execute`: Orchestrates the overall execution, managing parallelism where applicable (see lines 109-132).
 * - `determineExecutionOrder`: Determines the order of execution, organizing nodes into levels for parallel processing (see lines 186-227).
 *
 * Note: This is an experimental feature and may not fully support all types of graph structures, especially those with complex cyclic dependencies.
 *
 * Therefore, ensure you 'Validate' the flow with 'Validate Flow' CTA inside 'Run Flow' CTA.
 */

// Currently coloredFlowExecutor wont handle parallel flows. Plus its an experimental feature
import { nodeExecutionService } from "./NodeExecutionService";
import { HeadlessBrowserService } from "./HeadlessBrowserService";

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
  private headlessBrowser: HeadlessBrowserService;

  constructor(flow: Flow) {
    console.log("Initializing ColoredFlowExecutor with provided flow data.");
    this.nodes = new Map(flow.nodes.map((node) => [node.id, node]));
    this.coloredEdges = new Map();
    this.regularEdges = new Map();
    this.entryNodes = new Set();
    this.outputNodes = new Set();
    this.headlessBrowser = new HeadlessBrowserService();

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
    executionContext: Map<string, any>,
  ): Promise<any> {
    console.log(`Executing node by type: ${node.type}`);

    try {
      // Initialize browser if needed
      await this.headlessBrowser.initialize();

      // Declare variables outside switch
      let result;

      switch (node.type) {
        case "textfields":
          return {
            type: "textfields",
            output: node.data.fields,
            nodeId: node.id,
          };

        case "prompt":
          // Pass the execution context to handle any dependencies
          result = await this.headlessBrowser.executePromptNode(node.id);
          return {
            type: "prompt",
            output: result,
            nodeId: node.id,
          };

        default:
          throw new Error(`Unsupported node type: ${node.type}`);
      }
    } catch (error) {
      console.error(`Error executing node ${node.id}:`, error);
      throw error;
    }
  }

  // For parallel flow;
  public async execute(): Promise<Map<string, any>> {
    console.log("Determining execution order...");
    const executionLevels = this.determineExecutionOrder();
    console.log("Execution levels determined:", executionLevels);

    const executionContext = new Map<string, any>();
    const visited = new Set<string>();

    // Execute nodes level by level
    for (const level of executionLevels) {
      // Execute all nodes in current level in parallel
      await Promise.all(
        level.map((nodeId) =>
          this.executeNode(nodeId, executionContext).then(() =>
            visited.add(nodeId),
          ),
        ),
      );
    }

    console.log("Execution of flow completed.");
    return executionContext;
  }

  // For single flow; not for parallel flow
  //   public async execute(): Promise<Map<string, any>> {
  //     console.log("Determining execution order...");
  //     const executionOrder = this.determineExecutionOrder();
  //     console.log("Execution order determined:", executionOrder);

  //     console.log("Starting execution of flow.");
  //     const executionContext = new Map<string, any>();
  //     const visited = new Set<string>();

  //     // Execute nodes in the determined order
  //     for (const nodeId of executionOrder) {
  //       if (!visited.has(nodeId)) {
  //         await this.executeColoredFlow(nodeId, executionContext, visited);
  //       }
  //     }

  //     console.log("Execution of flow completed.");
  //     return executionContext;
  //   }

  // For parallel flow
  private determineExecutionOrder(): string[][] {
    const connectedNodes = this.getConnectedNodes();
    const inDegree = new Map<string, number>();
    const levelGroups: string[][] = [];

    // Initialize inDegree map
    connectedNodes.forEach((nodeId) => {
      inDegree.set(nodeId, 0);
    });

    // Calculate inDegree for each node
    this.coloredEdges.forEach((edges) => {
      edges.forEach((edge) => {
        if (connectedNodes.has(edge.target)) {
          inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
        }
      });
    });

    // Group nodes by levels (nodes in same level can be executed in parallel)
    while (inDegree.size > 0) {
      const currentLevel: string[] = [];

      // Find all nodes with zero in-degree
      inDegree.forEach((degree, nodeId) => {
        if (degree === 0) {
          currentLevel.push(nodeId);
        }
      });

      if (currentLevel.length === 0 && inDegree.size > 0) {
        throw new Error("Cycle detected in the graph");
      }

      // Remove processed nodes and update in-degrees
      currentLevel.forEach((nodeId) => {
        inDegree.delete(nodeId);
        const edges = this.coloredEdges.get(nodeId) || [];
        edges.forEach((edge) => {
          if (inDegree.has(edge.target)) {
            inDegree.set(edge.target, inDegree.get(edge.target)! - 1);
          }
        });
      });

      if (currentLevel.length > 0) {
        levelGroups.push(currentLevel);
      }
    }

    return levelGroups;
  }

  //   # single flow working; not for parallel flow
  //   private determineExecutionOrder(): string[] {
  //     const connectedNodes = this.getConnectedNodes();
  //     const inDegree = new Map<string, number>();
  //     const zeroInDegreeQueue: string[] = [];
  //     const sortedOrder: string[] = [];

  //     // Initialize inDegree map only for connected nodes
  //     connectedNodes.forEach((nodeId) => {
  //       inDegree.set(nodeId, 0);
  //     });

  //     // Calculate inDegree for each connected node
  //     this.coloredEdges.forEach((edges) => {
  //       edges.forEach((edge) => {
  //         if (connectedNodes.has(edge.target)) {
  //           inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  //         }
  //       });
  //     });

  //     // Find entry points (nodes with no incoming colored edges)
  //     inDegree.forEach((degree, nodeId) => {
  //       if (degree === 0 && this.coloredEdges.has(nodeId)) {
  //         zeroInDegreeQueue.push(nodeId);
  //       }
  //     });

  //     // If no entry points found among nodes with outgoing edges,
  //     // look for isolated entry nodes
  //     if (zeroInDegreeQueue.length === 0) {
  //       connectedNodes.forEach((nodeId) => {
  //         if (inDegree.get(nodeId) === 0) {
  //           zeroInDegreeQueue.push(nodeId);
  //         }
  //       });
  //     }

  //     // Process nodes in topological order
  //     while (zeroInDegreeQueue.length > 0) {
  //       const nodeId = zeroInDegreeQueue.shift()!;
  //       sortedOrder.push(nodeId);

  //       const edges = this.coloredEdges.get(nodeId) || [];
  //       edges.forEach((edge) => {
  //         if (connectedNodes.has(edge.target)) {
  //           const newDegree = inDegree.get(edge.target)! - 1;
  //           inDegree.set(edge.target, newDegree);
  //           if (newDegree === 0) {
  //             zeroInDegreeQueue.push(edge.target);
  //           }
  //         }
  //       });
  //     }

  //     // Validate that all connected nodes are included
  //     if (sortedOrder.length !== connectedNodes.size) {
  //       throw new Error("Invalid graph structure: not all nodes can be reached");
  //     }

  //     return sortedOrder;
  //   }

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
