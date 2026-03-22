/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../lib/AuthContext"
import { useLanguage } from "../lib/LanguageContext"
import { supabase } from "../lib/supabase"
import { Button } from "@/components/ui/button"

export function Settings() {
  const { user, signOut } = useAuth()
  const { language, setLanguage } = useLanguage()
  const navigate = useNavigate()

  // Profile data
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("Менеджер по продажам")
  const [companyName, setCompanyName] = useState("")
  
  // Product data
  const [productName, setProductName] = useState("")
  const [productDescription, setProductDescription] = useState("")
  const [competitors, setCompetitors] = useState("")
  const [dealSize, setDealSize] = useState("до $500")

  // Scripts
  const [salesScript, setSalesScript] = useState("")
  const [objectionPlaybook, setObjectionPlaybook] = useState("")

  // Loading states
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [isSavingScripts, setIsSavingScripts] = useState(false)
  const [isResetingPwd, setIsResetingPwd] = useState(false)

  // Load existing profile
  useEffect(() => {
    async function loadProfile() {
      if (!user) return
      setIsLoading(true)
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      
      if (data && !error) {
        setFullName(data.full_name || "")
        setRole(data.role || "Менеджер по продажам")
        setCompanyName(data.company_name || "")
        setProductName(data.product_name || "")
        setProductDescription(data.product_description || "")
        setCompetitors(data.competitors || "")
        setDealSize(data.deal_size || "до $500")
        setSalesScript(data.sales_script || "")
        setObjectionPlaybook(data.objection_playbook || "")
        if (data.default_language) {
          setLanguage(data.default_language as 'ru' | 'en')
        }
      }
      setIsLoading(false)
    }
    loadProfile()
  }, [user, setLanguage])

  const saveProfileField = async (payload: any, setLoading: (s: boolean) => void) => {
    if (!user) return
    setLoading(true)
    try {
      // Determine if a profile row already exists for this user
      const { data: existingProfile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single()
      
      let error = null;
      if (existingProfile) {
        // Row exists, perform an update
        const res = await supabase.from('profiles').update(payload).eq('user_id', user.id)
        error = res.error
      } else {
        // Row is missing (e.g. skipped Onboarding), perform a fresh insert with empty string fallbacks for NOT NULL columns
        const res = await supabase.from('profiles').insert([{ 
          user_id: user.id,
          full_name: '',
          role: 'Менеджер по продажам',
          company_name: '',
          product_name: '',
          product_description: '',
          competitors: '',
          deal_size: 'до $500',
          sales_script: '',
          objection_playbook: '',
          ...payload 
        }])
        error = res.error
      }

      if (error) {
        alert("ОШИБКА СОХРАНЕНИЯ: " + error.message)
      } else {
        // Optional: you can show a success toast here
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handlePasswordReset = async () => {
    if (!user?.email) return
    setIsResetingPwd(true)
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin + '/settings',
    })
    setIsResetingPwd(false)
    if (error) {
      alert("Error pushing reset email: " + error.message)
    } else {
      alert("Password reset email sent!")
    }
  }

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen text-zinc-500">Загрузка профиля...</div>
  }

  return (
    <div className="max-w-4xl mx-auto w-full p-8 flex flex-col gap-8 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Настройки</h1>
        <p className="text-zinc-500">Управляйте своим профилем и конфигурациями AI ассистента.</p>
      </div>

      <div className="flex flex-col gap-10 mt-4">
        
        {/* SECTION 1 - Профиль */}
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
            <h2 className="text-lg font-semibold text-zinc-900">Профиль</h2>
            <p className="text-sm text-zinc-500">Ваши основные контактные данные.</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Имя и Фамилия</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Ваша роль</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="Менеджер по продажам">Менеджер по продажам</option>
                <option value="SDR">SDR</option>
                <option value="AE">AE</option>
                <option value="Руководитель отдела продаж">Руководитель отдела продаж</option>
                <option value="Другое">Другое</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Название компании</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex justify-end">
            <Button 
              onClick={() => saveProfileField({ full_name: fullName, role, company_name: companyName }, setIsSavingProfile)}
              disabled={isSavingProfile}
              className="bg-[#00C853] hover:bg-[#00E676] text-white"
            >
              {isSavingProfile ? 'Сохранение...' : 'Сохранить изменения'}
            </Button>
          </div>
        </section>

        {/* SECTION 2 - Ваш продукт */}
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
            <h2 className="text-lg font-semibold text-zinc-900">Ваш продукт</h2>
            <p className="text-sm text-zinc-500">Информация о том, что именно вы продаете.</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Название продукта</label>
              <input
                type="text"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Что делает ваш продукт?</label>
              <textarea
                value={productDescription}
                onChange={e => setProductDescription(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[80px]"
                placeholder="Например: CRM система для малого бизнеса которая помогает отслеживать сделки"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Основные конкуренты</label>
              <textarea
                value={competitors}
                onChange={e => setCompetitors(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[60px]"
                placeholder="Например: Bitrix24, AmoCRM, Salesforce"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Средний чек</label>
              <select
                value={dealSize}
                onChange={e => setDealSize(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="до $500">до $500</option>
                <option value="$500–2000">$500–2000</option>
                <option value="$2000–10000">$2000–10000</option>
                <option value="$10000+">$10000+</option>
              </select>
            </div>
          </div>
          <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex justify-end">
            <Button 
              onClick={() => saveProfileField({ product_name: productName, product_description: productDescription, competitors, deal_size: dealSize }, setIsSavingProduct)}
              disabled={isSavingProduct}
              className="bg-[#00C853] hover:bg-[#00E676] text-white"
            >
              {isSavingProduct ? 'Сохранение...' : 'Сохранить изменения'}
            </Button>
          </div>
        </section>

        {/* SECTION 3 - Скрипты и плейбуки */}
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
            <h2 className="text-lg font-semibold text-zinc-900">Скрипты и плейбуки</h2>
            <p className="text-sm text-zinc-500">Модели поведения для AI Коуча.</p>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Основной скрипт продаж</label>
              <textarea
                value={salesScript}
                onChange={e => setSalesScript(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[150px] font-sans"
                placeholder="Вставьте ваш скрипт — AI будет использовать его как основу для подсказок"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Плейбук по возражениям</label>
              <textarea
                value={objectionPlaybook}
                onChange={e => setObjectionPlaybook(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[150px] font-sans"
                placeholder="Опишите как отвечать на типичные возражения: цена, конкуренты, время..."
              />
            </div>
          </div>
          <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex justify-end">
            <Button 
              onClick={() => saveProfileField({ sales_script: salesScript, objection_playbook: objectionPlaybook }, setIsSavingScripts)}
              disabled={isSavingScripts}
              className="bg-[#00C853] hover:bg-[#00E676] text-white"
            >
              {isSavingScripts ? 'Сохранение...' : 'Сохранить изменения'}
            </Button>
          </div>
        </section>

        {/* SECTION 4 - Настройки приложения */}
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
            <h2 className="text-lg font-semibold text-zinc-900">Настройки приложения</h2>
            <p className="text-sm text-zinc-500">Персонализация интерфейса.</p>
          </div>
          <div className="p-6">
            <label className="block text-sm font-medium text-zinc-700 mb-2">Язык интерфейса по умолчанию</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setLanguage('ru')
                  saveProfileField({ default_language: 'ru' }, () => {})
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors border ${language === 'ru' ? 'bg-[#00C853] text-white border-transparent' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}
              >
                🇷🇺 Русский
              </button>
              <button
                onClick={() => {
                  setLanguage('en')
                  saveProfileField({ default_language: 'en' }, () => {})
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors border ${language === 'en' ? 'bg-[#00C853] text-white border-transparent' : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>
        </section>

        {/* SECTION 5 - Аккаунт */}
        <section className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-red-50 bg-red-50/30">
            <h2 className="text-lg font-semibold text-zinc-900">Аккаунт</h2>
            <p className="text-sm text-zinc-500">Управление учетной записью.</p>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Email адрес</label>
              <div className="w-full max-w-md px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-500">
                {user?.email}
              </div>
            </div>
            <div className="flex items-center gap-4 pt-2">
              <Button 
                variant="outline" 
                onClick={handlePasswordReset}
                disabled={isResetingPwd}
                className="bg-white"
              >
                {isResetingPwd ? 'Отправка...' : 'Изменить пароль'}
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleSignOut}
                className="opacity-90 hover:opacity-100"
              >
                Выйти из аккаунта
              </Button>
            </div>
          </div>
        </section>
        
      </div>
    </div>
  )
}
