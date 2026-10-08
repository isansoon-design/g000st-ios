type IdentityKindIconProps = Readonly<{
  isPage: boolean;
}>;

export function IdentityKindIcon({ isPage }: IdentityKindIconProps) {
  const color = isPage ? "#EF0000" : "#070707";

  return (
    <svg
      viewBox="12 10 136 142"
      role="img"
      aria-label={isPage ? "Secondary page" : "Main profile"}
      className="h-9 w-9 shrink-0"
    >
      <rect x="15" y="11" width="131" height="133" rx="31" fill={color} />
      <path
        d="M116 77C116 100 105 108 91 113C79 117 69 118 66 126L67 130C67 120 92 122 104 109C111 101 116 91 116 77ZM58 131C64 137 79 144 91 136C95 133 97 130 99 128C105 134 101 145 92 148C78 153 62 149 58 131Z"
        fill="#070707"
      />
      <path
        d="M36.4 27.8C36.1 42.4 39.9 52.9 48.3 59.4L49.6 58.8C46.9 71.2 46.7 81.2 52.8 88.6C60.8 102.7 82.2 102.8 97.5 91.3C90.3 99.1 77.9 99.7 67.4 105.6C54.7 112.7 53.3 120.8 58 132.1C64.1 145.8 89.4 148 98.8 130.5C99.2 129.1 100.1 128.4 97.4 127.5C90.9 125.8 94.1 131.7 87.4 135.3C75.6 141.5 63.4 135.6 67 124.3C68.8 117 76.3 115.3 83.4 112.1C96.8 105.5 112.4 94.9 116.2 78.7C116.6 67.3 112.7 63.9 107 64.4L106 59.5L108.4 59.7C116 50.2 120.6 41.7 121 28.8C117 36.6 108.9 41.8 96.8 45.6C86.3 36.3 70.3 36.3 60.8 45C47.8 41.8 39.8 36.7 36.4 27.8Z"
        fill="#FFFFFF"
      />
      <ellipse cx="78" cy="70.6" rx="16" ry="18.6" fill={color} />
      <ellipse cx="72.8" cy="68.2" rx="2.4" ry="3.7" fill="#FFFFFF" />
      <ellipse cx="84.2" cy="68.2" rx="2.4" ry="3.7" fill="#FFFFFF" />
    </svg>
  );
}
