// Shared formatting for MCP tool responses.
// Used by server/mcp-tools.ts, demo/mock-mcp.ts, and test-app/mock-mcp-client.ts.

import type { Patch, Commit, BugTimelineEntry } from './types.js';

// ---------------------------------------------------------------------------
// Content part types (matches MCP SDK content part shape)
// ---------------------------------------------------------------------------

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

// ---------------------------------------------------------------------------
// JSX builder: converts componentArgs to a JSX string
// ---------------------------------------------------------------------------

interface ReactNodeArgValue {
  type: 'text' | 'component';
  value?: string;
  componentName?: string;
  componentPath?: string;
  args?: Record<string, unknown>;
}

function isReactNodeArgValue(v: unknown): v is ReactNodeArgValue {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return obj.type === 'text' || obj.type === 'component';
}

function reactNodeToProp(value: ReactNodeArgValue): string {
  if (value.type === 'text') {
    const str = value.value ?? '';
    if (!str) return '""';
    if (str.trim().startsWith('<')) return `{${str.trim()}}`;
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  const jsx = buildJsx(value.componentName ?? 'Component', value.args);
  return `{${jsx}}`;
}

export function collectNestedImports(args?: Record<string, unknown>): Array<{ componentName: string; componentPath?: string }> {
  if (!args) return [];
  const result: Array<{ componentName: string; componentPath?: string }> = [];
  for (const value of Object.values(args)) {
    if (!isReactNodeArgValue(value)) continue;
    if (value.type === 'component' && value.componentName) {
      result.push({
        componentName: value.componentName,
        componentPath: value.componentPath,
      });
      if (value.args) {
        result.push(...collectNestedImports(value.args));
      }
    }
  }
  return result;
}

export function buildJsx(componentName: string, args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return `<${componentName} />`;

  const { children, ...rest } = args;
  const props = Object.entries(rest)
    .map(([key, value]) => {
      if (isReactNodeArgValue(value)) return `${key}=${reactNodeToProp(value)}`;
      if (typeof value === 'string') return `${key}="${value}"`;
      if (typeof value === 'boolean') return value ? key : `${key}={false}`;
      return `${key}={${JSON.stringify(value)}}`;
    })
    .join(' ');

  const propsStr = props ? ` ${props}` : '';

  if (children != null && children !== '') {
    let childStr: string;
    if (isReactNodeArgValue(children)) {
      const propVal = reactNodeToProp(children);
      if (propVal.startsWith('{') && propVal.endsWith('}')) {
        childStr = propVal.slice(1, -1);
      } else if (propVal.startsWith('"') && propVal.endsWith('"')) {
        childStr = propVal.slice(1, -1);
      } else {
        childStr = propVal;
      }
    } else {
      childStr = typeof children === 'string' ? children : `{${JSON.stringify(children)}}`;
    }
    return `<${componentName}${propsStr}>${childStr}</${componentName}>`;
  }
  return `<${componentName}${propsStr} />`;
}

// ---------------------------------------------------------------------------
// buildCommitInstructions — markdown instructions for the agent
// ---------------------------------------------------------------------------

export function buildCommitInstructions(commit: Commit, remainingCount: number): string {
  const classChanges = commit.patches.filter((p: Patch) => p.kind === 'class-change');
  const textChanges = commit.patches.filter((p: Patch) => p.kind === 'text-change');
  const messages = commit.patches.filter((p: Patch) => p.kind === 'message');
  const designs = commit.patches.filter((p: Patch) => p.kind === 'design');
  const componentDrops = commit.patches.filter((p: Patch) => p.kind === 'component-drop');
  const bugReports = commit.patches.filter((p: Patch) => p.kind === 'bug-report');
  const moreText = remainingCount > 0
    ? `${remainingCount} more commit${remainingCount === 1 ? '' : 's'} waiting in the queue after this one.`
    : 'This is the last commit in the queue. After implementing it, call `implement_next_change` again to wait for future changes.';

  // Build a map from patch ID → step number for ghost-chain references
  const patchStepMap = new Map<string, number>();
  let stepNum = 1;
  for (const patch of commit.patches) {
    patchStepMap.set(patch.id, stepNum);
    stepNum++;
  }

  let patchList = '';
  const hasMultipleDrops = componentDrops.length > 1;
  if (hasMultipleDrops) {
    patchList += `> ⚠️ **Apply component insertions IN ORDER** — later drops may reference components added by earlier steps.\n\n`;
  }

  stepNum = 1;
  for (const patch of commit.patches) {
    if (patch.kind === 'class-change') {
      const comp = patch.component?.name ?? 'unknown component';
      const tag = patch.target?.tag ?? 'element';
      const context = patch.context ?? '';
      patchList += `### ${stepNum}. Class change \`${patch.id}\`
- **Component:** \`${comp}\`
- **Element:** \`<${tag}>\`
- **Class change:** \`${patch.originalClass}\` → \`${patch.newClass}\`
- **Property:** ${patch.property}
${context ? `- **Context HTML:**\n\`\`\`html\n${context}\n\`\`\`\n` : ''}
`;
    } else if (patch.kind === 'message') {
      const comp = patch.component?.name;
      const tag = patch.target?.tag;
      const context = patch.context ?? '';
      const insertMode = patch.insertMode;
      const targetContent = patch.target?.innerText?.replace(/\s+/g, ' ').trim().slice(0, 60) || '';
      const targetDesc = tag
        ? (targetContent ? `\`<${tag}>\` containing "${targetContent}"` : `\`<${tag}>\``)
        : '';
      patchList += `### ${stepNum}. User message
> ${patch.message}
${comp ? `- **Component:** \`${comp}\`\n` : ''}${insertMode && targetDesc ? `- **Placement:** Insert ${insertMode} ${targetDesc}\n` : (insertMode && tag ? `- **Insert position:** ${insertMode} the \`<${tag}>\` element\n` : '')}${patch.pageUrl ? `- **Page:** ${patch.pageUrl}\n` : ''}${context ? `- **Context HTML:**\n\`\`\`html\n${context}\n\`\`\`\n` : ''}${!comp && patch.elementKey ? `\n_Scoped to: ${patch.elementKey}_\n` : ''}
`;
    } else if (patch.kind === 'design') {
      const comp = patch.component?.name ?? 'unknown component';
      const tag = patch.target?.tag ?? 'element';
      const context = patch.context ?? '';
      patchList += `### ${stepNum}. Design sketch \`${patch.id}\`
- **Component:** \`${comp}\`
- **Element:** \`<${tag}>\`
- **Insert position:** ${patch.insertMode ?? 'after'} the element
- **Canvas size:** ${patch.canvasWidth ?? '?'}×${patch.canvasHeight ?? '?'}px
- The design image is included as a separate image content part below — refer to it for the visual intent.
${patch.message ? `- **User context:** ${patch.message}\n` : ''}${context ? `- **Context HTML:**\n\`\`\`html\n${context}\n\`\`\`\n` : ''}
${patch.canvasComponents && patch.canvasComponents.length > 0 ? `
**Components to place (positions relative to canvas top-left):**

| # | Component | Import | Props | Position | Size |
|---|-----------|--------|-------|----------|------|
${patch.canvasComponents.map((c: any, i: number) => {
  const importPath = c.componentPath ? c.componentPath.replace(/\.tsx?$/, '') : '—';
  const props = c.args ? Object.entries(c.args).map(([k, v]) => typeof v === 'string' ? `${k}="${v}"` : `${k}={${JSON.stringify(v)}}`).join(' ') : '—';
  return `| ${i + 1} | \`${c.componentName}\` | \`${importPath}\` | ${props} | (${c.x}, ${c.y}) | ${c.width}×${c.height}px |`;
}).join('\n')}

