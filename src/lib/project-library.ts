import { z } from "zod";
import { commissioning, hasModule, taskKind } from "./commissioning";
import type { AppData, Project, User } from "./domain";
import { canReadTask, isProjectMember } from "./permissions";

const identifier = z.string().trim().min(1).max(150);
export const projectLessonSourceSchema = z
  .object({
    projectId: identifier,
    assetId: identifier,
    taskId: identifier.optional(),
  })
  .strict();
const lessonFields = {
  title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(10).max(5000),
  source: projectLessonSourceSchema,
  visibility: z.literal("project"),
};
export const projectLessonSchema = z
  .object({
    id: identifier,
    ...lessonFields,
    createdBy: identifier,
    createdByName: z.string().trim().min(1).max(250),
    createdAt: z.iso.datetime(),
    updatedBy: identifier,
    updatedByName: z.string().trim().min(1).max(250),
    updatedAt: z.iso.datetime(),
    version: z.number().int().positive(),
  })
  .strict();
export type ProjectLesson = z.infer<typeof projectLessonSchema>;
export const projectLessonCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("create"), ...lessonFields }).strict(),
  z
    .object({
      kind: z.literal("update"),
      id: identifier,
      lessonVersion: z.number().int().positive(),
      ...lessonFields,
    })
    .strict(),
]);
export const projectLibraryQuerySchema = z
  .object({
    q: z.string().trim().max(200).default(""),
    projectId: identifier.optional(),
    kind: z.enum(["all", "asset", "issue", "lesson"]).default("all"),
    offset: z.coerce.number().int().min(0).max(1000000).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export type ProjectLibraryQuery = z.input<typeof projectLibraryQuerySchema>;
export type ProjectLibraryResult = {
  key: string;
  kind: "asset" | "issue" | "lesson";
  projectId: string;
  projectName: string;
  projectVersion: number;
  assetId?: string;
  taskId?: string;
  lessonId?: string;
  title: string;
  snippet: string;
  sourceHref: string;
  lesson?: ProjectLesson;
};
export type ProjectLibraryPage = {
  results: ProjectLibraryResult[];
  total: number;
  offset: number;
  limit: number;
  facets: {
    projects: { id: string; name: string; count: number }[];
    kinds: Record<ProjectLibraryResult["kind"], number>;
  };
};

export const canReadProjectLibrary = (user: User) =>
  user.role !== "worker" && hasModule(user, "commissioning");
export const canEditProjectLessons = (user: User) =>
  canReadProjectLibrary(user) &&
  (user.role === "admin" || user.role === "manager");

/** Source checks use both IDs: identical asset IDs in two projects never merge. */
export function canReadLessonSource(
  data: AppData,
  user: User,
  project: Project,
  source: ProjectLesson["source"],
) {
  if (
    !canReadProjectLibrary(user) ||
    source.projectId !== project.id ||
    !isProjectMember(user, project.id, data) ||
    !commissioning(project).assets.some((asset) => asset.id === source.assetId)
  )
    return false;
  if (!source.taskId) return true;
  return (
    hasModule(user, "tasks") &&
    data.tasks.some(
      (task) =>
        task.id === source.taskId &&
        task.projectId === project.id &&
        task.cx?.assetId === source.assetId &&
        canReadTask(user, task, data),
    )
  );
}
const sourceHref = (source: ProjectLesson["source"]) =>
  source.taskId
    ? `/tasks/${encodeURIComponent(source.taskId)}`
    : `/commissioning?projectId=${encodeURIComponent(source.projectId)}&asset=${encodeURIComponent(source.assetId)}`;
const normalize = (text: string) =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
const excerpt = (text: string, query: string) => {
  const compact = text.replace(/\s+/g, " ").trim();
  const first = query.split(/\s+/).find(Boolean);
  const index = first ? normalize(compact).indexOf(first) : 0;
  const start = Math.max(0, index - 50);
  return `${start ? "…" : ""}${compact.slice(start, start + 240)}${compact.length > start + 240 ? "…" : ""}`;
};

/** Authorization precedes matching, snippets, totals, pagination and facets. */
export function queryProjectLibrary(
  data: AppData,
  user: User,
  input: ProjectLibraryQuery = {},
): ProjectLibraryPage {
  const options = projectLibraryQuerySchema.parse(input);
  const empty: ProjectLibraryPage = {
    results: [],
    total: 0,
    offset: options.offset,
    limit: options.limit,
    facets: { projects: [], kinds: { asset: 0, issue: 0, lesson: 0 } },
  };
  if (!canReadProjectLibrary(user)) return empty;
  const projects = data.projects.filter((project) =>
    isProjectMember(user, project.id, data),
  );
  const tokens = normalize(options.q).split(/\s+/).filter(Boolean);
  const matches: ProjectLibraryResult[] = [];
  const add = (result: ProjectLibraryResult, searchable: string) => {
    const text = normalize(searchable);
    if (tokens.every((token) => text.includes(token))) matches.push(result);
  };
  for (const project of projects) {
    const state = commissioning(project);
    const base = {
      projectId: project.id,
      projectName: project.name,
      projectVersion: state.version,
    };
    for (const asset of state.assets) {
      const detail = [
        asset.clientAssetId,
        asset.equipmentType,
        asset.location,
        asset.area,
        asset.phase,
        asset.discipline,
      ]
        .filter(Boolean)
        .join(" · ");
      add(
        {
          ...base,
          key: JSON.stringify([project.id, "asset", asset.id]),
          kind: "asset",
          assetId: asset.id,
          title: asset.name,
          snippet: excerpt(detail, normalize(options.q)),
          sourceHref: sourceHref({ projectId: project.id, assetId: asset.id }),
        },
        [project.name, asset.id, asset.name, detail].join(" "),
      );
    }
    if (hasModule(user, "tasks")) {
      for (const task of data.tasks) {
        if (
          task.projectId !== project.id ||
          taskKind(task) !== "issue" ||
          !canReadTask(user, task, data)
        )
          continue;
        // Issue notes, activity notes and attachments remain at their source.
        add(
          {
            ...base,
            key: JSON.stringify([project.id, "issue", task.id]),
            kind: "issue",
            taskId: task.id,
            assetId: task.cx?.assetId,
            title: task.title,
            snippet: excerpt(task.description, normalize(options.q)),
            sourceHref: `/tasks/${encodeURIComponent(task.id)}`,
          },
          [
            project.name,
            task.title,
            task.description,
            task.discipline,
            task.location,
          ].join(" "),
        );
      }
    }
    for (const record of state.lessons ?? []) {
      const parsed = projectLessonSchema.safeParse(record);
      if (
        !parsed.success ||
        !canReadLessonSource(data, user, project, parsed.data.source)
      )
        continue;
      const lesson = parsed.data;
      add(
        {
          ...base,
          key: JSON.stringify([project.id, "lesson", lesson.id]),
          kind: "lesson",
          assetId: lesson.source.assetId,
          taskId: lesson.source.taskId,
          lessonId: lesson.id,
          title: lesson.title,
          snippet: excerpt(lesson.content, normalize(options.q)),
          sourceHref: sourceHref(lesson.source),
          lesson,
        },
        [project.name, lesson.title, lesson.content].join(" "),
      );
    }
  }
  const withinProject = matches.filter(
    (result) => !options.projectId || result.projectId === options.projectId,
  );
  const filtered = withinProject
    .filter((result) => options.kind === "all" || result.kind === options.kind)
    .sort(
      (a, b) =>
        a.title.localeCompare(b.title) ||
        a.projectName.localeCompare(b.projectName) ||
        a.key.localeCompare(b.key),
    );
  return {
    ...empty,
    results: filtered.slice(options.offset, options.offset + options.limit),
    total: filtered.length,
    facets: {
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        count: matches.filter((result) => result.projectId === project.id)
          .length,
      })),
      kinds: {
        asset: withinProject.filter((result) => result.kind === "asset").length,
        issue: withinProject.filter((result) => result.kind === "issue").length,
        lesson: withinProject.filter((result) => result.kind === "lesson")
          .length,
      },
    },
  };
}

