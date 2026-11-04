import React from 'react';

export const SafeMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const paragraphs = content.split('\n\n');

  return (
    <div className="space-y-4 text-ink leading-relaxed">
      {paragraphs.map((para, idx) => {
        const trimmed = para.trim();
        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={idx} className="text-xl font-display font-semibold text-ink mt-6 mb-2">
              {trimmed.replace('### ', '')}
            </h3>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={idx} className="text-2xl font-display font-semibold text-ink mt-8 mb-3">
              {trimmed.replace('## ', '')}
            </h2>
          );
        }
        const subParas = trimmed.split('\n').map((line, lIdx) => (
          <span key={lIdx}>
            {line}
            {lIdx < trimmed.split('\n').length - 1 && <br />}
          </span>
        ));
        return (
          <p key={idx} className="text-base text-muted">
            {subParas}
          </p>
        );
      })}
    </div>
  );
};
