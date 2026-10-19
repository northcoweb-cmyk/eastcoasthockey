#!/usr/bin/env node
/* Set, change or remove the private-preview password.
   node tools/set-gate.js "my password"   -> site asks for it
   node tools/set-gate.js off             -> site opens normally */
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const file = path.join(__dirname, '..', 'gate.js');
const arg = process.argv[2];
if (!arg) { console.error('Usage: node tools/set-gate.js "password" | off'); process.exit(1); }
const hash = arg === 'off' ? '' : crypto.createHash('sha256').update('ec-preview::' + arg.trim()).digest('hex');
const s = fs.readFileSync(file, 'utf8').replace(/var GATE_HASH = '[0-9a-f]*';/, "var GATE_HASH = '" + hash + "';");
fs.writeFileSync(file, s);
console.log(arg === 'off' ? 'Preview password removed. Commit and push to publish.' : 'Preview password set. Commit and push to publish.');
