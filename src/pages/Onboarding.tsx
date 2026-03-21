/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronRight, ChevronLeft, Check } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/AuthContext"

type OnboardingData = {
  fullName: string
  role: string
  companyName: string
  productName: string
  productDescription: string
  competitors: string
  dealSize: string
  salesScript: string
}

export function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [data, setData] = useState<OnboardingData>({
    fullName: "",
    role: "Менеджер по продажам",
    companyName: "",
    productName: "",
    productDescription: "",
    competitors: "",
    dealSize: "до $500",
    salesScript: ""
  })

  // Pre-fill name from auth metadata
  useEffect(() => {
    if (user?.user_metadata?.full_name && !data.fullName) {
      setData(prev => ({ ...prev, fullName: user.user_metadata.full_name }))
    }
  }, [user])

  const handleNext = async () => {
    if (step < 3) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleComplete = async () => {
    if (!user) return
    setIsSaving(true)

    try {
      const payload = {
        user_id: user.id,
        full_name: data.fullName,
        role: data.role,
        company_name: data.companyName,
        product_name: data.productName,
        product_description: data.productDescription,
        competitors: data.competitors,
        deal_size: data.dealSize,
        sales_script: data.salesScript,
        default_language: 'ru'
      }

      const { error } = await supabase.from('profiles').upsert(payload)

      if (error) {
        console.error("Error saving profile:", error)
        alert("Ошибка при сохранении профиля. Пожалуйста, убедитесь, что таблица profiles создана в Supabase.")
      } else {
        navigate('/')
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center py-12 px-4">
      
      {/* Header */}
      <div className="w-full max-w-2xl mb-8 flex flex-col items-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mb-6">Tyndap.</h1>
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 bg-white px-4 py-2 rounded-full shadow-sm border border-zinc-200">
          <span className={step >= 1 ? "text-zinc-900" : ""}>Шаг 1</span>
          <ChevronRight className="w-4 h-4 text-zinc-300" />
          <span className={step >= 2 ? "text-zinc-900" : ""}>Шаг 2</span>
          <ChevronRight className="w-4 h-4 text-zinc-300" />
          <span className={step >= 3 ? "text-zinc-900" : ""}>Шаг 3</span>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
        
        {step === 1 && (
          <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-semibold mb-6">О вас</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Имя и Фамилия</label>
                <input
                  type="text"
                  value={data.fullName}
                  onChange={(e) => setData({...data, fullName: e.target.value})}
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="Иван Иванов"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Ваша роль</label>
                <select
                  value={data.role}
                  onChange={(e) => setData({...data, role: e.target.value})}
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white transition-all"
                >
                  <option value="Менеджер по продажам">Менеджер по продажам</option>
                  <option value="SDR">SDR (Sales Development Rep)</option>
                  <option value="AE">AE (Account Executive)</option>
                  <option value="Руководитель отдела продаж">Руководитель отдела продаж</option>
                  <option value="Другое">Другое</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Название компании</label>
                <input
                  type="text"
                  value={data.companyName}
                  onChange={(e) => setData({...data, companyName: e.target.value})}
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="Например: Яндекс, Tyndap..."
                />
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleNext}
                disabled={!data.fullName || !data.companyName}
                className="bg-[#00C853] hover:bg-[#00E676] text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                Далее <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-semibold mb-6">О вашем продукте</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Название продукта</label>
                <input
                  type="text"
                  value={data.productName}
                  onChange={(e) => setData({...data, productName: e.target.value})}
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="Например: Clozer AI"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Что делает ваш продукт?</label>
                <textarea
                  value={data.productDescription}
                  onChange={(e) => setData({...data, productDescription: e.target.value})}
                  className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all min-h-[100px] resize-y"
                  placeholder="Например: CRM система для малого бизнеса которая помогает отслеживать сделки"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Средний чек</label>
                  <select
                    value={data.dealSize}
                    onChange={(e) => setData({...data, dealSize: e.target.value})}
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="до $500">до $500</option>
                    <option value="$500–2000">$500–2000</option>
                    <option value="$2000–10000">$2000–10000</option>
                    <option value="$10000+">$10000+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Основные конкуренты <span className="text-zinc-400 font-normal">(опционально)</span></label>
                  <input
                    type="text"
                    value={data.competitors}
                    onChange={(e) => setData({...data, competitors: e.target.value})}
                    className="w-full px-4 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    placeholder="Например: Bitrix24, AmoCRM"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Ваш скрипт продаж <span className="text-zinc-400 font-normal">(опционально)</span></label>
                <textarea
                  value={data.salesScript}
                  onChange={(e) => setData({...data, salesScript: e.target.value})}
                  className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all min-h-[120px] resize-y"
                  placeholder="Вставьте ваш основной скрипт продаж — AI будет использовать его как основу для подсказок"
                />
              </div>
            </div>
            <div className="mt-8 flex justify-between items-center">
              <button
                onClick={handleBack}
                className="text-zinc-500 hover:text-zinc-900 font-medium px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Назад
              </button>
              <button
                onClick={handleNext}
                disabled={!data.productName || !data.productDescription}
                className="bg-[#00C853] hover:bg-[#00E676] text-white font-medium px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                Далее <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-12 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 border-8 border-green-50">
              <Check className="w-8 h-8 text-[#00C853]" strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-bold mb-3 text-zinc-900">Всё готово!</h2>
            <p className="text-zinc-500 mb-10 max-w-sm">
              Ваш профиль успешно создан. Теперь Tyndap. (Clozer) настроен и обучен продавать <b>{data.productName}</b>!
            </p>
            <div className="flex justify-between w-full mt-4">
              <button
                onClick={handleBack}
                className="text-zinc-500 hover:text-zinc-900 font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Назад
              </button>
              <button
                onClick={handleComplete}
                disabled={isSaving}
                className="bg-[#00C853] hover:bg-[#00E676] text-white font-medium px-8 py-3 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 text-lg"
              >
                {isSaving ? "Сохранение..." : "Начать первый звонок"}
                {!isSaving && <ChevronRight className="w-5 h-5" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
