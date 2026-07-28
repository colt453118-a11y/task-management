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
  USERS: 'users',
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

// ─── Project Document Types ────────────────────────────────────

export interface ProjectSearchDocument {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  ownerId: string;
  organizationId: string;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Initialize Indexes ────────────────────────────────────────

export async function initializeSearchIndexes(): Promise<void> {
  const client = getSearchClient();

  // Ensure indexes exist with explicit primary key before updating settings.
  // Meilisearch requires a primary key to store documents; calling updateSettings
  // on a non-existent index creates it without a primary key, causing silent failures.
  await client.createIndex(INDEXES.TASKS, { primaryKey: 'id' }).catch(() => {});
  await client.createIndex(INDEXES.PROJECTS, { primaryKey: 'id' }).catch(() => {});
  await client.createIndex(INDEXES.USERS, { primaryKey: 'id' }).catch(() => {});

  // Update the tasks index settings
  const taskIndex = client.index(INDEXES.TASKS);
  await taskIndex.updateSettings({
    searchableAttributes: ['title', 'description', 'taskIdDisplay', 'labels', 'tags'],
    filterableAttributes: ['status', 'priority', 'organizationId', 'assignedTo', 'projectId'],
    sortableAttributes: ['createdAt', 'updatedAt', 'priority'],
    rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
  });

  // Update the projects index settings
  const projectIndex = client.index(INDEXES.PROJECTS);
  await projectIndex.updateSettings({
    searchableAttributes: ['name', 'code', 'description', 'tags'],
    filterableAttributes: ['organizationId', 'status', 'ownerId'],
    sortableAttributes: ['createdAt', 'name'],
  });

  // Update the users index settings
  const userIndex = client.index(INDEXES.USERS);
  await userIndex.updateSettings({
    searchableAttributes: ['name', 'email', 'displayName', 'designation'],
    filterableAttributes: ['organizationId', 'employmentStatus', 'departmentId'],
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
      if (value) filterParts.push(`${key} = ${value}`);
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

// ═══════════════════════════════════════════════════════════════
//  PROJECT INDEXING
// ═══════════════════════════════════════════════════════════════

// ─── Index a Single Project ───────────────────────────────────

export async function indexProject(project: ProjectSearchDocument): Promise<void> {
  try {
    const client = getSearchClient();
    await client.index(INDEXES.PROJECTS).addDocuments([project]);
  } catch (error) {
    console.error('[search] Failed to index project:', error instanceof Error ? error.message : error);
  }
}

// ─── Index Multiple Projects ───────────────────────────────────

export async function indexProjects(projects: ProjectSearchDocument[]): Promise<void> {
  try {
    const client = getSearchClient();
    await client.index(INDEXES.PROJECTS).addDocuments(projects);
  } catch (error) {
    console.error(
      '[search] Failed to index projects:',
      error instanceof Error ? error.message : error,
    );
  }
}

// ─── Remove Project from Index ─────────────────────────────────

export async function removeProjectFromIndex(projectId: string): Promise<void> {
  try {
    const client = getSearchClient();
    await client.index(INDEXES.PROJECTS).deleteDocument(projectId);
  } catch (error) {
    console.error(
      '[search] Failed to remove project from index:',
      error instanceof Error ? error.message : error,
    );
  }
}

// ─── Search Projects ──────────────────────────────────────────

export async function searchProjects(
  options: SearchOptions,
): Promise<SearchResult<ProjectSearchDocument>> {
  const client = getSearchClient();

  const filterParts: string[] = [`organizationId = ${options.organizationId}`];

  if (options.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      if (value) filterParts.push(`${key} = ${value}`);
    }
  }

  const result = await client.index(INDEXES.PROJECTS).search(options.query, {
    limit: options.limit ?? 20,
    offset: options.offset ?? 0,
    filter: filterParts,
  });

  return {
    hits: result.hits as ProjectSearchDocument[],
    total: result.estimatedTotalHits ?? 0,
    estimatedTotal: result.estimatedTotalHits ?? 0,
    limit: result.limit ?? 20,
    offset: result.offset ?? 0,
  };
}
