import { useEffect, useState } from 'react';
import { Check, Shield, Sparkles, Zap } from 'lucide-react';
import { useToast } from '@sdkwork/birdcoder-commons';
import { Button } from '@sdkwork/birdcoder-ui';
import {
  BIRDCODER_APPBASE_VIP_PLANS,
  type BirdCoderVipPlan,
} from '../vip';
import {
  readBirdCoderVipMembership,
  writeBirdCoderVipMembership,
} from '../storage';

export function VipPage() {
  const { addToast } = useToast();
  const [currentMembership, setCurrentMembership] = useState({
    creditsPerMonth: 0,
    planId: 'free' as BirdCoderVipPlan['id'],
    planTitle: 'Free',
    renewAt: 'Not scheduled',
    seats: 1,
    status: 'inactive' as const,
  });
  const [selectedPlanId, setSelectedPlanId] = useState<BirdCoderVipPlan['id']>('free');

  useEffect(() => {
    let isMounted = true;

    void readBirdCoderVipMembership().then((membership) => {
      if (!isMounted) {
        return;
      }

      setCurrentMembership(membership);
      setSelectedPlanId(membership.planId);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const activatePlan = async (plan: BirdCoderVipPlan) => {
    const nextMembership = await writeBirdCoderVipMembership({
      creditsPerMonth: plan.id === 'free' ? 0 : plan.id === 'pro' ? 1500 : 8000,
      planId: plan.id,
      planTitle: plan.title,
      renewAt: plan.id === 'free' ? 'Not scheduled' : '2026-05-09',
      seats: plan.id === 'team' ? 5 : 1,
      status: plan.id === 'free' ? 'inactive' : 'active',
    });
    setCurrentMembership(nextMembership);
    setSelectedPlanId(plan.id);
    addToast(`VIP entitlement updated to ${plan.title}.`, 'success');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0e0e11] text-gray-100 p-8 h-full">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.24em] text-blue-400 mb-2">
            sdkwork-appbase vip
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Membership Center</h1>
          <p className="text-sm text-gray-400 mt-2 max-w-3xl">
            Unified membership, entitlement, and upgrade workflows for BirdCoder. This bridge keeps the product aligned to the sdkwork-appbase commerce capability model while preserving BirdCoder-specific IDE business workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-8">
          <div className="bg-[#18181b] rounded-2xl border border-blue-500/20 p-6 shadow-lg h-fit">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Sparkles size={22} className="text-blue-300" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-blue-300">Active plan</p>
                <h2 className="text-lg font-semibold text-white">{currentMembership.planTitle}</h2>
              </div>
            </div>
            <div className="space-y-3 text-sm text-gray-300">
              <p>Status: <span className="text-white">{currentMembership.status}</span></p>
              <p>Seats: <span className="text-white">{currentMembership.seats}</span></p>
              <p>Credits/month: <span className="text-white">{currentMembership.creditsPerMonth}</span></p>
              <p>Renewal: <span className="text-white">{currentMembership.renewAt}</span></p>
            </div>
            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-3 mb-2">
                <Shield size={16} className="text-blue-400" />
                <p className="font-medium text-white">Entitlement posture</p>
              </div>
              <p className="text-sm text-gray-400">
                Membership state is stored under the commerce capability boundary so future appbase wallet, billing, and subscription packages can attach without reshaping BirdCoder business modules.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {BIRDCODER_APPBASE_VIP_PLANS.map((plan) => {
              const isSelected = selectedPlanId === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-6 shadow-lg transition-all ${
                    isSelected
                      ? 'bg-blue-500/10 border-blue-400/50'
                      : 'bg-[#18181b] border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                        {plan.id}
                      </p>
                      <h2 className="text-xl font-semibold text-white mt-2">{plan.title}</h2>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center">
                      {plan.id === 'team' ? (
                        <Shield size={18} className="text-blue-300" />
                      ) : plan.id === 'pro' ? (
                        <Zap size={18} className="text-blue-300" />
                      ) : (
                        <Sparkles size={18} className="text-blue-300" />
                      )}
                    </div>
                  </div>
                  <p className="text-3xl font-semibold text-white">
                    ${plan.monthlyPrice}
                    <span className="text-sm text-gray-400 font-normal">/month</span>
                  </p>
                  <p className="text-sm text-gray-400 mt-4 min-h-16">{plan.description}</p>
                  <div className="space-y-3 mt-6">
                    {plan.highlights.map((highlight) => (
                      <div key={highlight} className="flex items-start gap-3 text-sm text-gray-300">
                        <Check size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => void activatePlan(plan)}
                    className={
                      isSelected
                        ? 'w-full mt-6 bg-white text-black hover:bg-gray-200'
                        : 'w-full mt-6 border-white/10 text-gray-200 hover:bg-white/5'
                    }
                  >
                    {isSelected ? 'Selected' : `Switch to ${plan.title}`}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
