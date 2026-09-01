#!/usr/bin/env node
/**
 * check-full-sync.js
 * 
 * Checks that Better_Map_Widget-Full.html stays in sync with:
 *   - Better_Map_Widget.js (main widget logic)
 *   - Better_Map_Widget.css (stylesheet)
 * 
 * The JS file and Full.html are different variants:
 *   - JS file: CDN version loaded externally
 *   - Full.html: Self-contained version with all code embedded
 * 
 * This tool compares the core logic (functions, not wrapper code) to detect drift.
 * 
 * Usage:
 *   node tools/check-full-sync.js           # Check for drift
 *   node tools/check-full-sync.js --verbose # Show detailed diff
 */

const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "..", "src");
const JS_FILE = path.join(SRC_DIR, "Better_Map_Widget.js");
const CSS_FILE = path.join(SRC_DIR, "Better_Map_Widget.css");
const FULL_FILE = path.join(SRC_DIR, "Better_Map_Widget-Full.html");

const VERBOSE = process.argv.includes("--verbose");

// ============================================================================
// Extraction helpers
// ============================================================================

/**
 * Normalize a line: remove leading tabs/spaces for comparison
 */
function normalizeLine(line) {
	return line.trim();
}

/**
 * Extract the CSS from Full.html (between <style type="text/css"> and </style>)
 */
function extractCssFromFull(fullContent) {
	const styleStart = fullContent.indexOf('<style type="text/css">');
	const styleEnd = fullContent.indexOf("</style>");
	if (styleStart === -1 || styleEnd === -1) {
		throw new Error("Could not find <style> block in Full.html");
	}
	const afterTag = fullContent.indexOf(">", styleStart) + 1;
	let css = fullContent.slice(afterTag, styleEnd);
	// Remove leading tab from each line (Full.html indentation)
	css = css.split("\n").map(line => line.startsWith("\t") ? line.slice(1) : line).join("\n");
	return css.trim();
}

/**
 * Extract the main widget script from Full.html (the large script block with all the widget logic)
 */
function extractMainScriptFromFull(fullContent) {
	// Find the script that contains the main widget code (look for a unique function)
	const marker = "function refreshGroupData";
	const markerIndex = fullContent.indexOf(marker);
	if (markerIndex === -1) {
		throw new Error("Could not find main widget script in Full.html");
	}
	
	// Find the opening <script> before this marker
	const beforeMarker = fullContent.slice(0, markerIndex);
	const scriptTagIndex = beforeMarker.lastIndexOf("<script>");
	if (scriptTagIndex === -1) {
		throw new Error("Could not find <script> tag for main widget in Full.html");
	}
	
	// Find the closing </script> after the marker (skip comments)
	let searchStart = markerIndex;
	let endScriptIndex = -1;
	while (true) {
		const afterMarker = fullContent.slice(searchStart);
		const idx = afterMarker.indexOf("</script>");
		if (idx === -1) break;
		// Check if this </script> is inside a comment
		const lineStart = afterMarker.lastIndexOf("\n", idx);
		const lineContent = afterMarker.slice(lineStart, idx);
		if (!lineContent.includes("<!--")) {
			endScriptIndex = searchStart + idx;
			break;
		}
		searchStart += idx + 1;
	}
	
	if (endScriptIndex === -1) {
		throw new Error("Could not find </script> for main widget in Full.html");
	}
	
	let js = fullContent.slice(scriptTagIndex + "<script>".length, endScriptIndex);
	// Remove leading tab from each line (Full.html indentation)
	js = js.split("\n").map(line => line.startsWith("\t") ? line.slice(1) : line).join("\n");
	return js.trim();
}

/**
 * Read the standalone JS file
 */
function readJs() {
	return fs.readFileSync(JS_FILE, "utf8").trim();
}

/**
 * Read the standalone CSS file
 */
function readCss() {
	return fs.readFileSync(CSS_FILE, "utf8").trim();
}

// ============================================================================
// Function extraction and comparison
// ============================================================================

/**
 * Extract a function body from source code by name
 */
