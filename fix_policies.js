const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find all matches for CREATE POLICY "name" ON table
  const policyRegex = /CREATE POLICY\s+"([^"]+)"\s*(?:ON\s+([a-zA-Z0-9_\.]+))?/gi;
  let newContent = content;
  
  let match;
  let changesMade = false;
  // We cannot easily replace because of overlapping, let's just do a string approach
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/CREATE POLICY\s+"([^"]+)"\s+(?:ON\s+([a-zA-Z0-9_\.]+))?/i)
              || line.match(/CREATE POLICY\s+'([^']+)'\s+(?:ON\s+([a-zA-Z0-9_\.]+))?/i);
    
    if (match && !line.trim().startsWith('--')) {
      const policyName = match[1];
      let tableName = match[2];
      
      // Sometimes ON table is on the next line
      if (!tableName && i + 1 < lines.length) {
        const nextLineMatch = lines[i+1].match(/^\s*ON\s+([a-zA-Z0-9_\.]+)/i);
        if (nextLineMatch) {
          tableName = nextLineMatch[1];
        } else if (lines[i+1].includes('ON public.')) {
           tableName = lines[i+1].split('ON public.')[1].split(' ')[0];
        } else if (lines[i+1].includes('ON storage.')) {
           tableName = 'storage.' + lines[i+1].split('ON storage.')[1].split(' ')[0];
        }
      }
      
      if (tableName) {
        // Clean table name (remove trailing spaces, semicolon etc)
        tableName = tableName.trim().replace(';', '');
        
        // Ensure we don't duplicate DROP POLICY
        if (i > 0 && lines[i-1].includes(`DROP POLICY IF EXISTS "${policyName}"`)) {
          continue;
        }
        
        lines[i] = `DROP POLICY IF EXISTS "${policyName}" ON ${tableName};\n` + lines[i];
        changesMade = true;
      }
    }
  }
  
  if (changesMade) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`Fixed ${file}`);
  }
}
