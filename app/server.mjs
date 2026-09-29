import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { replaceProductAndBrandText } from "./reference-image-editor.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 3000);
const mongoUrl = process.env.MONGO_URL;
const mongoDatabase = process.env.MONGO_DATABASE || "imageGenerator";

let database = null;
let mongoStatus = "not configured";

if (mongoUrl) {
  try {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(mongoUrl);
    await client.connect();
    database = client.db(mongoDatabase);
    mongoStatus = `connected to ${mongoDatabase}`;
    console.log(`MongoDB ${mongoStatus}`);
  } catch (error) {
    mongoStatus = "connection failed; using local memory mode";
    console.error("MongoDB connection failed:", error.message);
  }
}

const memoryJobs = [];

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function handleGenerate(request, response) {
  const body = JSON.parse(await readBody(request));
  const required = ["productName", "brandName", "referenceImage"];
  const missing = required.filter((field) => !body[field]);
  if (missing.length) {
    return sendJson(response, 400, {
      error: "VALIDATION_FAILED",
      errors: missing.map((field) => ({ field, message: `${field} is required.` })),
    });
  }

  const job = {
    productType: body.productType,
    productName: body.productName,
    brandName: body.brandName,
    referenceImage: body.referenceImage,
    status: "received",
    createdAt: new Date(),
  };

  if (database) {
    await database.collection("generationJobs").insertOne(job);
  } else {
    memoryJobs.push(job);
  }

  const generatedImage = await replaceProductAndBrandText(
    body.referenceImage,
    body.productName,
    body.brandName,
  );

  return sendJson(response, 200, {
    status: "accepted",
    mode: "local-image-editor",
    originalImage: body.referenceImage,
    generatedImage,
    message: "Only the product name and brand name were replaced in the reference image.",
  });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/api/health") {
      return sendJson(response, 200, { ok: true, mongoStatus });
    }
    if (request.method === "POST" && request.url === "/api/generate") {
      return await handleGenerate(request, response);
    }

    const requested = request.url === "/" ? "/index.html" : request.url;
    const safePath = path.normalize(requested).replace(/^([.][.][/\\])+/, "");
    const filePath = path.join(publicDir, safePath);
    const content = await fs.readFile(filePath);
    const contentType = filePath.endsWith(".html") ? "text/html" : "text/plain";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  } catch (error) {
    sendJson(response, 500, { error: "SERVER_ERROR", message: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local app running at http://localhost:${port}`);
});
