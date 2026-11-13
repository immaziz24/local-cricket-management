import {
  Home, Users, Activity, Trophy, PlusCircle, BarChart3, Store, Clapperboard, MapPin, Flag, BookOpen, Wrench,
  ShieldAlert, Settings, Shield, Handshake, Newspaper, GraduationCap
} from 'lucide-react';

export const menuLanguages = [
  { code: 'en', name: 'English' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'mr', name: 'मराठी' },
  { code: 'ta', name: 'தமிழ்' }
];

const translations = {
  mr: {
    dashboard: 'मुख्यपृष्ठ', teams: 'माझे संघ', matches: 'सामने', tournaments: 'स्पर्धा',
    'create-tournament': 'स्पर्धा तयार करा', stats: 'खेळाडू व आकडेवारी', community: 'समुदाय',
    news: 'बातम्या', media: 'थेट व मीडिया', sponsors: 'प्रायोजक', grounds: 'मैदाने',
    officials: 'पंच व गुणलेखक', learn: 'शिका व प्रश्नमंजुषा', laws: 'कायदे व नियम',
    tools: 'क्रिकेट साधने', penalties: 'उशिरा येण्याचे नियम', settings: 'सेटिंग्ज व गोपनीयता',
    admin: 'प्रशासन', Explore: 'शोधा', Help: 'मदत', Account: 'खाते', live: 'थेट'
  },
  ta: {
    dashboard: 'முகப்பு', teams: 'என் அணிகள்', matches: 'போட்டிகள்', tournaments: 'தொடர்கள்',
    'create-tournament': 'தொடரை உருவாக்கு', stats: 'வீரர்கள் மற்றும் புள்ளிவிவரங்கள்', community: 'சமூகம்',
    news: 'செய்திகள்', media: 'நேரலை மற்றும் ஊடகம்', sponsors: 'ஆதரவாளர்கள்', grounds: 'மைதானங்கள்',
    officials: 'நடுவர்கள் மற்றும் மதிப்பெண் பதிவாளர்கள்', learn: 'கற்றல் மற்றும் வினாடி வினா', laws: 'சட்டங்கள் மற்றும் விதிகள்',
    tools: 'கிரிக்கெட் கருவிகள்', penalties: 'தாமத வருகை விதிகள்', settings: 'அமைப்புகள் மற்றும் தனியுரிமை',
    admin: 'நிர்வாகம்', Explore: 'ஆராய்க', Help: 'உதவி', Account: 'கணக்கு', live: 'நேரலை'
  },
  bn: {
    dashboard: 'হোম', teams: 'আমার দল', matches: 'ম্যাচ', tournaments: 'টুর্নামেন্ট',
    'create-tournament': 'টুর্নামেন্ট তৈরি করুন', stats: 'খেলোয়াড় ও পরিসংখ্যান', community: 'কমিউনিটি',
    news: 'খবর', media: 'লাইভ ও মিডিয়া', sponsors: 'স্পনসর', grounds: 'মাঠ',
    officials: 'আম্পায়ার ও স্কোরার', learn: 'শিখুন ও কুইজ', laws: 'আইন ও নিয়ম',
    tools: 'ক্রিকেট টুল', penalties: 'দেরিতে আসার নিয়ম', settings: 'সেটিংস ও গোপনীয়তা',
    admin: 'অ্যাডমিন প্যানেল', Explore: 'ঘুরে দেখুন', Help: 'সহায়তা', Account: 'অ্যাকাউন্ট', live: 'লাইভ'
  },
  hi: {
    dashboard: 'होम', teams: 'मेरी टीमें', matches: 'मैच', tournaments: 'टूर्नामेंट',
    'create-tournament': 'टूर्नामेंट बनाएँ', stats: 'खिलाड़ी और आँकड़े', community: 'समुदाय',
    news: 'समाचार', media: 'लाइव और मीडिया', sponsors: 'प्रायोजक', grounds: 'मैदान',
    officials: 'अंपायर और स्कोरर', learn: 'सीखें और क्विज़', laws: 'कानून और नियम',
    tools: 'क्रिकेट टूल', penalties: 'देर से आने के नियम', settings: 'सेटिंग्स और गोपनीयता',
    admin: 'एडमिन पैनल', Explore: 'देखें', Help: 'सहायता', Account: 'खाता', live: 'लाइव'
  }
};

// Signed-in members: grouped menu. Admin group only for Admin / Super-Admin.
export function memberNav({ isAdmin, liveMatchCount = 0 }) {
  const labels = translations[readLanguage()];
  return [
    { title: null, items: [
      { id: 'dashboard', label: 'Home', icon: Home },
      { id: 'teams', label: 'My Teams', icon: Users },
      { id: 'matches', label: 'Matches', icon: Activity, badge: liveMatchCount > 0 ? `${liveMatchCount} Live` : null, also: ['match-centre'] },
      { id: 'tournaments', label: 'Tournaments', icon: Trophy, also: ['tournament-details'] },
      { id: 'create-tournament', label: 'Create Tournament', icon: PlusCircle }
    ] },
    { title: 'Explore', items: [
      { id: 'stats', label: 'Players & Stats', icon: BarChart3, also: ['player-profile'] },
      { id: 'community', label: 'Community', icon: Store },
      { id: 'news', label: 'News', icon: Newspaper, also: ['article'] },
      { id: 'media', label: 'Live & Media', icon: Clapperboard },
      { id: 'sponsors', label: 'Sponsors', icon: Handshake, also: ['sponsor'] },
      { id: 'grounds', label: 'Grounds', icon: MapPin, also: ['ground'] },
      { id: 'officials', label: 'Umpires & Scorers', icon: Flag, also: ['official-profile'] }
    ] },
    { title: 'Help', items: [
      { id: 'learn', label: 'Learn & Quizzes', icon: GraduationCap, also: ['quiz'] },
      { id: 'laws', label: 'Laws & Rules', icon: BookOpen },
      { id: 'tools', label: 'Cricket Tools', icon: Wrench },
      { id: 'penalties', label: 'Late-arrival Rules', icon: ShieldAlert }
    ] },
    { title: 'Account', items: [
      { id: 'settings', label: 'Settings & Privacy', icon: Settings },
      ...(isAdmin ? [{ id: 'admin', label: 'Admin Panel', icon: Shield }] : [])
    ] }
  ].map(group => ({
    ...group,
    title: labels?.[group.title] || group.title,
    items: group.items.map(item => ({
      ...item,
      label: labels?.[item.id] || item.label,
      badge: item.badge && labels ? `${liveMatchCount} ${labels.live}` : item.badge
    }))
  }));
}

export function readLanguage() {
  try {
    const saved = localStorage.getItem('cricnotch-language');
    if (menuLanguages.some(({ code }) => code === saved)) return saved;
  } catch { /* Storage can be unavailable. */ }
  const device = globalThis.navigator?.language?.split('-')[0];
  return menuLanguages.some(({ code }) => code === device) ? device : 'en';
}

export const isActiveItem = (item, activeTab) => item.id === activeTab || (item.also || []).includes(activeTab);
