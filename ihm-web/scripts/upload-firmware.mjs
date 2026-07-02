#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SerialPort } from 'serialport';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sketch = path.join(root, 'firmware', 'me_arm_firmware');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function run(command, args) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function score(port) {
  const haystack = [port.path, port.manufacturer, port.vendorId, port.productId, port.pnpId]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let value = 0;
  if (haystack.includes('arduino') || haystack.includes('genuino')) value += 80;
  if (haystack.includes('2341') || haystack.includes('2a03')) value += 60;
  if (haystack.includes('usbmodem')) value += 45;
  if (haystack.includes('usbserial')) value += 35;
  if (haystack.includes('wch') || haystack.includes('ch340')) value += 30;
  if (port.path.includes('/dev/cu.')) value += 15;
  return value;
}

async function detectPort() {
  const ports = await SerialPort.list();
  return ports.sort((a, b) => score(b) - score(a))[0]?.path;
}

const fqbn = argValue('--fqbn', 'arduino:avr:uno');
const port = argValue('--port', await detectPort());

if (!port) {
  console.error('Nenhuma porta Arduino encontrada. Use: npm run firmware:upload -- --port /dev/cu.usbmodemXXXX');
  process.exit(1);
}

try {
  run('arduino-cli', ['version']);
} catch {
  console.error('arduino-cli não está instalado. Instale com: brew install arduino-cli');
  process.exit(1);
}

run('arduino-cli', ['core', 'install', 'arduino:avr']);
run('arduino-cli', ['compile', '--fqbn', fqbn, sketch]);
run('arduino-cli', ['upload', '-p', port, '--fqbn', fqbn, sketch]);

console.log(`Firmware enviado em ${port}`);
