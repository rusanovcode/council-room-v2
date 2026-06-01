const { spawn } = require("node:child_process");

const cmd = process.env.CLAUDE_CMD || "claude";
console.log("CLAUDE_CMD:", cmd);
console.log("CLAUDE_CONFIG_DIR:", process.env.CLAUDE_CONFIG_DIR);
console.log("---");

const args = ["-p", "--permission-mode", "default", "--output-format", "text", "--no-session-persistence"];
const child = spawn(cmd, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });

let stdout = "", stderr = "";
child.stdout.on("data", d => { stdout += d; });
child.stderr.on("data", d => { stderr += d; });
child.on("close", code => {
  console.log("exit:", code);
  console.log("stdout:", stdout.slice(0, 500));
  console.log("stderr:", stderr.slice(0, 500));
});
child.stdin.write("say: HELLO FROM ACC2");
child.stdin.end();
