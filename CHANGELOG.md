# Changelog

## 0.2.0

Permitted generated-JSON redistribution:

- packaged Comprehensive Rules effective September 25, 2026 as pre-release `v0.2.0-data.2`;

- added the named data profile `complete-generated-document`;
- added `package-data` so local `parse` is not silently treated as a publisher;
- embedded unofficial, free-use-only notices in packaged JSON and a NOTICE sidecar;
- recorded source URL, source SHA-256, and effective date on packaged artifacts;
- kept official TXT and full generated JSON out of Git and the npm package;
- added a manual GitHub pre-release checklist and artifact inspection for `rules.json` plus `NOTICE.txt`;
- added a static lookup tester in `web/` that loads packaged JSON and shows required notices; and
- clarified that MIT covers original code only, not Wizards-owned rules text.

## 0.1.2

Developer-experience and release-readiness improvements:

- tightened the README around installation, quickstart, CLI, API, validation, and local diffing;
- added runnable library examples;
- added contributor, issue, and pull-request guidance;
- reviewed public package metadata and exports;
- improved CLI help and common file/JSON error messages;
- added package-consumer and package-content safety checks; and
- clarified the pre-1.0 status and local-only rules-data boundary.

## 0.1.1

Parser hardening, structured diagnostics, `doctor`, deterministic behavior, local diffing, package safety, and architectural decision records.

## 0.1.0

Initial parser and tooling release.
