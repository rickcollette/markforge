import type { DocumentTemplate } from "./types";

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "blank",
    name: "Blank Document",
    description: "Start from scratch.",
    filename: "untitled.md",
    content: "",
  },
  {
    id: "readme",
    name: "README",
    description: "Project README with badges, usage and license sections.",
    filename: "README.md",
    content: `# Project Name

Short description of what this project does and who it is for.

## Installation

\`\`\`bash
npm install project-name
\`\`\`

## Usage

\`\`\`js
import { thing } from "project-name";
\`\`\`

## Contributing

Pull requests are welcome.

## License

MIT
`,
  },
  {
    id: "spec-md",
    name: "SPEC.md",
    description: "Software specification template.",
    filename: "SPEC.md",
    content: `# SPEC.md

## Overview

Describe the product and its goals.

## Requirements

1. Requirement one.
2. Requirement two.

## Architecture

\`\`\`mermaid
flowchart LR
  Client --> API --> Database
\`\`\`

## Milestones

| Milestone | Deliverable | Status |
| --- | --- | --- |
| 1 | Skeleton | Planned |

## Open Questions

- Question one?
`,
  },
  {
    id: "architecture",
    name: "Architecture Document",
    description: "System architecture with diagrams.",
    filename: "ARCHITECTURE.md",
    content: `# Architecture

## Context

Why this system exists.

## Components

\`\`\`mermaid
flowchart TD
  UI[Frontend] --> API[Backend API]
  API --> DB[(Database)]
  API --> Q[Queue]
\`\`\`

## Data Flow

Describe the main flows.

## Decisions

| Decision | Rationale |
| --- | --- |
|  |  |
`,
  },
  {
    id: "prd",
    name: "Product Requirements",
    description: "PRD with problem, goals, and scope.",
    filename: "PRD.md",
    content: `# Product Requirements Document

## Problem

What problem are we solving?

## Goals

- Goal one

## Non-Goals

- Out of scope item

## User Stories

- As a user, I want ... so that ...

## Success Metrics

| Metric | Target |
| --- | --- |
|  |  |
`,
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    description: "Agenda, notes, and action items.",
    filename: "meeting-notes.md",
    content: `# Meeting Notes

**Date:** {date}
**Attendees:**

## Agenda

1.

## Notes

-

## Action Items

- [ ] Owner — task
`,
  },
  {
    id: "decision-record",
    name: "Decision Record",
    description: "Architecture decision record (ADR).",
    filename: "adr-001.md",
    content: `# ADR-001: Title

## Status

Proposed

## Context

What is the issue we are deciding on?

## Decision

What did we decide?

## Consequences

What becomes easier or harder?
`,
  },
  {
    id: "runbook",
    name: "Runbook",
    description: "Operational runbook with procedures.",
    filename: "runbook.md",
    content: `# Runbook: Service Name

## Overview

What this service does.

## Health Checks

- [ ] Endpoint responds
- [ ] Queue depth normal

## Common Procedures

### Restart

\`\`\`bash
# commands here
\`\`\`

## Escalation

| Severity | Contact |
| --- | --- |
| P1 |  |
`,
  },
  {
    id: "incident-report",
    name: "Incident Report",
    description: "Post-incident review template.",
    filename: "incident-report.md",
    content: `# Incident Report

**Date:** {date}
**Severity:**
**Duration:**

## Summary

What happened, in two sentences.

## Timeline

| Time | Event |
| --- | --- |
|  |  |

## Root Cause

## Action Items

- [ ]
`,
  },
  {
    id: "blog-post",
    name: "Blog Post",
    description: "Frontmatter plus article skeleton.",
    filename: "post.md",
    content: `---
title: Post Title
description: One-line summary
tags:
  - writing
draft: true
---

# Post Title

Opening hook.

## Section

Body text.

## Conclusion

Wrap-up.
`,
  },
  {
    id: "mermaid-collection",
    name: "Mermaid Diagram Collection",
    description: "A document with one of each major diagram type.",
    filename: "diagrams.md",
    content: `# Diagram Collection

## Flow

\`\`\`mermaid
flowchart TD
  A[Start] --> B{Choice}
  B -->|Yes| C[Do it]
  B -->|No| D[Skip]
\`\`\`

## Sequence

\`\`\`mermaid
sequenceDiagram
  User->>App: Click
  App-->>User: Response
\`\`\`

## State

\`\`\`mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Busy
  Busy --> [*]
\`\`\`
`,
  },
  {
    id: "api-doc",
    name: "API Documentation",
    description: "Endpoint reference template.",
    filename: "api.md",
    content: `# API Reference

## Authentication

How to authenticate.

## Endpoints

### GET /resource

| Param | Type | Description |
| --- | --- | --- |
| id | string | Resource id |

**Response**

\`\`\`json
{
  "id": "abc",
  "name": "Example"
}
\`\`\`
`,
  },
];

export function instantiateTemplate(template: DocumentTemplate): string {
  const today = new Date().toISOString().slice(0, 10);
  return template.content.replaceAll("{date}", today);
}
