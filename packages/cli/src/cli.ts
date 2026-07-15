#!/usr/bin/env node

import path from 'node:path';
import {
  buildModule,
  checkMigrations,
  connectAiBridge,
  devModule,
  initModule,
  inspectAdvisory,
  inspectDependencies,
  inspectModule,
  publishModule,
  syncAiBridge,
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

const positionalArgs = (args: string[]): string[] => {
  const result: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith('--')) {
      index += 1;
      continue;
    }
    result.push(arg);
  }
  return result;
};

const printHelp = (): void => {
  process.stdout.write(`ravium <namespace> <command>

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
  ai connect <pairing-code> [--cwd <dir>] [--api-url <url>] [--workspace-name <name>]
  ai sync [--cwd <dir>] [--api-url <url>] [--token <token>] [--dry-run]
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

  const namespace = args[0];
  if (namespace === 'ai') {
    await runAiCommand(args[1], args.slice(2));
    return;
  }
  if (namespace !== 'module') {
    throw new Error('expected command namespace: module or ai');
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

const runAiCommand = async (command: string | undefined, commandArgs: string[]): Promise<void> => {
  const cwd = path.resolve(readOption(commandArgs, '--cwd', process.cwd()));
  switch (command) {
    case 'connect': {
      const pairingCode = positionalArgs(commandArgs)[0] || '';
      const apiUrl = readOption(commandArgs, '--api-url', process.env.RAVIUM_API_URL || '');
      const workspaceName = readOption(commandArgs, '--workspace-name', path.basename(cwd));
      const result = await connectAiBridge({
        cwd,
        apiUrl,
        pairingCode,
        workspaceName,
      });
      printJSON({
        status: 'connected',
        sessionID: result.sessionID,
        projectID: result.projectID,
        workspaceName: result.workspaceName,
        expiresAt: result.expiresAt,
        configPath: result.configPath,
      });
      return;
    }
    case 'sync': {
      const apiUrl = readOption(commandArgs, '--api-url', process.env.RAVIUM_API_URL || '');
      const token = readOption(commandArgs, '--token', process.env.RAVIUM_AI_BRIDGE_TOKEN || '');
      const result = await syncAiBridge({
        cwd,
        apiUrl,
        token,
        dryRun: hasFlag(commandArgs, '--dry-run'),
      });
      printJSON({
        status: 'synced',
        ...result,
      });
      return;
    }
    default:
      throw new Error(`unknown ai command: ${command || ''}`);
  }
};

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown ravium cli error';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
