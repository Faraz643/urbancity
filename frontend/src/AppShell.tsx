/**
 * UrbanCity application shell.
 *
 * The production-safe V2 refactor keeps the existing runtime implementation
 * in AppShellLegacy while we progressively extract features into dedicated
 * components/hooks. This file is intentionally small so new Phase 2 work has
 * a stable entry point.
 */
export { AppShellLegacy as AppShell } from "./AppShellLegacy";
