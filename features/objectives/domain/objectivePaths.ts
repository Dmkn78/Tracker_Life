import type { ObjectivesData } from "@/features/objectives/domain/objective";

type ObjectiveMapNode = ObjectivesData["objectives"][number];

export type ObjectivePath = {
  key: string;
  root: ObjectiveMapNode | null;
  leaf: ObjectiveMapNode | null;
  nodes: Record<"year" | "quarter" | "month" | "week", ObjectiveMapNode | null>;
  totalLinkedTasks: number;
  totalWeeklyMinutes: number;
};

export function buildObjectivePaths(tree: ObjectivesData["tree"]): ObjectivePath[] {
  const objectivePaths: ObjectivePath[] = [];

  function visitObjective(
    node: NonNullable<ObjectivesData["tree"][number]>,
    lineage: Partial<Record<"year" | "quarter" | "month" | "week", ObjectiveMapNode>>
  ): void {
    const nextLineage = {
      ...lineage,
      [node.horizon]: toObjectiveMapNode(node)
    };

    if (node.children.length === 0) {
      objectivePaths.push(buildObjectivePath(nextLineage));
      return;
    }

    for (const child of node.children) visitObjective(child, nextLineage);
  }

  tree
    .filter((node): node is NonNullable<ObjectivesData["tree"][number]> => node != null)
    .forEach((node) => visitObjective(node, {}));

  return objectivePaths;
}

function toObjectiveMapNode(
  node: NonNullable<ObjectivesData["tree"][number]>
): ObjectiveMapNode {
  return {
    id: node.id,
    parentId: node.parentId,
    title: node.title,
    summary: node.summary,
    nextAction: node.nextAction,
    kind: node.kind,
    horizon: node.horizon,
    status: node.status,
    priority: node.priority,
    targetDate: node.targetDate,
    weekId: node.weekId,
    color: node.color,
    sortOrder: node.sortOrder,
    archived: node.archived,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    linkedTaskIds: node.linkedTasks.map((task) => task.id),
    linkedTasksCount: node.linkedTasksCount,
    weeklyMinutes: node.weeklyMinutes
  };
}

function buildObjectivePath(
  lineage: Partial<Record<"year" | "quarter" | "month" | "week", ObjectiveMapNode>>
): ObjectivePath {
  const nodes = {
    year: lineage.year ?? null,
    quarter: lineage.quarter ?? null,
    month: lineage.month ?? null,
    week: lineage.week ?? null
  };
  const usedNodes = Object.values(nodes).filter(
    (objective): objective is ObjectiveMapNode => objective !== null
  );
  return {
    key: usedNodes.map((objective) => objective.id).join(":"),
    root: usedNodes[0] ?? null,
    leaf: usedNodes.at(-1) ?? null,
    nodes,
    totalLinkedTasks: usedNodes.reduce(
      (linkedTaskCount, objective) => linkedTaskCount + objective.linkedTasksCount,
      0
    ),
    totalWeeklyMinutes: usedNodes.reduce(
      (weeklyMinutes, objective) => weeklyMinutes + objective.weeklyMinutes,
      0
    )
  };
}
