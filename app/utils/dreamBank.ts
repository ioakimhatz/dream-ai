// app/utils/dreamBank.ts - Dream Bank with Rollover (Pile-up System)

export interface DreamGrant {
  amount: number;         // Number of dreams in this grant
  grantedAt: string;      // ISO timestamp when granted
  expiresAt: string;      // ISO timestamp (grantedAt + 90 days)
  remaining: number;      // Dreams left from this grant
  source: 'subscription' | 'topup' | 'share' | 'migration'; // Where it came from
}

export interface DreamUsageWithGrants {
  used: number;           // Total used (for display)
  total: number;          // Total available (for display)
  planId: string | null;  // Current plan
  grants: DreamGrant[];   // Array of individual dream grants
  lastGrantDate: string;  // Last time dreams were granted
  nextResetDate: string;  // Next subscription renewal date
  // Legacy fields for migration
  resetDate?: string;
}

// Constants
const MAX_DREAMS = 12;           // Maximum rollover cap
const EXPIRY_DAYS = 90;          // Dreams expire after 90 days
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Clean up expired grants (expiresAt < now)
 */
export function cleanExpiredGrants(grants: DreamGrant[]): DreamGrant[] {
  const now = new Date().toISOString();
  const cleaned = grants.filter(grant => grant.expiresAt > now && grant.remaining > 0);

  const removed = grants.length - cleaned.length;
  if (removed > 0) {
    console.log(`🧹 Removed ${removed} expired/empty grant(s)`);
  }

  return cleaned;
}

/**
 * Calculate total available dreams from all grants
 */
export function calculateTotal(grants: DreamGrant[]): number {
  return grants.reduce((sum, grant) => sum + grant.remaining, 0);
}

/**
 * Grant new dreams (on subscription renewal)
 * Returns updated grants array, capped at MAX_DREAMS
 */
export function grantDreams(
  currentGrants: DreamGrant[],
  amount: number,
  source: 'subscription' | 'topup' | 'share' = 'subscription'
): DreamGrant[] {
  // Clean up expired grants first
  const cleanedGrants = cleanExpiredGrants(currentGrants);

  // Calculate current total
  const currentTotal = calculateTotal(cleanedGrants);

  // Check if we're at max capacity
  if (currentTotal >= MAX_DREAMS) {
    console.log(`⚠️ Already at maximum capacity (${currentTotal}/${MAX_DREAMS}), not granting new dreams`);
    return cleanedGrants;
  }

  // Calculate how many dreams we can actually grant
  const available = MAX_DREAMS - currentTotal;
  const actualGrant = Math.min(amount, available);

  if (actualGrant < amount) {
    console.log(`⚠️ Capping grant at ${actualGrant} (max ${MAX_DREAMS}, current ${currentTotal})`);
  }

  // Create new grant
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_DAYS * MS_PER_DAY);

  const newGrant: DreamGrant = {
    amount: actualGrant,
    grantedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    remaining: actualGrant,
    source,
  };

  console.log(`✨ Granting ${actualGrant} dream(s) from ${source}, expires ${expiresAt.toLocaleDateString()}`);

  return [...cleanedGrants, newGrant];
}

/**
 * Deduct one dream using FIFO (oldest first)
 * Returns { success: boolean, grants: DreamGrant[] }
 */
export function deductDream(grants: DreamGrant[]): { success: boolean; grants: DreamGrant[] } {
  // Clean up expired grants first
  const cleanedGrants = cleanExpiredGrants(grants);

  // Check if any dreams available
  const total = calculateTotal(cleanedGrants);
  if (total === 0) {
    console.log('❌ No dreams available to deduct');
    return { success: false, grants: cleanedGrants };
  }

  // Sort by grantedAt (oldest first) for FIFO
  const sortedGrants = [...cleanedGrants].sort((a, b) =>
    new Date(a.grantedAt).getTime() - new Date(b.grantedAt).getTime()
  );

  // Find first grant with remaining > 0
  const grantToUse = sortedGrants.find(grant => grant.remaining > 0);

  if (!grantToUse) {
    console.log('❌ No grants with remaining dreams');
    return { success: false, grants: cleanedGrants };
  }

  console.log(`🎬 Deducting 1 dream from grant (${grantToUse.remaining} remaining, granted ${new Date(grantToUse.grantedAt).toLocaleDateString()})`);

  // Deduct from that grant
  const updatedGrants = cleanedGrants.map(grant => {
    if (grant.grantedAt === grantToUse.grantedAt && grant.source === grantToUse.source) {
      return { ...grant, remaining: grant.remaining - 1 };
    }
    return grant;
  });

  // Remove grants with 0 remaining
  const finalGrants = updatedGrants.filter(grant => grant.remaining > 0);

  console.log(`✅ Dream deducted. Remaining: ${calculateTotal(finalGrants)}/${MAX_DREAMS}`);

  return { success: true, grants: finalGrants };
}

/**
 * Refund one dream (add back to newest grant, or create new grant)
 */
