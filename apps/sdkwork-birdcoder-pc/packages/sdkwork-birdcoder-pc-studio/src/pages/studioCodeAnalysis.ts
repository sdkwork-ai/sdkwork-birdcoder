import type { StudioAnalyzeReport } from './StudioPageDialogs';

const FUNCTION_PATTERN =
  /function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=]+)\s*=>/g;
const CLASS_PATTERN = /class\s+\w+/g;
const COMPLEXITY_PATTERN = /\b(if|while|for|case|catch|&&|\|\||\?)\b/g;

export function analyzeStudioCode(fileContent: string): StudioAnalyzeReport {
  const lines = fileContent.split('\n');
  let emptyLines = 0;
  let imports = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine === '') {
      emptyLines += 1;
    }
    if (trimmedLine.startsWith('import ')) {
      imports += 1;
    }
  }

  const functions = (fileContent.match(FUNCTION_PATTERN) || []).length;
  const classes = (fileContent.match(CLASS_PATTERN) || []).length;
  const estimatedComplexity = (fileContent.match(COMPLEXITY_PATTERN) || []).length + 1;
  let maintainability = 100;

  if (lines.length > 300) maintainability -= 10;
  if (estimatedComplexity > 20) maintainability -= 15;
  if (functions > 10) maintainability -= 5;

  return {
    loc: lines.length,
    emptyLines,
    imports,
    functions,
    classes,
    complexity: estimatedComplexity,
    maintainability: Math.max(0, maintainability),
  };
}
