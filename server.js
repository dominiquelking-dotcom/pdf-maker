const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4005;

// Serve pdf-lib directly from node_modules under a clean URL
app.use(
  "/vendor/pdf-lib",
  express.static(path.join(__dirname, "node_modules", "pdf-lib", "dist"))
);

// Serve frontend assets
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", app: "pdf-maker" });
});

// Fallback → SPA index
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`MyFreightTracker PDF Studio running on port ${PORT}`);
});

