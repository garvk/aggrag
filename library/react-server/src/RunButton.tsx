// import React from "react";
// import { FLASK_BASE_URL } from "./backend/utils";

// interface RunButtonProps {
//   flow: any;
//   onExecutionComplete?: (results: any) => void;
//   disabled?: boolean;
// }

// export const RunButton: React.FC<RunButtonProps> = ({
//   flow,
//   onExecutionComplete,
//   disabled = false,
// }) => {
//   const [isRunning, setIsRunning] = React.useState(false);

//   const handleRun = async () => {
//     try {
//       setIsRunning(true);

//       const response = await fetch(`${FLASK_BASE_URL}/app/run`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           "Access-Control-Allow-Origin": "*",
//         },
//         body: JSON.stringify({ flow }),
//       });

//       const data = await response.json();

//       if (!data.success) {
//         throw new Error(data.error);
//       }

//       onExecutionComplete?.(data.results);
//     } catch (error) {
//       console.error("Flow execution failed:", error);
//       // Handle error (show notification, etc.)
//     } finally {
//       setIsRunning(false);
//     }
//   };

//   return (
//     <button
//       onClick={handleRun}
//       disabled={disabled || isRunning}
//       className="run-button"
//     >
//       {isRunning ? "Running..." : "Run Iteration"}
//     </button>
//   );
// };
