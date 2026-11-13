export interface CodeDetectionResult {
  type: 'text' | 'code' | 'url';
  language?: string;
}

const URL_REGEX = /^(https?:\/\/[^\s]+)$/i;

export function detectContentType(text: string): CodeDetectionResult {
  const trimmed = text.trim();

  // Check URL
  if (URL_REGEX.test(trimmed)) {
    return { type: 'url' };
  }

  // Quick JSON check
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return { type: 'code', language: 'json' };
    } catch {
      // Not valid JSON, continue checks
    }
  }

  // HTML / XML check
  if (/^<([a-z]+)([^<]+)*(?:>(.*)<\/\1>|\s*\/>)$/i.test(trimmed) || /<!DOCTYPE html>/i.test(trimmed)) {
    return { type: 'code', language: 'html' };
  }

  // JavaScript / TypeScript indicators
  const jsIndicators = [
    /\b(const|let|var)\s+[a-zA-Z0-9_$]+\s*=/,
    /\bfunction\s+[a-zA-Z0-9_$]+\s*\(/,
    /\b(import|export)\s+.*from\s+['"]/,
    /=>\s*\{?/,
    /\bconsole\.(log|error|warn)\(/,
    /\binterface\s+[A-Z][a-zA-Z0-9_$]*\s*\{/,
    /\bclass\s+[A-Z][a-zA-Z0-9_$]*\s*(extends|implements|\{)/
  ];
  if (jsIndicators.some((regex) => regex.test(trimmed))) {
    return { type: 'code', language: 'typescript' };
  }

  // Python indicators
  const pyIndicators = [
    /\bdef\s+[a-zA-Z0-9_]+\s*\([^)]*\):/,
    /\bimport\s+[a-zA-Z0-9_]+(\s+as\s+[a-zA-Z0-9_]+)?$/,
    /\bfrom\s+[a-zA-Z0-9_.]+\s+import\s+/,
    /\bclass\s+[a-zA-Z0-9_]+(\([^)]*\))?:/,
    /\bprint\s*\(.*\)/,
    /\bif\s+__name__\s*==\s*['"]__main__['"]:/
  ];
  if (pyIndicators.some((regex) => regex.test(trimmed))) {
    return { type: 'code', language: 'python' };
  }

  // SQL indicators
  const sqlIndicators = [
    /\bSELECT\s+.+\s+FROM\s+/i,
    /\bINSERT\s+INTO\s+/i,
    /\bUPDATE\s+.+\s+SET\s+/i,
    /\bCREATE\s+TABLE\s+/i
  ];
  if (sqlIndicators.some((regex) => regex.test(trimmed))) {
    return { type: 'code', language: 'sql' };
  }

  // Bash / Shell
  if (/^#!\/bin\/(bash|sh|zsh)/.test(trimmed) || /\b(npm|yarn|pnpm|git|docker|curl|wget)\s+/.test(trimmed)) {
    return { type: 'code', language: 'bash' };
  }

  return { type: 'text' };
}
