## Summary

Describe what changed and why.

## Type of Change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Documentation
- [ ] Test
- [ ] Build/CI

## Architecture Checklist

- [ ] Document model writes still go through worker services/systems and `NodeCursor`.
- [ ] Renderer/UI code remains read-only with respect to document data.
- [ ] New write methods declare mutation policy.
- [ ] Transaction and history responsibilities remain separate.
- [ ] Transform/layout semantics are documented when changed.
- [ ] Public API or package boundary changes are reflected in README/docs.

## Validation

List the checks you ran:

```bash
pnpm release:check
```

## Screenshots or Notes

Add screenshots, recordings or extra review notes when useful.
