const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function testEmbedding(modelName, outputDim) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log(`Testing ${modelName} with outputDimensionality = ${outputDim}...`);
    const embedModel = genAI.getGenerativeModel({ model: modelName });
    const embedResult = await embedModel.embedContent({
      content: { role: "user", parts: [{ text: "Hello world" }] },
      outputDimensionality: outputDim
    });
    console.log(`  Success embedding length:`, embedResult.embedding.values.length);
    return true;
  } catch (error) {
    console.log(`  Failed:`, error.message);
    return false;
  }
}

async function main() {
  await testEmbedding("gemini-embedding-2", 768);
  await testEmbedding("gemini-embedding-001", 768);
}

main();
