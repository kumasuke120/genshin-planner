import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

i18n.use(initReactI18next).init({
  resources: { 'zh-CN': { translation: zhCN }, 'en-US': { translation: enUS } },
  lng: 'zh-CN',
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false }
});

/** 已注册 React 插件和中英文资源的应用国际化实例 */
export default i18n;
