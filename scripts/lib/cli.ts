// -----------------------------------------------------------------------------
// Analyse minimaliste des arguments de ligne de commande.
// Reconnaît : --flag, --key=value, --key value
// -----------------------------------------------------------------------------

export interface CliArgs {
  dryRun: boolean;
  force: boolean;
  validateOnly: boolean;
  gameId?: string;
  limit?: number;
  useFixture: boolean;
  download: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dryRun: false,
    force: false,
    validateOnly: false,
    useFixture: false,
    download: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i] ?? '';
    if (!token.startsWith('--')) continue;
    const body = token.slice(2);
    const eq = body.indexOf('=');
    const key = eq === -1 ? body : body.slice(0, eq);
    const inlineValue = eq === -1 ? undefined : body.slice(eq + 1);
    const nextValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        i += 1;
        return next;
      }
      return undefined;
    };

    switch (key) {
      case 'dry-run':
        args.dryRun = true;
        break;
      case 'force':
        args.force = true;
        break;
      case 'validate-only':
        args.validateOnly = true;
        break;
      case 'fixture':
        args.useFixture = true;
        break;
      case 'download':
        args.download = true;
        break;
      case 'game-id': {
        const value = nextValue();
        if (value) args.gameId = value;
        break;
      }
      case 'limit': {
        const value = nextValue();
        const parsed = value ? Number.parseInt(value, 10) : NaN;
        if (!Number.isNaN(parsed)) args.limit = parsed;
        break;
      }
      default:
        break;
    }
  }

  return args;
}
