import express from "express";
import dotenv from "dotenv";
import { basename } from "node:path";
dotenv.config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT;


//admin enpoints
 

app.post("/createchat")

app.get("/", (req, res) => {
  res.json("I am healthy");
});


app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
