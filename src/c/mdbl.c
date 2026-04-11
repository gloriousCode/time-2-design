#include <pebble.h>

#include "message_keys.auto.h"

#define SECTOR_STROKE 3
#define SECTOR_STEP_ANGLE (TRIG_MAX_ANGLE / 360) /* 1 degree */
#define HOUR_HAND_STROKE 6
#define MINUTE_HAND_STROKE 6

typedef enum FaceMode {
  FACE_MODE_HANDS = 0,
  FACE_MODE_DIGITAL,
  FACE_MODE_LARGE_DIGITAL
} FaceMode;

typedef struct SectorRay {
  int32_t angle;
  GColor colour;
} SectorRay;

typedef enum BoundaryEdge {
  EDGE_TOP = 0,
  EDGE_RIGHT,
  EDGE_BOTTOM,
  EDGE_LEFT
} BoundaryEdge;

typedef struct AppState {
  Window *window;
  Layer *canvas;
  FaceMode mode;
  bool show_date_tiles;
  GColor bg_colour;
  GColor hour_colour;
  GColor minute_colour;
  GColor hand_colour;
  struct tm now;
  GRect cached_bounds;
  GPoint cached_centre;
  int16_t cached_min_dimension;
  int16_t cached_radius;
  bool cache_ready;
} AppState;

static AppState s_state;
static AppTimer *s_redraw_timer;
static GFont s_date_font;
static GFont s_day_font;
static GFont s_large_digital_font;
static int16_t s_date_font_height;
static int16_t s_day_font_height;

static void update_now(void) {
  time_t now_secs = time(NULL);
  struct tm *local = localtime(&now_secs);
  if (local) {
    s_state.now = *local;
  } else {
    memset(&s_state.now, 0, sizeof(s_state.now));
  }
}

static uint8_t snap_channel(uint8_t value) {
  static const uint8_t steps[] = {0, 85, 170, 255};
  uint8_t best = steps[0];
  uint8_t best_distance = (uint8_t)abs((int)value - (int)best);

  for (size_t i = 1; i < ARRAY_LENGTH(steps); i++) {
    const uint8_t distance = (uint8_t)abs((int)value - (int)steps[i]);
    if (distance < best_distance) {
      best_distance = distance;
      best = steps[i];
    }
  }

  return best;
}

static int8_t parse_hex_nibble(char c) {
  if (c >= '0' && c <= '9') {
    return (int8_t)(c - '0');
  }
  if (c >= 'a' && c <= 'f') {
    return (int8_t)(10 + (c - 'a'));
  }
  if (c >= 'A' && c <= 'F') {
    return (int8_t)(10 + (c - 'A'));
  }
  return -1;
}

static bool parse_hex_byte(const char *text, uint8_t *out) {
  if (!text || !out) {
    return false;
  }

  const int8_t hi = parse_hex_nibble(text[0]);
  const int8_t lo = parse_hex_nibble(text[1]);
  if (hi < 0 || lo < 0) {
    return false;
  }

  *out = (uint8_t)((hi << 4) | lo);
  return true;
}

static bool parse_hex_colour(const char *text, GColor fallback, GColor *out) {
  if (!text || !out) {
    return false;
  }

  while (*text == ' ') {
    text++;
  }

  if (*text == '#') {
    text++;
  }

  uint8_t r = 0;
  uint8_t g = 0;
  uint8_t b = 0;
  if (!parse_hex_byte(&text[0], &r) ||
      !parse_hex_byte(&text[2], &g) ||
      !parse_hex_byte(&text[4], &b)) {
    *out = fallback;
    return false;
  }

  *out = GColorFromRGB(
    snap_channel(r),
    snap_channel(g),
    snap_channel(b)
  );
  return true;
}

static FaceMode parse_mode(const char *text) {
  if (!text) {
    return FACE_MODE_HANDS;
  }

  if (strcmp(text, "digital") == 0) {
    return FACE_MODE_DIGITAL;
  }

  if (strcmp(text, "largedigital") == 0) {
    return FACE_MODE_LARGE_DIGITAL;
  }

  return FACE_MODE_HANDS;
}

static int32_t normalise_angle(int32_t angle) {
  int32_t wrapped = angle % TRIG_MAX_ANGLE;
  if (wrapped < 0) {
    wrapped += TRIG_MAX_ANGLE;
  }
  return wrapped;
}

