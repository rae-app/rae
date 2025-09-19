/**
 * Utility functions for extracting relevant insertable content from AI responses
 */

/**
 * Context information for smart insertion
 */
export interface InsertionContext {
  windowName?: string;
  windowScreenshot?: string;
  detectedContext?: 'code_editor' | 'text_editor' | 'browser' | 'terminal' | 'form' | 'coding_platform' | 'unknown';
  cursorPosition?: { x: number; y: number };
  selectedText?: string;
  platform?: 'leetcode' | 'codepen' | 'codesandbox' | 'replit' | 'jsfiddle' | 'unknown';
}

/**
 * Extract relevant insertable content from AI response with context awareness
 * Removes markdown formatting, explanatory text, and extracts actionable content
 * @param response - The AI response text
 * @param context - Optional context information about the target window
 * @returns Clean, insertable text content
 */
/**
 * Detect the context type from window name and screenshot
 */
function detectWindowContext(context?: InsertionContext): InsertionContext['detectedContext'] {
  if (!context?.windowName) return 'unknown';
  
  const windowName = context.windowName.toLowerCase();
  
  // Coding platforms (check first as they're usually in browsers)
  if (windowName.includes('leetcode') || windowName.includes('codepen') || 
      windowName.includes('codesandbox') || windowName.includes('replit') || 
      windowName.includes('jsfiddle') || windowName.includes('stackblitz') ||
      windowName.includes('glitch') || windowName.includes('codeforces') ||
      windowName.includes('hackerrank') || windowName.includes('codewars') ||
      windowName.includes('jsbin') || windowName.includes('plnkr')) {
    return 'coding_platform';
  }
  
  // Code editors
  if (windowName.includes('visual studio') || windowName.includes('vs code') || 
      windowName.includes('vscode') || windowName.includes('sublime') || 
      windowName.includes('atom') || windowName.includes('webstorm') || 
      windowName.includes('intellij') || windowName.includes('pycharm') ||
      windowName.includes('code') || windowName.includes('cursor')) {
    return 'code_editor';
  }
  
  // Terminals
  if (windowName.includes('terminal') || windowName.includes('cmd') || 
      windowName.includes('powershell') || windowName.includes('bash') || 
      windowName.includes('command prompt') || windowName.includes('git bash')) {
    return 'terminal';
  }
  
  // Browsers
  if (windowName.includes('chrome') || windowName.includes('firefox') || 
      windowName.includes('safari') || windowName.includes('edge') || 
      windowName.includes('browser')) {
    return 'browser';
  }
  
  // Text editors
  if (windowName.includes('notepad') || windowName.includes('wordpad') || 
      windowName.includes('word') || windowName.includes('docs') || 
      windowName.includes('writer')) {
    return 'text_editor';
  }
  
  return 'unknown';
}

/**
 * Detect specific coding platform from window name
 */
function detectCodingPlatform(windowName?: string): InsertionContext['platform'] {
  if (!windowName) return 'unknown';
  
  const name = windowName.toLowerCase();
  
  if (name.includes('leetcode')) return 'leetcode';
  if (name.includes('codepen')) return 'codepen';
  if (name.includes('codesandbox')) return 'codesandbox';
  if (name.includes('replit')) return 'replit';
  if (name.includes('jsfiddle')) return 'jsfiddle';
  
  return 'unknown';
}

export const extractInsertableContent = (response: string, context?: InsertionContext): string => {
  if (!response) return "";
  
  console.log("🎯 Starting extraction for response:", response.substring(0, 200) + "...");
  console.log("🔍 Context:", context);
  
  // Detect context if not provided
  const detectedContext = context?.detectedContext || detectWindowContext(context);
  const detectedPlatform = context?.platform || detectCodingPlatform(context?.windowName);
  const contextualInfo = { ...context, detectedContext, platform: detectedPlatform };
  
  console.log("🎪 Detected context:", detectedContext, "platform:", detectedPlatform);
  
  // Context-aware extraction strategy
  let result = "";
  switch (detectedContext) {
    case 'coding_platform':
      result = extractForCodingPlatform(response, contextualInfo);
      break;
    case 'code_editor':
      result = extractForCodeEditor(response, contextualInfo);
      break;
    case 'terminal':
      result = extractForTerminal(response, contextualInfo);
      break;
    case 'browser':
      result = extractForBrowser(response, contextualInfo);
      break;
    case 'text_editor':
      result = extractForTextEditor(response, contextualInfo);
      break;
    default:
      result = extractGeneral(response, contextualInfo);
      break;
  }
  
  console.log("🏁 Final extraction result:", result);
  
  // Safety fallback - only if result is completely empty
  if (!result || result.trim().length === 0) {
    console.warn("⚠️ Extraction result is empty, returning original response");
    return response;
  }
  
  return result;
};