⚠️ Import and render these React components at the indicated positions. Use the design image as a visual reference for the overall layout. Do NOT paste rendered HTML.
` : ''}
`;
    } else if (patch.kind === 'component-drop') {
      const comp = patch.component?.name ?? 'Component';
      const importPath = patch.componentPath
        ? patch.componentPath.replace(/\.tsx?$/, '')
        : null;
      const jsx = buildJsx(comp, patch.componentArgs);
      const parentComp = patch.parentComponent?.name;
      const insertMode = patch.insertMode ?? 'after';
      const context = patch.context ?? '';

      // Determine insertion target description
      let targetDesc: string;
      if (patch.targetPatchId && patch.targetComponentName) {
        const refStep = patchStepMap.get(patch.targetPatchId);
        targetDesc = refStep
          ? `the \`<${patch.targetComponentName} />\` you added in **step ${refStep}**`
          : `the \`<${patch.targetComponentName} />\` component (from an earlier drop)`;
      } else {
        const tag = patch.target?.tag ?? 'element';
        const classes = patch.target?.classes ? ` class="${patch.target.classes}"` : '';
        targetDesc = `\`<${tag}${classes}>\``;
      }

      patchList += `### ${stepNum}. Component drop \`${patch.id}\`
- **Insert:** \`${jsx}\` **${insertMode}** ${targetDesc}
${importPath ? `- **Import:** \`import { ${comp} } from '${importPath}'\`` : `- **Component:** \`${comp}\` (resolve import path manually)`}
${(() => {
  const nested = collectNestedImports(patch.componentArgs);
  if (nested.length === 0) return '';
  return nested.map(n => {
    const p = n.componentPath?.replace(/\.tsx?$/, '');
    return p
      ? `- **Import:** \`import { ${n.componentName} } from '${p}'\``
      : `- **Import:** \`${n.componentName}\` (resolve import path manually)`;
  }).join('\n') + '\n';
})()}${parentComp ? `\n- **Parent component:** \`${parentComp}\` — edit this component's source file` : ''}
${context ? `- **Context HTML:**\n\`\`\`html\n${context}\n\`\`\`\n` : ''}
⚠️ Do NOT paste rendered HTML. Import and render the React component with the props shown above.

