export function Disclaimer() {
  return (
    <div className="w-full rounded-md bg-secondary px-4 py-2 text-center text-xs text-muted-foreground">
      Unofficial, independent tool — not affiliated with the City of Berlin. Always verify
      details on{' '}
      <a
        href="https://service.berlin.de/dienstleistungen/"
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        service.berlin.de
      </a>
      .
    </div>
  );
}