export function refundDream(grants: DreamGrant[], source: 'subscription' | 'topup' | 'share' = 'subscription'): DreamGrant[] {
  const cleanedGrants = cleanExpiredGrants(grants);

  // Check if we're at max capacity
  const currentTotal = calculateTotal(cleanedGrants);
  if (currentTotal >= MAX_DREAMS) {
    console.log(`⚠️ Already at max capacity (${MAX_DREAMS}), cannot refund`);
    return cleanedGrants;
  }

  // Sort by grantedAt (newest first)
  const sortedGrants = [...cleanedGrants].sort((a, b) =>
    new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime()
  );

  // Find newest grant from same source that hasn't reached its original amount
  const grantToRefundTo = sortedGrants.find(grant =>
    grant.source === source && grant.remaining < grant.amount
  );

  if (grantToRefundTo) {
    // Refund to existing grant
    console.log(`💸 Refunding 1 dream to existing grant (${grantToRefundTo.remaining + 1}/${grantToRefundTo.amount})`);

    return cleanedGrants.map(grant => {
      if (grant.grantedAt === grantToRefundTo.grantedAt && grant.source === grantToRefundTo.source) {
        return { ...grant, remaining: grant.remaining + 1 };
      }
      return grant;
    });
  }

  // Create new grant for the refund
  console.log(`💸 Creating new grant for refund`);
  return grantDreams(cleanedGrants, 1, source);
}

/**
 * Check if should grant new dreams based on nextResetDate
 */
export function shouldGrantNewDreams(nextResetDate: string): boolean {
  const now = new Date();
  const resetDate = new Date(nextResetDate);
  return now >= resetDate;
}

/**
 * Calculate next reset date based on period
 */
export function calculateNextResetDate(period: 'weekly' | 'monthly'): string {
  const now = new Date();

  if (period === 'weekly') {
    const nextReset = new Date(now);
    nextReset.setDate(nextReset.getDate() + 7);
    return nextReset.toISOString();
  } else {
    const nextReset = new Date(now);
    nextReset.setMonth(nextReset.getMonth() + 1);
    return nextReset.toISOString();
  }
}

/**
 * Migrate old schema (no grants) to new schema
 */
export function migrateToGrantsSchema(
  oldUsage: { used: number; total: number; resetDate: string; planId: string | null }
): DreamUsageWithGrants {
  console.log('🔄 Migrating old schema to grants-based schema');
  console.log('   Old usage:', oldUsage);

  const remaining = Math.max(0, oldUsage.total - oldUsage.used);

  // Create a single grant for remaining dreams
  const grants: DreamGrant[] = remaining > 0 ? [{
    amount: remaining,
    grantedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + EXPIRY_DAYS * MS_PER_DAY).toISOString(),
    remaining: remaining,
    source: 'migration'
  }] : [];

  // Determine next reset date
  let nextResetDate: string;
  if (oldUsage.resetDate) {
    nextResetDate = oldUsage.resetDate;
  } else {
    // Default to 7 days from now
    nextResetDate = calculateNextResetDate('weekly');
  }

  const newUsage: DreamUsageWithGrants = {
    used: oldUsage.used,
    total: remaining,
    planId: oldUsage.planId,
    grants,
    lastGrantDate: new Date().toISOString(),
    nextResetDate,
  };

  console.log('✅ Migration complete. New usage:', newUsage);
  return newUsage;
}

/**
 * Process subscription renewal - grant dreams if it's time
 */
export function processRenewal(
  usage: DreamUsageWithGrants,
  dreamCount: number,
  period: 'weekly' | 'monthly'
): DreamUsageWithGrants {
  // Check if it's time to grant new dreams
  if (!shouldGrantNewDreams(usage.nextResetDate)) {
    console.log('⏳ Not time for renewal yet');
    return usage;
  }

  console.log('🎁 Renewal time! Granting new dreams...');

  // Grant new dreams
  const newGrants = grantDreams(usage.grants, dreamCount, 'subscription');
  const newTotal = calculateTotal(newGrants);

  // Calculate next reset date
  const nextResetDate = calculateNextResetDate(period);

  return {
    ...usage,
    grants: newGrants,
    total: newTotal,
    lastGrantDate: new Date().toISOString(),
    nextResetDate,
  };
}

/**
 * Get summary of all grants for debugging
 */
export function getGrantsSummary(grants: DreamGrant[]): string {
  const cleaned = cleanExpiredGrants(grants);
  const total = calculateTotal(cleaned);

  const lines = [
    `📊 Dream Bank Summary:`,
    `   Total: ${total}/${MAX_DREAMS} dreams`,
    `   Grants: ${cleaned.length}`,
  ];

  cleaned.forEach((grant, i) => {
    const grantedDate = new Date(grant.grantedAt).toLocaleDateString();
    const expiresDate = new Date(grant.expiresAt).toLocaleDateString();
    lines.push(`   ${i + 1}. ${grant.remaining}/${grant.amount} from ${grant.source} (granted ${grantedDate}, expires ${expiresDate})`);
  });

  return lines.join('\n');
}
