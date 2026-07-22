'use client';

const EXAMPLE_PROMPTS = [
  'I just moved to Berlin, what do I need to do?',
  'I need a new passport',
  'Convert my foreign driving license',
];

export function PromptChips({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-muted-foreground">Try asking:</div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map(prompt => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
            className="rounded-full border bg-card px-3 py-1.5 text-sm text-card-foreground hover:bg-secondary"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
