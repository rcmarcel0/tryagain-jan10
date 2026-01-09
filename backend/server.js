import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, "../frontend")));

app.post("/api/rewrite", async (req, res) => {
  const { text, tone } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  try {
    // 1. Clean the Endpoint: Remove trailing slashes or /openai/ paths
    const baseEndpoint = process.env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "").replace(/\/openai$/, "");
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

    // 2. Construct the URL
    const url = `${baseEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    
    console.log(`[DEBUG] Calling Azure at: ${url}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.AZURE_OPENAI_API_KEY,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: "You are Rephraso, a writing assistant." },
          { role: "user", content: `Rewrite the following text in a ${tone || "neutral"} tone:\n\n${text}` }
        ],
        temperature: 0.7
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[ERROR] Azure API returned:", data);
      // Specifically catch the "Resource not found" to give better advice
      if (response.status === 404) {
        return res.status(404).json({ 
          error: "Azure Resource not found. Verify your Deployment Name matches Azure exactly (case-sensitive)." 
        });
      }
      return res.status(response.status).json({ error: data.error?.message || "Azure error occurred." });
    }

    res.json({ rewrittenText: data.choices[0].message.content.trim() });

  } catch (error) {
    console.error("[CRITICAL] Server Error:", error);
    res.status(500).json({ error: "Could not connect to the rephrasing service." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Rephraso backend running on http://localhost:${PORT}`);
});