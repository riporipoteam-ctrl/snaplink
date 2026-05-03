import { collection, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import type { UserProfile } from '../contexts/AuthContext';
import { db } from './firebase';

export const BUSINESS_AFFILIATION_LIMIT = 5;

export interface BusinessAffiliation {
  businessUid: string;
  businessName: string;
  businessUsername?: string;
  badgeLabel: string;
  acceptedAt: string;
}

export interface BusinessAffiliationInvite {
  id: string;
  businessUid: string;
  businessName: string;
  businessUsername?: string;
  badgeLabel: string;
  targetUserId: string;
  targetDisplayName: string;
  targetUsername?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  respondedAt?: string | null;
}

export interface SponsoredAd {
  id: string;
  businessUid: string;
  businessName: string;
  businessUsername?: string;
  businessPhotoURL?: string | null;
  title: string;
  description: string;
  linkUrl: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  mediaStoragePath?: string | null;
  createdAt: string;
  updatedAt?: string;
  isActive: boolean;
}

export function isBusinessUser(profile?: Pick<UserProfile, 'isBusinessAccount'> | null) {
  return Boolean(profile?.isBusinessAccount);
}

export function getBusinessBadgeLabel(profile?: Pick<UserProfile, 'businessBadgeLabel'> | null) {
  const label = profile?.businessBadgeLabel?.trim();
  return label || 'Affiliated';
}

export function getPrimaryBusinessAffiliation(profile?: Pick<UserProfile, 'businessAffiliations'> | null) {
  return profile?.businessAffiliations?.[0] || null;
}

export function getAffiliationCount(invites: BusinessAffiliationInvite[]) {
  return invites.filter((invite) => invite.status === 'pending' || invite.status === 'accepted').length;
}

export function subscribeToIncomingBusinessInvites(
  targetUserId: string,
  callback: (invites: BusinessAffiliationInvite[]) => void
) {
  return onSnapshot(
    query(
      collection(db, 'notifications'),
      where('targetUserId', '==', targetUserId)
    ),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((inviteDoc) => ({ id: inviteDoc.id, ...inviteDoc.data() } as any))
          .filter((notification) => notification.type === 'business_affiliation')
          .map((notification) => ({
            id: notification.id,
            businessUid: notification.businessUid,
            businessName: notification.businessName,
            businessUsername: notification.businessUsername,
            badgeLabel: notification.badgeLabel,
            targetUserId: notification.targetUserId,
            targetDisplayName: notification.targetDisplayName,
            targetUsername: notification.targetUsername,
            status: notification.inviteStatus || 'pending',
            createdAt: notification.createdAt,
            respondedAt: notification.respondedAt || null,
          }) as BusinessAffiliationInvite)
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      );
    }
  );
}

export function subscribeToAffiliatedProfiles(
  businessUid: string,
  callback: (profiles: UserProfile[]) => void
) {
  return onSnapshot(
    collection(db, 'users'),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((userDoc) => userDoc.data() as UserProfile)
          .filter((profile) => (profile.businessAffiliations || []).some((entry) => entry.businessUid === businessUid))
      );
    }
  );
}

export function subscribeToBusinessAds(
  businessUid: string,
  callback: (ads: SponsoredAd[]) => void
) {
  return onSnapshot(
    query(collection(db, 'posts'), where('authorId', '==', businessUid)),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((adDoc) => ({ id: adDoc.id, ...adDoc.data() } as any))
          .filter((post) => post.isSponsored)
          .map((post) => mapSponsoredPostToAd(post))
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      );
    }
  );
}

export function subscribeToActiveAds(callback: (ads: SponsoredAd[]) => void) {
  return onSnapshot(
    query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(80)),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((postDoc) => ({ id: postDoc.id, ...postDoc.data() } as any))
          .filter((post) => post.isSponsored && post.sponsoredActive !== false)
          .map((post) => mapSponsoredPostToAd(post))
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      );
    }
  );
}

export async function fetchBusinessInvitesForTarget(targetUserId: string) {
  const snapshot = await getDocs(
    query(
      collection(db, 'notifications'),
      where('targetUserId', '==', targetUserId)
    )
  );

  return snapshot.docs
    .map((inviteDoc) => ({ id: inviteDoc.id, ...inviteDoc.data() } as any))
    .filter((notification) => notification.type === 'business_affiliation')
    .map((notification) => ({
      id: notification.id,
      businessUid: notification.businessUid,
      businessName: notification.businessName,
      businessUsername: notification.businessUsername,
      badgeLabel: notification.badgeLabel,
      targetUserId: notification.targetUserId,
      targetDisplayName: notification.targetDisplayName,
      targetUsername: notification.targetUsername,
      status: notification.inviteStatus || 'pending',
      createdAt: notification.createdAt,
      respondedAt: notification.respondedAt || null,
    }) as BusinessAffiliationInvite)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function mapSponsoredPostToAd(post: any): SponsoredAd {
  const media = Array.isArray(post.media) ? post.media[0] : null;
  return {
    id: post.id,
    businessUid: post.authorId,
    businessName: post.authorName || 'Business account',
    businessUsername: post.authorUsername,
    businessPhotoURL: post.authorPhotoURL || null,
    title: post.sponsoredTitle || post.authorName || 'Sponsored post',
    description: post.content || '',
    linkUrl: post.linkUrl || '#',
    mediaUrl: media?.url || post.mediaURLs?.[0] || null,
    mediaType: media?.type || post.mediaTypes?.[0] || null,
    mediaStoragePath: media?.storagePath || null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt || post.createdAt,
    isActive: post.sponsoredActive !== false,
  };
}
