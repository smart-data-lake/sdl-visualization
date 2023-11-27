const fs = require("fs");

if (process.argv.length !== 3) {
  console.error("Usage: node backend-config.js url");
  process.exit(1);
}

const url = process.argv[2];

fs.readFile("public/manifest.json", "utf8", (err, data) => {
  if (err) {
    console.error("Error reading the file:", err);
    process.exit(1); // Exit with an error code
  }

  const json = JSON.parse(data);
  json["backendConfig"] = `rest;${url}`;

  const modifiedJson = JSON.stringify(json, null, 2);

  fs.writeFile("public/manifest.json", modifiedJson, "utf8", (err) => {
    if (err) {
      console.error("Error writing to the file:", err);
      process.exit(1);
    }

    console.log("JSON file modified successfully.");
  });
});