/**
 * Extract content optimized for coding platforms like LeetCode, CodePen, etc.
 */
function extractForCodingPlatform(response: string, context: InsertionContext): string {
  console.log("🚀 Extracting for coding platform:", context.platform);
  
  // Simple approach: just extract code blocks without complex processing
  const codeBlockMatches = response.match(/```[\s\S]*?```/g);
  if (codeBlockMatches && codeBlockMatches.length > 0) {
    console.log("📦 Found", codeBlockMatches.length, "code blocks");
    
    const codeContent = codeBlockMatches.map((block, index) => {
      console.log(`📝 Processing code block ${index + 1}`);
      
      const lines = block.split('\n');
      // Remove first line (```language) and last line (```)
      const codeLines = lines.slice(1, -1);
      const rawCode = codeLines.join('\n');
      
      console.log("🔧 Extracted raw code:", rawCode);
      return rawCode;
    }).join('\n\n');
    
    if (codeContent.trim()) {
      console.log("✅ Returning simple code extraction:", codeContent.trim());
      return codeContent.trim();
    }
  }
  
  // Look for inline code and code patterns with proper formatting
  const lines = response.split('\n');
  const codeLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // High priority patterns for coding platforms
    if (trimmed.match(/^(function|const|let|var|class|interface|type|import|export|from|if|for|while|return|async|await|def|public|private|protected|static)\s+/)) {
      codeLines.push(trimmed);
      continue;
    }
    
    // Variable assignments and object properties
    if (trimmed.match(/^[a-zA-Z_$][\w$]*\s*[=:]\s*.+/) && !trimmed.includes(' is ') && !trimmed.includes(' are ')) {
      codeLines.push(trimmed);
      continue;
    }
    
    // Function calls and method chains
    if (trimmed.match(/^[a-zA-Z_$][\w$]*\s*\(.*\)/) || trimmed.match(/^\w+\.\w+/)) {
      codeLines.push(trimmed);
      continue;
    }
    
    // Control structures
    if (trimmed.match(/^(if|else|elif|for|while|try|catch|finally|with|switch|case|default)\s*[\(\{]?/)) {
      codeLines.push(trimmed);
      continue;
    }
  }
  
  if (codeLines.length > 0) {
    const codeText = codeLines.join('\n');
    console.log("📝 Found inline code patterns, formatting:", codeText);
    return formatCodeForPlatform(codeText, context.platform);
  }
  
  console.log("⚠️ No code patterns found, falling back to general extraction");
  return extractGeneral(response, context);
}

/**
 * Format code specifically for different coding platforms
 */
function formatCodeForPlatform(code: string, platform?: InsertionContext['platform']): string {
  if (!code) return code;
  
  switch (platform) {
    case 'leetcode':
      return formatForLeetCode(code);
    case 'codepen':
      return formatForCodePen(code);
    case 'codesandbox':
      return formatForCodeSandbox(code);
    case 'replit':
      return formatForReplit(code);
    default:
      return formatForGenericCodingPlatform(code);
  }
}

/**
 * Format code for LeetCode - handles function body insertion
 */
function formatForLeetCode(code: string): string {
  if (!code) return code;
  
  console.log("🔍 LeetCode formatting input:", code);
  
  // For LeetCode, let's be more flexible and not try to extract function bodies
  // Instead, just format the entire code block properly
  console.log("⚠️ Skipping function body extraction for LeetCode - using full code with proper indentation");
  
  // Just return the code as-is with minimal formatting
  // LeetCode editor handles most formatting automatically
  const lines = code.split('\n');
  console.log("🔍 All lines before filtering:", lines);
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  console.log("🔍 Non-empty lines:", nonEmptyLines);
  
  console.log("🎯 LeetCode formatted result (simplified):", nonEmptyLines.join('\n'));
  return nonEmptyLines.join('\n');
}

/**
 * Format code for CodePen - handles HTML/CSS/JS separation
 */
function formatForCodePen(code: string): string {
  // CodePen usually doesn't need special indentation
  return code.split('\n').map(line => line.trim()).filter(line => line).join('\n');
}

/**
 * Format code for CodeSandbox - handles module imports
 */
function formatForCodeSandbox(code: string): string {
  return code; // CodeSandbox handles formatting well
}

/**
 * Format code for Replit - handles proper indentation
 */
function formatForReplit(code: string): string {
  const lines = code.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    
    // Maintain consistent indentation
    const indentLevel = (line.length - line.trimStart().length) / 2;
    return '  '.repeat(Math.max(0, indentLevel)) + trimmed;
  }).join('\n');
}

