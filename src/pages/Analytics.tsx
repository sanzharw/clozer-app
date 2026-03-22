/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { format, subDays } from 'date-fns'
import { BarChart3, Clock, TrendingUp, PhoneCall, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Analytics() {
  const { user } = useAuth()
  const [calls, setCalls] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchAnalytics() {
      if (!user) return
      setIsLoading(true)
      const { data, error } = await supabase
        .from('calls')
        .select(`
          *,
          summaries (
            objections,
            sentiment,
            summary
          )
        `)
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })

      if (data && !error) {
        setCalls(data)
      }
      setIsLoading(false)
    }
    fetchAnalytics()
  }, [user])

  // Data Processing
  const stats = useMemo(() => {
    const totalCalls = calls.length
    const totalDuration = calls.reduce((acc, c) => acc + (c.duration || 0), 0)
    
    // Positive Sentiment %
    let positiveCount = 0
    let totalSentiments = 0
    calls.forEach(c => {
      if (c.summaries?.[0]?.sentiment) {
        totalSentiments++
        const sent = c.summaries[0].sentiment.toLowerCase()
        if (sent.includes('positive') || sent.includes('позитивное')) {
          positiveCount++
        }
      }
    })
    const positiveRate = totalSentiments > 0 ? Math.round((positiveCount / totalSentiments) * 100) : 0

    return { totalCalls, totalDuration, positiveRate }
  }, [calls])

  const objectionsData = useMemo(() => {
    const counts: Record<string, number> = {}
    calls.forEach(c => {
      const objs = c.summaries?.[0]?.objections
      if (Array.isArray(objs)) {
        objs.forEach(o => {
          if (typeof o === 'string' && o.length > 2) {
            counts[o] = (counts[o] || 0) + 1
          }
        })
      } else if (typeof objs === 'string') {
        // Try parsing JSON if stored as string
        try {
          const parsed = JSON.parse(objs)
          if (Array.isArray(parsed)) {
            parsed.forEach(o => {
              if (typeof o === 'string' && o.length > 2) counts[o] = (counts[o] || 0) + 1
            })
          }
        } catch (e) {
          counts["Неизвестное возражение"] = (counts["Неизвестное возражение"] || 0) + 1
        }
      }
    })
    
    return Object.entries(counts)
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5) // Top 5
  }, [calls])

  const sentimentData = useMemo(() => {
    // Last 7 days tracking
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i)
      days.push(format(d, 'MMM dd'))
    }
    
    const chartData = days.map(day => ({ name: day, Pos: 0, Neg: 0 }))
    
    calls.forEach(c => {
      const cDate = format(new Date(c.start_time), 'MMM dd')
      const targetDay = chartData.find(d => d.name === cDate)
      
      if (targetDay && c.summaries?.[0]?.sentiment) {
        const sent = c.summaries[0].sentiment.toLowerCase()
        if (sent.includes('positive') || sent.includes('позитивное')) targetDay.Pos++
        else if (sent.includes('negative') || sent.includes('негативное')) targetDay.Neg++
      }
    })
    return chartData
  }, [calls])

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}m ${s}s`
  }

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-[60vh] text-zinc-500">Загрузка аналитики...</div>
  }

  return (
    <div className="max-w-6xl mx-auto w-full p-8 flex flex-col gap-8 pb-20">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center shadow-md">
          <BarChart3 className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Аналитика</h1>
          <p className="text-zinc-500">Эффективность звонков и анализ возражений</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3 text-zinc-600 font-medium">
            <PhoneCall className="w-5 h-5 text-[#00C853]" />
            Всего звонков
          </div>
          <div className="text-4xl font-bold text-zinc-900">{stats.totalCalls}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3 text-zinc-600 font-medium">
            <Clock className="w-5 h-5 text-blue-500" />
            Длительность разговоров
          </div>
          <div className="text-4xl font-bold text-zinc-900">{formatDuration(stats.totalDuration)}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3 text-zinc-600 font-medium">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Позитивный настрой
          </div>
          <div className="text-4xl font-bold text-zinc-900">{stats.positiveRate}%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Objections */}
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-zinc-900 mb-6">Топ Возражений</h2>
          {objectionsData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={objectionsData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E4E4E7" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fill: '#52525B' }} />
                  <RechartsTooltip cursor={{fill: '#F4F4F5'}} contentStyle={{borderRadius: '12px', border: '1px solid #E4E4E7', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}} />
                  <Bar dataKey="value" fill="#00C853" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
             <div className="h-[300px] flex items-center justify-center text-zinc-400">Нет данных о возражениях</div>
          )}
        </section>

        {/* Sentiment Timeline */}
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-zinc-900 mb-6">Динамика настроений (7 дней)</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sentimentData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#A1A1AA' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 12, fill: '#A1A1AA' }} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{borderRadius: '12px', border: '1px solid #E4E4E7', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}} />
                <Line type="monotone" dataKey="Pos" name="Позитивно" stroke="#00C853" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="Neg" name="Негативно" stroke="#EF4444" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Recent Calls Table */}
      <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
          <h2 className="text-lg font-semibold text-zinc-900">Недавние Звонки</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Клиент</th>
                <th className="px-6 py-4 font-semibold">Дата</th>
                <th className="px-6 py-4 font-semibold">Длительность</th>
                <th className="px-6 py-4 font-semibold">Настроение</th>
                <th className="px-6 py-4 font-semibold text-right">Детали</th>
              </tr>
            </thead>
            <tbody>
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-zinc-500">История пуста</td>
                </tr>
              ) : (
                calls.slice(0, 10).map((call) => {
                  const sent = call.summaries?.[0]?.sentiment?.toLowerCase() || ''
                  let badgeObj = { bg: "bg-zinc-100", text: "text-zinc-600", label: "Neutral" }
                  if (sent.includes("positive") || sent.includes("позитивное")) badgeObj = { bg: "bg-green-100", text: "text-green-700", label: "Positive" }
                  else if (sent.includes("negative") || sent.includes("негативное")) badgeObj = { bg: "bg-red-100", text: "text-red-700", label: "Negative" }

                  return (
                    <tr key={call.id} className="bg-white border-b border-zinc-50 hover:bg-zinc-50/80 transition-colors">
                      <td className="px-6 py-4 font-medium text-zinc-900">{call.customer_name || 'Customer'}</td>
                      <td className="px-6 py-4 text-zinc-500">{new Date(call.start_time).toLocaleString()}</td>
                      <td className="px-6 py-4 text-zinc-500">{formatDuration(call.duration || 0)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${badgeObj.bg} ${badgeObj.text}`}>
                          {badgeObj.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          to={`/summary/${call.id}`}
                          className="inline-flex items-center justify-center p-2 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 transition-colors"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
