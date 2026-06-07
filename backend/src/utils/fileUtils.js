const fs = require("fs").promises;
const path = require("path");

const dataDirectory = path.join(__dirname, "..", "data");

const dataPaths = {
  doctors: path.join(dataDirectory, "doctors.json"),
  patients: path.join(dataDirectory, "patients.json"),
  diagnoses: path.join(dataDirectory, "diagnoses.json"),
  users: path.join(dataDirectory, "users.json"),
};

async function readJson(filePath) {
  const content = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(content);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function getNextId(items) {
  if (!items.length) return 1;
  return Math.max(...items.map((item) => Number(item.id) || 0)) + 1;
}

module.exports = {
  dataPaths,
  readJson,
  writeJson,
  getNextId,
};
