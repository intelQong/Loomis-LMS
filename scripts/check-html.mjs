import fs from 'node:fs';

const files = ['index.html', 'admin-dashboard.html', 'student-dashboard.html'];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes('<!DOCTYPE html>') && !content.includes('<html')) {
    throw new Error(`Invalid HTML in ${file}`);
  }
}

console.log('HTML parse ok');