/**
 * Generic formatting for coding platforms
 */
function formatForGenericCodingPlatform(code: string): string {
  const lines = code.split('\n');
  let indentLevel = 0;
  const formattedLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Adjust indent level based on brackets
    if (trimmed.includes('}') || trimmed.includes(']') || trimmed.includes(')')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    
    // Add the line with proper indentation
    formattedLines.push('    '.repeat(indentLevel) + trimmed);
    
    // Increase indent for opening brackets
    if (trimmed.includes('{') || trimmed.includes('[') || trimmed.includes('(')) {
      indentLevel++;
    }
  }
  
  return formattedLines.join('\n');
}

/**
 * Extract content optimized for code editors
 */
function extractForCodeEditor(response: string, context: InsertionContext): string {
  // Prioritize code blocks and code patterns
  const codeBlockMatches = response.match(/```[\s\S]*?```/g);
  if (codeBlockMatches && codeBlockMatches.length > 0) {
    const codeContent = codeBlockMatches.map(block => {
      const lines = block.split('\n');
      return lines.slice(1, -1).join('\n');
    }).join('\n\n');
    
    if (codeContent.trim()) {
      return codeContent.trim();
    }
  }
  
  // Look for inline code and code patterns
  const lines = response.split('\n');
  const codeLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // High priority patterns for code editors
    if (trimmed.match(/^(function|const|let|var|class|interface|type|import|export|from|if|for|while|return|async|await|def|public|private|protected)\s+/)) {
      codeLines.push(trimmed);
      continue;
    }
    
    // Variable assignments and object properties
    if (trimmed.match(/^[a-zA-Z_$][\w$]*\s*[=:]\s*.+/) && !trimmed.includes(' is ') && !trimmed.includes(' are ')) {
      codeLines.push(trimmed);
      continue;
    }
    
    // Function calls and method chains
    if (trimmed.match(/^[a-zA-Z_$][\w$]*\s*\(.*\)/) || trimmed.match(/^\w+\.\w+/)) {
      codeLines.push(trimmed);
      continue;
    }
  }
  
  if (codeLines.length > 0) {
    return codeLines.join('\n');
  }
  
  return extractGeneral(response, context);
}

/**
 * Extract content optimized for terminals
 */
function extractForTerminal(response: string, context: InsertionContext): string {
  const lines = response.split('\n');
  const commandLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Command line commands
    if (trimmed.match(/^(npm|yarn|pip|git|docker|curl|wget|cd|ls|mkdir|cp|mv|rm|chmod|sudo|python|node|java|gcc|make|ng|npx|pnpm)\s+/)) {
      commandLines.push(trimmed);
      continue;
    }
    
    // File operations and paths
    if (trimmed.match(/^(\.\/|\.\.\/|\/|[a-zA-Z]:\\)/)) {
      commandLines.push(trimmed);
      continue;
    }
    
    // Remove $ prefix from commands if present
    if (trimmed.startsWith('$ ')) {
      commandLines.push(trimmed.substring(2));
      continue;
    }
  }
  
  if (commandLines.length > 0) {
    return commandLines.join('\n');
  }
  
  return extractGeneral(response, context);
}

/**
 * Extract content optimized for browsers (forms, inputs, etc.)
 */
function extractForBrowser(response: string, context: InsertionContext): string {
  // For browsers, prioritize clean text without markdown
  const cleanText = response
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n\s*\n/g, "\n")
    .trim();
  
  // Extract URLs if present
  const urls = response.match(/https?:\/\/[^\s]+/g);
  if (urls && urls.length > 0) {
    return urls.join('\n');
  }
  
  return cleanText;
}

/**
 * Extract content optimized for text editors
 */
function extractForTextEditor(response: string, context: InsertionContext): string {
  // For text editors, provide clean, readable text
  const cleanText = response
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/```[\s\S]*?```/g, (match) => {
      const lines = match.split('\n');
      return lines.slice(1, -1).join('\n');
    })
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n\s*\n/g, "\n")
    .trim();
  
  return cleanText;
}

