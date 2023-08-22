import express from "express";

const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome to Express JS" });
});
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

export default app;
