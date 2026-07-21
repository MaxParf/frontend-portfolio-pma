export const projects = [
  {
    id: "construction-management-control-center",
    slug: "construction-management-control-center",
    galleryId: "cmca",
    status: "published",
    sortOrder: 10,
    meta: {
      type: "internal-company-management-system",
      startedAt: null,
      endedAt: null,
      ongoing: true,
    },
    translations: {
      en: {
        type: "Internal company management system",
        title: "Construction Management Control Center",
        role: "Solo Fullstack Developer (end-to-end development)",
        description:
          "A fullstack internal company management system for handling employees, departments, construction objects, tasks, permissions, task lifecycle, file exchange and Mattermost corporate messenger integration. Built independently from architecture and data modeling to frontend, backend, infrastructure and production deployment.",
        statusLabel: "Production",
        features: [
          "Employees and departments management",
          "Company structure",
          "Construction objects management",
          "Task creation and control",
          "Task lifecycle",
          "Role-based access control (RBAC)",
          "File exchange within the system",
          "Mattermost integration",
          "Production deployment (Docker, Nginx, VPS)",
        ],
        demoNote: "Demo access available on request.",
        links: {
          github: "GitHub",
          demo: "Demo available on request",
        },
        technologiesAriaLabel: "Construction Management technology stack",
      },
      ru: {
        type: "Внутренняя система управления компанией",
        title: "Центр управления строительством",
        role: "Solo Fullstack Developer / самостоятельная разработка",
        description:
          "Fullstack-система для управления операционными процессами компании: сотрудники, отделы, строительные объекты, задачи, права доступа, жизненный цикл задач, файлообмен и интеграция с корпоративным мессенджером Mattermost. Проект разработан самостоятельно — от архитектуры и модели данных до frontend, backend, инфраструктуры и production-деплоя.",
        statusLabel: "Production",
        features: [
          "Управление сотрудниками и отделами",
          "Структура компании",
          "Управление строительными объектами",
          "Постановка и контроль задач",
          "Жизненный цикл задач",
          "Роли и права доступа (RBAC)",
          "Файлообмен внутри системы",
          "Интеграция с Mattermost",
          "Production deployment (Docker, Nginx, VPS)",
        ],
        demoNote: "Демо-доступ предоставляется по запросу.",
        links: {
          github: "GitHub",
          demo: "Демо доступно по запросу",
        },
        technologiesAriaLabel: "Construction Management technology stack",
      },
    },
    technologies: [
      "React",
      "TypeScript",
      "NestJS",
      "PostgreSQL",
      "TypeORM",
      "Docker",
      "Nginx",
      "VPS",
      "Mattermost",
    ],
    links: [
      {
        id: "github",
        href: "https://github.com/MaxParf",
        type: "repository",
        external: true,
      },
      {
        id: "demo",
        href: "#contact",
        type: "demo-request",
        external: false,
      },
    ],
    galleryGroups: [
      {
        id: "main",
        className: "project-card__gallery",
        mediaIds: ["dashboard", "files"],
      },
    ],
    media: [
      {
        id: "dashboard",
        src: "images/projects/cus/cus-dashboard.png",
        role: "gallery",
        sortOrder: 10,
        width: 3022,
        height: 1898,
        imageClassName: "project-card__image",
        translations: {
          en: {
            alt: "Admin dashboard overview",
            ariaLabel: "Open screenshot: Construction Management Control Center dashboard",
          },
          ru: {
            alt: "Управляющая консоль системы",
            ariaLabel: "Открыть скриншот: дашборд Construction Management Control Center",
          },
        },
      },
      {
        id: "files",
        src: "images/projects/cus/cus-file-exchange.png",
        role: "gallery",
        sortOrder: 20,
        width: 3024,
        height: 1896,
        imageClassName: "project-card__image",
        translations: {
          en: {
            alt: "File exchange system interface",
            ariaLabel: "Open screenshot: Construction Management Control Center file exchange",
          },
          ru: {
            alt: "Интерфейс файлообмена",
            ariaLabel: "Открыть скриншот: файлообмен Construction Management Control Center",
          },
        },
      },
    ],
  },
  {
    id: "project-bradbury",
    slug: "project-bradbury",
    galleryId: "bradbury",
    status: "published",
    sortOrder: 20,
    meta: {
      type: "quiet-social-platform",
      startedAt: null,
      endedAt: null,
      ongoing: true,
    },
    translations: {
      en: {
        type: "Quiet social platform",
        title: "Project Bradbury",
        role: "Founder, Product Owner, Solo Fullstack Developer",
        description: [
          "Project Bradbury is a quiet social platform built around personal stories, warm moments, reflections, private correspondence, public profiles, friendships, follows, privacy controls and moderation tools.",
          "The project was created as an alternative to noisy social networks that increasingly turn into attention marketplaces, news feeds and places of constant competition for reaction. Project Bradbury does not reject engagement, but proposes a different principle for it: not through pressure, anxiety and endless flow, but through meaning, trust, human presence and the desire to return to a quiet, warm space from everyday chaos.",
          "At the moment, the platform includes invite-based registration, personal user space, public profiles, stories, photo shelves, emotional reactions, private messages, social connections, privacy settings, reporting flows, admin tools and a responsive interface for mobile and desktop.",
        ],
        statusLabel: "Closed Alpha",
        features: [
          "Invite-based registration and hosted closed alpha",
          "Personal space, public profiles, stories and photo shelves",
          "Private messages, friendships, follows and emotional reactions",
          "Privacy controls, reporting flows, moderation and admin tools",
          "Responsive mobile and desktop interface",
        ],
        notes: [
          "Hosted at prbdbr.com and currently in closed testing. Open registration is not available yet; access is provided only by invite code.",
          "Please note: in some regions, parts of the platform content may load correctly only when VPN is enabled.",
        ],
        links: {
          website: "Live platform",
        },
        technologiesAriaLabel: "Project Bradbury technology stack",
      },
      ru: {
        type: "Тихая социальная платформа",
        title: "Project Bradbury",
        role: "Founder, Product Owner, Solo Fullstack Developer",
        description: [
          "Project Bradbury — это социальная платформа, построенная вокруг личных историй, тёплых моментов, размышлений, личной переписки, публичных профилей, друзей, подписок, настроек приватности и инструментов модерации.",
          "Проект создавался как альтернатива шумным социальным сетям, которые всё чаще превращаются в маркетплейсы внимания, новостные ленты и площадки для постоянной борьбы за реакцию. Project Bradbury не отказывается от вовлечённости, но предлагает другой её принцип: не через давление, тревогу и бесконечный поток, а через смысл, доверие, человеческое присутствие и желание возвращаться в тихое, уютное пространство из повседневного хаоса.",
          "На данный момент платформа включает регистрацию по invite-коду, личное пространство пользователя, публичные профили, истории, фотоальбомы, эмоциональные реакции, личные сообщения, социальные связи, настройки приватности, сценарии жалоб, административные инструменты и адаптивный интерфейс для мобильных устройств и desktop.",
        ],
        statusLabel: "Закрытое тестирование",
        features: [
          "Регистрация по invite-коду и размещённая closed alpha",
          "Личное пространство, публичные профили, истории и фотоальбомы",
          "Личные сообщения, друзья, подписки и эмоциональные реакции",
          "Настройки приватности, жалобы, модерация и admin tools",
          "Адаптивный интерфейс для mobile и desktop",
        ],
        notes: [
          "Проект уже размещён на хостинге prbdbr.com и сейчас находится на этапе закрытого тестирования. Открытая регистрация пока недоступна. Доступ предоставляется только по invite-коду.",
          "Важно: в некоторых регионах часть контента платформы может корректно подгружаться только при включённом VPN.",
        ],
        links: {
          website: "Открыть платформу",
        },
        technologiesAriaLabel: "Project Bradbury technology stack",
      },
    },
    technologies: ["React", "TypeScript", "Vite", "Supabase", "PostgreSQL", "RLS", "SCSS", "VPS", "Nginx"],
    links: [
      {
        id: "website",
        href: "https://prbdbr.com/",
        type: "website",
        external: true,
      },
    ],
    galleryGroups: [
      {
        id: "mobile",
        className: "project-card__gallery project-card__gallery--bradbury-mobile",
        mediaIds: ["mobile-home", "mobile-profile", "mobile-messages", "mobile-stories"],
      },
      {
        id: "desktop",
        className: "project-card__gallery project-card__gallery--bradbury-desktop",
        mediaIds: ["desktop-home", "desktop-messages", "desktop-room", "admin-console"],
      },
    ],
    media: [
      {
        id: "mobile-home",
        src: "images/projects/bradbury/mobile_home_feed.webp",
        role: "gallery",
        sortOrder: 10,
        width: 1206,
        height: 2622,
        imageClassName: "project-card__image project-card__image--mobile-screen",
        translations: {
          en: {
            alt: "Project Bradbury mobile home feed",
            ariaLabel: "Open screenshot: Project Bradbury mobile home feed",
          },
          ru: {
            alt: "Мобильная главная лента Project Bradbury",
            ariaLabel: "Открыть скриншот: мобильная главная лента Project Bradbury",
          },
        },
      },
      {
        id: "mobile-profile",
        src: "images/projects/bradbury/mobile_public_profile_maraellis.webp",
        role: "gallery",
        sortOrder: 20,
        width: 1206,
        height: 2622,
        imageClassName: "project-card__image project-card__image--mobile-screen",
        translations: {
          en: {
            alt: "Project Bradbury mobile public profile",
            ariaLabel: "Open screenshot: Project Bradbury public profile",
          },
          ru: {
            alt: "Мобильный публичный профиль Project Bradbury",
            ariaLabel: "Открыть скриншот: публичный профиль Project Bradbury",
          },
        },
      },
      {
        id: "mobile-messages",
        src: "images/projects/bradbury/mobile_messages_list.webp",
        role: "gallery",
        sortOrder: 30,
        width: 1206,
        height: 2622,
        imageClassName: "project-card__image project-card__image--mobile-screen",
        translations: {
          en: {
            alt: "Project Bradbury mobile messages list",
            ariaLabel: "Open screenshot: Project Bradbury messages",
          },
          ru: {
            alt: "Мобильный список сообщений Project Bradbury",
            ariaLabel: "Открыть скриншот: сообщения Project Bradbury",
          },
        },
      },
      {
        id: "mobile-stories",
        src: "images/projects/bradbury/mobile_photo_stories_maraellis.webp",
        role: "gallery",
        sortOrder: 40,
        width: 1206,
        height: 2622,
        imageClassName: "project-card__image project-card__image--mobile-screen",
        translations: {
          en: {
            alt: "Project Bradbury mobile photo stories",
            ariaLabel: "Open screenshot: Project Bradbury photo stories",
          },
          ru: {
            alt: "Мобильные фотоистории Project Bradbury",
            ariaLabel: "Открыть скриншот: фотоистории Project Bradbury",
          },
        },
      },
      {
        id: "desktop-home",
        src: "images/projects/bradbury/desktop_home_feed.webp",
        role: "gallery",
        sortOrder: 50,
        width: 3024,
        height: 1900,
        imageClassName: "project-card__image",
        translations: {
          en: {
            alt: "Project Bradbury desktop home feed",
            ariaLabel: "Open screenshot: Project Bradbury desktop home feed",
          },
          ru: {
            alt: "Главная лента Project Bradbury на desktop",
            ariaLabel: "Открыть скриншот: главная лента Project Bradbury на desktop",
          },
        },
      },
      {
        id: "desktop-messages",
        src: "images/projects/bradbury/desktop_messages.webp",
        role: "gallery",
        sortOrder: 60,
        width: 3024,
        height: 1896,
        imageClassName: "project-card__image",
        translations: {
          en: {
            alt: "Project Bradbury desktop messages",
            ariaLabel: "Open screenshot: Project Bradbury desktop messages",
          },
          ru: {
            alt: "Сообщения Project Bradbury на desktop",
            ariaLabel: "Открыть скриншот: сообщения Project Bradbury на desktop",
          },
        },
      },
      {
        id: "desktop-room",
        src: "images/projects/bradbury/desktop_my_room_maraellis.webp",
        role: "gallery",
        sortOrder: 70,
        width: 3022,
        height: 1720,
        imageClassName: "project-card__image",
        translations: {
          en: {
            alt: "Project Bradbury desktop personal room",
            ariaLabel: "Open screenshot: Project Bradbury desktop personal room",
          },
          ru: {
            alt: "Личное пространство Project Bradbury на desktop",
            ariaLabel: "Открыть скриншот: личное пространство Project Bradbury на desktop",
          },
        },
      },
      {
        id: "admin-console",
        src: "images/projects/bradbury/admin_console.webp",
        role: "gallery",
        sortOrder: 80,
        width: 3024,
        height: 1898,
        imageClassName: "project-card__image",
        translations: {
          en: {
            alt: "Project Bradbury admin console",
            ariaLabel: "Open screenshot: Project Bradbury admin console",
          },
          ru: {
            alt: "Административная консоль Project Bradbury",
            ariaLabel: "Открыть скриншот: административная консоль Project Bradbury",
          },
        },
      },
    ],
  },
  {
    id: "foodai",
    slug: "foodai",
    galleryId: "foodai",
    status: "published",
    sortOrder: 30,
    meta: {
      type: "grocery-intelligence-product-prototype",
      startedAt: null,
      endedAt: null,
      ongoing: true,
    },
    translations: {
      en: {
        type: "Grocery intelligence / meal planning product prototype",
        title: "FoodAI",
        role: "Founder, Product Owner & Solo Fullstack Developer",
        description:
          "A grocery intelligence and meal planning product prototype focused on helping users compare food options, understand value through protein-per-dollar logic, and build smarter shopping habits. Built independently from idea and product concept to mobile app architecture, UI flows, backend integration direction and landing page.",
        statusLabel: "Prototype",
        features: [
          "Product comparison and protein-per-dollar logic",
          "Saved comparisons and onboarding flow",
          "Meal planning and grocery list concepts",
          "React Native / Expo, Supabase, and Zustand architecture",
          "FoodAI website / landing page and AI/API integration direction",
        ],
        links: {
          github: "GitHub",
          website: "App Website",
        },
        technologiesAriaLabel: "FoodAI technology stack",
      },
      ru: {
        type: "Grocery intelligence / meal planning startup product prototype",
        title: "FoodAI",
        role: "Founder, Product Owner & Solo Fullstack Developer / самостоятельная разработка",
        description:
          "Продуктовый прототип для анализа продуктовых покупок и планирования питания. Проект помогает сравнивать продукты, учитывать protein-per-dollar логику и формировать более осознанные сценарии покупок. Разработан самостоятельно — от идеи и продуктовой концепции до архитектуры мобильного приложения, UX-сценариев, backend-интеграции и landing page.",
        statusLabel: "Prototype",
        features: [
          "Сравнение продуктов и protein-per-dollar логика",
          "Сохранённые сравнения и onboarding-сценарий",
          "Концепции meal planning и списка покупок",
          "Архитектура на React Native / Expo, Supabase и Zustand",
          "FoodAI website / landing page и направление AI/API-интеграций",
        ],
        links: {
          github: "GitHub",
          website: "Сайт приложения",
        },
        technologiesAriaLabel: "FoodAI technology stack",
      },
    },
    technologies: ["Expo", "React Native", "Supabase", "Zustand", "React", "Vite"],
    links: [
      {
        id: "github",
        href: "https://github.com/MaxParf",
        type: "repository",
        external: true,
      },
      {
        id: "website",
        href: "https://foodai.pro/",
        type: "website",
        external: true,
      },
    ],
    galleryGroups: [
      {
        id: "mobile",
        className: "project-card__gallery project-card__gallery--mobile-screens",
        mediaIds: ["meal-plan", "grocery-split"],
      },
    ],
    media: [
      {
        id: "meal-plan",
        src: "images/projects/foodai/foodai-meal-plan.png",
        role: "gallery",
        sortOrder: 10,
        width: 787,
        height: 1622,
        imageClassName: "project-card__image project-card__image--mobile-screen",
        translations: {
          en: {
            alt: "Weekly meal plan with budget and nutrition targets",
            ariaLabel: "Open screenshot: FoodAI meal plan",
          },
          ru: {
            alt: "Интерфейс плана питания на неделю",
            ariaLabel: "Открыть скриншот: план питания FoodAI",
          },
        },
      },
      {
        id: "grocery-split",
        src: "images/projects/foodai/foodai-grocery-split.png",
        role: "gallery",
        sortOrder: 20,
        width: 787,
        height: 1622,
        imageClassName: "project-card__image project-card__image--mobile-screen",
        translations: {
          en: {
            alt: "Grocery list split by store with price optimization",
            ariaLabel: "Open screenshot: FoodAI grocery split",
          },
          ru: {
            alt: "Список покупок с разбивкой по магазинам",
            ariaLabel: "Открыть скриншот: список покупок FoodAI",
          },
        },
      },
    ],
  },
];
