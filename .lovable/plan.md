

## Fix: ErrorBoundary Appearing on Login and Generate

### Problem
Users are seeing the "Algo deu errado" (ErrorBoundary) screen when logging in and when clicking generate. The app works after reloading, which indicates a transient/race condition error during rendering.

### Root Cause Analysis
The current ErrorBoundary hides error details in production (`process.env.NODE_ENV === 'development'`), making it impossible to diagnose the actual crash. Additionally, the only recovery option is a full page reload, which is a poor user experience.

### Changes

**1. Improve ErrorBoundary with auto-recovery and visible error details**

Update `src/components/ErrorBoundary.tsx`:
- Always show the error message (not just in development) -- this is critical for remote diagnosis
- Add a "Try Again" button that resets the ErrorBoundary state (clears the error and re-renders children) instead of requiring a full page reload
- Keep the "Reload page" button as a fallback
- Log errors with more context for remote debugging

**2. Add route-level error boundaries**

Update `src/App.tsx`:
- Wrap each `<Route>` element's content in its own `<ErrorBoundary>` so that a crash on one page (e.g., Editor) doesn't kill the entire app including navigation
- The global ErrorBoundary stays as a last resort

**3. Add defensive guards in Editor.tsx**

Update `src/pages/Editor.tsx`:
- Wrap the `generateForResult` and `generateAllFromGravity` callbacks in more defensive try-catch to prevent any unhandled exception from propagating
- Add null-safety checks before accessing `error.context` in `FunctionsHttpError` handling

### Technical Details

```text
Current flow:
  Error in any component --> Global ErrorBoundary --> Full page reload required

New flow:
  Error in route component --> Route ErrorBoundary --> "Try Again" resets state
  Error in route boundary  --> Global ErrorBoundary --> "Try Again" or reload
```

The "Try Again" button will call `setState({ hasError: false, error: null })`, which re-renders children from scratch, effectively recovering from transient errors without losing the user's session or requiring a page reload.

