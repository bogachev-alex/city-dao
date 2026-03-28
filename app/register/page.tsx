import CitizenRegistration from '../../components/CitizenRegistration'

export default function RegisterPage() {
  return (
    <div className="min-h-screen pt-16 bg-gray-950">
      {/* Hero */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border-b border-gray-800">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" fill="none" stroke="#10b981" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">
            Стать гражданином <span className="text-emerald-400">Amanat</span>
          </h1>
          <p className="text-gray-400">
            Зарегистрируйтесь как присяжный гражданин и участвуйте в контроле за государственными контрактами вашего района
          </p>

          {/* Benefits */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { icon: '⚖️', title: 'Голосование', desc: 'Оцениваете качество работ' },
              { icon: '💎', title: 'Репутация', desc: 'Бронза → Серебро → Золото' },
              { icon: '💰', title: 'Награды', desc: 'USDC за точные голоса' },
            ].map((b) => (
              <div key={b.title} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <div className="text-2xl mb-1.5">{b.icon}</div>
                <div className="text-white text-xs font-semibold mb-0.5">{b.title}</div>
                <div className="text-gray-500 text-xs">{b.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <CitizenRegistration />
      </div>
    </div>
  )
}
