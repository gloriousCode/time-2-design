#include "mdbl.h"

int32_t normalise_angle(int32_t angle) {
  int32_t wrapped = angle % TRIG_MAX_ANGLE;
  if (wrapped < 0) {
    wrapped += TRIG_MAX_ANGLE;
  }
  return wrapped;
}

int32_t hour_angle(const struct tm *now) {
  const int32_t hour12 = now->tm_hour % 12;
  const int32_t minute_progress = (int32_t)(((int64_t)now->tm_min * TRIG_MAX_ANGLE) / (12 * 60));
  return normalise_angle((int32_t)((hour12 * TRIG_MAX_ANGLE) / 12) + minute_progress);
}

int32_t minute_angle(const struct tm *now) {
  return normalise_angle((int32_t)(((int64_t)now->tm_min * TRIG_MAX_ANGLE) / 60));
}

int32_t opposite_split_angle(int32_t hour, int32_t minute) {
  int32_t delta = normalise_angle(minute - hour);
  if (delta > (TRIG_MAX_ANGLE / 2)) {
    delta -= TRIG_MAX_ANGLE;
  }

  const int32_t midpoint = normalise_angle(hour + (delta / 2));
  return normalise_angle(midpoint + (TRIG_MAX_ANGLE / 2));
}

GPoint point_on_ray(GPoint centre, int32_t radius, int32_t angle) {
  return GPoint(
    centre.x + (int16_t)(sin_lookup(angle) * radius / TRIG_MAX_RATIO),
    centre.y - (int16_t)(cos_lookup(angle) * radius / TRIG_MAX_RATIO)
  );
}

bool bounds_equal(GRect a, GRect b) {
  return a.origin.x == b.origin.x &&
         a.origin.y == b.origin.y &&
         a.size.w == b.size.w &&
         a.size.h == b.size.h;
}

static int16_t isqrt16(int32_t value) {
  if (value <= 0) {
    return 0;
  }

  int32_t x = value;
  int32_t y = (x + 1) / 2;
  while (y < x) {
    x = y;
    y = (x + (value / x)) / 2;
  }

  return (int16_t)x;
}

void rebuild_geometry_cache(GRect bounds) {
  s_state.cached_bounds = bounds;
  s_state.cached_centre = GPoint(bounds.size.w / 2, bounds.size.h / 2);
  s_state.cached_min_dimension = bounds.size.w < bounds.size.h ? bounds.size.w : bounds.size.h;
  const int16_t half_w = bounds.size.w / 2;
  const int16_t half_h = bounds.size.h / 2;
  const int32_t corner_distance_sq = (int32_t)(half_w * half_w) + (int32_t)(half_h * half_h);
  s_state.cached_radius = (int16_t)(isqrt16(corner_distance_sq) + 4);
  s_state.cache_ready = true;
}

void sort_rays(SectorRay *rays, size_t count) {
  for (size_t i = 0; i < count; i++) {
    for (size_t j = i + 1; j < count; j++) {
      if (rays[j].angle < rays[i].angle) {
        const SectorRay swap = rays[i];
        rays[i] = rays[j];
        rays[j] = swap;
      }
    }
  }
}
