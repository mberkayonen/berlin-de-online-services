import type { UIToolInvocation } from 'ai';
import type { searchServicesTool } from '@/lib/tools/search-services';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Invocation = UIToolInvocation<typeof searchServicesTool>;

export function ServiceSearchResults({
  invocation,
  onSelect,
}: {
  invocation: Invocation;
  onSelect: (serviceName: string) => void;
}) {
  if (invocation.state === 'input-streaming' || invocation.state === 'input-available') {
    return <p className="text-sm text-muted-foreground">Searching services…</p>;
  }

  if (invocation.state === 'output-error') {
    return <p className="text-sm text-destructive">Error searching services.</p>;
  }

  if (invocation.state !== 'output-available') {
    return null;
  }

  const { results } = invocation.output;

  if (results.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No matching services found in the curated list.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {results.map(result => (
        <Card key={result.id} className="p-3 flex flex-col gap-2">
          <div className="font-medium">{result.name}</div>
          <p className="text-sm text-muted-foreground">{result.summary}</p>
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            onClick={() => onSelect(result.name)}
          >
            Tell me more about this
          </Button>
        </Card>
      ))}
    </div>
  );
}
