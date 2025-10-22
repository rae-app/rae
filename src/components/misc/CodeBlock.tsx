{
  /*
  This is the code block component.
  It is used to display code blocks
  Response from ai related to any programming question will be highlighted
*/
}

import React, { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  children: string;
  className?: string;
  inline?: boolean;
  [key: string]: any; // Allow additional props
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  children,
  className,
  inline,
  ...props
}) => {
  const [copied, setCopied] = useState(false);

  // Extract language from className (format: language-javascript)
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "text";

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  // For inline code, return simple styled span
  if (inline) {
    return (
      <code className="bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 px-1.5 py-0.5 rounded text-sm font-mono border border-stone-300 dark:border-stone-700">
        {children}
      </code>
    );
  }

  // For code blocks, return syntax highlighted version with copy button
  return (
    <div className="relative group my-4 w-full border border-stone-300 dark:border-stone-700 rounded-lg overflow-hidden bg-white dark:bg-stone-900">
      <div className="flex items-center justify-between bg-stone-100 dark:bg-stone-800 px-4 py-2 border-b border-stone-300 dark:border-stone-700">
        <span className="text-stone-700 dark:text-stone-300 text-sm font-medium">
          {language !== "text" ? language : "code"}
        </span>
        <button
          onClick={copyToClipboard}
          className={`p-1.5 rounded transition-all duration-200 ${
            copied
              ? "bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-700"
              : "bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-600 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
          }`}
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={language}
          PreTag="div"
          className="!m-0 !bg-transparent"
          customStyle={{
            margin: 0,
            padding: "16px",
            background: "transparent",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
          codeTagProps={{
            style: {
              fontSize: "14px",
              fontFamily:
                "ui-monospace, SFMono-Regular, 'SF Mono', Monaco, Inconsolata, 'Roboto Mono', monospace",
            },
          }}
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default CodeBlock;
