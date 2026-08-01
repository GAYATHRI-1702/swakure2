import React, { createContext, useContext, useState } from 'react'

const translations = {
  en: {
    dashboard: 'Dashboard', healthMonitor: 'Health Monitor', medicines: 'Medicines',
    doctors: 'Doctors', appointments: 'Appointments', prescriptions: 'Prescriptions',
    reminders: 'Reminders', firstAid: 'First Aid', aiAssistant: 'AI Assistant',
    settings: 'Settings', logout: 'Logout', uploadPrescription: 'Upload Prescription',
    noData: 'No data available', loading: 'Loading...', save: 'Save', cancel: 'Cancel',
    delete: 'Delete', edit: 'Edit', add: 'Add', search: 'Search',
  },
  hi: {
    dashboard: 'डैशबोर्ड', healthMonitor: 'स्वास्थ्य मॉनिटर', medicines: 'दवाइयाँ',
    doctors: 'डॉक्टर', appointments: 'अपॉइंटमेंट', prescriptions: 'नुस्खे',
    reminders: 'रिमाइंडर', firstAid: 'प्राथमिक चिकित्सा', aiAssistant: 'AI सहायक',
    settings: 'सेटिंग्स', logout: 'लॉगआउट', uploadPrescription: 'नुस्खा अपलोड करें',
    noData: 'कोई डेटा उपलब्ध नहीं', loading: 'लोड हो रहा है...', save: 'सहेजें',
    cancel: 'रद्द करें', delete: 'हटाएं', edit: 'संपादित करें', add: 'जोड़ें', search: 'खोजें',
  },
  ta: {
    dashboard: 'டாஷ்போர்டு', healthMonitor: 'உடல்நல கண்காணிப்பு', medicines: 'மருந்துகள்',
    doctors: 'மருத்துவர்கள்', appointments: 'சந்திப்புகள்', prescriptions: 'மருந்துச்சீட்டு',
    reminders: 'நினைவூட்டல்கள்', firstAid: 'முதலுதவி', aiAssistant: 'AI உதவியாளர்',
    settings: 'அமைப்புகள்', logout: 'வெளியேறு', uploadPrescription: 'மருந்துச்சீட்டு பதிவேற்று',
    noData: 'தரவு இல்லை', loading: 'ஏற்றுகிறது...', save: 'சேமி',
    cancel: 'ரத்து செய்', delete: 'நீக்கு', edit: 'திருத்து', add: 'சேர்', search: 'தேடு',
  },
  te: {
    dashboard: 'డాష్‌బోర్డ్', healthMonitor: 'ఆరోగ్య పర్యవేక్షణ', medicines: 'మందులు',
    doctors: 'వైద్యులు', appointments: 'అపాయింట్‌మెంట్లు', prescriptions: 'ప్రిస్క్రిప్షన్లు',
    reminders: 'రిమైండర్లు', firstAid: 'ప్రాథమిక చికిత్స', aiAssistant: 'AI సహాయకుడు',
    settings: 'సెట్టింగులు', logout: 'లాగ్అవుట్', uploadPrescription: 'ప్రిస్క్రిప్షన్ అప్‌లోడ్',
    noData: 'డేటా అందుబాటులో లేదు', loading: 'లోడ్ అవుతోంది...', save: 'సేవ్',
    cancel: 'రద్దు', delete: 'తొలగించు', edit: 'సవరించు', add: 'జోడించు', search: 'వెతుకు',
  },
  kn: { dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', healthMonitor: 'ಆರೋಗ್ಯ ಮಾನಿಟರ್', medicines: 'ಔಷಧಗಳು', doctors: 'ವೈದ್ಯರು', appointments: 'ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್‌ಗಳು', prescriptions: 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್‌ಗಳು', reminders: 'ರಿಮೈಂಡರ್‌ಗಳು', firstAid: 'ಪ್ರಥಮ ಚಿಕಿತ್ಸೆ', aiAssistant: 'AI ಸಹಾಯಕ', settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು', logout: 'ಲಾಗ್‌ಔಟ್', uploadPrescription: 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಅಪ್‌ಲೋಡ್', noData: 'ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ', loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...', save: 'ಉಳಿಸು', cancel: 'ರದ್ದು', delete: 'ಅಳಿಸು', edit: 'ಸಂಪಾದಿಸು', add: 'ಸೇರಿಸು', search: 'ಹುಡುಕು' },
  ml: { dashboard: 'ഡാഷ്‌ബോർഡ്', healthMonitor: 'ആരോഗ്യ നിരീക്ഷണം', medicines: 'മരുന്നുകൾ', doctors: 'ഡോക്ടർമാർ', appointments: 'അപ്പോയിന്റ്മെന്റുകൾ', prescriptions: 'പ്രിസ്ക്രിപ്ഷനുകൾ', reminders: 'റിമൈൻഡറുകൾ', firstAid: 'പ്രഥമ ചികിത്സ', aiAssistant: 'AI സഹായി', settings: 'ക്രമീകരണങ്ങൾ', logout: 'ലോഗ്ഔട്ട്', uploadPrescription: 'പ്രിസ്ക്രിപ്ഷൻ അപ്‌ലോഡ്', noData: 'ഡാറ്റ ലഭ്യമല്ല', loading: 'ലോഡ് ചെയ്യുന്നു...', save: 'സേവ്', cancel: 'റദ്ദാക്കുക', delete: 'ഇല്ലാതാക്കുക', edit: 'എഡിറ്റ്', add: 'ചേർക്കുക', search: 'തിരയുക' },
  mr: { dashboard: 'डॅशबोर्ड', healthMonitor: 'आरोग्य मॉनिटर', medicines: 'औषधे', doctors: 'डॉक्टर', appointments: 'अपॉइंटमेंट', prescriptions: 'प्रिस्क्रिप्शन', reminders: 'रिमाइंडर', firstAid: 'प्रथमोपचार', aiAssistant: 'AI सहाय्यक', settings: 'सेटिंग्ज', logout: 'लॉगआउट', uploadPrescription: 'प्रिस्क्रिप्शन अपलोड करा', noData: 'डेटा उपलब्ध नाही', loading: 'लोड होत आहे...', save: 'जतन करा', cancel: 'रद्द करा', delete: 'हटवा', edit: 'संपादित करा', add: 'जोडा', search: 'शोधा' },
  bn: { dashboard: 'ড্যাশবোর্ড', healthMonitor: 'স্বাস্থ্য মনিটর', medicines: 'ওষুধ', doctors: 'ডাক্তার', appointments: 'অ্যাপয়েন্টমেন্ট', prescriptions: 'প্রেসক্রিপশন', reminders: 'রিমাইন্ডার', firstAid: 'প্রাথমিক চিকিৎসা', aiAssistant: 'AI সহকারী', settings: 'সেটিংস', logout: 'লগআউট', uploadPrescription: 'প্রেসক্রিপশন আপলোড', noData: 'কোনো ডেটা নেই', loading: 'লোড হচ্ছে...', save: 'সংরক্ষণ', cancel: 'বাতিল', delete: 'মুছুন', edit: 'সম্পাদনা', add: 'যোগ করুন', search: 'অনুসন্ধান' },
  gu: { dashboard: 'ડેશબોર્ડ', healthMonitor: 'આરોગ્ય મોનિટર', medicines: 'દવાઓ', doctors: 'ડૉક્ટર', appointments: 'એપોઇન્ટમેન્ટ', prescriptions: 'પ્રિસ્ક્રિપ્શન', reminders: 'રિમાઇન્ડર', firstAid: 'પ્રાથમિક સારવાર', aiAssistant: 'AI સહાયક', settings: 'સેટિંગ્સ', logout: 'લૉગઆઉટ', uploadPrescription: 'પ્રિસ્ક્રિપ્શન અપલોડ', noData: 'કોઈ ડેટા નથી', loading: 'લોડ થઈ રહ્યું છે...', save: 'સાચવો', cancel: 'રદ કરો', delete: 'કાઢી નાખો', edit: 'સંપાદિત કરો', add: 'ઉમેરો', search: 'શોધો' },
  pa: { dashboard: 'ਡੈਸ਼ਬੋਰਡ', healthMonitor: 'ਸਿਹਤ ਮਾਨੀਟਰ', medicines: 'ਦਵਾਈਆਂ', doctors: 'ਡਾਕਟਰ', appointments: 'ਅਪੌਇੰਟਮੈਂਟ', prescriptions: 'ਨੁਸਖੇ', reminders: 'ਰਿਮਾਈਂਡਰ', firstAid: 'ਮੁੱਢਲੀ ਸਹਾਇਤਾ', aiAssistant: 'AI ਸਹਾਇਕ', settings: 'ਸੈਟਿੰਗਾਂ', logout: 'ਲੌਗਆਉਟ', uploadPrescription: 'ਨੁਸਖਾ ਅਪਲੋਡ ਕਰੋ', noData: 'ਕੋਈ ਡੇਟਾ ਨਹੀਂ', loading: 'ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ...', save: 'ਸੁਰੱਖਿਅਤ ਕਰੋ', cancel: 'ਰੱਦ ਕਰੋ', delete: 'ਮਿਟਾਓ', edit: 'ਸੰਪਾਦਿਤ ਕਰੋ', add: 'ਜੋੜੋ', search: 'ਖੋਜੋ' },
  ur: { dashboard: 'ڈیش بورڈ', healthMonitor: 'صحت مانیٹر', medicines: 'دوائیں', doctors: 'ڈاکٹر', appointments: 'ملاقاتیں', prescriptions: 'نسخے', reminders: 'یاد دہانیاں', firstAid: 'ابتدائی طبی امداد', aiAssistant: 'AI معاون', settings: 'ترتیبات', logout: 'لاگ آؤٹ', uploadPrescription: 'نسخہ اپلوڈ کریں', noData: 'کوئی ڈیٹا نہیں', loading: 'لوڈ ہو رہا ہے...', save: 'محفوظ کریں', cancel: 'منسوخ', delete: 'حذف کریں', edit: 'ترمیم', add: 'شامل کریں', search: 'تلاش' },
  or: { dashboard: 'ଡ୍ୟାଶବୋର୍ଡ', healthMonitor: 'ସ୍ୱାସ୍ଥ୍ୟ ମନିଟର', medicines: 'ଔଷଧ', doctors: 'ଡାକ୍ତର', appointments: 'ଅ୍ୟାପଏଣ୍ଟମେଣ୍ଟ', prescriptions: 'ପ୍ରେସ୍କ୍ରିପ୍ସନ', reminders: 'ରିମାଇଣ୍ଡର', firstAid: 'ପ୍ରାଥମିକ ଚିକିତ୍ସା', aiAssistant: 'AI ସହାୟକ', settings: 'ସେଟିଂ', logout: 'ଲଗଆଉଟ', uploadPrescription: 'ପ୍ରେସ୍କ୍ରିପ୍ସନ ଅପଲୋଡ', noData: 'କୌଣସି ଡାଟା ନାହିଁ', loading: 'ଲୋଡ ହେଉଛି...', save: 'ସଞ୍ଚୟ', cancel: 'ବାତିଲ', delete: 'ଡିଲିଟ', edit: 'ସଂପାଦନ', add: 'ଯୋଡ଼ନ୍ତୁ', search: 'ଖୋଜ' },
}

const LANGUAGES = [
  { code: 'en', name: 'English' }, { code: 'hi', name: 'हिंदी' },
  { code: 'ta', name: 'தமிழ்' }, { code: 'te', name: 'తెలుగు' },
  { code: 'kn', name: 'ಕನ್ನಡ' }, { code: 'ml', name: 'മലയാളം' },
  { code: 'mr', name: 'मराठी' }, { code: 'bn', name: 'বাংলা' },
  { code: 'gu', name: 'ગુજરાતી' }, { code: 'pa', name: 'ਪੰਜਾਬੀ' },
  { code: 'ur', name: 'اردو' }, { code: 'or', name: 'ଓଡ଼ିଆ' },
]

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('swakure_lang') || 'en')

  const setLanguage = (code) => {
    setLang(code)
    localStorage.setItem('swakure_lang', code)
  }

  const tr = (key) => translations[lang]?.[key] ?? translations.en[key] ?? key

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, tr, LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
