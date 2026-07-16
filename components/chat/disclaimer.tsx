import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function Disclaimer() {
  return (
    <Alert className="mb-4">
      <AlertTitle>Unofficial tool</AlertTitle>
      <AlertDescription>
        This is an independent, unofficial assistant and is not affiliated with the City of
        Berlin. Always verify details on{' '}
        <a
          href="https://service.berlin.de/dienstleistungen/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          service.berlin.de
        </a>
        .
      </AlertDescription>
    </Alert>
  );
}
