import express, { Router } from "express";
import cors from "cors";
import { FlowExecutor } from "../services/FlowExecutor";

const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Create router for flow endpoints
const router = Router();

router.post("/app/run", async (req, res) => {
  console.log("[/app/run] Received flow execution request");
  try {
    const { flow } = req.body;

    // Validate flow structure
    if (!flow || !flow.nodes || !flow.edges) {
      return res.status(400).json({ error: "Invalid flow structure" });
    }
    console.log(
      `[/app/run] Executing flow with ${flow.nodes.length} nodes and ${flow.edges.length} edges`,
    );
    // Create executor and run flow
    const executor = new FlowExecutor(flow);
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

// Mount the router
app.use("/", router);

export default app;
