import {
  Home, Users, Activity, Trophy, PlusCircle, BarChart3, Store, Clapperboard, MapPin, Flag, BookOpen, Wrench,
  ShieldAlert, Settings, Shield, Handshake, Newspaper, GraduationCap
} from 'lucide-react';

// Signed-in members: grouped menu. Admin group only for Admin / Super-Admin.
export function memberNav({ isAdmin, liveMatchCount = 0 }) {
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
  ];
}

export const isActiveItem = (item, activeTab) => item.id === activeTab || (item.also || []).includes(activeTab);
