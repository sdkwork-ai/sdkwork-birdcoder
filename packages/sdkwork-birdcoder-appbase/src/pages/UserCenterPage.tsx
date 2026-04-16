import { useEffect, useState } from 'react';
import {
  Building,
  Link as LinkIcon,
  LogOut,
  Mail,
  MapPin,
  Shield,
  Sparkles,
  UserCircle2,
} from 'lucide-react';
import { useAuth, useToast } from '@sdkwork/birdcoder-commons';
import { Button } from '@sdkwork/birdcoder-ui';
import {
  readBirdCoderUserProfile,
  readBirdCoderVipMembership,
  writeBirdCoderUserProfile,
} from '../storage';

export interface UserCenterPageProps {
  onOpenVip?: () => void;
}

export function UserCenterPage({ onOpenVip }: UserCenterPageProps) {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [company, setCompany] = useState('SDKWork');
  const [location, setLocation] = useState('Shanghai');
  const [website, setWebsite] = useState('https://sdkwork.com');
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [membership, setMembership] = useState({
    creditsPerMonth: 0,
    planId: 'free',
    planTitle: 'Free',
    renewAt: 'Not scheduled',
    seats: 1,
    status: 'inactive',
  });

  useEffect(() => {
    let isMounted = true;

    void readBirdCoderUserProfile().then((profile) => {
      if (!isMounted) {
        return;
      }

      setBio(profile.bio);
      setCompany(profile.company);
      setDisplayName(profile.displayName || user?.name || '');
      setLocation(profile.location);
      setWebsite(profile.website);
    });

    void readBirdCoderVipMembership().then((snapshot) => {
      if (!isMounted) {
        return;
      }

      setMembership(snapshot);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setDisplayName(user?.name ?? '');
  }, [user?.name]);

  const handleSave = async () => {
    await writeBirdCoderUserProfile({
      bio,
      company,
      displayName,
      location,
      website,
    });
    setIsEditing(false);
    addToast('User center saved through the appbase identity bridge.', 'success');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0e0e11] text-gray-100 p-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Identity session unavailable</h2>
          <p className="text-gray-400">Sign in through the unified appbase auth workflow first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#0e0e11] text-gray-100 p-8 h-full">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-blue-400 mb-2">
              sdkwork-appbase user
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Account Center</h1>
            <p className="text-sm text-gray-400 mt-2">
              BirdCoder account, membership, and profile state are now orchestrated through one appbase-aligned surface.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-red-900/30 text-red-400 hover:bg-red-950/50 hover:text-red-300 flex items-center gap-2 transition-colors"
            onClick={() => void logout()}
          >
            <LogOut size={16} />
            Sign Out
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-8">
          <div className="flex flex-col gap-6">
            <div className="bg-[#18181b] rounded-2xl border border-white/5 p-6 shadow-lg">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl">
                  <UserCircle2 size={34} className="text-white" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-100">{displayName || user.name}</p>
                  <p className="text-sm text-gray-400">{user.email}</p>
                </div>
              </div>
              <div className="space-y-3 text-sm text-gray-300">
                <div className="flex items-center gap-3">
                  <Building size={15} className="text-gray-500 shrink-0" />
                  <span>{company}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={15} className="text-gray-500 shrink-0" />
                  <span>{location}</span>
                </div>
                <div className="flex items-center gap-3">
                  <LinkIcon size={15} className="text-gray-500 shrink-0" />
                  <a
                    className="text-blue-400 hover:text-blue-300 transition-colors truncate"
                    href={website}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-[#18181b] rounded-2xl border border-blue-500/20 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Sparkles size={18} className="text-blue-300" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-blue-300">VIP status</p>
                  <h2 className="text-lg font-semibold text-white">{membership.planTitle}</h2>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-300 mb-5">
                <p>Status: <span className="text-white">{membership.status}</span></p>
                <p>Seats: <span className="text-white">{membership.seats}</span></p>
                <p>Credits/month: <span className="text-white">{membership.creditsPerMonth}</span></p>
                <p>Renews: <span className="text-white">{membership.renewAt}</span></p>
              </div>
              <Button
                variant="outline"
                onClick={onOpenVip}
                className="w-full border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
              >
                Manage Membership
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-[#18181b] rounded-2xl border border-white/10 overflow-hidden shadow-lg">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h3 className="text-base font-medium text-gray-200">Profile Workspace</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Standardized user profile state aligned to the sdkwork-appbase user capability.
                  </p>
                </div>
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  onClick={isEditing ? () => void handleSave() : () => setIsEditing(true)}
                  className={
                    isEditing
                      ? 'bg-white text-black hover:bg-gray-200'
                      : 'border-white/10 bg-transparent hover:bg-white/5 text-gray-300'
                  }
                  size="sm"
                >
                  {isEditing ? 'Save' : 'Edit'}
                </Button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    disabled={!isEditing}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-60 disabled:bg-transparent disabled:border-transparent disabled:px-0 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Company
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    disabled={!isEditing}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-60 disabled:bg-transparent disabled:border-transparent disabled:px-0 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    disabled={!isEditing}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-60 disabled:bg-transparent disabled:border-transparent disabled:px-0 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Website
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                    disabled={!isEditing}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-60 disabled:bg-transparent disabled:border-transparent disabled:px-0 transition-all"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(event) => setBio(event.target.value)}
                    disabled={!isEditing}
                    rows={4}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-60 disabled:bg-transparent disabled:border-transparent disabled:px-0 resize-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#18181b] rounded-2xl border border-white/10 overflow-hidden shadow-lg">
              <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                <h3 className="text-base font-medium flex items-center gap-2 text-gray-200">
                  <Shield size={18} className="text-blue-400" />
                  Security and Access
                </h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Mail size={16} className="text-blue-400" />
                    <p className="font-medium text-white">Primary identity</p>
                  </div>
                  <p className="text-sm text-gray-300">{user.email}</p>
                  <p className="text-xs text-gray-500 mt-2">Managed by the unified auth capability.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Sparkles size={16} className="text-blue-400" />
                    <p className="font-medium text-white">Membership entitlement</p>
                  </div>
                  <p className="text-sm text-gray-300">{membership.planTitle}</p>
                  <p className="text-xs text-gray-500 mt-2">Commerce access is standardized through the appbase VIP contract.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
