#!/usr/bin/env node
/**
 * check-sdk.js
 *
 * Verifies that sdk/lm-sdk.js (and the example widget) contain only ASCII characters,
 * which LogicMonitor's HTML sanitizer requires, and that the SDK compiles.
 *
 * Usage:
 *   node tools/check-sdk.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SDK_DIR = path.join(__dirname, "..", "sdk");
const FILES = [
	path.join(SDK_DIR, "lm-sdk.js"),
	path.join(SDK_DIR, "examples", "device-list-widget.html"),
];

let failed = false;

// Function to report any non-ASCII characters found in a file...
function checkAscii(file) {
	const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
	lines.forEach((line, i) => {
		for (let c = 0; c < line.length; c++) {
			const code = line.charCodeAt(c);
			if (code > 0x7e || (code < 0x20 && code !== 0x09)) {
				console.error(`${path.relative(process.cwd(), file)}:${i + 1}:${c + 1} non-ASCII character U+${code.toString(16).toUpperCase()}`);
				failed = true;
				return;
			}
		}
	});
}

FILES.forEach((file) => {
	if (fs.existsSync(file)) checkAscii(file);
});

try {
	new vm.Script(fs.readFileSync(FILES[0], "utf8"), { filename: FILES[0] });
} catch (e) {
	console.error(`Syntax error in lm-sdk.js: ${e.message}`);
	failed = true;
}

if (failed) process.exit(1);
console.log("SDK check passed: ASCII only and syntax OK.");
