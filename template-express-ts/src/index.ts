import dotenv from "dotenv";
import app from "./app";
import type { Port } from "./types";

dotenv.config();

const PORT: Port = process.env.PORT !== undefined ? Number(process.env.PORT) : 3000;

const main = () => {
  app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
  });
};

main();
