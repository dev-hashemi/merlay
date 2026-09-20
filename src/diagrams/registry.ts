import { DiagramDriver, DiagramTemplate, SupportedDiagramType } from './types';
import { FlowchartDriver } from './flowchart/flowchartDriver';
import { StateDiagramDriver } from './state/stateDriver';
import { SequenceDiagramDriver } from './sequence/sequenceDriver';
import { MindmapDriver } from './mindmap/mindmapDriver';
import { ClassDiagramDriver } from './class/classDriver';
import { createUnsupportedDiagramDriver } from './unsupported/unsupportedDriver';
import { findFirstCodeLine } from './common/diagramHeader';

const drivers = new Map<SupportedDiagramType, DiagramDriver>();

export function registerDriver(driver: DiagramDriver): void {
  drivers.set(driver.type, driver);
}

// Register built-in drivers
registerDriver(FlowchartDriver);
registerDriver(StateDiagramDriver);
registerDriver(SequenceDiagramDriver);
registerDriver(MindmapDriver);
registerDriver(ClassDiagramDriver);

export const DIAGRAM_DISPLAY_NAMES: Record<SupportedDiagramType, string> = {
  flowchart: 'Flowchart',
  sequenceDiagram: 'Sequence Diagram',
  stateDiagram: 'State Diagram',
  classDiagram: 'Class Diagram',
  erDiagram: 'Entity Relationship Diagram',
  mindmap: 'Mindmap',
  journey: 'User Journey',
  gantt: 'Gantt Chart',
  pie: 'Pie Chart',
  quadrantChart: 'Quadrant Chart',
  requirementDiagram: 'Requirement Diagram',
  gitGraph: 'Git Graph',
  c4: 'C4 Diagram',
  timeline: 'Timeline',
  sankey: 'Sankey Diagram',
  xychart: 'XY Chart',
  block: 'Block Diagram',
  packet: 'Packet Diagram',
  kanban: 'Kanban',
  architecture: 'Architecture Diagram',
  zenuml: 'ZenUML',
  useCaseDiagram: 'Use Case Diagram',
  agentflow: 'Agentflow',
  unknown: 'Mermaid Diagram',
};

/**
 * Returns true if visual interactive editing is supported for this diagram type.
 */
export function isDiagramSupported(type: string): boolean {
  const driver = drivers.get(type as SupportedDiagramType);
  return !!driver && driver.capabilities.editable !== false;
}

/**
 * Detect the Mermaid diagram type from code by inspecting the first
 * substantive line (shared helper skips blanks, `%%` comments, and a
 * leading `--- ... ---` frontmatter block).
 */
