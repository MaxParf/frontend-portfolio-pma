# Public frontend map

`index.html` loads the static frontend; `script.js`, `components/project-renderer.js`, `services/projects-api.js`, `services/projects-source.js`, and `mappers/project-api-mapper.js` render projects. The mapper accepts only public DTOs and resolves managed media through the configured API base. Locale is supplied to project source/rendering; public routes expose published candidates only. Draft/revision/pointer state is not a public data source.
