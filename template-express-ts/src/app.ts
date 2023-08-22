import express from "express";
import type { Request, Response } from "express";

const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ message: "Welcome to Express JS" });
});
app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" });
});

export default app;
