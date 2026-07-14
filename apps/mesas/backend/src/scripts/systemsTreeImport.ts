import fs from 'fs';
import path from 'path';
import { db } from '../db';

interface ParsedTreeNode {
  lineDepth: number;
  label: string;
  metadata: unknown[];
}

interface StackNode {
  pathSlug: string;
  systemId: string;
}

const KNOWN_ALIASES: Record<string, string[]> = {
  'dungeons-dragons': ['D&D', 'DnD', 'DND'],
  'pathfinder': ['PF'],
  'call-of-cthulhu': ['CoC'],
  'tormenta20': ['T20'],
  'ordem-paranormal-rpg': ['OPR'],
  'vampire-the-masquerade': ['VTM', 'V5'],
  'savage-worlds': ['SW', 'SWADE'],
  'old-dragon': ['ODRPG', 'OD2'],
};

const STOPWORDS = new Set([
  'de', 'do', 'da', 'das', 'dos', 'e', 'of', 'the', 'and', 'a', 'an', 'o', 'as', 'os', 'em', 'no', 'na',
]);

const slugify = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const normalizeLineLabel = (raw: string): string => raw.replace(/\s+/g, ' ').trim();

const extractMarkdownNodes = (markdown: string): ParsedTreeNode[] => {
  const lines = markdown.split(/\r?\n/);
  const nodes: ParsedTreeNode[] = [];

  for (const rawLine of lines) {
    const match = rawLine.match(/^(\s*)(.+?)\s+(\[\[.+\]\])\s*$/);
    if (!match) continue;

    const [, spaces, rawLabel, rawMetadataPayload] = match;
    let metadata: unknown[];

    try {
      const parsedPayload = JSON.parse(rawMetadataPayload) as unknown;
      if (!Array.isArray(parsedPayload) || parsedPayload.length === 0 || !Array.isArray(parsedPayload[0])) {
        continue;
      }

      metadata = parsedPayload[0] as unknown[];
    } catch {
      continue;
    }

    const lineDepth = Math.floor(spaces.length / 2);
    nodes.push({
      lineDepth,
      label: normalizeLineLabel(rawLabel),
      metadata,
    });
  }

  return nodes;
};

const shouldIgnoreNode = (node: ParsedTreeNode): boolean => {
  const metaName = typeof node.metadata[0] === 'string' ? node.metadata[0].toUpperCase() : '';
  if (metaName === 'ROOT' || metaName === 'NOTE') return true;

  // Ignora nós organizacionais do markdown, mantendo somente sistema > edição > variante
  return node.lineDepth < 2;
};

const deriveNodeType = (normalizedDepth: number): 'system' | 'edition' | 'variant' => {
  if (normalizedDepth <= 0) return 'system';
  if (normalizedDepth === 1) return 'edition';
  if (normalizedDepth === 2) return 'variant';
  throw new Error(`Profundidade inválida ${normalizedDepth}: catálogo aceita somente sistema > edição > variante.`);
};

const acronymFrom = (name: string): string | null => {
  const tokens = name
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !STOPWORDS.has(token.toLowerCase()));

  if (tokens.length < 2) return null;

  const acronym = tokens.map((token) => token[0]).join('').toUpperCase();
  if (acronym.length < 2 || acronym.length > 6) return null;
  return acronym;
};

const buildAliases = (name: string, rootSegment: string, metadata: unknown[]): string[] => {
  const aliasSet = new Set<string>();

  aliasSet.add(name.trim());

  const metadataSystemName = typeof metadata[0] === 'string' ? metadata[0].trim() : null;
  const metadataEdition = typeof metadata[1] === 'string' ? metadata[1].trim() : null;

  if (metadataSystemName && metadataSystemName.toLowerCase() !== name.toLowerCase()) {
    aliasSet.add(metadataSystemName);
  }

  if (metadataEdition && metadataEdition.toLowerCase() !== name.toLowerCase()) {
    aliasSet.add(metadataEdition);
  }

  const acronym = acronymFrom(name);
  if (acronym) aliasSet.add(acronym);

  const knownAliases = KNOWN_ALIASES[rootSegment] ?? [];
  for (const knownAlias of knownAliases) aliasSet.add(knownAlias);

  return Array.from(aliasSet)
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0)
    .slice(0, 20);
};

