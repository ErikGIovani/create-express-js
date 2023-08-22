import dotenv from "dotenv";
import app from "./app.js";

dotenv.config();

const PORT = process.env.PORT ?? 3000;

const main = () => {
  app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
  });
};

main();
