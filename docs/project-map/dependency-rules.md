# Dependency rules

Allowed chain: CMS component → CMS API client → Fastify route → repository/service → DB. Public frontend → public API/source mapper → published DTO only. Admin publication materializer → locale projection tables; verifiers read independently.

Forbidden: CMS direct DB access; public frontend draft data; editable UI sourced from projection; UI dependence on migration internals; GET mutation; destructive lifecycle action without a transactional service boundary.
