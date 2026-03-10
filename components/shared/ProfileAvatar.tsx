import React from 'react';
import type { AvatarPreset } from '../../shared/avatarPresets';

interface Props {
  preset: AvatarPreset;
  alt: string;
  className?: string;
}

const ProfileAvatar: React.FC<Props> = ({ preset, alt, className = '' }) => {
  return (
    <svg viewBox="0 0 96 96" role="img" aria-label={alt} className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>{alt}</title>

      {preset === 'baobab' && (
        <>
          <rect width="96" height="96" rx="48" fill="#E7F1E6" />
          <circle cx="21" cy="23" r="11" fill="#8EBB8F" />
          <circle cx="74" cy="20" r="9" fill="#C9DFC1" />
          <circle cx="78" cy="72" r="12" fill="#B2D4B1" />
          <path d="M18 84C22 67 33 58 48 58C63 58 74 67 78 84H18Z" fill="#0F2B46" />
          <ellipse cx="48" cy="37" rx="18" ry="20" fill="#C78A5C" />
          <path d="M30 39C30 25 38 17 48 17C58 17 66 25 66 39V41H30V39Z" fill="#4C7C59" />
          <circle cx="41" cy="39" r="2" fill="#3F2A1F" />
          <circle cx="55" cy="39" r="2" fill="#3F2A1F" />
          <path d="M42 47C44 49 46 50 48 50C50 50 52 49 54 47" stroke="#7A4E34" strokeWidth="3" strokeLinecap="round" />
          <path d="M39 60L48 67L57 60" stroke="#8FC5A0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {preset === 'sunrise' && (
        <>
          <rect width="96" height="96" rx="48" fill="#FDE6CB" />
          <circle cx="24" cy="26" r="13" fill="#F5B664" />
          <circle cx="73" cy="24" r="8" fill="#F8D08A" />
          <path d="M14 76C25 67 37 63 48 63C59 63 71 67 82 76V96H14V76Z" fill="#C86B4A" />
          <ellipse cx="48" cy="38" rx="17" ry="19" fill="#B9774E" />
          <path d="M33 39C35 25 41 18 48 18C55 18 61 25 63 39L58 33L48 29L38 33L33 39Z" fill="#5A3521" />
          <circle cx="42" cy="39" r="2" fill="#2F2117" />
          <circle cx="54" cy="39" r="2" fill="#2F2117" />
          <path d="M43 48C44.5 49.5 46.2 50 48 50C49.8 50 51.5 49.5 53 48" stroke="#7A4E34" strokeWidth="3" strokeLinecap="round" />
          <path d="M31 63C35 59 41 57 48 57C55 57 61 59 65 63" stroke="#FFF1D8" strokeWidth="4" strokeLinecap="round" />
        </>
      )}

      {preset === 'lagoon' && (
        <>
          <rect width="96" height="96" rx="48" fill="#DDEFF6" />
          <circle cx="24" cy="22" r="10" fill="#77B8CF" />
          <circle cx="72" cy="26" r="12" fill="#A8D4E2" />
          <path d="M16 82C24 69 35 61 48 61C61 61 72 69 80 82H16Z" fill="#0F2B46" />
          <ellipse cx="48" cy="37" rx="17" ry="19" fill="#B87B53" />
          <path d="M31 36C31 25 38 18 48 18C58 18 65 25 65 36V42H31V36Z" fill="#0F6B8C" />
          <path d="M34 29C39 24 43 22 48 22C53 22 57 24 62 29" stroke="#9ED6E5" strokeWidth="3" strokeLinecap="round" />
          <circle cx="42" cy="39" r="2" fill="#2F2117" />
          <circle cx="54" cy="39" r="2" fill="#2F2117" />
          <path d="M43 48C44.5 49.5 46.2 50 48 50C49.8 50 51.5 49.5 53 48" stroke="#7A4E34" strokeWidth="3" strokeLinecap="round" />
          <path d="M28 69C34 64 41 62 48 62C55 62 62 64 68 69" stroke="#79BFD4" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
};

export default ProfileAvatar;
