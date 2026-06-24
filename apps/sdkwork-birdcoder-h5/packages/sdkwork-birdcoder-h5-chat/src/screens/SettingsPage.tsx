import { resolveBirdCoderLegalLinks } from '@sdkwork/birdcoder-h5-commons';

export function SettingsPage() {
  const legal = resolveBirdCoderLegalLinks();

  return (
    <div className="flex h-full flex-col gap-6 px-4 py-6">
      <div>
        <h2 className="text-base font-semibold">Settings</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          H5 settings surface is routed through the shell catalog. Product settings modules can extend
          this screen without changing the root app entry.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Privacy and support</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Review how BirdCoder handles your data and where to get help.
        </p>
        <ul className="mt-4 space-y-3 text-sm">
          <li>
            <a
              href={legal.privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Privacy policy
            </a>
          </li>
          <li>
            <a
              href={legal.termsOfServiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Terms of service
            </a>
          </li>
          <li>
            <a
              href={legal.supportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Support
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