export class ProjectLibraryError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ProjectLibraryError";
  }
}

/** An explicit save creates curated content; source notes are never promoted. */
export function applyProjectLessonCommand(
  data: AppData,
  user: User,
  project: Project,
  input: z.input<typeof projectLessonCommandSchema>,
  context: { id: string; now: string },
) {
  if (!canEditProjectLessons(user) || !isProjectMember(user, project.id, data))
    throw new ProjectLibraryError(
      403,
      "Manager access to this project is required.",
    );
  const command = projectLessonCommandSchema.parse(input);
  if (!canReadLessonSource(data, user, project, command.source))
    throw new ProjectLibraryError(
      404,
      "The source is not available to your account.",
    );
  const lessons = commissioning(project).lessons ?? [];
  const previous =
    command.kind === "update"
      ? lessons.find((lesson) => lesson.id === command.id)
      : undefined;
  if (command.kind === "update") {
    if (!previous || !canReadLessonSource(data, user, project, previous.source))
      throw new ProjectLibraryError(404, "Lesson not found.");
    if (previous.version !== command.lessonVersion)
      throw new ProjectLibraryError(
        409,
        "This lesson changed. Refresh before saving.",
      );
  }
  const lesson = projectLessonSchema.parse({
    id: previous?.id ?? context.id,
    title: command.title,
    content: command.content,
    source: command.source,
    visibility: command.visibility,
    createdBy: previous?.createdBy ?? user.id,
    createdByName: previous?.createdByName ?? user.name,
    createdAt: previous?.createdAt ?? context.now,
    updatedBy: user.id,
    updatedByName: user.name,
    updatedAt: context.now,
    version: (previous?.version ?? 0) + 1,
  });
  if (!previous && lessons.some((entry) => entry.id === lesson.id))
    throw new ProjectLibraryError(
      409,
      "Lesson already exists. Refresh before saving.",
    );
  if (!previous && lessons.length >= 5000)
    throw new ProjectLibraryError(
      400,
      "This project has reached its lesson limit.",
    );
  return {
    lesson,
    lessons: previous
      ? lessons.map((entry) => (entry.id === previous.id ? lesson : entry))
      : [...lessons, lesson],
    changes: [
      `Lesson ${previous ? "updated" : "created"}: ${lesson.title} (version ${lesson.version})`,
    ],
  };
}
