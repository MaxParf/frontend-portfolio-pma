export type FixtureContentItem = { id: string; sortOrder: number; text: { ru: string; en: string } };
export type LegacyProjectContentFixture = { displayType: { ru: string; en: string }; features: FixtureContentItem[]; notes: FixtureContentItem[] };

const feature = (id: string, sortOrder: number, ru: string, en: string): FixtureContentItem => ({ id, sortOrder, text: { ru, en } });

export const legacyProjectContentFixtures: Readonly<Record<string, LegacyProjectContentFixture>> = {
  "construction-management-control-center": {
    displayType: { ru: "Внутренняя система управления компанией", en: "Internal company management system" }, notes: [],
    features: [
      feature("81000000-0000-4000-8000-000000000001", 10, "Управление сотрудниками и отделами", "Employees and departments management"),
      feature("81000000-0000-4000-8000-000000000002", 20, "Структура компании", "Company structure"),
      feature("81000000-0000-4000-8000-000000000003", 30, "Управление строительными объектами", "Construction objects management"),
      feature("81000000-0000-4000-8000-000000000004", 40, "Постановка и контроль задач", "Task creation and control"),
      feature("81000000-0000-4000-8000-000000000005", 50, "Жизненный цикл задач", "Task lifecycle"),
      feature("81000000-0000-4000-8000-000000000006", 60, "Роли и права доступа (RBAC)", "Role-based access control (RBAC)"),
      feature("81000000-0000-4000-8000-000000000007", 70, "Файлообмен внутри системы", "File exchange within the system"),
      feature("81000000-0000-4000-8000-000000000008", 80, "Интеграция с Mattermost", "Mattermost integration"),
      feature("81000000-0000-4000-8000-000000000009", 90, "Production deployment (Docker, Nginx, VPS)", "Production deployment (Docker, Nginx, VPS)"),
    ],
  },
  "project-bradbury": {
    displayType: { ru: "Тихая социальная платформа", en: "Quiet social platform" },
    features: [
      feature("82000000-0000-4000-8000-000000000001", 10, "Регистрация по invite-коду и размещённая closed alpha", "Invite-based registration and hosted closed alpha"),
      feature("82000000-0000-4000-8000-000000000002", 20, "Личное пространство, публичные профили, истории и фотоальбомы", "Personal space, public profiles, stories and photo shelves"),
      feature("82000000-0000-4000-8000-000000000003", 30, "Личные сообщения, друзья, подписки и эмоциональные реакции", "Private messages, friendships, follows and emotional reactions"),
      feature("82000000-0000-4000-8000-000000000004", 40, "Настройки приватности, жалобы, модерация и admin tools", "Privacy controls, reporting flows, moderation and admin tools"),
      feature("82000000-0000-4000-8000-000000000005", 50, "Адаптивный интерфейс для mobile и desktop", "Responsive mobile and desktop interface"),
    ],
    notes: [
      feature("84000000-0000-4000-8000-000000000001", 10, "Проект уже размещён на хостинге prbdbr.com и сейчас находится на этапе закрытого тестирования. Открытая регистрация пока недоступна. Доступ предоставляется только по invite-коду.", "Hosted at prbdbr.com and currently in closed testing. Open registration is not available yet; access is provided only by invite code."),
      feature("84000000-0000-4000-8000-000000000002", 20, "Важно: в некоторых регионах часть контента платформы может корректно подгружаться только при включённом VPN.", "Please note: in some regions, parts of the platform content may load correctly only when VPN is enabled."),
    ],
  },
  foodai: {
    displayType: { ru: "Grocery intelligence / meal planning startup product prototype", en: "Grocery intelligence / meal planning product prototype" },
    features: [
      feature("83000000-0000-4000-8000-000000000001", 10, "Сравнение продуктов и protein-per-dollar логика", "Product comparison and protein-per-dollar logic"),
      feature("83000000-0000-4000-8000-000000000002", 20, "Сохранённые сравнения и onboarding-сценарий", "Saved comparisons and onboarding flow"),
      feature("83000000-0000-4000-8000-000000000003", 30, "Концепции meal planning и списка покупок", "Meal planning and grocery list concepts"),
      feature("83000000-0000-4000-8000-000000000004", 40, "Архитектура на React Native / Expo, Supabase и Zustand", "React Native / Expo, Supabase, and Zustand architecture"),
      feature("83000000-0000-4000-8000-000000000005", 50, "FoodAI website / landing page и направление AI/API-интеграций", "FoodAI website / landing page and AI/API integration direction"),
    ], notes: [],
  },
};