/**
 * General extraction fallback
 */
function extractGeneral(response: string, context: InsertionContext): string {
  // First priority: Extract code blocks - they're usually the most insertable content
  const codeBlockMatches = response.match(/```[\s\S]*?```/g);
  if (codeBlockMatches && codeBlockMatches.length > 0) {
    const codeContent = codeBlockMatches.map(block => {
      const lines = block.split('\n');
      // Remove first line (language identifier) and last line (closing ```)
      return lines.slice(1, -1).join('\n');
    }).join('\n\n');
    
    if (codeContent.trim()) {
      return codeContent.trim();
    }
  }
  
  // Second priority: Extract inline code snippets
  const inlineCodeMatches = response.match(/`([^`]+)`/g);
  if (inlineCodeMatches && inlineCodeMatches.length > 0) {
    const inlineCode = inlineCodeMatches
      .map(match => match.replace(/`/g, ''))
      .filter(code => code.length > 5) // Only meaningful code snippets
      .join('\n');
    
    if (inlineCode.trim()) {
      return inlineCode.trim();
    }
  }
  
  // Third priority: Look for code-like patterns in the text
  const lines = response.split('\n');
  const codeLines = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Strong code patterns (high confidence)
    if (trimmed.match(/^(function|const|let|var|class|interface|type|import|export|from|if|for|while|return|async|await)\s+/)) {
      codeLines.push(trimmed);
      continue;
    }
    
    // Variable assignments and object properties
    if (trimmed.match(/^[a-zA-Z_$][\w$]*\s*[=:]\s*.+/) && !trimmed.includes(' is ') && !trimmed.includes(' are ')) {
      codeLines.push(trimmed);
      continue;
    }
    
    // Function calls and method chains
    if (trimmed.match(/^[a-zA-Z_$][\w$]*\s*\(.*\)/) || trimmed.match(/^\w+\.\w+/)) {
      codeLines.push(trimmed);
      continue;
    }
    
    // HTML/XML tags
    if (trimmed.match(/^<[^>]+>.*<\/[^>]+>$/) || trimmed.match(/^<[^>]+\/>$/)) {
      codeLines.push(trimmed);
      continue;
    }
    
    // CSS properties
    if (trimmed.match(/^\s*[a-zA-Z-]+\s*:\s*.+;?$/)) {
      codeLines.push(trimmed);
      continue;
    }
    
    // Command line commands
    if (trimmed.match(/^(npm|yarn|pip|git|docker|curl|wget|cd|ls|mkdir|cp|mv|rm|chmod|sudo|python|node|java|gcc|make|ng|npx|pnpm)\s+/)) {
      codeLines.push(trimmed);
      continue;
    }
    
    // File paths and URLs
    if (trimmed.match(/^(https?:\/\/|\/|\.\/|\.\.\/|[a-zA-Z]:\\)/)) {
      codeLines.push(trimmed);
      continue;
    }
  }
  
  // If we found code-like lines, return them
  if (codeLines.length > 0) {
    return codeLines.join('\n');
  }
  
  // Fourth priority: Clean up the response and filter out explanatory text
  const cleanText = response
    // Remove markdown headers
    .replace(/#{1,6}\s+/g, "")
    // Remove markdown bold/italic but keep content
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    // Remove markdown links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove inline code backticks
    .replace(/`([^`]+)`/g, "$1")
    // Clean up extra whitespace
    .replace(/\n\s*\n/g, "\n")
    .trim();
  
  // Filter out explanatory paragraphs
  const paragraphs = cleanText.split(/\n\s*\n/);
  const nonExplanatoryParagraphs = paragraphs.filter(paragraph => {
    const trimmed = paragraph.trim();
    
    // Skip empty paragraphs
    if (!trimmed) return false;
    
    // Skip paragraphs that start with explanatory phrases
    if (trimmed.match(/^(Here|This|The|You can|To do|In order to|Let me|I'll|We can|Simply|Just|Now|Next|For example|Note that|Remember that|Keep in mind|Make sure|Don't forget)/i)) {
      return false;
    }
    
    // Skip paragraphs with too many explanatory words
    const words = trimmed.split(/\s+/);
    const explanatoryWords = words.filter(word => 
      /^(is|are|will|would|should|can|could|might|may|allows|helps|enables|provides|offers|gives|makes|creates|shows|demonstrates|explains|means|indicates)$/i.test(word)
    );
    
    if (explanatoryWords.length > words.length * 0.3) {
      return false;
    }
    
    return true;
  });
  
  if (nonExplanatoryParagraphs.length > 0) {
    const result = nonExplanatoryParagraphs.join('\n\n');
    // Limit length to prevent extremely long insertions
    if (result.length > 1000) {
      return result.substring(0, 1000).trim() + "...";
    }
    return result;
  }
  
  // Last resort: return the original response (fallback)
  return response;
};
  
  /**
   * Detect if the response contains primarily code or commands
   * @param response - The AI response text
   * @returns true if the response is primarily code/commands
   */
  export const isCodeResponse = (response: string): boolean => {
    if (!response) return false;
    
    const lines = response.split('\n');
    const codeLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.match(/^[a-zA-Z_$][\w$]*\s*[=:({]|^[./]|^\w+:|^<|^\w+\s*\{|^import |^export |^function |^const |^let |^var /);
    });
    
    return codeLines.length > lines.length * 0.5; // More than 50% code-like lines
  };
  
  /**
   * Extract only code blocks from markdown response
   * @param response - The AI response text
   * @returns Concatenated code block contents
   */
  export const extractCodeBlocks = (response: string): string => {
    if (!response) return "";
    
    const codeBlocks: string[] = [];
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const lines = match[0].split('\n');
      // Remove first and last line (``` markers)
      const codeContent = lines.slice(1, -1).join('\n');
      if (codeContent.trim()) {
        codeBlocks.push(codeContent);
      }
    }
    
  return codeBlocks.join('\n\n');
};