static int32_t hour_angle(const struct tm *now) {
  const int32_t hour12 = now->tm_hour % 12;
  const int32_t minute_progress = (int32_t)(((int64_t)now->tm_min * TRIG_MAX_ANGLE) / (12 * 60));
  return normalise_angle((int32_t)((hour12 * TRIG_MAX_ANGLE) / 12) + minute_progress);
}

static int32_t minute_angle(const struct tm *now) {
  return normalise_angle((int32_t)(((int64_t)now->tm_min * TRIG_MAX_ANGLE) / 60));
}

static int32_t opposite_split_angle(int32_t hour, int32_t minute) {
  int32_t delta = normalise_angle(minute - hour);
  if (delta > (TRIG_MAX_ANGLE / 2)) {
    delta -= TRIG_MAX_ANGLE;
  }

  const int32_t midpoint = normalise_angle(hour + (delta / 2));
  return normalise_angle(midpoint + (TRIG_MAX_ANGLE / 2));
}

static GPoint point_on_ray(GPoint centre, int32_t radius, int32_t angle) {
  return GPoint(
    centre.x + (int16_t)(sin_lookup(angle) * radius / TRIG_MAX_RATIO),
    centre.y - (int16_t)(cos_lookup(angle) * radius / TRIG_MAX_RATIO)
  );
}

