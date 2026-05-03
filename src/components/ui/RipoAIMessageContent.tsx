import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

type ParsedBlock =
  | { type: 'text'; content: string }
  | { type: 'code'; language: string; content: string };

const CODE_BLOCK_PATTERN = /```([\w.+-]*)\n?([\s\S]*?)```/g;
const TOKEN_PATTERN =
  /(\/\/.*$|\/\*[\s\S]*?\*\/|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b(?:const|let|var|function|return|if|else|await|async|import|from|export|default|class|new|for|while|switch|case|break|continue|try|catch|throw|type|interface|extends|implements|public|private|protected|true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b)/gm;

function parseBlocks(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let lastIndex = 0;

  content.replace(CODE_BLOCK_PATTERN, (match, language, code, offset) => {
    if (offset > lastIndex) {
      blocks.push({ type: 'text', content: content.slice(lastIndex, offset) });
    }
    blocks.push({
      type: 'code',
      language: String(language || '').trim() || 'code',
      content: String(code || '').replace(/\n$/, ''),
    });
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < content.length) {
    blocks.push({ type: 'text', content: content.slice(lastIndex) });
  }

  return blocks.length > 0 ? blocks : [{ type: 'text', content }];
}

function renderInlineCode(text: string) {
  return text.split(/(`[^`]+`)/g).map((segment, index) => {
    if (segment.startsWith('`') && segment.endsWith('`')) {
      return (
        <code key={`inline-${index}`} className="rounded-md bg-slate-950 px-1.5 py-0.5 font-mono text-[0.92em] text-sky-200 dark:bg-slate-900 dark:text-sky-100">
          {segment.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`text-${index}`}>{segment}</React.Fragment>;
  });
}

function renderHighlightedCode(code: string) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  code.replace(TOKEN_PATTERN, (match, _group, offset) => {
    if (offset > lastIndex) {
      parts.push(
        <span key={`plain-${lastIndex}`} className="text-slate-100">
          {code.slice(lastIndex, offset)}
        </span>
      );
    }

    let className = 'text-slate-100';
    if (/^\/\//.test(match) || /^\/\*/.test(match)) className = 'text-slate-400';
    else if (/^['"`]/.test(match)) className = 'text-emerald-300';
    else if (/^(true|false|null|undefined)$/.test(match)) className = 'text-violet-300';
    else if (/^\d/.test(match)) className = 'text-amber-300';
    else className = 'text-sky-300';

    parts.push(
      <span key={`token-${offset}`} className={className}>
        {match}
      </span>
    );

    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < code.length) {
    parts.push(
      <span key={`plain-tail-${lastIndex}`} className="text-slate-100">
        {code.slice(lastIndex)}
      </span>
    );
  }

  return parts;
}

export function RipoAIMessageContent({ content }: { content: string }) {
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const blocks = useMemo(() => parseBlocks(content), [content]);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedBlock(code);
      window.setTimeout(() => {
        setCopiedBlock((current) => (current === code ? null : current));
      }, 1600);
    } catch {
      setCopiedBlock(null);
    }
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          const isCopied = copiedBlock === block.content;
          return (
            <div key={`code-${index}`} className="overflow-hidden rounded-2xl border border-slate-700 bg-[#020617] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 py-2.5">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-300">
                  {block.language}
                </span>
                <button
                  type="button"
                  onClick={() => void copyCode(block.content)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800"
                >
                  {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                  {isCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-6 sm:text-sm">
                <code className="font-mono">{renderHighlightedCode(block.content)}</code>
              </pre>
            </div>
          );
        }

        return block.content
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((paragraph, paragraphIndex) => (
            <p key={`text-${index}-${paragraphIndex}`} className="whitespace-pre-wrap break-words text-[15px] leading-7 text-current">
              {renderInlineCode(paragraph)}
            </p>
          ));
      })}
    </div>
  );
}
