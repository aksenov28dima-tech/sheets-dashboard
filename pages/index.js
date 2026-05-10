// pages/index.js
import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import styles from '../styles/Home.module.css'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Line, Pie } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
)

const COLORS = ['#3266ad', '#1d9e75', '#d85a30', '#ba7517', '#d4537e', '#534ab7']

function fmt(v) {
  if (typeof v !== 'number') return v
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000) return (v / 1000).toFixed(0) + 'K'
  return Math.round(v).toString()
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  async function analyze() {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setData(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Ошибка сервера')
      setData(json)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  function handleKey(e) {
    if (e.key === 'Enter') analyze()
  }

  const barData = data ? {
    labels: data.chartLabels,
    datasets: data.chartSeries.map((s, i) => ({
      label: s.name,
      data: s.data,
      backgroundColor: COLORS[i % COLORS.length],
      borderRadius: 4,
    }))
  } : null

  const lineData = data ? {
    labels: data.chartLabels,
    datasets: data.chartSeries.map((s, i) => ({
      label: s.name,
      data: s.data,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: i === 0 ? 'rgba(50,102,173,0.08)' : 'transparent',
      fill: i === 0,
      tension: 0.4,
      pointRadius: 3,
      borderDash: i > 0 ? [4, 4] : [],
    }))
  } : null

  const pieData = data ? {
    labels: data.chartLabels.slice(0, 6),
    datasets: [{
      data: data.chartSeries[0]?.data.slice(0, 6) || [],
      backgroundColor: COLORS,
      borderWidth: 2,
      borderColor: '#fff',
    }]
  } : null

  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { font: { size: 11 }, maxRotation: 45 } },
      y: { ticks: { font: { size: 11 }, callback: v => fmt(v) } }
    }
  }

  const pieOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } }
  }

  const typeMap = { trend: 'Тренд', anomaly: 'Аномалия', insight: 'Инсайт' }
  const typeClass = { trend: styles.badgeTrend, anomaly: styles.badgeAnomaly, insight: styles.badgeInsight }

  return (
    <>
      <Head>
        <title>Sheets Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className={styles.page}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.logo}>
              <span className={styles.logoIcon}>▦</span>
              <span>Sheets<b>AI</b></span>
            </div>
            <div className={styles.headerRight}>
              <span className={styles.badge}>Beta</span>
            </div>
          </div>
        </header>

        <main className={styles.main}>
          {/* Input card */}
          <div className={styles.inputCard}>
            <h1 className={styles.title}>Анализ Google Sheets с помощью AI</h1>
            <p className={styles.subtitle}>
              Вставьте ссылку на таблицу — Claude проанализирует данные и покажет инсайты
            </p>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={handleKey}
              />
              <button
                className={styles.btnPrimary}
                onClick={analyze}
                disabled={loading || !url.trim()}
              >
                {loading ? '⏳ Анализирую...' : '✦ Анализировать'}
              </button>
            </div>
            <p className={styles.hint}>
              Таблица должна быть открыта для просмотра: Файл → Поделиться → Все у кого есть ссылка
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className={styles.errorCard}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className={styles.loadingCard}>
              <div className={styles.spinner}></div>
              <div>
                <div className={styles.loadingTitle}>Загружаем и анализируем...</div>
                <div className={styles.loadingText}>Claude читает данные и ищет инсайты</div>
              </div>
            </div>
          )}

          {/* Results */}
          {data && (
            <>
              {/* Metrics */}
              <div className={styles.metricsGrid}>
                {data.analysis.metrics.map((m, i) => (
                  <div key={i} className={styles.metricCard}>
                    <div className={styles.metricLabel}>{m.label}</div>
                    <div className={styles.metricValue}>{m.value}</div>
                    <div className={styles.metricSub}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className={styles.panel}>
                <div className={styles.panelTitle}>📋 Резюме данных</div>
                <p className={styles.summary}>{data.analysis.summary}</p>
              </div>

              {/* Charts row */}
              <div className={styles.chartsRow}>
                <div className={styles.panel}>
                  <div className={styles.panelTitle}>📊 По периодам</div>
                  <div className={styles.legend}>
                    {data.chartSeries.map((s, i) => (
                      <span key={i} className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: COLORS[i % COLORS.length] }}></span>
                        {s.name}
                      </span>
                    ))}
                  </div>
                  <div className={styles.chartWrap}>
                    <Bar data={barData} options={chartOpts} />
                  </div>
                </div>

                <div className={styles.panel}>
                  <div className={styles.panelTitle}>🥧 Распределение</div>
                  <div className={styles.legend}>
                    {data.chartLabels.slice(0, 6).map((l, i) => (
                      <span key={i} className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: COLORS[i % COLORS.length] }}></span>
                        {l}
                      </span>
                    ))}
                  </div>
                  <div className={styles.chartWrap}>
                    <Pie data={pieData} options={pieOpts} />
                  </div>
                </div>
              </div>

              {/* Line chart */}
              <div className={styles.panel}>
                <div className={styles.panelTitle}>📈 Динамика</div>
                <div className={styles.chartWrap} style={{ height: 200 }}>
                  <Line data={lineData} options={chartOpts} />
                </div>
              </div>

              {/* Insights */}
              <div className={styles.panel}>
                <div className={styles.panelTitle}>💡 Инсайты и аномалии</div>
                <div className={styles.insights}>
                  {data.analysis.insights.map((ins, i) => (
                    <div key={i} className={styles.insightItem}>
                      <span className={styles.insightIcon}>{ins.icon}</span>
                      <div>
                        <span className={`${styles.insightBadge} ${typeClass[ins.type]}`}>
                          {typeMap[ins.type]}
                        </span>
                        <div className={styles.insightTitle}>{ins.title}</div>
                        <div className={styles.insightText}>{ins.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export */}
              <div className={styles.exportRow}>
                <button className={styles.btnSecondary} onClick={() => window.print()}>
                  ⬇ Экспорт в PDF
                </button>
              </div>
            </>
          )}

          {/* Empty state */}
          {!data && !loading && !error && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>▦</div>
              <div className={styles.emptyTitle}>Вставьте ссылку на таблицу выше</div>
              <div className={styles.emptyText}>
                Поддерживаются любые Google Sheets с публичным доступом.<br />
                AI автоматически найдёт тренды, аномалии и ключевые метрики.
              </div>
            </div>
          )}
        </main>

        <footer className={styles.footer}>
          Работает на Claude · Vercel · Next.js
        </footer>
      </div>
    </>
  )
}
