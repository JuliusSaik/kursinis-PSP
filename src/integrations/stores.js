import fs from 'node:fs';
import path from 'node:path';

export class JsonFileStore {
  constructor(filePath, initialData) {
    this.filePath = filePath;
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      this.write(initialData);
    }
  }

  read() {
    return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
  }

  write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }
}

export class MemoryStore {
  constructor(initialData) {
    this.data = structuredClone(initialData);
  }

  read() {
    return structuredClone(this.data);
  }

  write(data) {
    this.data = structuredClone(data);
  }
}
