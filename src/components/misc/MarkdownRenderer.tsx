import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import CodeBlock from "@/components/misc/CodeBlock";

interface MarkdownRendererProps {
  source: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  source,
  className,
}) => {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
        p: ({ children }) => (
          <p className="mb-3 last:mb-0 leading-7 text-[15px]">{children}</p>
        ),
        h1: ({ children }) => (
          <h1 className="text-xl font-semibold mb-3 mt-6 first:mt-0 text-foreground dark:text-white">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold mb-3 mt-5 first:mt-0 text-foreground dark:text-white">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold mb-2 mt-4 first:mt-0 text-foreground dark:text-white">
            {children}
          </h3>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-3 space-y-1 ml-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-3 space-y-1 ml-2">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-[15px] leading-6 ml-2">{children}</li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 py-2 mb-3 italic text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 rounded-r">
            {children}
          </blockquote>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground dark:text-white">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-foreground dark:text-zinc-200">{children}</em>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-blue-500 hover:text-blue-600 underline underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        code: ({ className, children, ...props }: any) => {
          const inline = props.inline;
          return (
            <CodeBlock className={className} inline={inline} {...props}>
              {String(children).replace(/\n$/, "")}
            </CodeBlock>
          );
        },
      }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
