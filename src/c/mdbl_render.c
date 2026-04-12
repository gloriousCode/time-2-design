#include "mdbl.h"

#include <stdlib.h>

void release_render_resources(void) {
  // No persistent render resources currently allocated.
}

static void draw_thick_line(GContext *ctx, GPoint start, GPoint end, uint8_t stroke, GColor colour) {
  graphics_context_set_stroke_color(ctx, colour);
  graphics_context_set_stroke_width(ctx, stroke);
  graphics_draw_line(ctx, start, end);
}

static bool point_in_bounds(GPoint point, GRect bounds) {
  return point.x >= bounds.origin.x &&
         point.y >= bounds.origin.y &&
         point.x < bounds.origin.x + bounds.size.w &&
         point.y < bounds.origin.y + bounds.size.h;
}

static BoundaryEdge detect_edge(GPoint point, GRect bounds) {
  const int16_t top = bounds.origin.y;
  const int16_t right = bounds.origin.x + bounds.size.w - 1;
  const int16_t bottom = bounds.origin.y + bounds.size.h - 1;

  if (point.y <= top) {
    return EDGE_TOP;
  }
  if (point.x >= right) {
    return EDGE_RIGHT;
  }
  if (point.y >= bottom) {
    return EDGE_BOTTOM;
  }
  return EDGE_LEFT;
}

static GPoint edge_terminal_corner(BoundaryEdge edge, GRect bounds) {
  const int16_t left = bounds.origin.x;
  const int16_t top = bounds.origin.y;
  const int16_t right = bounds.origin.x + bounds.size.w - 1;
  const int16_t bottom = bounds.origin.y + bounds.size.h - 1;

  switch (edge) {
    case EDGE_TOP:
      return GPoint(right, top);
    case EDGE_RIGHT:
      return GPoint(right, bottom);
    case EDGE_BOTTOM:
      return GPoint(left, bottom);
    case EDGE_LEFT:
    default:
      return GPoint(left, top);
  }
}

static GPoint ray_hit_bounds(GPoint centre, int32_t angle, GRect bounds, BoundaryEdge *edge) {
  const int16_t max_dim = bounds.size.w > bounds.size.h ? bounds.size.w : bounds.size.h;
  const GPoint far = point_on_ray(centre, max_dim * 4, angle);

  int16_t x0 = centre.x;
  int16_t y0 = centre.y;
  const int16_t x1 = far.x;
  const int16_t y1 = far.y;

  int16_t dx = (int16_t)abs(x1 - x0);
  int16_t sx = x0 < x1 ? 1 : -1;
  int16_t dy = (int16_t)-abs(y1 - y0);
  int16_t sy = y0 < y1 ? 1 : -1;
  int16_t err = dx + dy;

  GPoint last_in = centre;
  while (true) {
    const GPoint current = GPoint(x0, y0);
    if (point_in_bounds(current, bounds)) {
      last_in = current;
    } else {
      break;
    }

    if (x0 == x1 && y0 == y1) {
      break;
    }

    const int16_t e2 = (int16_t)(2 * err);
    if (e2 >= dy) {
      err = (int16_t)(err + dy);
      x0 = (int16_t)(x0 + sx);
    }
    if (e2 <= dx) {
      err = (int16_t)(err + dx);
      y0 = (int16_t)(y0 + sy);
    }
  }

  if (edge) {
    *edge = detect_edge(last_in, bounds);
  }
  return last_in;
}

