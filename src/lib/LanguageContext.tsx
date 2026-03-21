/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */
import { createContext, useContext, useState, useEffect } from "react"
import type { ReactNode } from "react"

export type Language = "ru" | "en"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: keyof typeof translations["ru"]) => string
}

const translations = {
  ru: {
    dashboard_new_call: "Новый звонок",
    dashboard_placeholder: "Имя клиента",
    dashboard_start_call: "Начать звонок",
    dashboard_recent_calls: "Последние звонки",
    dashboard_empty_calls: "Нет звонков. Начните первый звонок выше.",
    dashboard_table_customer: "Клиент",
    dashboard_table_date: "Дата",
    dashboard_table_duration: "Длительность",
    dashboard_table_sentiment: "Настроение",
    dashboard_active: "В процессе",
    
    livecall_listening: "Слушаю клиента...",
    livecall_listening_failed: "ОШИБКА: Аудио не выбрано.",
    livecall_stop: "Остановить",
    livecall_start: "Слушать",
    livecall_suggestions_title: "Tyndap советует",
    livecall_analyzing: "Анализирую...",
    livecall_end_call: "Завершить Звонок",
    livecall_tab_transcript: "Стенограмма",
    livecall_tab_objections: "Возражения",
    livecall_nav_back: "Назад",
    
    modal_title: "Как подключить звук звонка",
    modal_step_1: "Появится окно — выберите вкладку с программой для звонков",
    modal_step_2: "Отметьте галочкой 'Поделиться звуком вкладки' внизу окна",
    modal_step_3: "Нажмите \"Поделиться\" — Tyndap начнёт слушать клиента",
    modal_button: "Понятно, начать звонок",
    
    summary_title: "Итог звонка",
    summary_objections: "Возражения клиента",
    summary_next_steps: "Следующие шаги",
    summary_sentiment: "Настроение сделки",
    summary_copy: "Скопировать в буфер",
    summary_back: "На главную",
    summary_sentiment_positive: "Позитивное",
    summary_sentiment_neutral: "Нейтральное",
    summary_sentiment_negative: "Негативное"
  },
  en: {
    dashboard_new_call: "New Call",
    dashboard_placeholder: "Customer Name",
    dashboard_start_call: "Start Call",
    dashboard_recent_calls: "Recent Calls",
    dashboard_empty_calls: "No calls yet. Start your first call above.",
    dashboard_table_customer: "Customer",
    dashboard_table_date: "Date",
    dashboard_table_duration: "Duration",
    dashboard_table_sentiment: "Sentiment",
    dashboard_active: "Active",

    livecall_listening: "Listening to customer...",
    livecall_listening_failed: "ERROR: Audio source not selected.",
    livecall_stop: "Stop",
    livecall_start: "Start Listening",
    livecall_suggestions_title: "Tyndap Suggests",
    livecall_analyzing: "Analyzing...",
    livecall_end_call: "End Call",
    livecall_tab_transcript: "Transcript",
    livecall_tab_objections: "Objections",
    livecall_nav_back: "Back",
    
    modal_title: "How to connect call audio",
    modal_step_1: "A window will appear — select the tab with your calling app",
    modal_step_2: "Check the 'Share tab audio' toggle at the bottom",
    modal_step_3: "Click 'Share' — Tyndap will start listening",
    modal_button: "Got it, Start Listening",
    
    summary_title: "Call Summary",
    summary_objections: "Objections Raised",
    summary_next_steps: "Next Steps",
    summary_sentiment: "Deal Sentiment",
    summary_copy: "Copy to clipboard",
    summary_back: "Back to Dashboard",
    summary_sentiment_positive: "Positive",
    summary_sentiment_neutral: "Neutral",
    summary_sentiment_negative: "Negative"
  }
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ru")

  useEffect(() => {
    const saved = localStorage.getItem("clozer_language") as Language
    if (saved && (saved === "ru" || saved === "en")) {
      setLanguageState(saved)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("clozer_language", lang)
  }

  const t = (key: keyof typeof translations["ru"]) => {
    return translations[language][key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error("useLanguage must be used within LanguageProvider")
  return context
}
