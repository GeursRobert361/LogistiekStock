export const metadata = {
  title: 'Offline — StockFlow',
}

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="text-4xl" aria-hidden="true">
        📴
      </span>
      <h1 className="text-lg font-bold text-gray-900">Geen verbinding</h1>
      <p className="max-w-xs text-sm text-gray-600">
        Deze pagina is nog niet eerder geopend en kan daarom niet offline worden getoond.
        Een lopende telronde blijft wel bereikbaar — die staat op dit apparaat opgeslagen.
      </p>
    </div>
  )
}