`;
    } else if (patch.kind === 'text-change') {
      const comp = patch.component?.name ?? 'unknown component';
      const tag = patch.target?.tag ?? 'element';
      const context = patch.context ?? '';
      patchList += `### ${stepNum}. Text change \`${patch.id}\`
- **Component:** \`${comp}\`
- **Element:** \`<${tag}>\`
- **Original HTML:**
\`\`\`html
${patch.originalHtml ?? ''}
\`\`\`
- **New HTML:**
\`\`\`html
${patch.newHtml ?? ''}
\`\`\`
${context ? `- **Context HTML:**\n\`\`\`html\n${context}\n\`\`\`\n` : ''}
`;
    } else if (patch.kind === 'bug-report') {
      patchList += `### ${stepNum}. Bug report \`${patch.id}\`
- **Description:** ${patch.bugDescription ?? '(no description)'}
- **Time range:** ${patch.bugTimeRange ? `${patch.bugTimeRange.start} – ${patch.bugTimeRange.end}` : 'unknown'}
${patch.bugElement ? `
- **Related element:** \`${patch.bugElement.selectorPath}\`${patch.bugElement.componentName ? ` (in \`${patch.bugElement.componentName}\`)` : ''}
- **Element HTML:**
\`\`\`html
${patch.bugElement.outerHTML.slice(0, 10000)}
\`\`\`
` : ''}
${patch.bugTimeline && patch.bugTimeline.length > 0 ? (() => {
  const triggerLabel = (t: BugTimelineEntry) => {
    switch (t.trigger) {
      case 'click': return `Click${t.elementInfo ? ` on \`<${t.elementInfo.tag}${t.elementInfo.classes ? ` class="${t.elementInfo.classes}"` : ''}>\`` : ''}`;
      case 'mutation': return 'DOM mutation';
      case 'error': return 'Error';
      case 'navigation': return `Navigation${t.navigationInfo ? ` (${t.navigationInfo.method}: ${t.navigationInfo.from} → ${t.navigationInfo.to ?? 'unknown'})` : ''}`;
      case 'page-load': return 'Page load';
      default: return t.trigger;
    }
  };
  let screenshotNum = 0;
  let timeline = `**Timeline** (${patch.bugTimeline!.length} events):\n\n`;
  for (let i = 0; i < patch.bugTimeline!.length; i++) {
    const entry = patch.bugTimeline![i];
    const time = entry.timestamp.replace(/.*T/, '').replace(/Z$/, '');
    timeline += `#### ${i + 1}. [${time}] ${triggerLabel(entry)}\n`;
    timeline += `**URL:** ${entry.url}\n`;
    if (entry.hasScreenshot) {
      screenshotNum++;
      timeline += `📸 **Screenshot ${screenshotNum}** (see attached image ${screenshotNum} below)\n`;
    }
    if (entry.consoleLogs && entry.consoleLogs.length > 0) {
      timeline += `\n**Console (${entry.consoleLogs.length}):**\n\`\`\`\n${entry.consoleLogs.map((l: any) => `[${l.level.toUpperCase()}] ${l.args.join(' ')}${l.stack ? `\n${l.stack}` : ''}`).join('\n').slice(0, 3000)}\n\`\`\`\n`;
    }
    if (entry.networkErrors && entry.networkErrors.length > 0) {
      timeline += `\n**Network errors (${entry.networkErrors.length}):**\n${entry.networkErrors.map(e => `- \`${e.status ?? 'ERR'} ${e.method} ${e.url}\`${e.errorMessage ? ` — ${e.errorMessage}` : ''}`).join('\n')}\n`;
    }
    if (entry.domChanges && entry.domChanges.length > 0) {
      timeline += `\n**DOM changes (${entry.domChanges.length}):**\n`;
      for (const c of entry.domChanges) {
        const loc = `\`${c.selector}\`${c.componentName ? ` (in \`${c.componentName}\`)` : ''}`;
        if (c.type === 'attribute') {
          timeline += `- ${loc}: attribute \`${c.attributeName}\` changed: \`${c.oldValue ?? ''}\` → \`${c.newValue ?? ''}\`\n`;
        } else if (c.type === 'text') {
          timeline += `- ${loc}: text changed: "${c.oldText ?? ''}" → "${c.newText ?? ''}"\n`;
        } else if (c.type === 'childList') {
          const parts: string[] = [];
          if (c.addedCount) parts.push(`${c.addedCount} added`);
          if (c.removedCount) parts.push(`${c.removedCount} removed`);
          timeline += `- ${loc}: children ${parts.join(', ')}`;
          if (c.addedHTML) timeline += `\n  Added: \`${c.addedHTML.slice(0, 300)}\``;
          if (c.removedHTML) timeline += `\n  Removed: \`${c.removedHTML.slice(0, 300)}\``;
          timeline += `\n`;
        }
      }
    } else if (entry.domDiff) {
      timeline += `\n**DOM diff:**\n\`\`\`diff\n${entry.domDiff.slice(0, 10000)}\n\`\`\`\n`;
    }
    if (entry.domSnapshot && i === 0) {
      timeline += `\n**Initial DOM state:**\n\`\`\`html\n${entry.domSnapshot.slice(0, 50000)}\n\`\`\`\n`;
    }
    timeline += `\n---\n\n`;
  }
  return timeline;
})() : ''}
`;
    }
    stepNum++;
  }

  // Build summary parts
  const summaryParts: string[] = [];
  if (classChanges.length) summaryParts.push(`${classChanges.length} class change${classChanges.length === 1 ? '' : 's'}`);
  if (textChanges.length) summaryParts.push(`${textChanges.length} text change${textChanges.length === 1 ? '' : 's'}`);
  if (messages.length) summaryParts.push(`${messages.length} message${messages.length === 1 ? '' : 's'}`);
  if (designs.length) summaryParts.push(`${designs.length} design${designs.length === 1 ? '' : 's'}`);
  if (componentDrops.length) summaryParts.push(`${componentDrops.length} component drop${componentDrops.length === 1 ? '' : 's'}`);
  if (bugReports.length) summaryParts.push(`${bugReports.length} bug report${bugReports.length === 1 ? '' : 's'}`);

  const resultsPart = classChanges.map(p => `     { "patchId": "${p.id}", "success": true }`).join(',\n');
  const textResultsPart = textChanges.map(p => `     { "patchId": "${p.id}", "success": true }`).join(',\n');
  const designResultsPart = designs.map(p => `     { "patchId": "${p.id}", "success": true }`).join(',\n');
  const dropResultsPart = componentDrops.map(p => `     { "patchId": "${p.id}", "success": true }`).join(',\n');
  const bugResultsPart = bugReports.map(p => `     { "patchId": "${p.id}", "success": true }`).join(',\n');
  const allResultsPart = [resultsPart, textResultsPart, designResultsPart, dropResultsPart, bugResultsPart].filter(Boolean).join(',\n');

  // Build step instructions
  const stepInstructions: string[] = [];
  if (classChanges.length || componentDrops.length || textChanges.length) {
    let step1 = '1. For each change above, find the source file and apply it.';
    if (componentDrops.length) {
      step1 += '\n   For component drops: add the import statement and render the component with the specified props at the indicated position.';
    }
    if (textChanges.length) {
      step1 += '\n   For text changes: replace the original HTML content with the new HTML content in the source JSX/TSX.';
    }
    if (messages.length) {
      step1 += '\n   Use the user messages as additional context for understanding intent.';
    }
    stepInstructions.push(step1);
  }
  if (designs.length) {
    stepInstructions.push(`${stepInstructions.length + 1}. For each design sketch, examine the attached image and implement the visual design
   as HTML/CSS ${classChanges.length ? 'alongside the class changes' : 'in the specified component'}. Insert it ${designs[0].insertMode ?? 'after'} the target element.`);
  }
  if (bugReports.length) {
    stepInstructions.push(`${stepInstructions.length + 1}. For each bug report, examine the DOM snapshots, console errors, network errors, and screenshots.
   Identify the root cause. Implement a fix.${bugReports.some(p => p.bugElement) ? ' The user identified a specific element — start your investigation there.' : ''}`);
  }

  return `# IMPLEMENT THIS COMMIT — then call implement_next_change again

