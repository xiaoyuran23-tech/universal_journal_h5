/**
 * 万物手札 v4.0 - DOM ID 注册表
 * 所有 DOM 元素的 ID 必须在此定义，禁止在代码中硬编码字符串。
 * 通过集中管理，彻底杜绝 ID 不匹配导致的 Bug。
 */

const DOM_IDS = {
  // 页面容器
  PAGE_HOME: 'page-home',
  PAGE_CALENDAR: 'page-calendar',
  PAGE_TIMELINE: 'page-timeline',
  PAGE_FAVORITES: 'page-favorites',
  PAGE_PROFILE: 'page-profile',
  PAGE_FORM: 'page-form',
  PAGE_DETAIL: 'page-detail',
  PAGE_TRASH: 'page-trash',
  PAGE_STATS: 'page-stats',
  PAGE_TEMPLATE_MANAGER: 'page-template-manager',

  // 导航栏
  TAB_HOME: 'tab-home',
  TAB_CALENDAR: 'tab-calendar',
  TAB_TIMELINE: 'tab-story',
  TAB_FAVORITES: 'tab-favorites',
  TAB_PROFILE: 'tab-profile',
  THEME_TOGGLE: 'theme-toggle',
  THEME_PANEL: 'theme-panel',

  // 首页组件
  SEARCH_INPUT: 'search-input',
  SEARCH_BTN: 'search-btn',
  CATEGORY_FILTER: 'category-filter',
  TAG_FILTER: 'tag-filter',
  ITEMS_CONTAINER: 'items-container',
  FAVORITES_CONTAINER: 'favorites-container',
  EMPTY_STATE: 'empty-state',
  EMPTY_ADD_BTN: 'empty-add-btn',
  FAB_ADD: 'fab-add',

  // 表单组件
  FORM_BACK_BTN: 'form-back-btn',
  FORM_SAVE_BTN: 'form-save-btn',
  FORM_TITLE: 'form-title',
  INPUT_NAME: 'create-name',
  INPUT_CATEGORY: 'create-category',
  INPUT_TAGS: 'create-tags',
  TAG_INPUT_WRAPPER: 'tag-input-wrapper',
  INPUT_RICH_CONTENT: 'create-rich-content',
  INPUT_STATUS: 'create-status',
  INPUT_DATE: 'create-date',
  INPUT_NOTES: 'create-notes',
  INPUT_PHOTO: 'create-photo-input',
  PHOTO_BTN: 'create-photo-btn',
  PHOTO_PREVIEW: 'photo-preview',
  PHOTO_PROGRESS: 'photo-upload-progress',
  PHOTO_SUMMARY: 'photo-summary',
  TEMPLATE_SELECTOR: 'template-selector',
  BTN_USE_TEMPLATE: 'btn-use-template',
  BTN_SAVE_TEMPLATE: 'btn-save-template',

  // 详情页组件
  DETAIL_BACK_BTN: 'detail-back-btn',
  DETAIL_FAV_BTN: 'detail-favorite-btn',
  DETAIL_SHARE_BTN: 'detail-share-btn',
  DETAIL_EDIT_BTN: 'detail-edit-btn',
  DETAIL_DELETE_BTN: 'detail-delete-btn',

  // 设置页组件
  EXPORT_DATA_BTN: 'export-data-btn',
  IMPORT_DATA_BTN: 'import-data-btn',
  CLEAR_DATA_BTN: 'clear-all-data-btn',
  MANAGE_CATEGORIES_BTN: 'manage-categories-btn',
  MANAGE_TEMPLATES_BTN: 'manage-templates-btn',
  SYNC_SETTINGS_BTN: 'settings-cloud-config',
  IMPORT_FILE_INPUT: 'import-file-input',

  // 同步模态框
  CLOUD_MODAL: 'cloud-modal',
  CLOUD_MODAL_CLOSE: 'cloud-modal-close',
  SYNC_GIST_ID: 'sync-gist-id',
  SYNC_TOKEN: 'sync-token',
  SYNC_KEY: 'sync-key',
  SYNC_SAVE_CONFIG: 'sync-save-config',
  SYNC_UPLOAD: 'sync-upload',
  SYNC_DOWNLOAD: 'sync-download',

  // 分类管理
  CATEGORY_MODAL: 'category-manager-modal',
  CATEGORY_LIST: 'category-manager-list',
  BTN_ADD_CATEGORY: 'btn-add-category',
  
  // 其他组件
  CAL_BACK_BTN: 'cal-back-btn',
  CANCEL_TEMPLATE_BTN: 'cancel-template-btn',
  SETTINGS_TRASH: 'settings-trash',
  SETTINGS_LOCK: 'settings-lock',
  SETTINGS_THEME: 'settings-theme',
  SETTINGS_STATS: 'settings-stats',
  SETTINGS_ABOUT: 'settings-about',
  TM_BACK_BTN: 'tm-back-btn',
  CLOSE_CATEGORY_MGR: 'close-category-mgr',
  ADD_CATEGORY_BTN: 'add-category-btn',
  CATEGORY_MGR_INPUT: 'category-mgr-input',
  CATEGORY_MGR_LIST: 'category-mgr-list',
  
  // 通用
  TOAST: 'toast'
};

// 验证函数：检查所有 ID 是否在 DOM 中存在
function validateDOMIds() {
  const missing = [];
  for (const [key, id] of Object.entries(DOM_IDS)) {
    if (!document.getElementById(id)) {
      missing.push(`${key} (${id})`);
    }
  }
  if (missing.length > 0) {
    console.warn('️ 以下 DOM ID 在页面中未找到:', missing);
  } else {
    console.log('✅ 所有 DOM ID 验证通过');
  }
  return missing;
}

// 暴露给全局
window.DOM_IDS = DOM_IDS;
window.validateDOMIds = validateDOMIds;
