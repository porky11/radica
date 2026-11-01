// Web-of-Trust (WoT) Dislike & Reputation Engine for Radica.
//
// In decentralized, censorship-resistant networks like Freenet, anonymous accounts can be spawned at zero cost (Sybil attacks).
// A flat 1-account = 1-vote downvote system is vulnerable to brigading and coordinated trolling.
//
// Radica's Web-of-Trust evaluates reactions subjectively through the reader's own social graph:
// - Tier 1 (Direct Trust / "Roots"): People the reader follows directly, plus the reader's trusted curators.
// - Tier 2 (Extended Trust): People followed by Tier 1 peers (friends of friends).
// - Outsiders (Tier 0): Unknown personas outside the reader's network. Their dislikes carry zero penalty weight.
//
// Furthermore, community creators and moderators act as Tier 1 authorities within their respective community posts.

export interface PostReactionEvaluation {
  wotScore: number;
  trustedLikers: string[];
  trustedDislikers: string[];
  isPenalized: boolean;
  penaltyReason: string | null;
}

export interface TrustBadgeInfo {
  tier: 0 | 1 | 2;
  isTrusted: boolean;
  label: string;
  badgeClass: string;
  icon: string;
  description: string;
}

export class WebOfTrust {
  public readonly me: string;
  public readonly tier1: Set<string>;
  public readonly tier2: Set<string>;

  constructor(
    me: string,
    directFollowing: string[],
    trustedCurators: string[] = [],
    followingOf: (pubkey: string) => string[] = () => []
  ) {
    this.me = me;
    this.tier1 = new Set([me, ...directFollowing, ...trustedCurators]);

    // Build Tier 2 from connections of Tier 1 members
    this.tier2 = new Set<string>();
    for (const pk of this.tier1) {
      if (pk === me) continue;
      const peers = followingOf(pk) || [];
      for (const p of peers) {
        if (!this.tier1.has(p)) {
          this.tier2.add(p);
        }
      }
    }
  }

  public trustTier(pubkey: string): 0 | 1 | 2 {
    if (this.tier1.has(pubkey)) return 1;
    if (this.tier2.has(pubkey)) return 2;
    return 0;
  }

  public isTrusted(pubkey: string): boolean {
    return this.tier1.has(pubkey) || this.tier2.has(pubkey);
  }

  public trustBadge(pubkey: string): TrustBadgeInfo {
    const tier = this.trustTier(pubkey);
    if (tier === 1) {
      return {
        tier: 1,
        isTrusted: true,
        label: "Rooted",
        badgeClass: "badge-trusted-tier1",
        icon: "🌿",
        description: pubkey === this.me ? "Your profile" : "Direct root connection (Web-of-Trust Tier 1)",
      };
    }
    if (tier === 2) {
      return {
        tier: 2,
        isTrusted: true,
        label: "Trusted",
        badgeClass: "badge-trusted-tier2",
        icon: "🌱",
        description: "Extended Web-of-Trust (Friend of a friend)",
      };
    }
    return {
      tier: 0,
      isTrusted: false,
      label: "New",
      badgeClass: "badge-untrusted",
      icon: "✨",
      description: "Outside your Web-of-Trust (New peer / Pending connection)",
    };
  }

  /**
   * Evaluates a post against this reader's Web-of-Trust.
   *
   * Outsider dislikes have 0 weight and cannot penalize a post.
   * Direct contacts (Tier 1) and Community Moderators have full weight.
   * Extended contacts (Tier 2) have fractional weight.
   */
  public evaluatePost(
    post: { id: string; author: string; community_id?: string },
    likers: string[],
    dislikers: string[],
    communityMods: string[] = []
  ): PostReactionEvaluation {
    const modSet = new Set(communityMods.filter((m) => m !== "system"));

    const trustedLikers: string[] = [];
    const trustedDislikers: string[] = [];

    let positiveScore = 0;
    let negativeScore = 0;

    // Evaluate likes
    for (const liker of likers) {
      const tier = this.trustTier(liker);
      if (tier === 1 || modSet.has(liker)) {
        trustedLikers.push(liker);
        positiveScore += 2;
      } else if (tier === 2) {
        trustedLikers.push(liker);
        positiveScore += 1;
      }
    }

    // Evaluate dislikes
    for (const disliker of dislikers) {
      const tier = this.trustTier(disliker);
      const isMod = modSet.has(disliker);
      if (tier === 1 || isMod) {
        trustedDislikers.push(disliker);
        negativeScore += 3; // Direct trusted contact dislike is a strong signal
      } else if (tier === 2) {
        trustedDislikers.push(disliker);
        negativeScore += 1.5;
      }
      // Tier 0 (outsiders) do not contribute to negativeScore or trustedDislikers
    }

    const wotScore = positiveScore - negativeScore;

    // A post is penalized if trusted negative signals outweigh trusted positive signals
    const isPenalized =
      trustedDislikers.length > 0 &&
      negativeScore > positiveScore;

    let penaltyReason: string | null = null;
    if (isPenalized) {
      penaltyReason =
        trustedDislikers.length === 1
          ? "Disliked by a contact in your Web-of-Trust"
          : `Disliked by ${trustedDislikers.length} contacts in your Web-of-Trust`;
    }

    return {
      wotScore,
      trustedLikers,
      trustedDislikers,
      isPenalized,
      penaltyReason,
    };
  }
}

