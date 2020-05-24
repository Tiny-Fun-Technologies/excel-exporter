const shell = require("shelljs");
shell.exec("npm install && npm run compile")
shell.cp(["转表.bat", "转表.sh", "excel-exporter.json"], "dist")