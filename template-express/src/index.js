const dotenv = require("dotenv");
const app = require("./app");

dotenv.config();

const PORT = process.env.PORT ?? 3000;

const main = () => {
  app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
  });
};

main();
