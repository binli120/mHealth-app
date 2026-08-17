```markdown
# mHealth-app Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the `mHealth-app` repository, a TypeScript-based Next.js project. You'll learn how to structure files, write imports and exports, and follow commit and testing conventions. This guide is designed to help contributors maintain consistency and quality across the codebase.

## Coding Conventions

### File Naming
- Use **kebab-case** for all file and folder names.
  - **Example:**  
    ```
    user-profile.ts
    health-data-form.tsx
    ```

### Import Style
- Use **alias imports** for modules.
  - **Example:**  
    ```typescript
    import { fetchUserData } from '@/services/user';
    import HealthCard from '@/components/health-card';
    ```

### Export Style
- Prefer **named exports** over default exports.
  - **Example:**  
    ```typescript
    // In health-utils.ts
    export function calculateBMI(weight: number, height: number): number {
      return weight / (height * height);
    }

    // Importing
    import { calculateBMI } from '@/utils/health-utils';
    ```

### Commit Patterns
- Commit messages are **freeform** (no strict type prefixes).
- Commonly use short, descriptive messages (~36 characters).
  - **Example:**  
    ```
    add user authentication flow
    fix bug in health data sync
    update profile page layout
    ```

## Workflows

_No explicit workflows detected in the repository._

## Testing Patterns

- **Test File Pattern:** All test files follow the `*.test.*` naming convention.
  - **Example:**  
    ```
    user-profile.test.ts
    health-utils.test.ts
    ```
- **Testing Framework:** Not explicitly detected. Check the project for dependencies like Jest, Vitest, or similar.
- **Test Example:**
    ```typescript
    // health-utils.test.ts
    import { calculateBMI } from '@/utils/health-utils';

    test('calculates BMI correctly', () => {
      expect(calculateBMI(70, 1.75)).toBeCloseTo(22.86, 2);
    });
    ```

## Commands
| Command | Purpose |
|---------|---------|
| /file-naming | Show file naming conventions |
| /import-style | Show import style examples |
| /export-style | Show export style examples |
| /test-patterns | Show test file patterns and examples |
```