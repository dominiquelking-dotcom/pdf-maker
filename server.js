const express = require("express");
// Simple request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    const time = new Date().toISOString();

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${time}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    });

    next();
});

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
// Error logger
app.use((err, req, res, next) => {
    console.error("🔥 ERROR:", err.stack || err);
    res.status(500).send("Internal Server Error");
});

app.listen(PORT, () => {
  console.log(`MyFreightTracker PDF Studio running on port ${PORT}`);
});

