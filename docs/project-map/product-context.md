# Product context

The public site presents a personal portfolio. Its CMS is a direct single-owner authoring tool; there is no public registration, multi-user management, or ordinary-user roles. The expected workflow is select project → edit central form → inspect right-hand preview → save draft or publish.

RU and EN are paired content for one project. Published data is public-only; editor heads and publication internals are technical mechanisms. The current implementation exposes a `readOnly` published-without-draft mode and is marked **CURRENT IMPLEMENTATION — PRODUCT REVIEW REQUIRED**. Approved corrective target: selecting a published project hydrates an editable in-memory form without a write; the draft is created lazily on first save. Draft discard for a published project restores that published source; never-published deletion is a separate lifecycle.

Do not make revision, pointer, projection, generation, or lock management a required CMS action. A selected project must remain available for authoring; a missing persisted draft must not become a dead-end UI.
