import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import { PDFParse } from "pdf-parse";
dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
app.use(express.json());
const PORT = process.env.PORT;

//admin enpoints

//creates knowledgebase
app.post("/knowledgebase", (req, res) => {
  //step1 : it will take the orgname, knowbname, address, type
  //validation
  //creates new knowledge base
  //return knowledgebase
});

//fetches the docs
app.post("/docs:orgId", upload.single("pdfFile"), async (req, res) => {

  //multer will have the pdf in memory
  if (!req.file) return res.status(400).send("No file uploaded.");
  if (req.file.mimetype !== "application/pdf")
    return res.status(400).send("Only PDF files allowed.");

  //getting pdf from storage
  const pdf = req.file.buffer;
  
  // const orgId = req.params;
  // cosnt {category,type}

  const parser = new PDFParse({
    data: new Uint8Array(pdf),
  });

  const result = await parser.getText();
  console.log(result);

  //passed that text to embeeding model
  //chunks and storage in vector db 
  //return document embeed success
});


app.get("/", (req, res) => {
  res.json("I am healthy");
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
