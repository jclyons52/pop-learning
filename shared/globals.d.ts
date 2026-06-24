// Ambient declarations for the custom globals the shared modules attach to the
// page (loaded via plain <script> tags, so they live on window/globalThis).
// Typed loosely as `any` for now; can be tightened into a real Pop API later.
export {};

declare global {
  interface Window {
    // deno-lint-ignore no-explicit-any
    Pop?: any;
    // deno-lint-ignore no-explicit-any
    PopPlanCore?: any;
  }
  // deno-lint-ignore no-var no-explicit-any
  var Pop: any;
  // deno-lint-ignore no-var no-explicit-any
  var PopPlanCore: any;
}