function extractFunction(source, funcName) {
	// Match various function declaration patterns
	const patterns = [
		new RegExp(`(async\\s+)?function\\s+${funcName}\\s*\\(`),
		new RegExp(`const\\s+${funcName}\\s*=\\s*(async\\s+)?function\\s*\\(`),
		new RegExp(`const\\s+${funcName}\\s*=\\s*(async\\s+)?\\(`),
		new RegExp(`let\\s+${funcName}\\s*=\\s*(async\\s+)?function\\s*\\(`),
		new RegExp(`var\\s+${funcName}\\s*=\\s*(async\\s+)?function\\s*\\(`),
	];
	
	let startIndex = -1;
	for (const pattern of patterns) {
		const match = source.match(pattern);
		if (match) {
			startIndex = source.indexOf(match[0]);
			break;
		}
	}
	
	if (startIndex === -1) return null;
	
	// Find the function body by counting braces
	// Need to handle strings and template literals to avoid miscounting braces inside them
	let braceCount = 0;
	let started = false;
	let endIndex = startIndex;
	let inString = false;
	let stringChar = "";
	let inTemplate = false;
	let templateDepth = 0;
	
	for (let i = startIndex; i < source.length; i++) {
		const char = source[i];
		const prevChar = i > 0 ? source[i - 1] : "";
		
		// Handle escape sequences
		if (prevChar === "\\" && (inString || inTemplate)) {
			continue;
		}
		
		// Handle string literals
		if ((char === '"' || char === "'") && !inTemplate) {
			if (!inString) {
				inString = true;
				stringChar = char;
			} else if (char === stringChar) {
				inString = false;
			}
			continue;
		}
		
		// Handle template literals
		if (char === "`") {
			if (!inString) {
				inTemplate = !inTemplate;
				if (inTemplate) templateDepth = 0;
			}
			continue;
		}
		
		// Handle template literal expressions ${...}
		if (inTemplate && char === "$" && source[i + 1] === "{") {
			templateDepth++;
			continue;
		}
		
		if (inString) continue;
		
		if (char === "{") {
			if (inTemplate && templateDepth > 0) {
				templateDepth++;
			} else if (!inTemplate) {
				braceCount++;
				started = true;
			}
		} else if (char === "}") {
			if (inTemplate && templateDepth > 0) {
				templateDepth--;
			} else if (!inTemplate) {
				braceCount--;
				if (started && braceCount === 0) {
					endIndex = i + 1;
					break;
				}
			}
		}
	}
	
	return source.slice(startIndex, endIndex);
}

/**
 * Normalize function code for comparison (remove indentation differences)
 */
function normalizeFunction(code) {
	if (!code) return null;
	return code
		.split("\n")
		.map(line => line.trim())
		.filter(line => line.length > 0)
		.join("\n");
}

/**
 * Compare two functions and return differences
 */
function compareFunctions(name, jsSource, fullSource) {
	const jsFunc = extractFunction(jsSource, name);
	const fullFunc = extractFunction(fullSource, name);
	
	if (!jsFunc && !fullFunc) {
		return { name, status: "missing", message: "Function not found in either file" };
	}
	if (!jsFunc) {
		return { name, status: "drift", message: "Function missing from Better_Map_Widget.js" };
	}
	if (!fullFunc) {
		return { name, status: "drift", message: "Function missing from Full.html" };
	}
	
	const jsNorm = normalizeFunction(jsFunc);
	const fullNorm = normalizeFunction(fullFunc);
	
	if (jsNorm === fullNorm) {
		return { name, status: "ok" };
	}
	
	// Find line differences
	const jsLines = jsNorm.split("\n");
	const fullLines = fullNorm.split("\n");
	let diffCount = 0;
	const diffs = [];
	
	const maxLen = Math.max(jsLines.length, fullLines.length);
	for (let i = 0; i < maxLen; i++) {
		if (jsLines[i] !== fullLines[i]) {
			diffCount++;
			if (diffs.length < 3) {
				diffs.push({
					line: i + 1,
					js: jsLines[i] || "(end)",
					full: fullLines[i] || "(end)"
				});
			}
		}
	}
	
	return { 
		name, 
		status: "drift", 
		message: `${diffCount} line(s) differ`,
		jsLines: jsLines.length,
		fullLines: fullLines.length,
		diffs
	};
}

function truncate(str, maxLen) {
	if (!str) return "(empty)";
	if (str.length <= maxLen) return str;
	return str.slice(0, maxLen - 3) + "...";
}

/**
 * Compare CSS files line by line (after normalizing Full.html's indentation)
 */
