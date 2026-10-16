# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The public page serves three people, with the rule lookup first. A player needs the official wording of a rule right now. A judge checks a rule number during a game or event. A developer wants the same document as machine-readable data. Confirmed by the maintainer on 16 October 2026.

## Product Purpose

mtg-rules turns the official Magic: The Gathering Comprehensive Rules into structured data and lets a person find a rule by number or by words. Success on the public page is finding the official wording, with its examples, without the page interpreting how to play.

## Positioning

The page shows the official wording in the document's own structure. It does not judge card interactions, explain strategy, or replace the Comprehensive Rules. The same structured document is what a program can read.

## Operating Context

A visitor opens the public page in a browser, types a rule number such as 704.5f or a phrase, and reads the matching rule. Example searches are offered. The effective date, source URL, and unofficial notices stay visible. The hosted page loads a packaged JSON file that the build downloads from a GitHub release. The parser and CLI remain a local developer tool.

## Capabilities and Constraints

- Search is by rule id, id prefix, rule text, and glossary term.
- Packaged data uses the profile `complete-generated-document`, with source URL, source hash, and effective date.
- Required notices: unofficial Fan Content, not affiliated with Wizards of the Coast, free noncommercial use only, MIT applies to original code and not to Wizards-owned text.
- The rules JSON is not stored in Git.
- No accounts, no paywall, no ads, no gameplay interpretation, no hosted rules API.
- Donations or sponsorships may be added later without charging for the data. They are not on the page yet.

## Brand Commitments

The name is mtg-rules. The page must identify itself as unofficial Fan Content and must not present itself as a Wizards of the Coast site. The maintainer rejected the incumbent public page as dreary. That rejection is not a palette or typeface brief.

## Evidence on Hand

- Live page: https://mtg-rules-liard.vercel.app
- Repository: https://github.com/natewizz/mtg-rules
- Current packaged release: v0.2.0-data.1, effective date August 7, 2026, 3,162 rules, 739 glossary entries.
- Notices: NOTICE.md
- Official rules page: https://magic.wizards.com/en/rules
- No testimonials, user counts, or pricing exist. Do not invent them.

## Product Principles

- The lookup comes before the explanation.
- The official wording is shown as written.
- The page stays free and visibly unofficial.
- A rule number is the stable way to point at a rule.