export function detectDiagramType(code: string): SupportedDiagramType {
  const trimmed = findFirstCodeLine(code);
  if (!trimmed) return 'unknown';

  // Flowchart / Graph
  if (/^(flowchart|graph)\b/i.test(trimmed)) {
    return 'flowchart';
  }

  // State Diagram
  if (/^stateDiagram(-v2)?\b/i.test(trimmed)) {
    return 'stateDiagram';
  }

  // Sequence Diagram
  if (/^sequenceDiagram\b/i.test(trimmed)) {
    return 'sequenceDiagram';
  }

  // Class Diagram
  if (/^classDiagram(-v2)?\b/i.test(trimmed)) {
    return 'classDiagram';
  }

  // Entity Relationship Diagram
  if (/^erDiagram\b/i.test(trimmed)) {
    return 'erDiagram';
  }

  // User Journey
  if (/^journey\b/i.test(trimmed)) {
    return 'journey';
  }

  // Gantt Chart
  if (/^gantt\b/i.test(trimmed)) {
    return 'gantt';
  }

  // Pie Chart
  if (/^pie\b/i.test(trimmed)) {
    return 'pie';
  }

  // Quadrant Chart
  if (/^quadrantChart\b/i.test(trimmed)) {
    return 'quadrantChart';
  }

  // Requirement Diagram
  if (/^requirementDiagram\b/i.test(trimmed)) {
    return 'requirementDiagram';
  }

  // Git Graph
  if (/^gitGraph\b/i.test(trimmed)) {
    return 'gitGraph';
  }

  // C4 Diagram
  if (/^C4(Context|Container|Component|Dynamic|Deployment)\b/i.test(trimmed)) {
    return 'c4';
  }

  // Mindmap
  if (/^mindmap\b/i.test(trimmed)) {
    return 'mindmap';
  }

  // Timeline
  if (/^timeline\b/i.test(trimmed)) {
    return 'timeline';
  }

  // Sankey Diagram
  if (/^sankey(-beta)?\b/i.test(trimmed)) {
    return 'sankey';
  }

  // XY Chart
  if (/^xychart(-beta)?\b/i.test(trimmed)) {
    return 'xychart';
  }

  // Block Diagram
  if (/^block(-beta)?\b/i.test(trimmed)) {
    return 'block';
  }

  // Packet Diagram
  if (/^packet(-beta)?\b/i.test(trimmed)) {
    return 'packet';
  }

  // Kanban
  if (/^kanban\b/i.test(trimmed)) {
    return 'kanban';
  }

  // Architecture Diagram
  if (/^architecture(-beta)?\b/i.test(trimmed)) {
    return 'architecture';
  }

  // ZenUML
  if (/^zenuml\b/i.test(trimmed)) {
    return 'zenuml';
  }

  // Use Case Diagram
  if (/^useCaseDiagram\b/i.test(trimmed)) {
    return 'useCaseDiagram';
  }

  // Agentflow
  if (/^agentflow\b/i.test(trimmed)) {
    return 'agentflow';
  }

  return 'unknown';
}

export function getDriver(type: SupportedDiagramType): DiagramDriver | undefined {
  return drivers.get(type);
}

export function getDriverOrDefault(type: SupportedDiagramType): DiagramDriver {
  return (
    drivers.get(type) ??
    createUnsupportedDiagramDriver(type, DIAGRAM_DISPLAY_NAMES[type] || 'Mermaid Diagram')
  );
}

export function getDriverForCode(code: string): DiagramDriver {
  const type = detectDiagramType(code);
  return getDriverOrDefault(type);
}

export function getAllDrivers(): DiagramDriver[] {
  return Array.from(drivers.values());
}

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    type: 'flowchart',
    label: 'Flowchart (Default)',
    description: 'Process maps, workflows, decision trees, and system architectures.',
    defaultCode: `flowchart LR\n    A["Start"] --> B["Process"]\n    B --> C["End"]\n`,
  },
  {
    type: 'stateDiagram',
    label: 'State Diagram',
    description: 'Finite state machines, lifecycle transitions, choices, and forks.',
    defaultCode: `stateDiagram-v2\n    [*] --> Idle\n    Idle --> Processing : Submit\n    Processing --> Success : Approve\n    Processing --> Failed : Reject\n    Success --> [*]\n    Failed --> Idle : Retry\n`,
  },
  {
    type: 'sequenceDiagram',
    label: 'Sequence Diagram',
    description: 'Interactions, actors, synchronous/asynchronous messages, and lifelines.',
    defaultCode: `sequenceDiagram\n    autonumber\n    actor Alice\n    participant Bob\n    Alice->>Bob: Hello Bob, how are you?\n    Bob-->>Alice: I am good thanks!\n`,
  },
  {
    type: 'mindmap',
    label: 'Mindmap',
    description: 'Hierarchical idea trees, brainstorms, outlines, and knowledge breakdown.',
    defaultCode: `mindmap\n  root((Central Topic))\n    Idea 1\n      Detail A\n      Detail B\n    Idea 2\n      Detail C\n`,
  },
  {
    type: 'classDiagram',
    label: 'Class Diagram',
    description: 'Object-oriented structures, interfaces, inheritance, and associations.',
    defaultCode: `classDiagram\n    class Animal {\n        +String name\n        +move()\n    }\n    class Duck {\n        +quack()\n    }\n    Animal <|-- Duck\n`,
  },
];
