#!/usr/bin/env node

import path from 'node:path';
import {
  buildModule,
  checkMigrations,
  devModule,
  initModule,
  inspectAdvisory,
  inspectDependencies,
  inspectModule,
  publishModule,
  validateModule,
} from './index.js';

const readOption = (args: string[], name: string, fallback = ''): string => {
  const index = args.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return args[index + 1] || fallback;
};

const hasFlag = (args: string[], name: string): boolean => args.includes(name);

const printHelp = (): void => {
  process.stdout.write(`ravium module <command>

Commands:
  module init <dir> --namespace <namespace> --slug <slug> --name <name> [--template basic|kitchen-sink]
  module dev [--cwd <dir>] [--out <dir>]
  module validate [--cwd <dir>]
  module build [--cwd <dir>] [--out <dir>]
  module size [--cwd <dir>] [--out <dir>]
  module pack [--cwd <dir>] [--out <dir>]
  module publish [--cwd <dir>] --api-url <url> [--token <token>] [--dry-run]
  module inspect [--cwd <dir>]
  module deps [--cwd <dir>]
  module migrate:check [--cwd <dir>]
  module advisory [--cwd <dir>]
`);
};

const printJSON = (payload: unknown): void => {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  if (args.length === 0 || hasFlag(args, '--help')) {
    printHelp();
    return;
  }

  if (args[0] !== 'module') {
    throw new Error('expected command namespace: module');
  }

  const command = args[1];
  const commandArgs = args.slice(2);
  const cwd = path.resolve(readOption(commandArgs, '--cwd', process.cwd()));

  switch (command) {
    case 'init': {
      const directory = commandArgs.find((arg) => !arg.startsWith('--')) || 'ravium-module';
      const namespace = readOption(commandArgs, '--namespace');
      const slug = readOption(commandArgs, '--slug', directory);
      const name = readOption(commandArgs, '--name', slug);
      const template = readOption(commandArgs, '--template', 'basic');
      if (!namespace) {
        throw new Error('--namespace is required');
      }
      if (template !== 'basic' && template !== 'kitchen-sink') {
        throw new Error('--template must be basic or kitchen-sink');
      }
      const moduleDir = await initModule({ cwd, directory, namespace, slug, name, template });
      process.stdout.write(`created ${moduleDir}\n`);
      return;
    }
    case 'validate': {
      const manifest = await validateModule(cwd);
      process.stdout.write(`valid ${manifest.namespace}/${manifest.slug}@${manifest.version}\n`);
      return;
    }
    case 'dev': {
      const outDir = path.resolve(readOption(commandArgs, '--out', path.join(cwd, '.ravium-dev')));
      printJSON(await devModule({ cwd, outDir }));
      return;
    }
    case 'build':
    case 'pack': {
      const outDir = path.resolve(readOption(commandArgs, '--out', path.join(cwd, 'dist')));
      const result = await buildModule({ cwd, outDir });
      process.stdout.write(`${command} ${result.artifactRoot}\n`);
      return;
    }
    case 'size': {
      const outDir = path.resolve(readOption(commandArgs, '--out', path.join(cwd, 'dist')));
      const result = await buildModule({ cwd, outDir });
      printJSON({
        artifactRoot: result.artifactRoot,
        module: {
          id: result.manifest.id,
          namespace: result.manifest.namespace,
          slug: result.manifest.slug,
          version: result.manifest.version,
        },
        sizeReport: result.sizeReport,
      });
      return;
    }
    case 'inspect': {
      printJSON(await inspectModule(cwd));
      return;
    }
    case 'deps': {
      printJSON(await inspectDependencies(cwd));
      return;
    }
    case 'migrate:check': {
      printJSON(await checkMigrations(cwd));
      return;
    }
    case 'advisory': {
      printJSON(await inspectAdvisory(cwd));
      return;
    }
    case 'publish': {
      const outDir = path.resolve(readOption(commandArgs, '--out', path.join(cwd, 'dist')));
      const apiUrl = readOption(commandArgs, '--api-url', process.env.RAVIUM_API_URL || '');
      const token = readOption(commandArgs, '--token', process.env.RAVIUM_ACCESS_TOKEN || '');
      const result = await publishModule({
        cwd,
        outDir,
        apiUrl,
        token,
        dryRun: hasFlag(commandArgs, '--dry-run'),
      });
      process.stdout.write(`publish ${result.moduleID}/${result.versionID} ${result.versionStatus}\n`);
      return;
    }
    default:
      throw new Error(`unknown module command: ${command || ''}`);
  }
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown ravium cli error';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
