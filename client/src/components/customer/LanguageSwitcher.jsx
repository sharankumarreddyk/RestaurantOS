import { useState } from 'react';
import { Globe } from 'lucide-react';

const languageNames = {
  en: 'English', hi: 'हिन्दी', ta: 'தமிழ்', kn: 'ಕನ್ನಡ',
  te: 'తెలుగు', mr: 'मराठी', bn: 'বাংলা', gu: 'ગુજરાતી',
  ml: 'മലയാളം', pa: 'ਪੰਜਾਬੀ', ur: 'اردو',
};

export default function LanguageSwitcher({ supportedLanguages = ['en'], currentLanguage, onLanguageChange }) {
  const [open, setOpen] = useState(false);

  if (supportedLanguages.length <= 1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-xs font-medium"
        aria-label="Change language"
        aria-expanded={open}
      >
        <Globe size={12} aria-hidden="true" />
        {languageNames[currentLanguage] || currentLanguage}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border z-30 py-1 min-w-[120px]">
            {supportedLanguages.map((lang) => (
              <button
                key={lang}
                onClick={() => { onLanguageChange(lang); setOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                  lang === currentLanguage ? 'font-medium text-accent' : ''
                }`}
              >
                {languageNames[lang] || lang}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
