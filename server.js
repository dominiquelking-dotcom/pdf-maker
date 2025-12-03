kconst express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4005;

// ---------- Simple request logging middleware ----------
app.use((req, res, next) => {
  const start = Date.now();
  const time = new Date().toISOString();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${time}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`
    );
  });

  next();
});

// ---------- Static assets ----------

// Serve pdf-lib directly from node_modules under a clean URL
app.use(
  "/vendor/pdf-lib",
  express.static(path.join(__dirname, "node_modules", "pdf-lib", "dist"))
);

// Serve frontend assets (your public folder)
app.use(express.static(path.join(__dirname, "public")));

// ---------- Routes ----------

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", app: "pdf-maker" });
});

// Fallback → SPA index (for any other route)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---------- Error logger (after routes) ----------
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err.stack || err);
  res.status(500).send("Internal Server Error");
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`MyFreightTracker PDF Studio running on port ${PORT}`);
});

