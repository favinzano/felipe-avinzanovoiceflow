```markdown
# felipe-avinzanovoiceflow Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development conventions and workflows used in the `felipe-avinzanovoiceflow` JavaScript repository. It covers file organization, code style, commit patterns, and testing practices to help contributors write consistent, maintainable code.

## Coding Conventions

### File Naming
- Use **kebab-case** for all file names.
  - Example: `voice-handler.js`, `user-data-service.js`

### Import Style
- Use **relative imports** for modules within the project.
  ```js
  import { getUserData } from './user-data-service.js';
  ```

### Export Style
- Use **named exports** for all modules.
  ```js
  // user-data-service.js
  export function getUserData(id) { ... }
  export function setUserData(id, data) { ... }
  ```

### Commit Messages
- Follow the **Conventional Commits** standard.
- Use the `feat` prefix for new features.
  - Example: `feat: add support for multi-language responses`

## Workflows

### Creating a New Feature
**Trigger:** When adding a new feature to the codebase  
**Command:** `/new-feature`

1. Create a new file using kebab-case naming.
2. Write your code using named exports.
3. Import any dependencies using relative paths.
4. Write or update corresponding test files (`*.test.ts`).
5. Commit your changes using a conventional commit message with the `feat` prefix.
   ```sh
   git commit -m "feat: implement user profile handler"
   ```

### Writing and Running Tests
**Trigger:** When verifying code correctness  
**Command:** `/run-tests`

1. Create or update test files with the `.test.ts` suffix.
2. Use the project's preferred (unknown) testing framework.
3. Run the test suite using the appropriate command (refer to project documentation or package scripts).

## Testing Patterns

- Test files are named with the `.test.ts` suffix and placed alongside or near the code they test.
- The specific testing framework is not detected; refer to the project documentation for details.
- Example test file name: `user-data-service.test.ts`

## Commands
| Command        | Purpose                                  |
|----------------|------------------------------------------|
| /new-feature   | Start the process for adding a new feature|
| /run-tests     | Run the test suite                       |
```
