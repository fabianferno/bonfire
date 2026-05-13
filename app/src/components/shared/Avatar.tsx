"use client";

interface AvatarProps {
  src?: string;
  name: string;
  size?: number;
  color?: string;
  className?: string;
}

export default function Avatar({ src, name, size = 32, color = "#6e86d6", className = "" }: AvatarProps) {
  const initial = name.charAt(0).toUpperCase();
  const style = { width: size, height: size, minWidth: size, minHeight: size };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      style={{ ...style, background: color }}
      className={`rounded-full flex items-center justify-center text-white font-bold select-none ${className}`}
    >
      <span style={{ fontSize: size * 0.4 }}>{initial}</span>
    </div>
  );
}
