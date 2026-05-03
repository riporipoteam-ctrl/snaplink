import React from 'react';

interface VerificationBadgeProps {
  className?: string;
  title?: string;
}

export function VerificationBadge({ className = "w-5 h-5", title = "Verified" }: VerificationBadgeProps) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      aria-label={title}
      role="img" 
      className={`${className} min-h-[16px] min-w-[16px] cursor-pointer`}
      title={title}
    >
      <title>{title}</title>
      <g>
        <path 
          fill="#1d9bf0" 
          d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.918-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.337 2.25c-.416-.165-.866-.25-1.336-.25-2.21 0-3.918 1.79-3.918 4 0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.46.74 2.746 1.867 3.45-.06.31-.09.63-.09.95 0 2.21 1.71 4 3.918 4 .527 0 1.03-.1 1.49-.277.592 1.22 1.83 2.077 3.317 2.077 1.487 0 2.725-.857 3.317-2.077.46.177.963.277 1.49.277 2.21 0 3.918-1.79 3.918-4 0-.32-.03-.64-.09-.95 1.127-.704 1.867-1.99 1.867-3.45z" 
        />
        <path 
          fill="#FFFFFF" 
          d="M9.64 16.36l-3.18-3.18 1.41-1.42 1.77 1.77 5.66-5.66 1.41 1.42-7.07 7.07z" 
        />
      </g>
    </svg>
  );
}

// Custom badge component for user-created badges
interface CustomBadgeProps {
  key?: React.Key;
  imageURL: string;
  name: string;
  className?: string;
}

export function CustomBadge({ imageURL, name, className = "w-5 h-5" }: CustomBadgeProps) {
  return (
    <img
      src={imageURL}
      alt={name}
      title={name}
      className={`${className} min-h-[16px] min-w-[16px] rounded-full cursor-pointer inline-block`}
      style={{ objectFit: 'cover' }}
    />
  );
}

// Component to render all user badges (filters out hidden ones)
interface UserBadgesProps {
  badges?: { id: string; name: string; imageURL: string; assignedAt: string }[];
  hiddenBadges?: string[];
  className?: string;
  badgeSize?: string;
}

export function UserBadges({ badges, hiddenBadges, className = "", badgeSize = "w-[18px] h-[18px]" }: UserBadgesProps) {
  if (!badges || badges.length === 0) return null;

  const visibleBadges = hiddenBadges?.length
    ? badges.filter(b => !hiddenBadges.includes(b.id))
    : badges;

  if (visibleBadges.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-0.5 ml-0.5 ${className}`}>
      {visibleBadges.map(badge => (
        <CustomBadge
          key={badge.id}
          imageURL={badge.imageURL}
          name={badge.name}
          className={badgeSize}
        />
      ))}
    </span>
  );
}

// Premium badge (gold star)
export function PremiumBadge({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-label="Premium subscriber"
      role="img"
      className={`${className} min-h-[16px] min-w-[16px] cursor-pointer`}
      title="SnapLink Plus"
    >
      <title>SnapLink Plus</title>
      <defs>
        <linearGradient id="premium-badge-gradient" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A" />
          <stop offset="0.48" stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <path
        fill="url(#premium-badge-gradient)"
        d="M12 1.75l2.08 2.52 3.19-.28 1.46 2.84 3.03 1.09-.3 3.18 2.04 2.47-2.04 2.47.3 3.18-3.03 1.09-1.46 2.84-3.19-.28L12 25.25l-2.08-2.52-3.19.28-1.46-2.84-3.03-1.09.3-3.18L.5 13.57l2.04-2.47-.3-3.18 3.03-1.09 1.46-2.84 3.19.28L12 1.75z"
      />
      <path
        fill="#FFF7ED"
        d="M12 6.35l1.52 3.12 3.44.5-2.48 2.42.58 3.4L12 14.2l-3.06 1.59.58-3.4-2.48-2.42 3.44-.5L12 6.35z"
      />
      <circle cx="18.6" cy="7.1" r="1.1" fill="#FFF7ED" opacity="0.9" />
    </svg>
  );
}