static void fill_sector_polygon(GContext *ctx, GRect bounds, GPoint centre, int32_t start_angle, int32_t end_angle, GColor colour) {
  BoundaryEdge start_edge = EDGE_TOP;
  BoundaryEdge end_edge = EDGE_TOP;
  const GPoint start_point = ray_hit_bounds(centre, normalise_angle(start_angle), bounds, &start_edge);
  const GPoint end_point = ray_hit_bounds(centre, normalise_angle(end_angle), bounds, &end_edge);

  GPoint points[7];
  uint32_t count = 0;
  points[count++] = centre;
  points[count++] = start_point;

  BoundaryEdge edge = start_edge;
  while (edge != end_edge && count < 6) {
    points[count++] = edge_terminal_corner(edge, bounds);
    edge = (BoundaryEdge)((edge + 1) % 4);
  }
  points[count++] = end_point;

  GPathInfo info = {
    .num_points = count,
    .points = points
  };
  GPath *path = gpath_create(&info);
  if (!path) {
    return;
  }

  graphics_context_set_fill_color(ctx, colour);
  gpath_draw_filled(ctx, path);
  gpath_destroy(path);
}

static void draw_sector_seams(GContext *ctx, GPoint centre, int32_t radius, int32_t hour, int32_t minute) {
  const GPoint hour_edge = point_on_ray(centre, radius, hour);
  const GPoint minute_edge = point_on_ray(centre, radius, minute);

  draw_thick_line(ctx, centre, hour_edge, SECTOR_STROKE + 1, s_state.hour_colour);
  draw_thick_line(ctx, centre, minute_edge, SECTOR_STROKE + 1, s_state.minute_colour);
}

static void draw_hands(GContext *ctx, GPoint centre, int16_t min_dimension, int32_t hour, int32_t minute) {
  const int16_t hour_length = (int16_t)(min_dimension * 23 / 100);
  const int16_t minute_length = (int16_t)(min_dimension * 34 / 100);
  const GPoint hour_end = point_on_ray(centre, hour_length, hour);
  const GPoint minute_end = point_on_ray(centre, minute_length, minute);
  const uint8_t outline_width = HOUR_HAND_STROKE + 2;
  const uint8_t minute_outline_width = MINUTE_HAND_STROKE + 2;

  draw_thick_line(ctx, centre, hour_end, outline_width, GColorBlack);
  draw_thick_line(ctx, centre, minute_end, minute_outline_width, GColorBlack);
  draw_thick_line(ctx, centre, hour_end, HOUR_HAND_STROKE, s_state.hour_hand_colour);
  draw_thick_line(ctx, centre, minute_end, MINUTE_HAND_STROKE, s_state.minute_hand_colour);

  graphics_context_set_fill_color(ctx, GColorBlack);
  graphics_fill_circle(ctx, centre, 6);
  graphics_context_set_fill_color(ctx, s_state.minute_hand_colour);
  graphics_fill_circle(ctx, centre, 4);
}

