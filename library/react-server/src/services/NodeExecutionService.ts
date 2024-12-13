import { Node, Edge } from "reactflow";

interface NodeRef {
  // Modified to make run optional since not all nodes need it
  run?: (...args: any[]) => Promise<any>;
  handleRunClick: () => void;
  type: string;
}

export class NodeExecutionService {
  private nodeRefs: Map<string, NodeRef> = new Map();

  registerNodeRef(nodeId: string, ref: NodeRef) {
    this.nodeRefs.set(nodeId, ref);
  }

  unregisterNodeRef(nodeId: string) {
    this.nodeRefs.delete(nodeId);
  }

  async executeNode(nodeId: string, userInputs?: Record<string, string>) {
    const nodeRef = this.nodeRefs.get(nodeId);
    if (!nodeRef) {
      throw new Error(`No ref found for node ${nodeId}`);
    }

    // Replace any {user_input_for_api} in the node's data
    if (userInputs) {
      // TODO: Replace user inputs in node data
      console.log(`Replacing user inputs for node ${nodeId}`, userInputs);
    }

    try {
      // First try to use run if available
      if (nodeRef.run) {
        const result = await nodeRef.run();
        return result;
      }

      // Fallback to handleRunClick
      nodeRef.handleRunClick();

      // Wait for execution to complete
      return new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
    } catch (error) {
      console.error(`Error executing node ${nodeId}:`, error);
      throw error;
    }
  }
}

export const nodeExecutionService = new NodeExecutionService();