/**
 * Generate context-aware prompt for better AI responses
 * @param userMessage - The user's original message
 * @param context - Window context information
 * @returns Enhanced prompt with context
 */
export const generateContextAwarePrompt = (userMessage: string, context?: InsertionContext): string => {
  if (!context || !context.detectedContext || context.detectedContext === 'unknown') {
    return userMessage;
  }

  let contextPrompt = "";
  
  switch (context.detectedContext) {
    case 'coding_platform':
      const platform = context.platform || 'coding platform';
      contextPrompt = `I'm working on ${platform} (${context.windowName}). Please provide:
1. Clean, properly indented code that can be directly inserted
2. For LeetCode: provide just the function body with 4-space indentation
3. For other platforms: ensure proper formatting for the specific environment
4. No explanations or comments unless specifically requested
5. Code should be ready to run immediately after insertion

User question: ${userMessage}`;
      break;
      
    case 'code_editor':
      contextPrompt = `I'm working in a code editor (${context.windowName}). When providing code solutions, please prioritize:
1. Clean, executable code without explanations unless asked
2. Proper syntax and formatting
3. Focus on the actual implementation
4. Avoid lengthy explanations in the response

User question: ${userMessage}`;
      break;
      
    case 'terminal':
      contextPrompt = `I'm working in a terminal/command line (${context.windowName}). Please provide:
1. Direct commands without explanations unless asked
2. Executable terminal commands
3. No markdown formatting for commands
4. Focus on what I should type/execute

User question: ${userMessage}`;
      break;
      
    case 'browser':
      contextPrompt = `I'm working in a web browser (${context.windowName}). Please provide:
1. Clean text suitable for web forms or content
2. URLs if relevant
3. Text without complex formatting
4. Content ready for copy-paste into web interfaces

User question: ${userMessage}`;
      break;
      
    case 'text_editor':
      contextPrompt = `I'm working in a text editor (${context.windowName}). Please provide:
1. Clean, readable text
2. Proper formatting for documents
3. No code blocks unless specifically about code
4. Focus on clear, insertable content

User question: ${userMessage}`;
      break;
      
    default:
      return userMessage;
  }
  
  return contextPrompt;
};

/**
 * Analyze screenshot to provide additional context (placeholder for future AI vision integration)
 * @param screenshot - Base64 screenshot data
 * @returns Analysis results
 */
export const analyzeScreenshotContext = async (screenshot: string): Promise<{
  detectedElements: string[];
  suggestedInsertionMode: 'replace' | 'append' | 'cursor';
  confidence: number;
}> => {
  // Placeholder for future implementation with AI vision models
  // This could analyze the screenshot to detect:
  // - Text input fields
  // - Code editor contexts
  // - Cursor position
  // - Selected text areas
  // - UI elements that suggest insertion points
  
  return {
    detectedElements: [],
    suggestedInsertionMode: 'cursor',
    confidence: 0.5
  };
};