import React from 'react';
import { Link } from 'react-router-dom';

export function FormattedText({ text, className = '' }: { text: string; className?: string }) {
  if (!text) return null;

  const tokenRegex = /\*\*[^*]+?\*\*|\*[^*\n][^*]*?\*|@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(tokenRegex)) {
    const token = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex, start)}</span>);
    }

    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      nodes.push(<strong key={`token-${start}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*') && token.length > 2 && !token.startsWith('**')) {
      nodes.push(<em key={`token-${start}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('@')) {
      const username = token.substring(1);
      if (username.toLowerCase() === 'ripoai') {
        nodes.push(
          <Link
            key={`token-${start}`}
            to="/ripoai"
            className="cursor-pointer rounded bg-purple-50 px-1 font-bold text-purple-500 hover:underline dark:bg-purple-900/20"
            title="Open RipoAI"
            onClick={(e) => e.stopPropagation()}
          >
            {token}
          </Link>
        );
      } else {
        nodes.push(
          <Link
            key={`token-${start}`}
            to={`/u/${encodeURIComponent(username)}`}
            className="cursor-pointer font-medium text-blue-500 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {token}
          </Link>
        );
      }
    } else if (token.startsWith('#')) {
      const tag = token.substring(1);
      nodes.push(
        <Link
          key={`token-${start}`}
          to={`/hashtag/${encodeURIComponent(tag.toLowerCase())}`}
          className="cursor-pointer font-medium text-blue-500 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {token}
        </Link>
      );
    }

    lastIndex = start + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(<span key={`text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return <p className={`whitespace-pre-wrap ${className}`}>{nodes}</p>;
}
