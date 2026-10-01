import fs from "fs";
import path from "path";
import Groq from "groq-sdk";

const envPath = path.join(process.cwd(), ".env");
let key = process.env.GROQ_API_KEY;
if (!key && fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  const match = content.match(/GROQ_API_KEY\s*=\s*["']?([^"'\r\n]+)/);
  if (match) key = match[1];
}

async function check() {
  if (!key) {
    console.log("No key found");
    return;
  }
  const groq = new Groq({ apiKey: key });
  try {
    const list = await groq.models.list();
    console.log("AVAILABLE GROQ MODELS:", list.data.map(m => m.id));
  } catch (err: any) {
    console.error("GROQ LIST ERROR:", err.message);
  }
}

check();
