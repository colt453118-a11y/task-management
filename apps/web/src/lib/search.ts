import { MeiliSearch } from 'meilisearch';

// ─── Meilisearch Client (lazy singleton) ───────────────────────

let searchClient: MeiliSearch | null = null;

function getSearchClient(): MeiliSearch {
  if (!searchClient) {
    const host = process.env.MEILISEARCH_HOST;
    const apiKey = process.env.MEILISEARCH_API_KEY;

    if (!host) {
      throw new Error('MEILISEARCH_HOST is not configured');
    }

    searchClient = new MeiliSearch({
      host,
      apiKey: apiKey || undefined,
    });
  }
  return searchClient;
}

// ─── Index Names ───────────────────────────────────────────────

export const INDEXES = {
  TASKS: 'tasks',
  PROJECTS: 'projects',
} as const;

// ─── Task Document Types ───────────────────────────────────────

export interface TaskSearchDocument {
  id: string;
  title: string;
  description: string | null;
  taskIdDisplay: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  projectId: string | null;
  organizationId: string;
  labels: string[] | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Initialize Indexes ────────────────────────────────────────

export async function initializeSearchIndexes(): Promise<void> {
  const client = getSearchClient();

  // Create or update the tasks index
  const taskIndex = client.index(INDEXES.TASKS);
  await taskIndex.updateSettings({
    searchableAttributes: ['title', 'description', 'taskIdDisplay', 'labels', 'tags'],
    filterableAttributes: ['status', 'priority', 'organizationId', 'assignedTo', 'projectId'],
    sortableAttributes: ['createdAt', 'updatedAt', 'priority'],
    rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
  });

  const projectIndex = client.index(INDEXES.PROJECTS);
  await projectIndex.updateSettings({
    searchableAttributes: ['name', 'code', 'description'],
    filterableAttributes: ['organizationId', 'status', 'ownerId'],
    sortableAttributes: ['createdAt', 'name'],
  });
}

// ─── Index a Single Task ───────────────────────────────────────

export async function indexTask(task: TaskSearchDocument): Promise<void> {
  try {
    const client = getSearchClient();
    await client.index(INDEXES.TASKS).addDocuments([task]);
  } catch (error) {
    console.error('[search] Failed to index task:', error instanceof Error ? error.message : error);
  }
}

// ─── Index Multiple Tasks ──────────────────────────────────────

export async function indexTasks(tasks: TaskSearchDocument[]): Promise<void> {
  try {
    const client = getSearchClient();
    await client.index(INDEXES.TASKS).addDocuments(tasks);
  } catch (error) {
    console.error(
      '[search] Failed to index tasks:',
      error instanceof Error ? error.message : error,
    );
  }
}

// ─── Remove Task from Index ────────────────────────────────────

export async function removeTaskFromIndex(taskId: string): Promise<void> {
  try {
    const client = getSearchClient();
    await client.index(INDEXES.TASKS).deleteDocument(taskId);
  } catch (error) {
    console.error(
      '[search] Failed to remove task from index:',
      error instanceof Error ? error.message : error,
    );
  }
}

// ─── Search Tasks ──────────────────────────────────────────────

export interface SearchOptions {
  query: string;
  organizationId: string;
  limit?: number;
  offset?: number;
  filter?: Record<string, string>;
}

export interface SearchResult<T> {
  hits: T[];
  total: number;
  estimatedTotal: number;
  limit: number;
  offset: number;
}

export async function searchTasks(
  options: SearchOptions,
): Promise<SearchResult<TaskSearchDocument>> {
  const client = getSearchClient();

  const filterParts: string[] = [`organizationId = ${options.organizationId}`];

  if (options.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      filterParts.push(`${key} = ${value}`);
    }
  }

  const result = await client.index(INDEXES.TASKS).search(options.query, {
    limit: options.limit ?? 20,
    offset: options.offset ?? 0,
    filter: filterParts,
  });

  return {
    hits: result.hits as TaskSearchDocument[],
    total: result.estimatedTotalHits ?? 0,
    estimatedTotal: result.estimatedTotalHits ?? 0,
    limit: result.limit ?? 20,
    offset: result.offset ?? 0,
  };
}
