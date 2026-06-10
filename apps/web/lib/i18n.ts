import i18n from "i18next"
import { initReactI18next } from "react-i18next"

// Simple initialization for client-side components to resolve i18n static text warnings.
// We are only initializing the 'en' locale.
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
          // Add translations here if we want to decouple strings from components
        }
      }
    },
    lng: "en", 
    fallbackLng: "en",
    
    // We are passing strings directly as the key in most cases for quick resolution,
    // so we disable keySeparator and nsSeparator if needed, but default works.
    
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  })

export default i18n