function compareCss(cssSource, fullCss) {
	const cssLines = cssSource.split("\n").map(l => l.trim()).filter(l => l);
	const fullLines = fullCss.split("\n").map(l => l.trim()).filter(l => l);
	
	let diffCount = 0;
	const diffs = [];
	const maxLen = Math.max(cssLines.length, fullLines.length);
	
	for (let i = 0; i < maxLen; i++) {
		if (cssLines[i] !== fullLines[i]) {
			diffCount++;
			if (diffs.length < 5) {
				diffs.push({
					line: i + 1,
					css: cssLines[i] || "(end)",
					full: fullLines[i] || "(end)"
				});
			}
		}
	}
	
	return { diffCount, diffs, cssLines: cssLines.length, fullLines: fullLines.length };
}

// ============================================================================
// Main
// ============================================================================

// Key functions to check for sync (add more as needed)
const FUNCTIONS_TO_CHECK = [
	"refreshGroupData",
	"resetZoom",
	"clearCache",
	"buildMarkersInBatches",
	"LMClient",
	"fetchPaginatedLMItems",
	"cleanupBetterMapInstance",
	"initSidebarResize",
	"addWeatherOverlay",
	"initializeMap",
	"createGoogleMap",
	"saveCache",
	"loadCache",
	"enqueueGeocode",
	"pumpGeocodeQueue",
	"finishRefreshIfComplete",
];

function main() {
	console.log("\nBetter Map Widget Sync Checker");
	console.log("==============================\n");
	
	if (!fs.existsSync(FULL_FILE)) {
		console.error("Error: Cannot find", FULL_FILE);
		process.exit(1);
	}
	
	const fullContent = fs.readFileSync(FULL_FILE, "utf8");
	const jsSource = readJs();
	const cssSource = readCss();
	
	let hasErrors = false;
	
	// Check CSS sync
	console.log("Checking CSS sync...");
	try {
		const cssFromFull = extractCssFromFull(fullContent);
		const cssResult = compareCss(cssSource, cssFromFull);
		
		if (cssResult.diffCount === 0) {
			console.log("  [OK] CSS is in sync");
		} else {
			console.log(`  [DRIFT] ${cssResult.diffCount} line(s) differ`);
			console.log(`          .css: ${cssResult.cssLines} lines, Full.html: ${cssResult.fullLines} lines`);
			if (VERBOSE && cssResult.diffs.length > 0) {
				for (const d of cssResult.diffs) {
					console.log(`    Line ${d.line}:`);
					console.log(`      .css:  ${truncate(d.css, 70)}`);
					console.log(`      Full:  ${truncate(d.full, 70)}`);
				}
			}
			hasErrors = true;
		}
	} catch (err) {
		console.log(`  [ERROR] ${err.message}`);
		hasErrors = true;
	}
	
	// Check JS sync by comparing key functions
	console.log("\nChecking JavaScript sync (key functions)...");
	try {
		const fullScript = extractMainScriptFromFull(fullContent);
		
		let okCount = 0;
		let driftCount = 0;
		let missingCount = 0;
		const driftFuncs = [];
		const missingFuncs = [];
		
		for (const funcName of FUNCTIONS_TO_CHECK) {
			const result = compareFunctions(funcName, jsSource, fullScript);
			
			if (result.status === "ok") {
				okCount++;
				if (VERBOSE) console.log(`    [OK] ${funcName}`);
			} else if (result.status === "drift") {
				driftCount++;
				driftFuncs.push(result);
			} else if (result.status === "missing") {
				missingCount++;
				missingFuncs.push(result);
			}
		}
		
		console.log(`  [OK] ${okCount} function(s) match`);
		
		if (driftCount > 0) {
			console.log(`  [DRIFT] ${driftCount} function(s) differ:`);
			for (const f of driftFuncs) {
				console.log(`    - ${f.name}: ${f.message}`);
				if (VERBOSE && f.diffs) {
					for (const d of f.diffs) {
						console.log(`        Line ${d.line}:`);
						console.log(`          .js:  ${truncate(d.js, 60)}`);
						console.log(`          Full: ${truncate(d.full, 60)}`);
					}
				}
			}
			hasErrors = true;
		}
	} catch (err) {
		console.log(`  [ERROR] ${err.message}`);
		hasErrors = true;
	}
	
	console.log("");
	
	if (hasErrors) {
		console.log("Files are out of sync!");
		console.log("  - Run with --verbose to see detailed differences");
		console.log("  - Manually apply changes to keep files in sync\n");
		process.exit(1);
	} else {
		console.log("All checked sections are in sync!\n");
		process.exit(0);
	}
}

main();