static bool bounds_equal(GRect a, GRect b) {
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

static void rebuild_geometry_cache(GRect bounds) {
  s_state.cached_bounds = bounds;
  s_state.cached_centre = GPoint(bounds.size.w / 2, bounds.size.h / 2);
  s_state.cached_min_dimension = bounds.size.w < bounds.size.h ? bounds.size.w : bounds.size.h;
  const int16_t half_w = bounds.size.w / 2;
  const int16_t half_h = bounds.size.h / 2;
  const int32_t corner_distance_sq = (int32_t)(half_w * half_w) + (int32_t)(half_h * half_h);
  s_state.cached_radius = (int16_t)(isqrt16(corner_distance_sq) + 4);
  s_state.cache_ready = true;
}

static void draw_thick_line(GContext *ctx, GPoint start, GPoint end, uint8_t stroke, GColor colour) {
  graphics_context_set_stroke_color(ctx, colour);
  graphics_context_set_stroke_width(ctx, stroke);
  graphics_draw_line(ctx, start, end);
}

static void sort_rays(SectorRay *rays, size_t count) {
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
  while (edge != end_edge && count < ARRAY_LENGTH(points) - 1) {
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

  draw_thick_line(ctx, centre, hour_end, HOUR_HAND_STROKE, s_state.hand_colour);
  draw_thick_line(ctx, centre, minute_end, MINUTE_HAND_STROKE, s_state.hand_colour);
  graphics_context_set_fill_color(ctx, s_state.hand_colour);
  graphics_fill_circle(ctx, centre, 5);
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
  graphics_context_set_fill_color(ctx, s_state.hour_colour);
  graphics_fill_rect(ctx, tile, 5, GCornersAll);
  graphics_context_set_fill_color(ctx, s_state.bg_colour);
  graphics_fill_rect(ctx, grect_inset(tile, GEdgeInsets(1)), 4, GCornersAll);
  graphics_context_set_text_color(ctx, text_colour);
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

static void update_canvas(Layer *layer, GContext *ctx) {
  const GRect bounds = layer_get_bounds(layer);
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
  graphics_fill_rect(ctx, bounds, 0, GCornerNone);

  for (size_t i = 0; i < ARRAY_LENGTH(rays); i++) {
    const SectorRay current = rays[i];
    const SectorRay next = rays[(i + 1) % ARRAY_LENGTH(rays)];
    fill_sector_polygon(ctx, bounds, centre, current.angle, next.angle, current.colour);
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

  if (s_state.mode == FACE_MODE_HANDS) {
    draw_hands(ctx, centre, s_state.cached_min_dimension, hour, minute);
  }
}

static void redraw_timer_callback(void *context) {
  (void)context;
  update_now();
  if (s_state.canvas) {
    layer_mark_dirty(s_state.canvas);
  }

  const uint32_t millis_to_next_minute = (uint32_t)((60 - s_state.now.tm_sec) * 1000) + 50;
  s_redraw_timer = app_timer_register(millis_to_next_minute, redraw_timer_callback, NULL);
}

static void inbox_received_handler(DictionaryIterator *iter, void *context) {
  (void)context;

  Tuple *bg = dict_find(iter, MESSAGE_KEY_BG_COLOUR);
  Tuple *hour = dict_find(iter, MESSAGE_KEY_HOUR_COLOUR);
  Tuple *minute = dict_find(iter, MESSAGE_KEY_MINUTE_COLOUR);
  Tuple *mode = dict_find(iter, MESSAGE_KEY_FACE_MODE);
  Tuple *date = dict_find(iter, MESSAGE_KEY_SHOW_DATE_TILES);
  Tuple *hand_colour = dict_find(iter, MESSAGE_KEY_HAND_COLOUR);

  if (bg && bg->type == TUPLE_CSTRING) {
    parse_hex_colour(bg->value->cstring, s_state.bg_colour, &s_state.bg_colour);
  }

  if (hour && hour->type == TUPLE_CSTRING) {
    parse_hex_colour(hour->value->cstring, s_state.hour_colour, &s_state.hour_colour);
  }

  if (minute && minute->type == TUPLE_CSTRING) {
    parse_hex_colour(minute->value->cstring, s_state.minute_colour, &s_state.minute_colour);
  }

  if (mode && mode->type == TUPLE_CSTRING) {
    s_state.mode = parse_mode(mode->value->cstring);
    if (s_state.mode == FACE_MODE_LARGE_DIGITAL) {
      s_state.show_date_tiles = false;
    }
  }

  if (date && s_state.mode != FACE_MODE_LARGE_DIGITAL) {
    s_state.show_date_tiles = date->value->int32 == 1;
  }

  if (hand_colour && (hand_colour->type == TUPLE_INT || hand_colour->type == TUPLE_UINT)) {
    s_state.hand_colour = hand_colour->value->int32 == 1 ? GColorWhite : GColorBlack;
  }

  if (s_state.mode == FACE_MODE_LARGE_DIGITAL) {
    s_state.show_date_tiles = false;
  }

  update_now();
  if (s_state.canvas) {
    layer_mark_dirty(s_state.canvas);
  }
}

static void window_load(Window *window) {
  Layer *root = window_get_root_layer(window);
  GRect bounds = layer_get_bounds(root);

  s_state.canvas = layer_create(bounds);
  layer_set_update_proc(s_state.canvas, update_canvas);
  layer_add_child(root, s_state.canvas);
}

static void window_unload(Window *window) {
  (void)window;
  layer_destroy(s_state.canvas);
  s_state.canvas = NULL;
}

static void init_state(void) {
  update_now();

  s_state.mode = FACE_MODE_HANDS;
  s_state.show_date_tiles = false;
  s_state.bg_colour = GColorFromRGB(255, 255, 170);
  s_state.hour_colour = GColorFromRGB(85, 85, 170);
  s_state.minute_colour = GColorFromRGB(255, 85, 0);
  s_state.hand_colour = GColorBlack;
  s_state.cache_ready = false;
}

static void init(void) {
  init_state();
  s_date_font = fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD);
  s_day_font = fonts_get_system_font(FONT_KEY_GOTHIC_24_BOLD);
  s_large_digital_font = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_FONT_DIGITAL_LARGE_72));
  s_date_font_height = (int16_t)graphics_text_layout_get_content_size("8", s_date_font, GRect(0, 0, 40, 40), GTextOverflowModeWordWrap, GTextAlignmentCenter).h;
  s_day_font_height = (int16_t)graphics_text_layout_get_content_size("W", s_day_font, GRect(0, 0, 40, 40), GTextOverflowModeWordWrap, GTextAlignmentCenter).h;

  s_state.window = window_create();
  window_set_background_color(s_state.window, GColorBlack);
  window_set_window_handlers(s_state.window, (WindowHandlers){
    .load = window_load,
    .unload = window_unload
  });
  window_stack_push(s_state.window, true);

  app_message_register_inbox_received(inbox_received_handler);
  app_message_open(256, 64);
  if (s_state.canvas) {
    layer_mark_dirty(s_state.canvas);
  }
  const uint32_t millis_to_next_minute = (uint32_t)((60 - s_state.now.tm_sec) * 1000) + 50;
  s_redraw_timer = app_timer_register(millis_to_next_minute, redraw_timer_callback, NULL);
}

static void deinit(void) {
  if (s_redraw_timer) {
    app_timer_cancel(s_redraw_timer);
    s_redraw_timer = NULL;
  }
  if (s_large_digital_font) {
    fonts_unload_custom_font(s_large_digital_font);
    s_large_digital_font = NULL;
  }
  window_destroy(s_state.window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
