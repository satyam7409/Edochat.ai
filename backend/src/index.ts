import express from "express";
import dotenv from "dotenv";
import { errorHandler } from "./middlewares/error.middleware";
import orgRoutes from "./route/org.routes"
import userRoutes from "./route/user.routes"
dotenv.config();

const app = express();
app.use(express.json());
const PORT = process.env.PORT;
  

app.get("/", (req, res) => {
  res.json("I am healthy");
});

app.use("/org",orgRoutes);
app.use("/user",userRoutes);
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

