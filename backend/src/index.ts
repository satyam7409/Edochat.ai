import express from "express";
import dotenv from "dotenv";
import { errorHandler } from "./middlewares/error.middleware";
dotenv.config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT;
  

app.get("/", (req, res) => {
  res.json("I am healthy");
});

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
