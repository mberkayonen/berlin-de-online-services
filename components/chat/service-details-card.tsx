import type { UIToolInvocation } from 'ai';
import type { getServiceDetailsTool } from '@/lib/tools/get-service-details';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

type Invocation = UIToolInvocation<typeof getServiceDetailsTool>;

export function ServiceDetailsCard({ invocation }: { invocation: Invocation }) {
  if (invocation.state === 'input-streaming' || invocation.state === 'input-available') {
    return <p className="text-sm text-muted-foreground">Looking up service details…</p>;
  }

  if (invocation.state === 'output-error') {
    return <p className="text-sm text-destructive">Error looking up service details.</p>;
  }

  if (invocation.state !== 'output-available') {
    return null;
  }

  const { service, error } = invocation.output;

  if (!service) {
    return <p className="text-sm text-destructive">{error ?? 'Service not found.'}</p>;
  }

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div>
        <div className="font-semibold">{service.name}</div>
        <Badge variant="secondary" className="mt-1">
          {service.bookingInfo.office}
        </Badge>
      </div>

      <Separator />

      <div>
        <div className="text-sm font-medium mb-1">Eligibility</div>
        <p className="text-sm text-muted-foreground">{service.eligibility}</p>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Documents to bring</div>
        <ul className="list-disc list-inside text-sm text-muted-foreground">
          {service.requiredDocuments.map((doc, i) => (
            <li key={i}>{doc}</li>
          ))}
        </ul>
      </div>

      <div className="flex gap-6">
        <div>
          <div className="text-sm font-medium mb-1">Fees</div>
          <p className="text-sm text-muted-foreground">{service.fees}</p>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Processing time</div>
          <p className="text-sm text-muted-foreground">{service.processingTime}</p>
        </div>
      </div>

      <Separator />

      <div className="flex gap-4 text-sm">
        <a
          href={service.bookingInfo.url}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Book an appointment
        </a>
        <a href={service.sourceUrl} target="_blank" rel="noreferrer" className="underline">
          View official page
        </a>
      </div>
    </Card>
  );
}