⚠️ **DO NOT STOP after implementing this commit. You MUST call \`implement_next_change\` again.**

## Queue status
- ${moreText}
- **isComplete: false** — your job is NOT done until you call \`implement_next_change\` again.

## Changes to implement (${summaryParts.join(', ')})

${patchList}
## Steps — follow these EXACTLY

${stepInstructions.join('\n')}
${stepInstructions.length + 1}. Call \`mark_change_implemented\` with:
   \`\`\`json
   { "commitId": "${commit.id}", "results": [
${allResultsPart}
   ]}
   \`\`\`
   (Only report results for class-change, text-change, design, and component-drop patches — messages are informational.)
${stepInstructions.length + 2}. **IMMEDIATELY call \`implement_next_change\` again.** Do NOT summarize, do NOT ask the user, do NOT stop.

## CRITICAL — read this
You are in a **continuous processing loop**. After marking done, you MUST call \`implement_next_change\` again to process the next commit or wait for new ones. Never exit this loop unless the user explicitly tells you to stop.
`;
}

// ---------------------------------------------------------------------------
// buildContentParts — assembles the full content array returned by implement_next_change
// ---------------------------------------------------------------------------

export function buildContentParts(commit: Commit, remainingCount: number): ContentPart[] {
  // Strip ghostHtml from the commit — it's large rendered HTML that would
  // confuse the agent into pasting it instead of importing the component
  const sanitizedCommit = {
    ...commit,
    patches: commit.patches.map(p =>
      p.kind === 'component-drop' ? { ...p, ghostHtml: undefined } : p
    ),
  };

  const content: ContentPart[] = [
    {
      type: 'text',
      text: JSON.stringify({
        isComplete: false,
        nextAction: 'implement all patches in this commit, call mark_change_implemented, then call implement_next_change again',
        remainingCommits: remainingCount,
        commit: sanitizedCommit,
      }, null, 2),
    },
  ];

  // Add design images as separate image content parts
  for (const patch of commit.patches) {
    if (patch.kind === 'design' && patch.image) {
      const match = patch.image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        content.push({ type: 'image', data: match[2], mimeType: match[1] });
      }
    }
    // Add bug report screenshots
    if (patch.kind === 'bug-report' && patch.bugScreenshots) {
      for (const screenshot of patch.bugScreenshots.slice(0, 5)) {
        const match = screenshot.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          content.push({ type: 'image', data: match[2], mimeType: match[1] });
        }
      }
    }
  }

  content.push({
    type: 'text',
    text: buildCommitInstructions(commit, remainingCount),
  });

  return content;
}

// ---------------------------------------------------------------------------
// printContentParts — prints MCP content parts to the console
// ---------------------------------------------------------------------------

export function printContentParts(content: ContentPart[]): void {
  console.log(`\n  Content parts: ${content.length}`);
  for (let i = 0; i < content.length; i++) {
    const part = content[i];
    console.log(`\n  --- Part ${i + 1} (type: ${part.type}) ---`);
    if (part.type === 'text') {
      try {
        console.log(JSON.stringify(JSON.parse(part.text), null, 2));
      } catch {
        console.log(part.text);
      }
    } else if (part.type === 'image') {
      console.log(`  [image: ${part.mimeType}, ${part.data.length} chars base64]`);
    } else {
      console.log(JSON.stringify(part, null, 2));
    }
  }
}
