import { PhosphorIcon } from "./phosphor-icon";

type RatingProps = {
  rating: number; // 0-5
  count?: number;
  size?: "sm" | "md";
};

/** แสดงดาว 5 ดวง + จำนวนรีวิว ตาม meb components.md */
export function Rating({ rating, count, size = "sm" }: RatingProps) {
  const starSize = size === "sm" ? "text-xs" : "text-sm";
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;

  return (
    <div className="flex items-center gap-1">
      <div className={`flex items-center ${starSize}`}>
        {Array.from({ length: 5 }).map((_, i) => {
          if (i < full) {
            return (
              <PhosphorIcon
                key={i}
                name="star-fill"
                weight="fill"
                className="text-star-full"
              />
            );
          }
          if (i === full && hasHalf) {
            return (
              <PhosphorIcon
                key={i}
                name="star-half"
                weight="fill"
                className="text-star-full"
              />
            );
          }
          return (
            <PhosphorIcon
              key={i}
              name="star"
              className="text-star-empty"
            />
          );
        })}
      </div>
      {count !== undefined && (
        <span className="text-[10px] text-slate-400">({count})</span>
      )}
    </div>
  );
}