static void draw_digital(GContext *ctx, GRect bounds) {
  static char time_text[5];
  strftime(time_text, sizeof(time_text), "%H%M", &s_state.now);

  const int16_t tile_width = bounds.size.w * 19 / 100;
  const int16_t tile_height = bounds.size.h * 16 / 100;
  const int16_t gap = bounds.size.w * 15 / 1000;
  const int16_t total_width = (tile_width * 4) + (gap * 3);
  const int16_t left = (bounds.size.w - total_width) / 2;
  const int16_t top = bounds.size.h * 11 / 100;
  GFont font = fonts_get_system_font(FONT_KEY_BITHAM_30_BLACK);

  for (int i = 0; i < 4; i++) {
    const GRect tile = GRect(left + (i * (tile_width + gap)), top, tile_width, tile_height);
    const GColor digit_colour = i < 2 ? s_state.hour_colour : s_state.minute_colour;
    char text[2] = {time_text[i], '\0'};

    graphics_context_set_fill_color(ctx, GColorBlack);
    graphics_fill_rect(ctx, tile, 4, GCornersAll);
    graphics_context_set_fill_color(ctx, GColorWhite);
    graphics_fill_rect(ctx, grect_inset(tile, GEdgeInsets(1)), 3, GCornersAll);

    graphics_context_set_text_color(ctx, digit_colour);
    graphics_draw_text(ctx, text, font, tile, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
  }
}

static void draw_large_digital(GContext *ctx, GRect bounds) {
  char hh[3];
  char mm[3];
  strftime(hh, sizeof(hh), "%H", &s_state.now);
  strftime(mm, sizeof(mm), "%M", &s_state.now);

  const GRect top_text = GRect(0, bounds.size.h * 3 / 100, bounds.size.w, bounds.size.h * 45 / 100);
  const GRect bottom_text = GRect(0, bounds.size.h * 52 / 100, bounds.size.w, bounds.size.h * 45 / 100);
  GFont smooth_font = s_large_digital_font ? s_large_digital_font : fonts_get_system_font(FONT_KEY_BITHAM_42_BOLD);

  graphics_context_set_text_color(ctx, s_state.hour_colour);
  graphics_draw_text(ctx, hh, smooth_font, top_text, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);

  graphics_context_set_text_color(ctx, s_state.minute_colour);
  graphics_draw_text(ctx, mm, smooth_font, bottom_text, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
}

static void draw_tile_text(GContext *ctx, GRect tile, const char *text, GFont font, GColor text_colour) {
  (void)text_colour;
  graphics_context_set_fill_color(ctx, s_state.complication_border_colour);
  graphics_fill_rect(ctx, tile, 5, GCornersAll);
  graphics_context_set_fill_color(ctx, s_state.complication_bg_colour);
  graphics_fill_rect(ctx, grect_inset(tile, GEdgeInsets(1)), 4, GCornersAll);
  graphics_context_set_text_color(ctx, s_state.complication_text_colour);
  graphics_draw_text(ctx, text, font, tile, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
}

static void draw_day_date_tiles(GContext *ctx, GRect bounds) {
  static const char *days[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
  char date[3];
  strftime(date, sizeof(date), "%d", &s_state.now);
  const char *day = days[s_state.now.tm_wday];
  const int16_t tile_w = bounds.size.w * 135 / 1000;
  const int16_t date_tile_h = s_date_font_height + 8;
  const int16_t day_tile_h = s_day_font_height + 8;
  const int16_t gap = bounds.size.w * 2 / 100;
  const int16_t row_gap = bounds.size.w * 2 / 100;
  const int16_t total_h = date_tile_h + row_gap + day_tile_h;
  const int16_t top_y = (bounds.size.h * 78 / 100) - (total_h / 2);
  const int16_t top_total = (tile_w * 2) + gap;
  const int16_t top_left = (bounds.size.w - top_total) / 2;

  char d0[2] = {date[0], '\0'};
  char d1[2] = {date[1], '\0'};
  draw_tile_text(ctx, GRect(top_left, top_y, tile_w, date_tile_h), d0, s_date_font, s_state.minute_colour);
  draw_tile_text(ctx, GRect(top_left + tile_w + gap, top_y, tile_w, date_tile_h), d1, s_date_font, s_state.minute_colour);

  const int16_t bottom_y = top_y + date_tile_h + row_gap;
  const int16_t bottom_total = (tile_w * 3) + (gap * 2);
  const int16_t bottom_left = (bounds.size.w - bottom_total) / 2;
  char c0[2] = {day[0], '\0'};
  char c1[2] = {day[1], '\0'};
  char c2[2] = {day[2], '\0'};
  draw_tile_text(ctx, GRect(bottom_left, bottom_y, tile_w, day_tile_h), c0, s_day_font, s_state.minute_colour);
  draw_tile_text(ctx, GRect(bottom_left + tile_w + gap, bottom_y, tile_w, day_tile_h), c1, s_day_font, s_state.minute_colour);
  draw_tile_text(ctx, GRect(bottom_left + (tile_w + gap) * 2, bottom_y, tile_w, day_tile_h), c2, s_day_font, s_state.minute_colour);
}

static int16_t clamp_i16(int16_t value, int16_t lower, int16_t upper) {
  if (value < lower) {
    return lower;
  }
  if (value > upper) {
    return upper;
  }
  return value;
}

static void draw_date_complication(GContext *ctx, GRect bounds, GPoint centre, int16_t min_dimension) {
  char date[3];
  strftime(date, sizeof(date), "%d", &s_state.now);

  const int16_t side = (int16_t)(min_dimension * 17 / 100);
  const int16_t comp_centre_x = centre.x + (int16_t)(min_dimension * 28 / 100);
  const int16_t x = clamp_i16((int16_t)(comp_centre_x - (side / 2)), 2, (int16_t)(bounds.size.w - side - 2));
  const int16_t y = clamp_i16((int16_t)(centre.y - (side / 2)), 2, (int16_t)(bounds.size.h - side - 2));
  const GRect tile = GRect(x, y, side, side);
  const uint16_t radius = (uint16_t)(side / 4);

  graphics_context_set_fill_color(ctx, s_state.complication_bg_colour);
  graphics_fill_rect(ctx, tile, radius, GCornersAll);

  graphics_context_set_stroke_color(ctx, s_state.complication_border_colour);
  graphics_context_set_stroke_width(ctx, 2);
  graphics_draw_round_rect(ctx, tile, radius);

  GFont font = fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD);
  const GRect text_bounds = grect_inset(tile, GEdgeInsets(2));
  const GSize text_size = graphics_text_layout_get_content_size(
    date,
    font,
    text_bounds,
    GTextOverflowModeWordWrap,
    GTextAlignmentCenter
  );
  const int16_t text_y = text_bounds.origin.y + ((text_bounds.size.h - text_size.h) / 2);
  const GRect text_rect = GRect(text_bounds.origin.x, text_y, text_bounds.size.w, text_size.h);

  graphics_context_set_text_color(ctx, s_state.complication_text_colour);
  graphics_draw_text(ctx, date, font, text_rect, GTextOverflowModeWordWrap, GTextAlignmentCenter, NULL);
}

void update_canvas(Layer *layer, GContext *ctx) {
  const GRect bounds = layer_get_bounds(layer);
  const GRect paint_bounds = GRect(bounds.origin.x - 1, bounds.origin.y - 1, bounds.size.w + 2, bounds.size.h + 2);

  if (!s_state.cache_ready || !bounds_equal(bounds, s_state.cached_bounds)) {
    rebuild_geometry_cache(bounds);
  }

  const GPoint centre = s_state.cached_centre;
  const int16_t radius = s_state.cached_radius;
  const int32_t hour = hour_angle(&s_state.now);
  const int32_t minute = minute_angle(&s_state.now);
  const int32_t split = opposite_split_angle(hour, minute);
  const bool draw_date_tiles = s_state.show_date_tiles && s_state.mode != FACE_MODE_LARGE_DIGITAL;
  SectorRay rays[3] = {
    {.angle = hour, .colour = s_state.hour_colour},
    {.angle = minute, .colour = s_state.minute_colour},
    {.angle = split, .colour = s_state.bg_colour}
  };
  sort_rays(rays, ARRAY_LENGTH(rays));

  graphics_context_set_fill_color(ctx, s_state.bg_colour);
  graphics_fill_rect(ctx, paint_bounds, 0, GCornerNone);

  for (size_t i = 0; i < ARRAY_LENGTH(rays); i++) {
    const SectorRay current = rays[i];
    const SectorRay next = rays[(i + 1) % ARRAY_LENGTH(rays)];
    fill_sector_polygon(ctx, paint_bounds, centre, current.angle, next.angle, current.colour);
  }
  draw_sector_seams(ctx, centre, radius, hour, minute);

  if (s_state.mode == FACE_MODE_DIGITAL) {
    draw_digital(ctx, bounds);
  } else if (s_state.mode == FACE_MODE_LARGE_DIGITAL) {
    draw_large_digital(ctx, bounds);
  }

  if (draw_date_tiles) {
    draw_day_date_tiles(ctx, bounds);
  }

  if (s_state.show_date_complication && s_state.mode != FACE_MODE_LARGE_DIGITAL) {
    draw_date_complication(ctx, bounds, centre, s_state.cached_min_dimension);
  }

  if (s_state.mode == FACE_MODE_HANDS && s_state.show_hands) {
    draw_hands(ctx, centre, s_state.cached_min_dimension, hour, minute);
  }
}
