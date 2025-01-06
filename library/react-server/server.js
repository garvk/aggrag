/* eslint-disable @typescript-eslint/no-var-requires */
const { exec } = require("child_process");
const path = require("path");

const serverPath = path.join(__dirname, "src/server.ts");

exec(`ts-node ${serverPath}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
  console.error(`stderr: ${stderr}`);
});