const resolveSourceFilePath = (): string => {
  return path.resolve(__dirname, '../../arvores_de_sistemas.md');
};

const run = async () => {
  const sourcePath = resolveSourceFilePath();
  const markdown = fs.readFileSync(sourcePath, 'utf8');
  const parsedNodes = extractMarkdownNodes(markdown).filter((node) => !shouldIgnoreNode(node));

  if (parsedNodes.length === 0) {
    throw new Error('Nenhum nó válido foi identificado em arvores_de_sistemas.md.');
  }

  let inserted = 0;
  let updated = 0;
  let aliasesCreated = 0;

  await db.transaction().execute(async (trx) => {
    const existingSystems = await trx
      .selectFrom('systems')
      .select(['id', 'path_slug'])
      .where('path_slug', 'is not', null)
      .execute();

    const existingMap = new Map<string, string>();
    for (const row of existingSystems) {
      if (row.path_slug) existingMap.set(row.path_slug, row.id);
    }

    const stack: StackNode[] = [];

    for (const node of parsedNodes) {
      const normalizedDepth = node.lineDepth - 2;

      while (stack.length > normalizedDepth) {
        stack.pop();
      }

      const parent = normalizedDepth > 0 ? stack[normalizedDepth - 1] : null;
      const label = node.label;
      const segment = slugify(label) || `node-${Date.now().toString(36)}`;
      const pathSlug = parent ? `${parent.pathSlug}/${segment}` : segment;
      const description = typeof node.metadata[6] === 'string' ? node.metadata[6] : null;
      const nodeType = deriveNodeType(normalizedDepth);
      const globalSlug = pathSlug.replace(/\//g, '--');

      const alreadyExisted = existingMap.has(pathSlug);

      const [upserted] = await trx
        .insertInto('systems')
        .values({
          name: label,
          slug: globalSlug,
          description,
          parent_id: parent?.systemId ?? null,
          node_type: nodeType,
          depth: Math.max(0, normalizedDepth),
          path_slug: pathSlug,
        })
        .onConflict((oc) =>
          oc.column('path_slug').doUpdateSet({
            name: label,
            slug: globalSlug,
            description,
            parent_id: parent?.systemId ?? null,
            node_type: nodeType,
            depth: Math.max(0, normalizedDepth),
          })
        )
        .returning(['id'])
        .execute();

      if (!upserted) continue;

      if (alreadyExisted) updated += 1;
      else inserted += 1;

      existingMap.set(pathSlug, upserted.id);
      stack[normalizedDepth] = {
        pathSlug,
        systemId: upserted.id,
      };

      const rootSegment = pathSlug.split('/')[0] ?? segment;
      const aliases = buildAliases(label, rootSegment, node.metadata);

      for (const alias of aliases) {
        const aliasSlug = slugify(alias);
        if (!aliasSlug) continue;

        const insertedAlias = await trx
          .insertInto('system_aliases')
          .values({
            system_id: upserted.id,
            alias,
            alias_slug: aliasSlug,
            is_official: (KNOWN_ALIASES[rootSegment] ?? []).includes(alias),
          })
          .onConflict((oc) => oc.columns(['system_id', 'alias_slug']).doNothing())
          .returning(['id'])
          .executeTakeFirst();

        if (insertedAlias?.id) aliasesCreated += 1;
      }
    }
  });

  console.log('[systems:import-tree] Concluído com sucesso.');
  console.log(`- Sistemas inseridos: ${inserted}`);
  console.log(`- Sistemas atualizados: ${updated}`);
  console.log(`- Aliases inseridos: ${aliasesCreated}`);

  await db.destroy();
};

run().catch(async (error) => {
  console.error('[systems:import-tree] Falha na importação.', error);
  await db.destroy();
  process.exit(1);
});
