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
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between bg-secondary px-4 py-3">
        <div className="font-semibold text-secondary-foreground">{service.name}</div>
        <Badge className="bg-primary text-primary-foreground">{service.bookingInfo.office}</Badge>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <div className="text-sm font-medium mb-1">Eligibility</div>
          <p className="text-sm text-muted-foreground">{service.eligibility}</p>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Bring with you
          </div>
          <div className="flex flex-col gap-1.5">
            {service.requiredDocuments.map((doc, i) => (
              <div key={i} className="flex gap-2 text-sm text-foreground">
                <span className="text-primary">✓</span>
                {doc}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fees
            </div>
            <div className="text-sm text-foreground">{service.fees}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Processing
            </div>
            <div className="text-sm text-foreground">{service.processingTime}</div>
          </div>
        </div>

        <Separator />

        <div className="flex gap-4 text-sm">
          <a
            href={service.bookingInfo.url}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            Book an appointment
          </a>
          <a
            href={service.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            View official page
          </a>
        </div>
      </div>
    </Card>
  );
}
