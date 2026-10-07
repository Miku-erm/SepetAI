import { useId } from "react";
export function LaptopArt({
  color = "sage",
  hero = false,
}: {
  color?: string;
  hero?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const colors: Record<string, string[]> = {
    sage: ["#adc6b4", "#427b68", "#d5e5c8"],
    sand: ["#d9ba95", "#a46f43", "#f1dcc1"],
    slate: ["#a9b6c9", "#506383", "#d9dfeb"],
    lavender: ["#b9b0d5", "#706291", "#e8e0f4"],
  };
  const [light, dark, accent] = colors[color] ?? colors.sage;
  return (
    <svg
      viewBox="0 0 440 275"
      className={hero ? "laptop-art hero-laptop" : "laptop-art"}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`screen${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={dark} />
          <stop offset="1" stopColor={light} />
        </linearGradient>
        <linearGradient id={`body${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#e0e3df" />
          <stop offset="1" stopColor="#9da7a0" />
        </linearGradient>
        <filter id={`shadow${id}`}>
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <ellipse
        cx="222"
        cy="240"
        rx="150"
        ry="11"
        fill="#244c36"
        opacity=".13"
        filter={`url(#shadow${id})`}
      />
      <g transform="rotate(-4 220 135)">
        <rect x="75" y="30" width="288" height="181" rx="10" fill="#3c4542" />
        <rect
          x="83"
          y="39"
          width="272"
          height="162"
          rx="4"
          fill={`url(#screen${id})`}
        />
        <circle cx="219" cy="34" r="1.5" fill="#8c9f91" />
        <path
          d="M84 162 C144 75 170 231 245 104 S310 38 355 77 L355 201 L84 201Z"
          fill={accent}
          opacity=".65"
        />
        <path
          d="M84 192 C120 127 193 234 231 153 S309 78 355 119 L355 201 L84 201Z"
          fill={light}
          opacity=".82"
        />
        <path
          d="M75 211 L363 211 L411 237 Q412 245 397 246 L36 246 Q23 245 27 237Z"
          fill={`url(#body${id})`}
        />
        <path
          d="M89 214 L349 214 L371 229 L62 229Z"
          fill="#88938d"
          opacity=".55"
        />
        {Array.from({ length: 4 }, (_, row) => (
          <path
            key={row}
            d={`M${85 - row * 5} ${216 + row * 3} H${351 + row * 4}`}
            stroke="#d5dcd6"
            strokeWidth="1"
          />
        ))}
        <path
          d="M173 232 H265 L273 240 H164Z"
          fill="#b0b9b1"
          stroke="#97a59b"
          strokeWidth=".7"
        />
        <path
          d="M29 241 Q31 246 42 246 H395 Q408 246 409 241"
          fill="none"
          stroke="#738079"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}
