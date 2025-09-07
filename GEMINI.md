# GEMINI.md

## Project Overview

This project is a web-based SSH terminal built with Next.js, TypeScript, and Tailwind CSS. It uses xterm.js for the terminal interface and a custom WebSocket server to bridge the connection to an SSH server. The application allows users to connect to an SSH server from their web browser.

The frontend is a Next.js application that provides the terminal UI. The backend is a simple Node.js server that uses the `ssh2` library to create an SSH client and `ws` to create a WebSocket server. The frontend and backend communicate over WebSockets.

## Building and Running

To build and run the project, you need to have Node.js and pnpm installed.

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Run the development server:**
    ```bash
    pnpm dev
    ```
    This will start the Next.js development server on port 3000 and the WebSocket server on port 3001.

3.  **Build the project:**
    ```bash
    pnpm build
    ```

4.  **Start the production server:**
    ```bash
    pnpm start
    ```

## Development Conventions

*   **Package Manager:** The project uses pnpm for package management.
*   **Linting:** ESLint is used for linting. You can run the linter with `pnpm lint`.
*   **Styling:** Tailwind CSS is used for styling.
*   **Terminal:** The terminal interface is built with xterm.js.
*   **Communication:** WebSockets are used for communication between the frontend and the backend.

---
# Agents — Must-Follow Follow-Ups After Every Code Change

1. Type check after each change: run `pnpm exec tsc --noEmit` and resolve any type errors before committing.
2. Commit message format: use one of `docs: ...`, `update: ...`, or `fix: ...` depending on the change.
3. Push after commit: always push the changes to `origin` on the current branch.

Notes
- `pnpm exec tsc --noEmit` performs a fast, project-wide TypeScript type check without emitting files.
- Do not skip type checking; only proceed to commit/push when the type check passes.